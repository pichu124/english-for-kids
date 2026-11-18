# Ghi chú: nhận giọng nói không chạy trên điện thoại bản ROM Trung Quốc

Trạng thái: **tạm dừng, sẽ làm tiếp sau** (18/11/2026). Trong lúc chờ, bé vẫn học được: phần nói hiện 2 nút "Bé nói đúng / Thử lại" cho bố mẹ chấm.

## Máy gặp lỗi
- Điện thoại Android, ROM có sẵn bàn phím **Baidu** và **Sogou "Customized Version"** (dấu hiệu bản ROM Trung Quốc). Chưa rõ hãng, đời máy.
- App Google bản `17.74.18.ve.arm64`. Giọng nói của Google: ngôn ngữ chính English (US).
- Chrome trên Android. Trên laptop Windows (Chrome), cùng code nhận đúng 6/6 từ.

## Đã xác định được
| Kiểm tra | Kết quả |
|---|---|
| Trang mở được micro (`getUserMedia`) | ✓ |
| App Google có quyền micro | ✓ ("Allowed while using") |
| Gboard nhập bằng giọng nói, nói "dog" | ✓ ra "Dog" |
| Chrome nhận giọng tiếng Anh (`en-US`, `en-GB`, không chỉ định) | ✗ nghe thấy tiếng (`speechstart`) nhưng trả `nomatch` |
| Chrome nhận giọng **tiếng Việt** (`vi-VN`) | ✓ ra "Xin chào" |

**Kết luận:** dịch vụ nhận giọng mà Chrome dùng trên máy này chạy được, nhưng **chỉ có tiếng Việt**. Gboard có gói tiếng Anh riêng nên vẫn nhận đúng.

## Đã thử, chưa sửa được
1. Bật **Google Voice Typing** trong Manage keyboards → Chrome từ "không thu được âm thanh" chuyển sang "nghe thấy nhưng `nomatch`" (có tiến bộ).
2. Đổi chế độ nhận giọng (đầy đủ / không kết quả tạm, 5 phương án / đơn giản) → cả 3 đều `nomatch`. Chế độ đơn giản có 1 lần ra "knock knock" khi nói "dog".
3. Tạm dừng âm thanh của app trong lúc nghe (`sfx.pause()`) → không đổi.
4. Tải gói tiếng Anh ở: On-device speech recognition, app Speech Recognition & Synthesis from Google, cài đặt Gboard → không được.

## Công cụ chẩn đoán có sẵn trong app (Khu bố mẹ → Giọng đọc & micro)
- **Phiên bản đang chạy** và nút **🔄 Tải bản mới nhất**.
- **🎤 Thử micro:** thử lần lượt 3 chế độ, có "Chi tiết kỹ thuật" (start/audiostart/speechstart/nomatch/error kèm ms), sau đó kiểm tra riêng micro bằng `getUserMedia`.
- **🧪 Thử nâng cao:** thử `en-US`, `en-GB`, không chỉ định ngôn ngữ, `vi-VN`.

## Hướng làm tiếp (chọn một)
1. **Thử trên máy khác** (tablet của bé, hoặc máy Android bản quốc tế): chạy *Thử nâng cao*. Nếu tiếng Anh ra chữ thì không cần sửa gì.
2. **Chế độ "nghe bằng tai tiếng Việt"** (miễn phí, chạy ngay trên máy):
   - Gọi nhận giọng với `vi-VN`. Bé nói "dog" → máy viết kiểu "đốc".
   - Chuyển chữ Việt sang dạng gần tiếng Anh (đ→d, bỏ dấu, ph→f, x→s, gh→g, kh→k…), rồi chấm dễ như hiện nay.
   - Tự bật khi *Thử nâng cao* thấy tiếng Anh `nomatch` mà tiếng Việt ra chữ.
   - Nhược điểm: kém chính xác với từ dài ("ice cream", "good morning"), có thể chấm đúng nhầm.
3. **Thu âm rồi gửi lên VPS để chuyển thành chữ** (Azure hoặc Google Cloud Speech): không phụ thuộc máy.
   - Cần thêm một dịch vụ nhỏ trên VPS giữ khoá API.
   - Chi phí khoảng vài chục nghìn đồng mỗi tháng cho một bé.
   - Giọng bé đi qua VPS tới Microsoft hoặc Google.

Mã liên quan: `src/lib/listen.ts` (chế độ, ngôn ngữ, diễn biến), `src/screens/lesson/speak.ts` (tự hạ chế độ trong bài học), `src/screens/parent.ts` (Thử micro, Thử nâng cao), `tests/e2e/fakes.js` (các chế độ giả lập: `simple-only`, `full-nomatch`, `simple-text-only`, `broken`).
