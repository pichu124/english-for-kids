#!/bin/bash
# Cập nhật Bix English trên VPS. Chạy bằng người dùng `casa`.
# Chép ra ngoài kho mã một lần rồi chạy bản chép (git pull sửa tệp đang chạy thì bash đọc hỏng):
#   cp /opt/bix-english/scripts/cap-nhat-vps.sh ~/cap-nhat-bix.sh && chmod +x ~/cap-nhat-bix.sh
#   ~/cap-nhat-bix.sh
# Bước nào lỗi là dừng ngay; trang đang chạy chỉ bị thay ở bước rsync cuối cùng.
set -euo pipefail

TEN_MIEN="${TEN_MIEN:-bix-english.duckdns.org}"
MA=/opt/bix-english
WEB=/var/www/bix-english

cd "$MA"
echo "Bản đang chạy: $(git log --oneline -1)"
git pull --ff-only origin main
npm ci --no-audit --no-fund
npm test
npm run build
rsync -a --delete dist/ "$WEB/"
echo "Bản mới: $(git log --oneline -1)"
sleep 1
curl -sI "https://$TEN_MIEN/" | head -1
curl -s "https://$TEN_MIEN/sw.js" | grep "const CACHE"
