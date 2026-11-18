# Cài Bix English lên VPS InterData

Máy: VPS InterData đặt tại Việt Nam, IP `103.195.238.114`, Ubuntu 24.04, Node 22, giờ máy +07, người dùng `casa`. Trên máy đã có hai app: CASA Mầm non (`casa-school.duckdns.org`) và Chăm sóc lead (`casa-lead.duckdns.org`). Caddy lo HTTPS cho cả hai. Thông tin máy lấy từ `pichu124/casa-mamnon` (`docs/MAY-CHU-THU-INTERDATA.md`) và `pichu124/pichu124-casa-lead` (`docs/TRIEN-KHAI.md`).

Bix English chạy **bên cạnh**, không đụng gì của hai app kia:

| | CASA Mầm non | Chăm sóc lead | Bix English (mới) |
|---|---|---|---|
| Mã | `/opt/casa-mamnon` | `/opt/casa-lead` | `/opt/bix-english` |
| Phục vụ | dịch vụ `casa-mamnon`, cổng 3000 | dịch vụ `casa-lead`, cổng 8100 | **không có dịch vụ, không mở cổng**: Caddy trả thẳng tệp tĩnh trong `/var/www/bix-english` |
| Dữ liệu trên máy chủ | `/var/lib/casa-mamnon` | `/var/lib/casa-lead` | **không có**: tiến độ của bé nằm trên tablet |
| Sao lưu, cron | có | có | **không cần** |
| Tên miền | `casa-school.duckdns.org` | `casa-lead.duckdns.org` | `bix-english.duckdns.org` (tạm, miễn phí) |
| Tệp Caddy | | `/etc/caddy/sites/casa-lead.caddy` | `/etc/caddy/sites/bix-english.caddy` |

Chỗ chung duy nhất là Caddy. Tệp `/etc/caddy/Caddyfile` đã có dòng `import /etc/caddy/sites/*.caddy`, nên app này dùng **tệp riêng**. Không sửa tệp chính, không đụng tệp của app khác.

**Cách làm:** đăng nhập bằng `ssh casa@103.195.238.114`, rồi **dán từng dòng một**. Chờ dấu nhắc hiện lại rồi mới dán dòng tiếp: dán cả khối một lúc dễ hỏng mà không báo lỗi.

> **Lưu ý:** tài liệu của casa-mamnon ghi máy này sẽ chuyển sang **đứng tên trường** và sắp chứa dữ liệu thật của trẻ. Bix English là trang tĩnh, không chạy dịch vụ, không mở cổng mới, không giữ dữ liệu, nên gần như không thêm rủi ro cho hai app kia. Nhưng khi máy chính thức thuộc về trường, nên chuyển Bix English sang chỗ khác (Vercel hoặc VPS riêng). Gỡ ra mất 1 phút, xem mục cuối.

## 0. Chuẩn bị (không cần vào VPS)

1. **Đưa mã vào `main`.** Máy chủ chỉ lấy nhánh `main`, giống luật của hai app kia. Việc làm xong được gộp từ nhánh làm việc vào `main` bằng pull request.
2. **Tên miền tạm:** vào https://www.duckdns.org bằng tài khoản đã tạo `casa-school`, thêm tên `bix-english`. Ô "current ip" điền `103.195.238.114`, bấm **update ip**.
   Nếu tên `bix-english` đã có người lấy, chọn tên khác, rồi thay ở ba chỗ: tệp Caddy (mục 3), các lệnh `curl` bên dưới, và biến `TEN_MIEN` trong `scripts/cap-nhat-vps.sh`.

## 1. Lấy mã và build

```bash
node --version
```

Phải in `v22.12` trở lên (Vite 8 cần Node 20.19+ hoặc 22.12+). Máy đã có Node 22 từ khi cài casa-mamnon.

```bash
rsync --version          # máy InterData đã có sẵn (3.2.7); chỉ khi báo không có lệnh mới cài: sudo apt-get install -y rsync
sudo mkdir -p /opt/bix-english /var/www/bix-english
sudo chown casa:casa /opt/bix-english /var/www/bix-english
git clone -b main https://github.com/pichu124/english-for-kids.git /opt/bix-english
cd /opt/bix-english
npm ci --no-audit --no-fund
npm test
npm run build
rsync -a --delete dist/ /var/www/bix-english/
ls /var/www/bix-english
```

Dòng cuối phải thấy `index.html`, `sw.js`, `manifest.webmanifest`, `assets`, `icons`.

Kho mã đang **công khai** nên clone bằng HTTPS là đủ. Nếu sau này chuyển kho sang riêng tư, làm khoá chỉ đọc (deploy key) giống mục 1 của `docs/TRIEN-KHAI.md` bên casa-lead.

Vì sao build ra `dist/` rồi mới chép sang `/var/www/bix-english`: lúc build, Vite xoá sạch `dist/` trước. Nếu Caddy phục vụ thẳng `dist/` thì trong lúc build trang bị trống, và build lỗi giữa chừng là trang hỏng. Chép sau cùng thì build lỗi vẫn giữ bản cũ.

## 2. Kiểm tên miền

```bash
getent hosts bix-english.duckdns.org
```

Phải in `103.195.238.114  bix-english.duckdns.org`. Chưa ra thì chờ vài phút sau khi bấm update ip trên duckdns.

## 3. HTTPS qua Caddy

Tạo tệp riêng cho app bằng `nano`:

```bash
sudo nano /etc/caddy/sites/bix-english.caddy
```

