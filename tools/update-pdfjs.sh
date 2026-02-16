#!/bin/bash
# Script to vendor Mozilla's pdf.js into the extension
# Based on Hypothesis browser extension pattern

set -e

# Configuration
PDFJS_VERSION="${1:-latest}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PUBLIC_DIR="$PROJECT_ROOT/public"
PDFJS_DIR="$PUBLIC_DIR/pdfjs"
TMP_DIR=$(mktemp -d)

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "==> Downloading pdf.js ${PDFJS_VERSION}..."

# Get the download URL for the release
if [ "$PDFJS_VERSION" = "latest" ]; then
  # Get latest version tag from mozilla/pdf.js
  LATEST_TAG=$(curl -s "https://api.github.com/repos/mozilla/pdf.js/releases/latest" | grep '"tag_name"' | cut -d '"' -f 4)
  VERSION_NUM="${LATEST_TAG#v}"
  DOWNLOAD_URL="https://github.com/mozilla/pdf.js/releases/download/${LATEST_TAG}/pdfjs-${VERSION_NUM}-dist.zip"
  echo "   Latest version: $LATEST_TAG"
else
  DOWNLOAD_URL="https://github.com/mozilla/pdf.js/releases/download/v${PDFJS_VERSION}/pdfjs-${PDFJS_VERSION}-dist.zip"
fi

echo "   Download URL: $DOWNLOAD_URL"

# Download and extract
curl -L -o "$TMP_DIR/pdfjs.zip" "$DOWNLOAD_URL"
unzip -q "$TMP_DIR/pdfjs.zip" -d "$TMP_DIR/pdfjs"

echo "==> Setting up public/pdfjs directory..."

# Remove old pdfjs directory and create fresh
rm -rf "$PDFJS_DIR"
mkdir -p "$PDFJS_DIR"

# Copy build and web directories
cp -r "$TMP_DIR/pdfjs/build" "$PDFJS_DIR/"
cp -r "$TMP_DIR/pdfjs/web" "$PDFJS_DIR/"


echo "==> Cleaning up unnecessary files..."

# Remove source maps
find "$PDFJS_DIR" -name "*.map" -delete

# Remove example/test PDFs
find "$PDFJS_DIR" -name "*.pdf" -delete

# Remove compressed.tracemonkey-pldi-09.pdf reference file if present
rm -f "$PDFJS_DIR/web/compressed.tracemonkey-pldi-09.pdf"

echo "==> Patching viewer.mjs to disable origin checking..."

VIEWER_MJS="$PDFJS_DIR/web/viewer.mjs"
if [ -f "$VIEWER_MJS" ]; then
  # Patch validateFileURL to always return early
  # This disables the same-origin restriction for loading PDFs
  # The function is defined as: var validateFileURL = function (file) { ... }
  perl -i -p0e 's/(var validateFileURL = function \(file\) \{)[^}]+\};/$1\n    \/\/ PATCHED: Origin check disabled for browser extension use\n    return;\n  };/s' "$VIEWER_MJS"
  echo "   Patched viewer.mjs"
else
  echo "   Warning: viewer.mjs not found at expected location"
fi

echo "==> Injecting pdfjs-init.js into viewer.html..."

VIEWER_HTML="$PDFJS_DIR/web/viewer.html"
if [ -f "$VIEWER_HTML" ]; then
  # Inject pdfjs-init.js before </head> - it dynamically loads other scripts
  sed -i.bak 's|</head>|<script src="/pdfjs-init.js"></script>\n</head>|' "$VIEWER_HTML"
  rm -f "$VIEWER_HTML.bak"
  echo "   Injected pdfjs-init.js"
else
  echo "   Warning: viewer.html not found at expected location"
fi

echo "==> Done!"
echo "   pdf.js vendored to: $PDFJS_DIR"
echo ""
echo "Next steps:"
echo "  1. Create public/pdfjs-init.js for extension communication"
echo "  2. Build the extension with 'npm run dev' or 'npm run build'"
