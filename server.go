package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// The Bun server as a child of the app. It listens on 127.0.0.1 on a port the
// shell chose, with a key the shell made: both go in by environment (never
// argv, which any process can list), the key stays in this process and is added
// to every call the window makes (proxy.go), and the child's stdin is a pipe
// the shell holds: when the shell goes, however it goes, the server reads EOF
// and stops (server/control.ts).

type child struct {
	root string
	bun  string
	path string
	key  string
	port int

	mu     sync.Mutex
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	exited chan struct{}
	closed bool
}

// familyRoot: WOW_ADDONS_ROOT, else the folder this build was made from, else
// ~/code/wow-addons. It must hold watchtower/server/control.ts.
func familyRoot() (string, error) {
	home, _ := os.UserHomeDir()
	for _, c := range []string{os.Getenv("WOW_ADDONS_ROOT"), defaultRoot, filepath.Join(home, "code", "wow-addons")} {
		if c == "" {
			continue
		}
		if _, err := os.Stat(filepath.Join(c, "watchtower", "server", "control.ts")); err == nil {
			return c, nil
		}
	}
	return "", errors.New("the family folder (with watchtower/server/control.ts) was not found: set WOW_ADDONS_ROOT")
}

// loginPath: an app started at login has launchd's bare PATH, with no bun, gh
// or git. The login shell's PATH is asked once, with a timeout, and the usual
// folders are added behind it (docs/probe.md).
func loginPath(current string) string {
	parts := []string{}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if out, err := exec.CommandContext(ctx, "/bin/zsh", "-lic", `printf %s "$PATH"`).Output(); err == nil {
		// (an interactive shell may print a banner first: the PATH is the last line)
		lines := strings.Split(strings.TrimSpace(string(out)), "\n")
		parts = append(parts, strings.Split(lines[len(lines)-1], ":")...)
	}
	home, _ := os.UserHomeDir()
	parts = append(parts, strings.Split(current, ":")...)
	parts = append(parts, "/opt/homebrew/bin", "/usr/local/bin", filepath.Join(home, ".bun", "bin"), filepath.Join(home, ".volta", "bin"), "/usr/bin", "/bin")
	return dedupe(parts)
}

func dedupe(parts []string) string {
	seen := map[string]bool{}
	out := []string{}
	for _, p := range parts {
		if p != "" && !seen[p] {
			seen[p] = true
			out = append(out, p)
		}
	}
	return strings.Join(out, ":")
}

func newKey() (string, error) {
	b := make([]byte, 18)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func freePort() (int, error) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port, nil
}

// newChild resolves everything but starts nothing. script is the server's entry
// (control.ts, or a fake in the tests).
func newChild(root, path string) (*child, error) {
	key, err := newKey()
	if err != nil {
		return nil, err
	}
	port, err := freePort()
	if err != nil {
		return nil, err
	}
	return &child{root: root, path: path, key: key, port: port}, nil
}

// argv is what the process list shows: no key, no port.
func (c *child) argv(script string) []string { return []string{c.bun, script} }

func (c *child) env() []string {
	env := []string{}
	for _, e := range os.Environ() {
		if !strings.HasPrefix(e, "PATH=") && !strings.HasPrefix(e, "WATCHTOWER_") {
			env = append(env, e)
		}
	}
	return append(env, "PATH="+c.path, "NO_COLOR=1", "WATCHTOWER_SHELL=1", fmt.Sprintf("WATCHTOWER_PORT=%d", c.port), "WATCHTOWER_KEY="+c.key)
}

func (c *child) start(script string, logw io.Writer) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return errors.New("closed")
	}
	if c.bun == "" {
		old := os.Getenv("PATH")
		os.Setenv("PATH", c.path)
		bun, err := exec.LookPath("bun")
		os.Setenv("PATH", old)
		if err != nil {
			return fmt.Errorf("bun not found on the login PATH: %w", err)
		}
		c.bun = bun
	}
	argv := c.argv(script)
	cmd := exec.Command(argv[0], argv[1:]...)
	cmd.Dir = c.root
	cmd.Env = c.env()
	cmd.Stdout, cmd.Stderr = logw, logw
	in, err := cmd.StdinPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	c.cmd, c.stdin, c.exited = cmd, in, make(chan struct{})
	return nil
}

// wait blocks until the server answers on its port, or gives up.
func (c *child) wait(d time.Duration) error {
	deadline := time.Now().Add(d)
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", c.port), 300*time.Millisecond)
		if err == nil {
			conn.Close()
			return nil
		}
		time.Sleep(150 * time.Millisecond)
	}
	return fmt.Errorf("the server did not answer on port %d", c.port)
}

// supervise keeps the server up: when it exits on its own it is started again
// after a pause that grows, until stop.
func (c *child) supervise(script string, logw io.Writer) {
	pause := time.Second
	for {
		started := time.Now()
		if err := c.start(script, logw); err != nil {
			log.Printf("server: %v", err)
		} else {
			c.mu.Lock()
			cmd, exited := c.cmd, c.exited
			c.mu.Unlock()
			err := cmd.Wait()
			close(exited)
			log.Printf("server exited: %v", err)
		}
		c.mu.Lock()
		closed := c.closed
		c.mu.Unlock()
		if closed {
			return
		}
		if time.Since(started) > time.Minute {
			pause = time.Second
		}
		time.Sleep(pause)
		if pause < time.Minute {
			pause *= 2
		}
	}
}

// stop closes the server's stdin (it exits), and kills it if it hasn't a
// moment later.
func (c *child) stop() {
	c.mu.Lock()
	c.closed = true
	cmd, in, exited := c.cmd, c.stdin, c.exited
	c.mu.Unlock()
	if in != nil {
		in.Close()
	}
	if cmd == nil || exited == nil {
		return
	}
	select {
	case <-exited:
	case <-time.After(2 * time.Second):
		_ = cmd.Process.Kill()
	}
}
