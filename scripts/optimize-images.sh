#!/bin/bash
# Image Optimization Script
# Converts PNG images to WebP format for better performance

echo "Converting placeholder images to WebP..."

cd "$(dirname "$0")/../public/placeholders" || exit

for f in *.png; do
  if [ -f "$f" ]; then
    output="${f%.png}.webp"

    # Try different tools in order of preference
    if command -v cwebp &> /dev/null; then
      echo "Converting $f with cwebp..."
      cwebp -q 85 "$f" -o "$output"
    elif command -v magick &> /dev/null; then
      echo "Converting $f with ImageMagick..."
      magick "$f" -quality 85 "$output"
    elif command -v convert &> /dev/null; then
      echo "Converting $f with ImageMagick convert..."
      convert "$f" -quality 85 "$output"
    else
      echo "Error: No image converter found. Please install one of:"
      echo "  - cwebp (from libwebp)"
      echo "  - ImageMagick"
      exit 1
    fi

    # Show size comparison
    if [ -f "$output" ]; then
      original_size=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null)
      new_size=$(stat -f%z "$output" 2>/dev/null || stat -c%s "$output" 2>/dev/null)
      reduction=$((100 - (new_size * 100 / original_size)))
      echo "  Original: $(numfmt --to=iec-i --suffix=B $original_size)"
      echo "  WebP:     $(numfmt --to=iec-i --suffix=B $new_size)"
      echo "  Saved:    ${reduction}%"
      echo ""
    fi
  fi
done

echo "Conversion complete!"
echo ""
echo "To install conversion tools:"
echo "  macOS:  brew install webp imagemagick"
echo "  Ubuntu: apt-get install webp imagemagick"
