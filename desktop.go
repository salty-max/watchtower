package main

import (
	"bytes"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync/atomic"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

// The window's pages (frontend/, built by Vite into frontend/dist). A checkout
// without a build still compiles: dist holds a placeholder (.gitkeep).
//
//go:embed all:frontend/dist
var frontendFS embed.FS

// summary is what the icon and the menu need of the server's /api/state.
type summary struct {
	Overall string `json:"overall"`
	Quiet   bool   `json:"quiet"`
	Pages   []struct {
		Label string `json:"label"`
		Light string `json:"light"`
	} `json:"pages"`
}

var lightWords = map[string]string{"green": "everything in order", "amber": "something to look at", "red": "something in the way", "grey": "not read yet"}

func (s summary) line() string {
	if s.Overall == "" {
		return "Reading…"
	}
	return "Watchtower: " + lightWords[s.Overall]
}

// fetchSummary asks the server with the key, as the window does through the proxy.
func fetchSummary(port int, key string) (summary, error) {
	var s summary
	req, _ := http.NewRequest("GET", fmt.Sprintf("http://127.0.0.1:%d/api/state", port), nil)
	req.Header.Set("x-watchtower-key", key)
	res, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return s, err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return s, fmt.Errorf("state: HTTP %d", res.StatusCode)
	}
	return s, json.NewDecoder(res.Body).Decode(&s)
}

func post(port int, key, path string, body string) {
	req, _ := http.NewRequest("POST", fmt.Sprintf("http://127.0.0.1:%d%s", port, path), bytes.NewBufferString(body))
	req.Header.Set("x-watchtower-key", key)
	req.Header.Set("content-type", "application/json")
	if res, err := (&http.Client{Timeout: 5 * time.Minute}).Do(req); err == nil {
		io.Copy(io.Discard, res.Body)
		res.Body.Close()
	}
}

// runDesktop runs the window and the menu-bar icon until Quit. Closing the
// window only hides it: the server keeps reading from the icon.
func runDesktop() error {
	var win *application.WebviewWindow
	show := func() {
		if win == nil {
			return
		}
		setDockVisible(true)
		win.Show()
		win.Focus()
	}
	hide := func() {
		if win == nil {
			return
		}
		win.Hide()
		setDockVisible(false)
	}

	var c *child
	// (the pages come from the server through the proxy, which needs the
	// server's port: the window's handler is filled in once it is up)
	var proxy atomic.Pointer[http.Handler]
	serve := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if h := proxy.Load(); h != nil {
			(*h).ServeHTTP(w, r)
			return
		}
		http.Error(w, "starting", http.StatusServiceUnavailable)
	})
	// Opened again while running: the running one shows its window. A second
	// instance exits inside New, before it starts a server of its own.
	app := application.New(application.Options{
		Name:        "Watchtower",
		Description: "The addon family's control centre",
		Icon:        appIcon(512),
		Assets:      application.AssetOptions{Handler: serve},
		Mac:         application.MacOptions{ActivationPolicy: application.ActivationPolicyAccessory},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID:               "app.watchtower",
			OnSecondInstanceLaunch: func(application.SecondInstanceData) { show() },
		},
		OnShutdown: func() {
			if c != nil {
				c.stop()
			}
		},
	})

	root, err := familyRoot()
	if err != nil {
		return err
	}
	c, err = newChild(root, loginPath(os.Getenv("PATH")))
	if err != nil {
		return err
	}
	logw, err := os.OpenFile(filepath.Join(logDir(), "server.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		logw = os.Stderr
	}
	script := filepath.Join(root, "watchtower", "server", "control.ts")
	go c.supervise(script, logw)
	if err := c.wait(20 * time.Second); err != nil {
		log.Print(err) // (the window still opens: it says the server is not answering)
	}
	dist, err := fs.Sub(frontendFS, "frontend/dist")
	if err != nil {
		return err
	}
	sh := &shell{port: c.port, key: c.key, run: runCommand}
	h := sh.handler(dist)
	proxy.Store(&h)

	win = app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:             "main",
		Title:            "Watchtower",
		Width:            1180,
		Height:           800,
		MinWidth:         860,
		MinHeight:        560,
		Hidden:           true,
		BackgroundColour: application.NewRGB(14, 16, 22),
		URL:              "/",
		// (as Ravenpost: the traffic lights sit over the sidebar)
		Mac: application.MacWindow{
			TitleBar:                application.MacTitleBarHiddenInset,
			InvisibleTitleBarHeight: 52,
		},
	})
	win.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		e.Cancel()
		hide()
	})

	tray := app.SystemTray.New()
	menu := app.NewMenu()
	status := menu.Add("Reading…").SetEnabled(false)
	menu.AddSeparator()
	menu.Add("Open Watchtower").OnClick(func(*application.Context) { show() })
	menu.Add("Refresh all").OnClick(func(*application.Context) {
		go post(c.port, c.key, "/api/refresh", `{"source":"all"}`)
	})
	menu.AddSeparator()
	menu.Add("Quit Watchtower").OnClick(func(*application.Context) { app.Quit() })
	tray.SetMenu(menu)
	tray.SetTooltip("Watchtower")
	tray.SetIcon(trayIcon("grey"))

	app.Event.OnApplicationEvent(events.Common.ApplicationStarted, func(*application.ApplicationEvent) { show() })
	app.Event.OnApplicationEvent(events.Mac.ApplicationShouldHandleReopen, func(*application.ApplicationEvent) { show() })

	// The icon is the worst light, read again every half minute.
	go func() {
		last := ""
		for {
			s, err := fetchSummary(c.port, c.key)
			if err != nil {
				s = summary{}
			}
			light := s.Overall
			if light == "" {
				light = "grey"
			}
			line := s.line()
			if line != last {
				last = line
				tray.SetIcon(trayIcon(light))
				status.SetLabel(line)
				menu.Update()
				tray.SetTooltip(line)
			}
			time.Sleep(30 * time.Second)
		}
	}()

	log.Printf("Watchtower %s: window and menu-bar icon, server on 127.0.0.1:%d", version, c.port)
	return app.Run()
}
