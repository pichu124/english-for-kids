# Bix English: app học nói tiếng Anh cho bé (bản 0, dùng trong gia đình)

Web app (PWA) cho bé 6 tuổi dùng trên tablet Android (Chrome). Mỗi bài học 5–8 phút theo vòng **nghe → nói → chơi → nhận thưởng**, cùng nhân vật khối vuông **Bix** (tự thiết kế: đầu hộp, ăng-ten đỏ, kính vuông màu cam, trái tim pixel trên ngực).

Mục tiêu bản 0 là kiểm chứng hai điều:
1. Bé có chịu **nói** tiếng Anh với nhân vật mỗi ngày không?
2. Nhận dạng giọng nói của trình duyệt có **nghe đúng giọng bé** không?

Cả hai được đo trong **Khu vực bố mẹ → Nhật ký 14 ngày** (số ngày có nói; tỉ lệ máy tự nhận đúng so với bố mẹ chấm).

## Chạy thử

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # kiểm tra kiểu + build ra dist/
npm run preview    # chạy bản build ở http://localhost:4173
```

Micro chỉ chạy trên **HTTPS** hoặc `localhost`. Muốn thử trên tablet thì deploy lên Vercel (xem dưới). Mở `http://192.168.x.x` qua mạng LAN sẽ không dùng được micro.

### Kiểm thử

```bash
npm test                       # unit test bộ chấm phát âm dễ (vitest)
npm run build && npm run preview &
npm run e2e                    # chơi tự động trọn bài, kéo thả, khu bố mẹ, offline
```

Test e2e dùng giọng đọc và nhận giọng **giả lập** (`tests/e2e/fakes.js`), nên không thay được việc thử thật trên tablet.

## Cấu trúc thư mục

```
content/            Nội dung bài học, mỗi chủ đề một file JSON
public/             manifest, icon (icon.svg → PNG bằng `npm run icons`)
scripts/            make-icons.mjs, cap-nhat-vps.sh (cập nhật trên VPS)
src/
  main.ts           khởi động, đăng ký màn hình
  router.ts         chuyển màn hình + dọn dẹp khi rời màn
  content.ts        nạp content/*.json (import.meta.glob) + kiểm tra dữ liệu
  art/              Bix (SVG, 6 trạng thái), khối voxel, khối xây dựng
  lib/
    tts.ts          đọc bằng speechSynthesis (en-US, tốc độ 0.8)
    listen.ts       nghe bằng SpeechRecognition (maxAlternatives 5)
    match.ts        chấm dễ: chứa từ / gần giống (Levenshtein) / giống âm
    storage.ts      localStorage (bọc try/catch)
    usage.ts        đếm phút học, giới hạn mỗi ngày
    sfx.ts          hiệu ứng âm thanh tổng hợp (không cần file)
    pwa.ts          đăng ký service worker, nút cài app
  screens/          start, home, lesson/ (listen, speak, play, reward), world, parent, rest
  styles/
tests/              match.test.ts + e2e/
vite.config.ts      có plugin sinh dist/sw.js (precache toàn bộ app)
deploy/             tệp Caddy cho VPS
vercel.json         (cách khác) cấu hình Vercel
```

## Thêm chủ đề mới (không cần sửa code)

Tạo file `content/06-tên.json` rồi build lại. Mẫu:

```json
{
  "id": "toys",
  "order": 6,
  "title": "Toys",
  "titleVi": "Đồ chơi",
  "icon": "🧸",
  "color": "#8fd46b",
  "intro": "Let's play with toys!",
  "playPrompt": "Where is the {word}?",
  "block": { "name": "Wood block", "style": "wood", "color": "#c98b52" },
  "words": [
    { "id": "ball", "text": "ball", "image": { "emoji": "⚽" }, "sentence": "This is a ball.", "accept": ["bowl", "balls"] }
  ]
}
```

- `image`: `{ "emoji": "…" }` hoặc `{ "color": "#rrggbb" }` (vẽ khối màu, dùng cho từ chỉ màu).
- `accept`: những cách máy hay nghe nhầm mà vẫn tính là đúng (ví dụ `mom` cho `mum`).
- `ask` (tuỳ chọn): câu hỏi ở bước Nói, mặc định là “Can you say {text}?”.
- `play` (tuỳ chọn): câu hỏi riêng của từ này ở bước Chơi.
- `block.style`: một trong `grass, brick, rainbow, cake, window, wood, stone, gold, plain`.
- Mỗi chủ đề cần ít nhất 3 từ (nên có 6). File sai cấu trúc sẽ bị bỏ qua, có cảnh báo trong console.

## Cách chấm điểm phần Nói

- Chấm **dễ**: đúng nếu **bất kỳ** phương án nhận dạng nào (cả kết quả tạm thời) chứa từ mục tiêu, hoặc gần giống (sai 1–2 chữ cái tuỳ độ dài từ), hoặc có “khung phụ âm” giống nhau.
- **Không bao giờ báo “sai”**: lần 1 chưa khớp thì Bix nói “Try again!”; lần 2 thì “Good try! Let's go on.” rồi sang từ khác.
- Khi máy không thu được giọng (trình duyệt không hỗ trợ, chưa cấp quyền micro, mất mạng), sẽ hiện 2 nút nhỏ cho bố mẹ: **“✓ Bé nói đúng”** / **“↻ Thử lại”**. Khi máy nghe ra từ khác, 2 nút này cũng hiện để bố mẹ chấm lại.

