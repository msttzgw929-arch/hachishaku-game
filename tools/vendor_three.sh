#!/bin/sh
# three.js を vendor/three.min.js にビルドする（開発時のみ。実行時はCDN不要）
set -e
D=$(mktemp -d); cp "$(dirname "$0")/three_entry.js" "$D/entry.js"; cd "$D"
npm init -y >/dev/null; npm i three@0.169.0 esbuild >/dev/null
OUT="$OLDPWD/$(dirname "$0")/../vendor/three.min.js"
echo "/*! three.js r169 (subset, IIFE build for 八尺様から逃げろ！) | MIT License | Copyright © 2010-2024 three.js authors | https://github.com/mrdoob/three.js */" > "$OUT"
npx esbuild entry.js --bundle --minify --format=iife --global-name=THREE --legal-comments=none >> "$OUT"
