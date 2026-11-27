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
                    book (My Words), wardrobe (tủ đồ Bix), garden, games (lật thẻ, bóng bay, tô màu, Who Is Who?, Riddles cho Flyers),
                    stories (truyện), parent, rest, report (báo cáo tuần), worksheet (phiếu bài tập in), certificate
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
  Hình vẽ khi không có emoji: `"image": { "body": "knee" }` (bạn nhỏ có khoanh bộ phận) hoặc `"image": { "icon": "towel" }` (cả vị trí: above, below, near, opposite, inside, outside; và động tác: climb, hop, skip, kick, catch, throw), danh sách trong `src/art/drawings.ts`.
  Hình cây gia đình: `"image": { "family": "aunt" }` (aunt, uncle, cousin, parents, grandparents).
  Điền từ (🧩): thêm `"gap": true` vào bài, chỉ khi mỗi câu mẫu chỉ hợp với đúng một từ của bài. Hoặc soạn tay
  `"gaps": [{ "s": "Mice love ___!", "answer": "cheese", "options": ["soup", "pasta"] }]` (đáp án là chữ của một từ trong bài).
- **Flyers (bậc 4)**: phần 2 gồm `gap`, `define` (đọc định nghĩa, gõ từ; từ đơn 3–12 chữ cái), `sentence`, `text`. Mỗi từ có thể có định nghĩa:
  `"def": "You can see old and interesting things here."` (không được chứa chính từ đó). Bài cần ít nhất 2 từ có định nghĩa thì mới có bước 📝. Bài thi thử Flyers lấy câu phần Viết từ các định nghĩa này.
- **Bảng chữ cái**: `content/alphabet.json`, 26 chữ, mỗi chữ có một từ và một hình ("B is for ball").
- **`vi`** (trong ngân hàng từ): nghĩa tiếng Việt ngắn cho bố mẹ. Không bao giờ hiện cho bé.
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

## Phiếu bài tập in & giấy chứng nhận

- **Khu bố mẹ → Phiếu bài tập in**: chọn bậc và bài (mặc định bài bé học gần nhất), bấm **📄 Mở phiếu**, rồi **🖨️ In phiếu** (A4 dọc, 1–2 trang bài tập + 1 trang "Đáp án cho bố mẹ"). Phiếu tự tạo từ các từ của bài (`src/lib/worksheet.ts`, màn `src/screens/worksheet.ts`), không cần soạn thêm dữ liệu:
  bậc 0–1 tô màu, nối hình giống nhau, nghe và khoanh; Starters nối hình–chữ, tô chữ, nhìn hình viết từ (có chữ đầu), tìm chữ 8×8; Movers/Flyers viết từ, điền từ (`gaps`), đọc định nghĩa (`def`, Flyers), đoạn văn (`text`). In lại trong cùng ngày ra đúng phiếu đó.
- **🃏 Thẻ từ và 🎱 Bingo cả nhà** (Khu bố mẹ → Phiếu bài tập in, `src/screens/printcards.ts`): thẻ hình to của bài (6 thẻ/trang, có đường cắt, kèm trang gợi ý trò chơi), và 4 bảng Bingo 3×3 khác nhau (2 bảng/trang) với danh sách từ để bố mẹ đọc.
- **Giấy chứng nhận**: mỗi bậc học xong mọi bài có một giấy (khổ A4 ngang), màu và câu khen riêng theo bậc (`src/styles/printables.css`), mở ở **Khu bố mẹ → Huy hiệu & giấy chứng nhận**.

## Phonics, tự đọc to, trò chuyện với Bix, chơi cùng bố mẹ