Dán đúng nội dung dưới đây (cũng là nội dung tệp `deploy/bix-english.caddy` trong kho mã). Lưu bằng Ctrl+O, Enter, rồi thoát bằng Ctrl+X:

```
bix-english.duckdns.org {
    root * /var/www/bix-english
    encode zstd gzip
    file_server
    header Permissions-Policy "microphone=(self), camera=(), geolocation=()"
    header Referrer-Policy "no-referrer"
    header X-Content-Type-Options "nosniff"
    header /sw.js Cache-Control "no-cache"
    header /assets/* Cache-Control "public, max-age=31536000, immutable"
    header /manifest.webmanifest Content-Type "application/manifest+json"
}
```

Kiểm tra cú pháp:

```bash
cat /etc/caddy/sites/bix-english.caddy
sudo caddy validate --config /etc/caddy/Caddyfile
```

Chỉ khi thấy `Valid configuration` mới nạp lại:

```bash
sudo systemctl reload caddy
```

Vì sao có các dòng `header`:
- `Permissions-Policy … microphone=(self)`: cho trang dùng micro, chặn camera và vị trí.
- `sw.js` **không được cache**: thiếu dòng này, tablet có thể giữ bản cũ rất lâu sau khi cập nhật.
- `assets/*` cache lâu: tên tệp trong `assets/` đổi theo nội dung mỗi lần build, nên cache lâu không bao giờ ra bản cũ.
- `manifest.webmanifest` phải có kiểu `application/manifest+json`: Caddy 2.6 (bản của Ubuntu 24.04) không biết đuôi `.webmanifest` nên trả `text/plain`. Đi cùng `nosniff`, Chrome có thể bỏ qua manifest và **không cho cài app**. Đã thử với Caddy 2.6.2: thiếu dòng này ra `text/plain`, có dòng này ra đúng kiểu và app cài được.

Lỡ hỏng: `sudo rm /etc/caddy/sites/bix-english.caddy && sudo systemctl reload caddy`.

## 4. Kiểm

Lần đầu chờ khoảng 1 phút để Caddy xin chứng chỉ.

```bash
curl -sI https://bix-english.duckdns.org/ | head -1
curl -sI https://bix-english.duckdns.org/sw.js | grep -i cache-control
curl -sI https://bix-english.duckdns.org/ | grep -i permissions-policy
curl -sI https://bix-english.duckdns.org/manifest.webmanifest | grep -i content-type
curl -sI https://casa-school.duckdns.org/healthz | head -1
curl -s https://casa-lead.duckdns.org/healthz; echo
```

Phải ra lần lượt:
1. `HTTP/2 200`
2. `cache-control: no-cache`
3. dòng có `microphone=(self)`
4. `content-type: application/manifest+json`
5. `HTTP/2 200`: CASA Mầm non vẫn chạy.
6. `ok`: Chăm sóc lead vẫn chạy.

Lỗi chứng chỉ thì xem `sudo journalctl -u caddy -n 30 --no-pager`.

## 5. Mở trên tablet

1. Chrome trên tablet → https://bix-english.duckdns.org → bấm ▶, nghe Bix chào.
2. Vào **🔒 Bố mẹ** → **Thử micro**: Chrome hỏi quyền micro → **Cho phép** → nói "dog".
3. ⋮ → **Thêm vào màn hình chính** (hoặc **Cài đặt ứng dụng**).
4. Làm tiếp checklist "Thử thật trên tablet" trong `README.md`.

## Cập nhật mã về sau

Làm một lần, chép script cập nhật ra ngoài kho mã (git pull mà sửa đúng tệp đang chạy thì bash đọc hỏng):

```bash
cp /opt/bix-english/scripts/cap-nhat-vps.sh ~/cap-nhat-bix.sh
chmod +x ~/cap-nhat-bix.sh
```

Từ đó, mỗi khi `main` có bản mới, chỉ cần chạy:

```bash
~/cap-nhat-bix.sh
```

Script ghi lại bản đang chạy, rồi lần lượt: `git pull` → `npm ci` → `npm test` → `npm run build` → chép sang `/var/www/bix-english` → kiểm `HTTP/2 200` và số phiên bản trong `sw.js`. Bước nào lỗi là dừng ngay và trang vẫn chạy bản cũ. Nếu bản thân `scripts/cap-nhat-vps.sh` có thay đổi, chép lại như trên.

**Tablet đã cài app:** mở, đóng hẳn, mở lại. Lần mở thứ hai mới là bản mới (service worker tải bản mới ở lần mở đầu).

### Quay lui về bản trước

```bash
cd /opt/bix-english
git checkout <mã bản cũ>          # mã in ở dòng "Bản đang chạy" lần cập nhật trước
npm ci --no-audit --no-fund
npm run build
rsync -a --delete dist/ /var/www/bix-english/
```

Tiến độ của bé không bị ảnh hưởng, vì nó nằm trên tablet. Khi đã có bản sửa: `git checkout main` rồi chạy lại `~/cap-nhat-bix.sh`.

## Gỡ app khỏi máy (khi chuyển đi nơi khác)

```bash
sudo rm /etc/caddy/sites/bix-english.caddy
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo rm -rf /opt/bix-english /var/www/bix-english
rm -f ~/cap-nhat-bix.sh
```

Rồi xoá tên `bix-english` trên duckdns.org. Trên tablet, tiến độ của bé gắn với tên miền: chuyển sang tên miền mới thì bé bắt đầu lại từ đầu.
