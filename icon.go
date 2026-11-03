package main

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"math"
)

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

// tower draws a watchtower on an n×n canvas: a tapering shaft, a wider
// lantern room on top, a doorway cut at the foot. in reports whether the point
// (in 0..1) is part of the tower.
func tower(fx, fy float64) bool {
	switch {
	case fy >= 0.2 && fy < 0.34: // the lantern room
		return fx >= 0.3 && fx <= 0.7
	case fy >= 0.34 && fy < 0.4: // the gallery
		return fx >= 0.24 && fx <= 0.76
	case fy >= 0.4 && fy <= 0.9: // the shaft
		half := 0.14 + (fy-0.4)*0.16
		if fy > 0.76 && fx >= 0.45 && fx <= 0.55 {
			return false // the doorway
		}
		return math.Abs(fx-0.5) <= half
	}
	return false
}

// trayIcon is the menu-bar icon: the light's colour as a disc, the tower
// cut out of it (so it reads on a light and a dark menu bar), 44 px for a
// retina bar (the system scales it to the bar's height).
func trayIcon(light string) []byte {
	const n = 44
	img := image.NewNRGBA(image.Rect(0, 0, n, n))
	c := lightColour(light)
	for y := 0; y < n; y++ {
		for x := 0; x < n; x++ {
			fx, fy := (float64(x)+0.5)/n, (float64(y)+0.5)/n
			if math.Hypot(fx-0.5, fy-0.5) > 0.48 {
				continue
			}
			if tower(fx, fy) {
				continue
			}
			img.SetNRGBA(x, y, c)
		}
	}
	return encode(img)
}

// appIcon is the app's icon: the tower on a dark rounded square with a lit
// lantern, n px.
func appIcon(n int) []byte {
	img := image.NewNRGBA(image.Rect(0, 0, n, n))
	bg := color.NRGBA{0x14, 0x16, 0x1c, 0xff}
	stone := color.NRGBA{0xc9, 0xc2, 0xb0, 0xff}
	lamp := lightColour("amber")
	for y := 0; y < n; y++ {
		for x := 0; x < n; x++ {
			fx, fy := (float64(x)+0.5)/float64(n), (float64(y)+0.5)/float64(n)
			// (a rounded square, macOS' icon grid leaves a margin of about 10%)
			qx, qy := math.Abs(fx-0.5)-0.34, math.Abs(fy-0.5)-0.34
			if math.Hypot(math.Max(qx, 0), math.Max(qy, 0)) > 0.12 {
				continue
			}
			c := bg
			if tower(fx, fy) {
				c = stone
				if fy >= 0.23 && fy < 0.31 && fx >= 0.36 && fx <= 0.64 {
					c = lamp
				}
			}
			img.SetNRGBA(x, y, c)
		}
	}
	return encode(img)
}

func encode(img image.Image) []byte {
	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	return buf.Bytes()
}