- **Phonics** (ABC → 🔊 Sounds, `src/screens/phonics.ts`, nội dung `content/phonics.json`): 8 nhóm âm (s a t p i n · c k e h r m d · g o u l f b · j v w x y z qu · sh ch th ee oo · ai oa ie ar or · ng ow oi er ur · Tricky Words: the, I, go, said…). Xong cả 8 nhóm có giấy khen **Sounds Star**. Làm dở một nhóm thì lần sau mở lại đúng bước bé đang làm (thẻ nhóm có vạch tiến độ). Mỗi nhóm: làm quen âm → tìm âm → ghép âm (nghe c-a-t, chọn hình) → ghép chữ từ thẻ âm → đọc truyện nhỏ chỉ dùng âm đã học (+ vài từ "tricky" như the, is). Kiểm thử `tests/phonics.test.ts` bảo đảm mọi từ đều ghép được từ âm đã dạy.
- **Bé tự đọc to**: truyện từ Starters có nút 🎤 **My turn**; truyện phonics cũng vậy. Từ nào máy nghe thấy chuyển xanh (`src/lib/readcheck.ts`, dễ tính). Không có micro, hoặc máy 2 lần không nghe thấy gì, thì bố mẹ bấm "✓ Bé đã nói". Chạm đáp án, lật trang hay bấm "Read to me" là micro tắt ngay.
- **Talk with Bix** (nút 💬 Talk ở màn chính, `src/screens/talk.ts`, `content/talk.json`): trò chuyện theo kịch bản (bé nói hoặc chạm hình trả lời, Bix đáp theo câu bé chọn) và **luyện phần Nói Cambridge** theo bậc (chỉ và gọi tên trong tranh; tìm điểm khác; kể chuyện theo tranh; câu hỏi về bé). Mọi thứ chạy trên máy, không dùng AI hay máy chủ; Bix không hỏi tên, trường hay bạn của bé. **Hôm nay** có một bước nói mỗi ngày (bộ âm tiếp theo, luyện Nói hoặc trò chuyện). Lựa chọn AI thật: xem `docs/NGHIEN-CUU-TINH-NANG.md`, Đợt G.
- **🐢 Nghe chậm**: bé chạm lần hai vào cùng một từ/câu (nút loa, chữ trong truyện, thẻ chữ…) thì Bix đọc lại chậm hơn, kèm chú rùa nhỏ (`src/lib/tts.ts`). Chỉ áp dụng khi bé chạm, câu app tự nhắc lại vẫn đọc tốc độ thường.
- **Giọng Anh-Anh / Anh-Mỹ**: Khu bố mẹ → Giọng đọc & micro. Anh-Anh giống bài thi Cambridge; máy chưa có giọng đó thì app báo và dùng giọng tiếng Anh khác.
- **🎯 Practice** (đảo ngay trước đảo 🎓 Test, từ Starters): gom tối đa 8 từ bé hay chọn nhầm nhất của bậc (rồi đến từ chưa thuộc ở các bài đã học), nghe lại và tìm hình, tính như một lượt ôn tập.
- **Trò chơi mới** (Games, `src/screens/games2.ts`): **👂 Which one?** (từ 4–5 tuổi; ba trò này cũng xuất hiện ở bước trò chơi của **Hôm nay** và được tính vào bảng 4 kỹ năng): nghe một trong hai từ gần giống (ship/sheep, cat/cap, pen/pan, light/night, three/tree…), chạm đúng hình; sau mỗi câu Bix đọc cả hai từ để bé nghe khác biệt. **🕐 What time?** (từ Starters): nghe giờ, chọn đồng hồ đúng: Starters giờ chẵn, Movers thêm "half past", Flyers thêm "quarter past/to"; chọn nhầm thì Bix đọc giờ của đồng hồ đó. **🧱 Bix's Tower** (từ Starters): đoán từ theo hình, chọn từng chữ cái; chữ đúng thêm một khối vào tháp, chữ không có thì "Not in this word!"; không bao giờ thua.
- **Trò chơi đợt L** (Games, `src/screens/games3.ts`; cũng có ở bước trò chơi của **Hôm nay** và bảng 4 kỹ năng):
  - **🧩 Grammar** (từ Starters): một câu có chỗ trống, chọn 2–3 từ nhỏ. Starters: a/an, cat/cats, is/are, he/she, can/can't, in/on/under; Movers thêm was/were, quá khứ, so sánh -er; Flyers thêm will, have … ever. Bix đọc câu, chọn xong thì đọc lại cả câu.
  - **🔢 Maths**: đếm (3–4 tuổi đến 5, 4–5 tuổi đến 10), cộng, bớt ("Bix eats two!"), nhóm nào nhiều hơn, nghe số (Starters 11–20, Movers phân biệt 13/30).
  - **🧺 Sort it!**: xếp 6 hình vào 2 giỏ (Animals hay Food?), rồi 3 lượt tìm hình khác loại (từ 4–5 tuổi). Chỉ dùng từ của bậc đang học và các bậc trước; bỏ những từ thuộc hai nhóm (chicken, orange…).
  - **🎵 Songs**: mọi bài vè của các bài bé đã học (32 bài vè, có giai điệu khi bật nhạc); bài chưa học hiện ổ khoá, học xong thì mở.
