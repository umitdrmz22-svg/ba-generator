
#!/usr/bin/env bash
set -e

# 1) Hedef klasör
mkdir -p assets/lib

# 2) Birincil kaynak: jsDelivr (docx 8.5.0, UMD derleme)
curl -L "https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js" -o assets/lib/docx.min.js \
|| curl -L "https://unpkg.com/docx@8.5.0/build/index.umd.js" -o assets/lib/docx.min.js

# 3) Son kontrol
test -s assets/lib/docx.min.js || { echo "docx indirilemedi."; exit 1; }
echo "OK - assets/lib/docx.min.js hazır."
``
