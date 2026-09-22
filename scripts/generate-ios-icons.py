#!/usr/bin/env python3
"""Generate iOS AppIcon assets from the user's exact 1024px JPEG on macOS.

Run from any directory: python3 scripts/generate-ios-icons.py
The full square artwork (including its original corners) is preserved. No
cropping, masking, padding, or design changes are applied. JPEG conversion
produces opaque RGB PNGs; Xcode applies the home-screen icon mask itself.
"""

import json
import struct
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/app-icon/muscle-max-original.jpg"
DESTINATION = ROOT / "ios/App/App/Assets.xcassets/AppIcon.appiconset"

# Sizes are points; scales convert each slot to its required pixel dimensions.
SLOTS = [
    ("iphone", "20x20", "2x"),
    ("iphone", "20x20", "3x"),
    ("iphone", "29x29", "2x"),
    ("iphone", "29x29", "3x"),
    ("iphone", "40x40", "2x"),
    ("iphone", "40x40", "3x"),
    ("iphone", "60x60", "2x"),
    ("iphone", "60x60", "3x"),
    ("ipad", "20x20", "1x"),
    ("ipad", "20x20", "2x"),
    ("ipad", "29x29", "1x"),
    ("ipad", "29x29", "2x"),
    ("ipad", "40x40", "1x"),
    ("ipad", "40x40", "2x"),
    ("ipad", "76x76", "1x"),
    ("ipad", "76x76", "2x"),
    ("ipad", "83.5x83.5", "2x"),
    ("ios-marketing", "1024x1024", "1x"),
]


def run_sips(*arguments: str) -> str:
    return subprocess.run(
        ["sips", *arguments], check=True, capture_output=True, text=True
    ).stdout


def main() -> None:
    source_info = run_sips("-g", "pixelWidth", "-g", "pixelHeight", str(SOURCE))
    if "pixelWidth: 1024" not in source_info or "pixelHeight: 1024" not in source_info:
        raise ValueError("The source artwork must be the original 1024×1024 JPEG.")

    DESTINATION.mkdir(parents=True, exist_ok=True)
    images = []
    generated = set()
    for idiom, size, scale in SLOTS:
        pixels = int(float(size.split("x")[0]) * int(scale.removesuffix("x")))
        # Keep the original Xcode master filename to avoid an unused asset.
        filename = "AppIcon-512@2x.png" if pixels == 1024 else f"AppIcon-{pixels}.png"
        if pixels not in generated:
            target = DESTINATION / filename
            arguments = ["-s", "format", "png"]
            if pixels != 1024:
                arguments += ["-z", str(pixels), str(pixels)]
            run_sips(*arguments, str(SOURCE), "--out", str(target))

            # PNG IHDR directly verifies the output size, bit depth and opacity.
            data = target.read_bytes()
            if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
                raise ValueError(f"Invalid PNG output: {target}")
            width, height, depth, color = struct.unpack(">IIBB", data[16:26])
            if (width, height, depth, color) != (pixels, pixels, 8, 2):
                raise ValueError(f"Expected {pixels}px opaque 8-bit RGB: {target}")
            generated.add(pixels)

        images.append({"filename": filename, "idiom": idiom, "scale": scale, "size": size})

    contents = {"images": images, "info": {"author": "xcode", "version": 1}}
    (DESTINATION / "Contents.json").write_text(json.dumps(contents, indent=2) + "\n")
    print(f"Generated and verified {len(generated)} opaque PNGs for {len(images)} iOS icon slots.")


if __name__ == "__main__":
    main()