- **👋 Hello!** (bước đầu tiên của **Hôm nay**, khoảng 30 giây, `src/screens/circle.ts`): như giờ chào buổi sáng ở lớp: hôm nay thứ mấy (từ 4–5 tuổi; tới Starters ô hôm nay sáng lên), thời tiết, con thấy thế nào. Bix nói mẫu cả câu ("It's sunny!", "I'm tired.") để bé nói theo. Báo cáo tuần có mục **💛 Bé chào Bix mỗi ngày** (cảm xúc bé chọn từng ngày).
- **🧭 Xếp bậc và lên bậc** (Khu bố mẹ → Bậc học, `src/screens/placement.ts`): bài xếp bậc khoảng 3 phút do bé làm (mỗi bậc 4 câu nghe chọn hình, từ Starters có 2 câu đọc chữ; đúng 3/4 thì sang bậc sau). Bé không bị báo đúng/sai; kết quả và nút chọn bậc hiện cho bố mẹ. Khi bé đạt bài thi thử hoặc học xong mọi bài của bậc, khu bố mẹ gợi ý **⬆️ Lên bậc tiếp theo** (bấm "Để sau" để ẩn).
- **Nghĩa tiếng Việt cho bố mẹ**: mỗi từ trong ngân hàng có trường `vi` (ví dụ `"vi": "con voi"`). Chỉ hiện ở khu bố mẹ, báo cáo tuần, trang đáp án phiếu in và danh sách đọc Bingo; màn hình của bé vẫn hoàn toàn tiếng Anh.
- **Play Together** (Games → 🧒👩 Play Together, `src/screens/duo.ts`): 2 người trên một máy — Quick Tap (bấm chuông trả lời), You Be Bix (một người tả, người kia đoán), Say It! (một người nói, người kia chấm 👍). Cả hai luôn được khen, không có người thua.
- **✏️ Write** (ABC → ✏️ Write, hoặc chạm một chữ rồi ✏️; `src/screens/trace.ts`, nét chữ `src/lib/strokes.ts`): bé tô chữ bằng ngón tay, từng nét theo thứ tự. Chấm xanh có số là chỗ bắt đầu, quả bóng vàng chạy trước chỉ đường, nét tô đến đâu tô màu đến đó. Nhấc tay giữa chừng vẫn giữ phần đã tô; vẽ lung tung hay ngược chiều thì không tô màu, không bao giờ báo "sai". Có 4 loại: chữ thường **a**, chữ hoa **A**, chữ số **123** (0–10, kèm hình đếm táo) và từ ngắn **cat** (20 từ ghép được từ các âm đầu: cat, dog, sun…; tô xong Bix đánh vần từ). Nét chữ là chữ in đơn giản trên 4 đường kẻ.
- **4 kỹ năng** (khu bố mẹ và báo cáo tuần, `src/lib/skills.ts`): nghe, nói, đọc, viết, mỗi kỹ năng một thanh tiến độ theo bậc đang học, tính từ dữ liệu app đã có (chọn đúng hình, nói được, đánh vần, phần Đọc & Viết, phonics, tô chữ, phiếu in, thi thử), kèm gợi ý kỹ năng nên tập thêm.
- Báo cáo tuần có mục **Cùng bố mẹ**: số lượt Chơi cùng nhau và số phiếu bài tập đã in.
- Lượt nói dùng chung: `src/screens/mic.ts` (micro → kiểm tra → "Try again!" → "Good try!"; không có nhận dạng giọng nói thì hiện nút cho bố mẹ).

## Lần đầu mở app

