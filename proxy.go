package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os/exec"
	"strings"
)

// What the window loads comes through this handler (Wails' asset handler: only
// the window reaches it, it is no network port): the pages from the embedded
// frontend/dist, /api/* from the Bun server with the key added, /shell/* from
// here. The key is held by this process and added to every call to the server
// (with the Host it checks, the Origin dropped), so no page ever holds it and
// nothing but this window can use it.

type shell struct {
	port int
	key  string
	// run starts a process: replaced in the tests.
	run func(name string, args ...string) error
}

func (s *shell) handler(pages fs.FS) http.Handler {
	target := &url.URL{Scheme: "http", Host: fmt.Sprintf("127.0.0.1:%d", s.port)}
	rp := httputil.NewSingleHostReverseProxy(target)
	director := rp.Director
	rp.Director = func(r *http.Request) {
		director(r)
		r.Host = target.Host
		r.Header.Del("Origin") // (checked first, in the handler below)
		r.Header.Set("x-watchtower-key", s.key)
	}
	rp.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		http.Error(w, "the server is not answering", http.StatusBadGateway)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/shell/info", func(w http.ResponseWriter, r *http.Request) {
		reply(w, 200, map[string]any{"shell": true})
	})
	mux.HandleFunc("/shell/open", func(w http.ResponseWriter, r *http.Request) {
		var b struct{ URL string }
		_ = json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&b)
		// (a link the pages draw: https only, nothing local, nothing else)
		u, err := url.Parse(b.URL)
		if r.Method != http.MethodPost || err != nil || u.Scheme != "https" || u.Host == "" {
			reply(w, 400, map[string]any{"error": "not a link to open"})
			return
		}
		if err := s.run("/usr/bin/open", u.String()); err != nil {
			reply(w, 400, map[string]any{"error": err.Error()})
			return
		}
		reply(w, 200, map[string]any{"ok": true})
	})
	static := http.FileServerFS(pages)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasPrefix(r.URL.Path, "/shell/"):
			mux.ServeHTTP(w, r)
		case strings.HasPrefix(r.URL.Path, "/api/"):
			// (the server's second lock is the Origin: only the window's own gets the key)
			if !windowOrigin(r.Header.Get("Origin")) {
				http.Error(w, "not here", http.StatusForbidden)
				return
			}
			// (the webview gives the body with no length, and ReverseProxy drops a body
			// whose length is 0: read it here, the page's POSTs are small)
			if r.Body != nil && r.Body != http.NoBody && r.ContentLength <= 0 {
				b, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
				if err != nil {
					http.Error(w, "too much", http.StatusRequestEntityTooLarge)
					return
				}
				r.Body, r.ContentLength = io.NopCloser(bytes.NewReader(b)), int64(len(b))
			}
			rp.ServeHTTP(w, r)
		default:
			w.Header().Set("cache-control", "no-store")
			static.ServeHTTP(w, r)
		}
	})
}

// windowOrigin: no Origin (a plain GET from the window) or the window's own
// (wails.localhost, in whichever scheme the platform's webview uses).
func windowOrigin(origin string) bool {
	if origin == "" {
		return true
	}
	u, err := url.Parse(origin)
	return err == nil && u.Hostname() == "wails.localhost"
}

func reply(w http.ResponseWriter, status int, v any) {
	w.Header().Set("content-type", "application/json")
	w.Header().Set("cache-control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func runCommand(name string, args ...string) error {
	return exec.Command(name, args...).Run()
}
