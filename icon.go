package main

import (
	"bytes"
	_ "embed"
	"image"
	"image/color"
	"image/png"
	"math"
)

// trayPx is the menu-bar icon's side, in pixels.
const trayPx = 44

// The lights' colours, as the page's beacon has them.
var lightColours = map[string]color.NRGBA{
	"green": {0x4c, 0xb0, 0x6a, 0xff},
	"amber": {0xe0, 0xa1, 0x3a, 0xff},
	"red":   {0xd2, 0x4a, 0x3f, 0xff},
	"grey":  {0x8a, 0x8d, 0x96, 0xff},
}

func lightColour(light string) color.NRGBA {
	if c, ok := lightColours[light]; ok {
		return c
	}
	return lightColours["grey"]
}

// trayMask is the owl as the menu-bar icon cuts it out: 176 px, white where the owl is
// (scripts/tray.sh makes it from the painting, the eyes left black).
//
//go:embed assets/tray-mask.png
var trayMaskPNG []byte

var trayMask = func() image.Image {
	img, err := png.Decode(bytes.NewReader(trayMaskPNG))
	if err != nil {
		panic(err)
	}
	if b := img.Bounds(); b.Dx() != b.Dy() || b.Dx()%trayPx != 0 {
		panic("assets/tray-mask.png must be square, a multiple of 44 px")
	}
	return img
}()

// owlCover is how much of the pixel (x, y) of an n×n icon the owl covers, 0 to 1: the
// mask's block of pixels under it, averaged.
func owlCover(x, y, n int) float64 {
	b := trayMask.Bounds()
	step := b.Dx() / n
	var sum float64
	for dy := 0; dy < step; dy++ {
		for dx := 0; dx < step; dx++ {
			r, _, _, _ := trayMask.At(b.Min.X+x*step+dx, b.Min.Y+y*step+dy).RGBA()
			sum += float64(r) / 0xffff
		}
	}
	return sum / float64(step*step)
}

// trayIcon is the menu-bar icon: the light's colour as a disc, the owl cut out of it
// (so it reads on a light and a dark menu bar), 44 px for a retina bar (the system
// scales it to the bar's height).
func trayIcon(light string) []byte {
	const n = trayPx
	img := image.NewNRGBA(image.Rect(0, 0, n, n))
	c := lightColour(light)
	for y := 0; y < n; y++ {
		for x := 0; x < n; x++ {
			fx, fy := (float64(x)+0.5)/n, (float64(y)+0.5)/n
			if math.Hypot(fx-0.5, fy-0.5) > 0.48 {
				continue
			}
			c.A = uint8(math.Round(255 * (1 - owlCover(x, y, n))))
			img.SetNRGBA(x, y, c)
		}
	}
	return encode(img)
}

// appIconPNG is the app's icon: the painted logo on macOS' icon grid, 512 px
// (scripts/icon.sh makes it from assets/logo-1024.png, and build.sh makes the .icns from the 1024 px one).
//
//go:embed assets/app-icon-512.png
var appIconPNG []byte

// appIcon is what the window's application icon (the Dock's) is.
func appIcon() []byte { return appIconPNG }

func encode(img image.Image) []byte {
	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	return buf.Bytes()
}