Máy chưa có tiến độ nào thì app mở **màn chào cho bố mẹ** (`src/screens/welcome.ts`) thay cho nút ▶: giới thiệu ngắn → tên và tuổi của bé (tuổi gợi ý bậc: 3 → bậc 0, 4 → bậc 1, 5–6 → Starters, 7–8 → Movers, 9+ → Flyers) → thời gian học mỗi ngày (mặc định 15 phút) → thử loa và micro → xong. Bước nào cũng bỏ qua được và đổi lại trong khu bố mẹ. Máy đã có tiến độ, hoặc mở bằng đường link bài học của cô giáo (`?unit=…`), thì không hiện màn này.

## Hình emoji giống nhau trên mọi máy

App kèm sẵn tệp `public/fonts/bix-emoji.woff2` (440 KB, chỉ các emoji app dùng, lấy từ **Noto Color Emoji** của Google, giấy phép SIL OFL 1.1 cho phép dùng thương mại, bản giấy phép kèm ở `public/fonts/LICENSE-bix-emoji.txt`), nên Samsung, Xiaomi hay máy Android cũ đều hiện cùng một hình, kể cả khi offline. Chrome 108+ và Firefox dùng tệp này; Safari (iPad/iPhone) vẫn dùng emoji của Apple. Thêm emoji mới vào nội dung thì tạo lại tệp: xem đầu `scripts/emoji-font.py` (bộ test `tests/emoji-font.test.ts` báo nếu quên).

## Giọng người thật thu sẵn (tuỳ chọn)

Mặc định Bix dùng giọng đọc của máy. Muốn giọng người thật (nghe tự nhiên hơn, nhất là trên máy Android rẻ):

1. `node scripts/voice-lines.mjs > voice-lines.csv`: danh sách khoảng 3.400 câu/từ cần thu, mỗi dòng kèm tên tệp.
2. Người thu âm (người bản ngữ, giọng thân thiện, không nhạc nền) thu mỗi dòng thành một tệp mp3/m4a đúng tên, bỏ vào `public/audio/`.
3. `node scripts/voice-lines.mjs --manifest`: tạo `public/audio/manifest.json`.

Câu nào có tệp thì phát tệp (câu dài phát từng câu nhỏ), câu nào chưa có thì vẫn dùng giọng máy, nên có thể thu dần. Bố mẹ tắt/bật ở khu bố mẹ → Giọng đọc & micro. Tệp thu được lưu sẵn để dùng offline (`src/lib/voice.ts`).

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

Cả hai cách gửi kèm header bảo mật, trong đó có **Content-Security-Policy**: trang chỉ chạy mã, kiểu chữ và hình của chính nó, không gọi tới máy chủ nào khác, không cho trang khác nhúng vào. Bản cài sẵn trên tablet nhận header mới ở lần cập nhật mã kế tiếp.

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

Trang **Chính sách quyền riêng tư** và **Điều khoản sử dụng** (tiếng Việt) nằm ngay trong app (`src/screens/legal.ts`): mở ở Khu bố mẹ → Quyền riêng tư, ở màn chào lần đầu, hoặc bằng đường link `https://<tên miền>/?legal=privacy` và `?legal=terms` (dán vào trang Google Play / App Store). Trước khi phát hành: điền email liên hệ vào `CONTACT_EMAIL` trong file đó, và nên nhờ luật sư xem bản cuối. Nội dung phải luôn đúng với những gì app làm; sửa text thì đổi ngày `UPDATED`.


- Không tài khoản, không backend, không quảng cáo, không công cụ thống kê bên thứ ba.
- Tiến độ, tên bé, nhật ký chỉ lưu trong `localStorage` của máy.
- App không ghi âm. Khi bé bấm micro, **Chrome** gửi âm thanh tới dịch vụ nhận dạng giọng nói của Google để chuyển thành chữ (đây là cách Web Speech API hoạt động trên Chrome). App chỉ giữ lại phần chữ (ví dụ “dog”) để bố mẹ xem.

## Để sau (không làm ở bản 0)

- Bản 1: đồng bộ tiến độ lên Supabase, báo cáo tuần, API chấm phát âm (Azure Pronunciation Assessment / SpeechSuper).
- Bản 2: hội thoại AI trong phạm vi từ đã học; thêm chủ đề theo sách giáo khoa lớp 1–2.
