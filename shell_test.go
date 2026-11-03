package main

import (
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"testing/fstest"
	"time"
)

var testPages = fstest.MapFS{"index.html": {Data: []byte("<html>the pages</html>")}}

func TestPagesComeFromTheBundleAndNeverFromTheServer(t *testing.T) {
	asked := false
	back := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { asked = true }))
	defer back.Close()
	s := &shell{port: portOf(back), key: "KEY", run: func(string, ...string) error { return nil }}
	front := httptest.NewServer(s.handler(testPages))
	defer front.Close()
	res, err := http.Get(front.URL + "/")
	if err != nil {
		t.Fatal(err)
	}
	b, _ := io.ReadAll(res.Body)
	if !strings.Contains(string(b), "the pages") || asked {
		t.Fatalf("page %q, server asked %v", b, asked)
	}
}

func portOf(s *httptest.Server) int {
	_, p, _ := net.SplitHostPort(s.Listener.Addr().String())
	n, _ := strconv.Atoi(p)
	return n
}

func TestProxyAddsTheKeyAndHost(t *testing.T) {
	var got http.Header
	var host string
	back := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { got, host = r.Header, r.Host; io.WriteString(w, "ok") }))
	defer back.Close()
	p := portOf(back)
	s := &shell{port: p, key: "KEY", run: func(string, ...string) error { return nil }}
	front := httptest.NewServer(s.handler(testPages))
	defer front.Close()
	req, _ := http.NewRequest("POST", front.URL+"/api/refresh", nil)
	req.Header.Set("Origin", "wails://wails.localhost")
	req.Header.Set("x-watchtower-key", "the page's own")
	res, err := http.DefaultClient.Do(req)
	if err != nil || res.StatusCode != 200 {
		t.Fatalf("proxy: %v %v", err, res)
	}
	if got.Get("x-watchtower-key") != "KEY" || got.Get("Origin") != "" || host != back.Listener.Addr().String() {
		t.Fatalf("key %q origin %q host %q", got.Get("x-watchtower-key"), got.Get("Origin"), host)
	}
}

func TestOnlyHTTPSLinksOpen(t *testing.T) {
	var ran int
	s := &shell{port: 1, key: "K", run: func(string, ...string) error { ran++; return nil }}
	front := httptest.NewServer(s.handler(testPages))
	defer front.Close()
	open := func(u string) int {
		res, _ := http.Post(front.URL+"/shell/open", "application/json", strings.NewReader(`{"url":"`+u+`"}`))
		return res.StatusCode
	}
	for _, bad := range []string{"file:///etc/passwd", "http://x.example/", "javascript:alert(1)", "", "/relative"} {
		if open(bad) != 400 {
			t.Fatalf("%q opened", bad)
		}
	}
	if open("https://github.com/salty-max/yonder/pull/1") != 200 || ran != 1 {
		t.Fatal("an https link should open")
	}
}

func TestABodyWithNoLengthStillReachesTheServer(t *testing.T) {
	var got string
	back := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { b, _ := io.ReadAll(r.Body); got = string(b) }))
	defer back.Close()
	s := &shell{port: portOf(back), key: "KEY", run: func(string, ...string) error { return nil }}
	// (as the webview's scheme handler hands it: a body, a length of 0)
	req := httptest.NewRequest("POST", "/api/change", io.NopCloser(strings.NewReader(`{"op":"tick"}`)))
	req.ContentLength = 0
	req.Header.Set("Origin", "wails://wails.localhost")
	s.handler(testPages).ServeHTTP(httptest.NewRecorder(), req)
	if got != `{"op":"tick"}` {
		t.Fatalf("the server got %q", got)
	}
}