## Thử trước khi lên VPS

### Bước 1: trên máy tính (5 phút)

```powershell
git clone https://github.com/pichu124/english-for-kids.git
cd english-for-kids
npm install
npm test
npm run dev
```

Mở Chrome ở `http://localhost:5173`. Micro chạy được vì `localhost` được Chrome coi là an toàn. Bấm F12 rồi Ctrl+Shift+M, chọn khung 1280×800 nằm ngang để xem gần giống tablet. Giọng đọc trên Windows khác Android, nên nghe thử thật phải dùng tablet.

### Bước 2: trên tablet thật, qua đường hầm Cloudflare (không cần VPS, không cần tài khoản)

Cách này giống `docs/PHEP-THU-DIEN-THOAI.md` bên casa-mamnon. Cài một lần: `winget install --id Cloudflare.cloudflared`.

```powershell
npm run thu                                      # cửa sổ 1: build rồi chạy bản build ở cổng 4173
cloudflared tunnel --url http://localhost:4173   # cửa sổ 2: in ra https://<ngẫu-nhiên>.trycloudflare.com
```

Mở địa chỉ `https://….trycloudflare.com` bằng Chrome trên tablet. Có HTTPS nên micro, offline và "Thêm vào màn hình chính" đều thử được. Làm theo checklist bên dưới.

- Máy tính phải bật và hai cửa sổ phải mở trong lúc thử. Mỗi lần chạy lại, địa chỉ đổi khác.
- Ai có link đều mở được trong lúc đường hầm chạy. App không có dữ liệu trên máy chủ nên không lộ gì, nhưng thử xong vẫn nên tắt cả hai cửa sổ (Ctrl+C).
- Tiến độ của bé gắn với tên miền: những gì học trên link thử **không** chuyển sang bản VPS. Thử xong thì gỡ icon app thử trên tablet (giữ icon → Gỡ cài đặt) để khỏi nhầm với bản thật.
- Windows có thể hỏi quyền tường lửa cho Node: chọn Huỷ cũng được, vì đường hầm nối vào `localhost`.

## Triển khai

**Chọn: VPS InterData** (máy chung với CASA Mầm non và Chăm sóc lead). Xem **`docs/TRIEN-KHAI-VPS.md`**: lấy mã, build, thêm một tệp Caddy riêng, kiểm, cập nhật bằng `~/cap-nhat-bix.sh`, quay lui, gỡ. App là trang tĩnh: không chạy dịch vụ, không mở cổng, không có dữ liệu trên máy chủ.

Cách khác: Vercel. `vercel.json` đã có sẵn. Vào vercel.com → Add New… → Project → chọn repo, dùng tên miền Production `*.vercel.app` (bản Preview có thể bắt đăng nhập).

## Checklist thử thật trên tablet (Chrome Android)

- [ ] Mở link HTTPS → bấm ▶ → Bix chào và **có tiếng** (nếu không có tiếng: tăng âm lượng media; cài giọng Google English US trong Cài đặt → Chuyển văn bản thành giọng nói).
- [ ] Bố mẹ → Giọng đọc & micro → **Thử micro**: cho phép micro, nói “dog”, thấy chữ máy nghe được.
- [ ] ⋮ → **Thêm vào màn hình chính** → mở từ icon: chạy toàn màn hình, nằm ngang.
- [ ] Học trọn một bài: nghe 6 từ, nói 6 từ, chơi 6 lượt, nhận khối.
- [ ] Tắt hẳn app rồi mở lại: sao và khối vẫn còn.
- [ ] Bật chế độ máy bay → mở app: vẫn học được; phần nói hiện 2 nút cho bố mẹ chấm.
- [ ] Thế giới của bé: kéo khối vào lưới, kéo khối ra ngoài để cất lại.
- [ ] Đặt giới hạn 5 phút → hết giờ thì Bix đi ngủ.

## Quyền riêng tư

- Không tài khoản, không backend, không quảng cáo, không công cụ thống kê bên thứ ba.
- Tiến độ, tên bé, nhật ký chỉ lưu trong `localStorage` của máy.
- App không ghi âm. Khi bé bấm micro, **Chrome** gửi âm thanh tới dịch vụ nhận dạng giọng nói của Google để chuyển thành chữ (đây là cách Web Speech API hoạt động trên Chrome). App chỉ giữ lại phần chữ (ví dụ “dog”) để bố mẹ xem.

## Để sau (không làm ở bản 0)

- Bản 1: đồng bộ tiến độ lên Supabase, báo cáo tuần, API chấm phát âm (Azure Pronunciation Assessment / SpeechSuper).
- Bản 2: hội thoại AI trong phạm vi từ đã học; thêm chủ đề theo sách giáo khoa lớp 1–2.
