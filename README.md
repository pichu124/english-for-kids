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
content/            words/ (ngân hàng từ), units/ (bài), stories/ (truyện), alphabet.json (bảng chữ cái)
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
    storage.ts      localStorage (bọc try/catch), tối đa 4 hồ sơ bé
    progress.ts     sticker, số bài đã học, ngày học, từ cho trò chơi
    adapt.ts        độ khó tự điều chỉnh của trò chọn hình
    memory.ts       Bix nhớ bài trước, câu hỏi trò chuyện mỗi ngày
    review.ts       ôn tập ngắt quãng (Leitner)
    usage.ts        đếm phút học, giới hạn mỗi ngày
    sfx.ts          hiệu ứng âm thanh tổng hợp (không cần file)
    pwa.ts          đăng ký service worker, nút cài app
  screens/          start (chọn bé), home, lesson/ (listen, speak, play, do-it, chant, reward), world,
                    book (My Words), wardrobe (tủ đồ Bix), garden, games (lật thẻ, bóng bay, tô màu),
                    stories (truyện), parent, rest
  styles/
tests/              match.test.ts + e2e/
vite.config.ts      có plugin sinh dist/sw.js (precache toàn bộ app)
deploy/             tệp Caddy cho VPS
vercel.json         (cách khác) cấu hình Vercel
```

## Thêm bài học mới (không cần sửa code)

Nội dung dùng **định dạng v2**. Kế hoạch đầy đủ và tiến độ nằm ở `docs/KE-HOACH-NOI-DUNG-CAMBRIDGE.md`.

- `content/words/<chủ-đề>.json`: **ngân hàng từ**. Mỗi từ khai một lần, dùng lại được ở nhiều bậc và nhiều bài.
- `content/units/<Bậc>-<chủ-đề>.json`: **một bài (Unit)** ở một bậc, liệt kê id các từ.

```json
{
  "id": "l1-farm",
  "level": "L1",
  "topic": "farm",
  "order": 7,
  "title": "On the Farm",
  "titleVi": "Ở nông trại",
  "icon": "🐷",
  "color": "#8fd46b",
  "intro": "Let's visit the farm!",
  "playPrompt": "Where's the {word}?",
  "block": { "name": "Hay block", "style": "wood", "color": "#e9c46a" },
  "casa": { "luaTuoi": "4-5", "chuDe": "Animals", "monHoc": "Communication and Language" },
  "steps": ["listen", "do-it", "say", "tap-picture", "chant"],
  "words": ["pig", "sheep", { "id": "cow", "sentence": "This is a cow. Moo, moo!" }],
  "actions": [{ "say": "Oink like a pig!", "emoji": "🐷" }],
  "chant": { "title": "Farm Chant", "lines": ["On the farm, what do you see?", "A pig, a sheep, a cow and me!"] }
}
```

**Các trường:**
- **`level`**: `L0` (3–4 tuổi, không hiện chữ), `L1` (4–5), `L2` (Starters 5–7), `L3` (Movers), `L4` (Flyers). `casa.luaTuoi` phải khớp bậc: `3-4`, `4-5`, `5-6`.
- **`steps`**: thứ tự hoạt động. `listen` (nghe), `say` (nói), `tap-picture` (chọn hình), `do-it` (làm theo lệnh, cần `actions`), `chant` (vè, cần `chant`).
- **Phần 2 "Đọc & Viết"** (bậc Starters, tự thêm, không cần ghi vào `steps`):
  - `read`: nhìn hình, chọn đúng chữ viết, 4 lượt;
  - `spell`: chạm chữ cái để ghép từ, 3 từ ngắn nhất (từ đơn 2–6 chữ cái). Bài có dưới 2 từ như vậy thì bỏ bước này;
  - `sentence`: ghép câu từ câu mẫu đầu tiên của từ (3–6 từ), và một câu đúng/sai dạng "This is a/an …";
  - các bước khác là phần 1 "Nghe & Nói". Tắt phần 2 cho một bài bằng `"reading": false`. Link `?unit=<id>&part=2` mở thẳng phần 2.
- **Movers (bậc 3)**: phần 2 gồm `read`, `write` (gõ từ trên bàn phím a–z, từ đơn 3–8 chữ cái), `sentence`, `text`. Bài có đoạn văn thì thêm:
  ```json
  "text": { "title": "Tom Is Ill", "lines": ["Yesterday Tom was ill.", "..."],
            "questions": [{ "q": "Who was ill?", "options": ["Tom", "the doctor"], "answer": 0 }] }
  ```
  `answer` là số thứ tự đáp án đúng (bắt đầu từ 0). Hình đồng hồ: `"image": { "clock": "7:00" }`.
  Hình vẽ khi không có emoji: `"image": { "body": "knee" }` (bạn nhỏ có khoanh bộ phận) hoặc `"image": { "icon": "towel" }`, danh sách trong `src/art/drawings.ts`.
  Hình cây gia đình: `"image": { "family": "aunt" }` (aunt, uncle, cousin, parents, grandparents).
  Điền từ (🧩): thêm `"gap": true` vào bài, chỉ khi mỗi câu mẫu chỉ hợp với đúng một từ của bài. Hoặc soạn tay
  `"gaps": [{ "s": "Mice love ___!", "answer": "cheese", "options": ["soup", "pasta"] }]` (đáp án là chữ của một từ trong bài).
- **Bảng chữ cái**: `content/alphabet.json`, 26 chữ, mỗi chữ có một từ và một hình ("B is for ball").
- **Mỗi từ trong bài** có thể ghi đè `sentence`, `play`, `ask`, `image` của ngân hàng. Ví dụ bậc 0 dùng câu ngắn hơn bậc 2.
- **Hình** (`image`): `{ "emoji": "🐷" }`, `{ "color": "#e63946" }` (khối màu), hoặc `{ "text": "11" }` (chữ số lớn).
- **`accept`**: những cách máy hay nghe nhầm mà vẫn tính là đúng. **Không** đưa từ thông dụng (no, and, here, son…) hay một từ khác trong cùng bài vào đây. Bộ test sẽ chặn.
- **`block.style`**: `grass, brick, rainbow, cake, window, wood, stone, gold, plain`.
- **`parentTip`** (`{ "vi": "...", "say": "..." }`): thẻ **Chơi cùng con**. `vi` là việc bố mẹ làm ở nhà, `say` là câu tiếng Anh bố mẹ nói.
- **`chat`** (`{ "ask": "Do you like pigs?", "yes": "...", "no": "..." }`): câu hỏi có/không Bix hỏi bé, mỗi ngày một câu, kèm hai câu đáp.
- **`chant.tune`**: giai điệu nền của bài vè: `twinkle, oldmac, row, mary, london, frere`. Bỏ trống thì máy tự chọn cố định theo bài.
- **`anim`** (trong ngân hàng từ): cách hình chuyển động khi đọc, gồm `bounce, wiggle, hop, fly, drive, swim, fall, spin, pulse, sway, shine, wave`. Bỏ trống thì lấy theo chủ đề.
- **Id của bài và của từ không bao giờ đổi**, vì tiến độ của bé gắn với chúng.

### Thêm truyện

`content/stories/<id-bài>.json`. Truyện mở khi bé học xong bài đó. Đáp án câu hỏi là id một từ của bài.

```json
{
  "id": "story-l2-zoo",
  "unit": "l2-zoo",
  "title": "A Day at the Zoo",
  "icon": "🦁",
  "pages": [
    { "text": "Bix goes to the zoo.", "scene": "🎟️", "bix": true },
    { "text": "The giraffe has a long neck.", "scene": "🦒" }
  ],
  "questions": [{ "ask": "Who has a long neck?", "answer": "giraffe" }]
}
```

Câu ngắn, thì hiện tại, gọi nhân vật là "Bix" (không dùng he/she). `"bix": true` vẽ Bix nhỏ cạnh cảnh.

**Kiểm tra:** `npm test` báo lỗi nếu thiếu từ, câu mẫu không chứa từ cần học, lứa không khớp casa, hoặc từ chấp nhận dễ nhầm.

**Link mở thẳng một bài** (dùng trong casa-mamnon): `https://<tên-miền>/?unit=<id>`. Danh mục mọi bài: `https://<tên-miền>/catalog.json`.

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