func TestAForeignOriginNeverGetsTheKey(t *testing.T) {
	asked := false
	back := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { asked = true }))
	defer back.Close()
	s := &shell{port: portOf(back), key: "KEY", run: func(string, ...string) error { return nil }}
	front := httptest.NewServer(s.handler(testPages))
	defer front.Close()
	for _, origin := range []string{"https://evil.example", "http://127.0.0.1:9", "null", "wails://wails.localhost.evil.example"} {
		req, _ := http.NewRequest("POST", front.URL+"/api/action", nil)
		req.Header.Set("Origin", origin)
		res, err := http.DefaultClient.Do(req)
		if err != nil || res.StatusCode != 403 || asked {
			t.Fatalf("%q: %v %v asked %v", origin, err, res, asked)
		}
	}
}

func TestLightColours(t *testing.T) {
	if lightColour("red") == lightColour("green") || lightColour("nonsense") != lightColour("grey") {
		t.Fatal("colours")
	}
	for _, l := range []string{"green", "amber", "red", "grey"} {
		if len(trayIcon(l)) == 0 {
			t.Fatal(l)
		}
	}
	if (summary{}).line() != "Reading…" || (summary{Overall: "red"}).line() != "Watchtower: something in the way" {
		t.Fatal("line")
	}
}

// A fake server: a script that records its argv and environment, then reads
// stdin until EOF, as control.ts does.
func fakeServer(t *testing.T) (script, out string) {
	dir := t.TempDir()
	out = filepath.Join(dir, "seen")
	script = filepath.Join(dir, "fake.sh")
	body := "#!/bin/sh\necho \"argv: $0 $@\" > " + out + "\nenv >> " + out + "\ncat > /dev/null\n"
	if err := os.WriteFile(script, []byte(body), 0o755); err != nil {
		t.Fatal(err)
	}
	return
}

func TestTheKeyReachesTheChildByEnvironmentAndNeverArgv(t *testing.T) {
	script, out := fakeServer(t)
	c, err := newChild(t.TempDir(), "/usr/bin:/bin")
	if err != nil {
		t.Fatal(err)
	}
	c.bun = "/bin/sh"
	if err := c.start(script, io.Discard); err != nil {
		t.Fatal(err)
	}
	var seen []byte
	for i := 0; i < 40 && !strings.Contains(string(seen), "WATCHTOWER_KEY="); i++ {
		time.Sleep(100 * time.Millisecond)
		seen, _ = os.ReadFile(out)
	}
	text := string(seen)
	argv := strings.SplitN(text, "\n", 2)[0]
	if strings.Contains(argv, c.key) || strings.Contains(strings.Join(c.argv(script), " "), c.key) {
		t.Fatal("the key is in argv")
	}
	if !strings.Contains(text, "WATCHTOWER_KEY="+c.key) || !strings.Contains(text, "WATCHTOWER_SHELL=1") || !strings.Contains(text, "PATH=/usr/bin:/bin\n") {
		t.Fatalf("environment: %s", text)
	}
	c.stop()
}

func TestStoppingClosesTheChildsStdin(t *testing.T) {
	script, _ := fakeServer(t)
	c, _ := newChild(t.TempDir(), "/usr/bin:/bin")
	c.bun = "/bin/sh"
	if err := c.start(script, io.Discard); err != nil {
		t.Fatal(err)
	}
	exited := make(chan error, 1)
	cmd := c.cmd
	go func() { exited <- cmd.Wait(); close(c.exited) }()
	c.stop()
	select {
	case <-exited:
	case <-time.After(3 * time.Second):
		t.Fatal("the child outlived its stdin")
	}
	if cmd.ProcessState == nil || !cmd.ProcessState.Success() {
		t.Fatal("it should leave on EOF, not be killed")
	}
}

func TestLoginPathKeepsTheCurrentOne(t *testing.T) {
	p := loginPath("/somewhere/odd:/usr/bin")
	seen := map[string]int{}
	for _, d := range strings.Split(p, ":") {
		seen[d]++
	}
	if seen["/somewhere/odd"] != 1 || seen["/usr/bin"] != 1 {
		t.Fatalf("path %s", p)
	}
}
