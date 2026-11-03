// Watchtower: the addon family's control centre as a menu-bar app. A Wails
// window and an icon whose colour is the worst light, around the Bun server in
// server/ (the pages, the rules, the tools it reads). Read, plus harmless
// actions: nothing here publishes.
package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
)

var version = "0.2.0"

// defaultRoot is the family folder this build was made from (scripts/build.sh,
// -X main.defaultRoot=…): the server and the tools it runs live there, not in
// the bundle.
var defaultRoot = ""

func main() {
	showVersion := flag.Bool("version", false, "print the version")
	drawIcon := flag.String("draw-icon", "", "write the app's icon (512 px PNG) to this path and exit")
	flag.Parse()
	switch {
	case *showVersion:
		fmt.Println(version)
		return
	case *drawIcon != "":
		if err := os.WriteFile(*drawIcon, appIcon(512), 0o644); err != nil {
			log.Fatal(err)
		}
		return
	}
	setupLog()
	if err := runDesktop(); err != nil {
		log.Fatal(err)
	}
}

// logDir is ~/Library/Logs/Watchtower (WATCHTOWER_LOG_DIR for the tests).
func logDir() string {
	if d := os.Getenv("WATCHTOWER_LOG_DIR"); d != "" {
		return d
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, "Library", "Logs", "Watchtower")
}

// The app's own log and the server's go there, with no key in either.
func setupLog() {
	dir := logDir()
	if dir == "" || os.MkdirAll(dir, 0o700) != nil {
		return
	}
	path := filepath.Join(dir, "watchtower.log")
	if st, err := os.Stat(path); err == nil && st.Size() > 1<<20 {
		_ = os.Rename(path, path+".old")
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return
	}
	log.SetOutput(io.MultiWriter(os.Stderr, f))
}
