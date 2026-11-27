import { h } from '../lib/dom';
import type { Ctx } from '../router';

/**
 * Privacy policy and terms of use, in Vietnamese for parents. Shown in the app (parent area,
 * first-run welcome) and by link: https://…/?legal=privacy or ?legal=terms (for app stores).
 * Keep them true to what the app does; update UPDATED when the text changes.
 */
const UPDATED = '27/11/2026';
/** Contact for parents (privacy questions, deleting data, problems). Fill in before publishing. */
export const CONTACT_EMAIL = '';
const contact = () =>
  CONTACT_EMAIL ? `Mọi câu hỏi về quyền riêng tư hoặc điều khoản, xin gửi về: ${CONTACT_EMAIL}.` : 'Mọi câu hỏi về quyền riêng tư hoặc điều khoản, xin liên hệ người phát hành app qua kênh nơi bạn tải app.';

type Section = [title: string, ...paragraphs: (string | string[])[]];

const PRIVACY: Section[] = [
  [
    'Tóm tắt',
    [
      'Không cần tài khoản. Không quảng cáo. Không dùng công cụ thống kê hay theo dõi của bên thứ ba.',
      'Mọi tiến độ học của bé chỉ lưu trên chính máy này. Chúng tôi không có máy chủ lưu dữ liệu của bé và không bán hay chia sẻ dữ liệu cho ai.',
      'App không ghi âm. Khi bé nói vào micro, trình duyệt dùng dịch vụ nhận dạng giọng nói của nó để chuyển thành chữ (xem mục 3).',
    ],
  ],
  [
    '1. App lưu gì, lưu ở đâu',
    'App lưu các thông tin sau trong bộ nhớ của trình duyệt trên máy (localStorage). Thông tin không được gửi về máy chủ nào của chúng tôi:',
    [
      'Tên gọi ở nhà của bé, nếu bố mẹ nhập (không bắt buộc). Tên dùng cho lời chào và giấy khen.',
      'Bậc học, cài đặt (giờ học mỗi ngày, tốc độ đọc, nhạc, micro).',
      'Tiến độ: bài đã học, từ đã nói hoặc chọn đúng, chữ đã tập viết, kết quả thi thử, sticker và đồ của Bix.',
      'Nhật ký học: số phút và số lượt học mỗi ngày, để bố mẹ xem báo cáo.',
      'Câu trả lời có/không của bé trong trò chuyện với Bix, để Bix nhắc lại cho vui.',
      'Ở bước 👋 Hello! mỗi ngày: thời tiết và cảm xúc bé chọn (vui, mệt, buồn, bực), để bố mẹ xem trong báo cáo tuần.',
      'Kết quả bài xếp bậc (số câu đúng ở mỗi bậc và bậc gợi ý).',
    ],
    'App không hỏi và không lưu tuổi chính xác, ngày sinh, trường, địa chỉ, ảnh hay số điện thoại. Ở màn chào, tuổi chỉ dùng để gợi ý bậc học; app chỉ lưu bậc học.',
  ],
  [
    '2. Nhiều bé trên một máy',
    'Mỗi bé có hồ sơ riêng trên cùng máy. Dữ liệu của các hồ sơ vẫn chỉ nằm trên máy đó.',
  ],
  [
    '3. Micro và giọng nói',
    [
      'App không ghi âm, không lưu âm thanh và không gửi bản ghi âm đi đâu.',
      'Khi bé bấm micro, trình duyệt gửi âm thanh tới dịch vụ nhận dạng giọng nói của nó để chuyển thành chữ: Chrome dùng dịch vụ của Google, Safari dùng dịch vụ của Apple. Việc này theo chính sách quyền riêng tư của Google hoặc Apple. App chỉ nhận lại phần chữ (ví dụ “dog”) để chấm ngay, và chỉ giữ lại việc bé đã nói được từ nào.',
      'Giọng Bix đọc là giọng đọc có sẵn trong máy. Một số giọng có ghi “cần mạng” thì do dịch vụ của trình duyệt đọc qua Internet.',
      'Không có micro hoặc không muốn dùng micro: bố mẹ bấm “✓ Bé đã nói” để chấm, mọi bài vẫn học được.',
    ],
  ],
  [
    '4. Sao lưu',
    'Tệp sao lưu do bố mẹ tự bấm tải về máy. App không gửi tệp này đi đâu. Bố mẹ giữ tệp ở nơi an toàn, vì trong đó có tên gọi và tiến độ của bé.',
  ],
  [
    '5. Trẻ em',
    [
      'App làm cho trẻ em học cùng hoặc dưới sự trông nom của bố mẹ hay thầy cô.',
      'Phần của bé không có quảng cáo, không mua bán, không trò chuyện với người lạ và không có đường dẫn ra trang web khác.',
      'Khu bố mẹ có một phép tính nhỏ để bé không tự vào đổi cài đặt.',
    ],
  ],
  [
    '6. Quyền của bố mẹ',
    [
      'Xem: Khu bố mẹ có tiến độ, nhật ký, báo cáo tuần và các từ bé đã nói được.',
      'Sửa: đổi tên gọi, bậc học và cài đặt trong Khu bố mẹ.',
      'Xoá: Khu bố mẹ → Xoá tiến độ, hoặc xoá dữ liệu trang web trong cài đặt của trình duyệt. Gỡ app cũng xoá dữ liệu trên máy.',
      'Mang đi: Khu bố mẹ → Sao lưu, để chuyển tiến độ sang máy khác.',
    ],
  ],
  [
    '7. Máy chủ phát app',
    'Khi tải app lần đầu hoặc cập nhật, máy chủ web có thể ghi nhật ký kỹ thuật thông thường (địa chỉ IP, thời gian, loại trình duyệt), như với mọi trang web. Nhật ký này không chứa dữ liệu học của bé và không dùng để nhận diện bé. Sau khi tải xong, app chạy được cả khi không có mạng.',
  ],
  ['8. Thay đổi chính sách', 'Khi chính sách thay đổi, ngày cập nhật ở đầu trang sẽ đổi theo. Thay đổi lớn sẽ được báo trong app.'],
  ['9. Liên hệ', contact()],
];

const TERMS: Section[] = [
  ['1. Đồng ý điều khoản', 'Khi dùng Bix English, bạn đồng ý với các điều khoản này. Bố mẹ hoặc thầy cô đồng ý thay cho bé.'],
  [
    '2. Mục đích',
    'Bix English là app học tiếng Anh cho trẻ em, dùng cho gia đình và lớp học. App bổ trợ, không thay thế thầy cô hay việc học ở trường.',
  ],
  [
    '3. Nội dung bài học',
    [
      'Bài học được soạn theo khung trình độ Cambridge Young Learners (Starters, Movers, Flyers). Bix English không liên kết với Cambridge và không được Cambridge chứng nhận.',
      'Bài thi thử chỉ để luyện tập, không phải bài thi chính thức. Giấy khen trong app là kỷ niệm của gia đình hay lớp học, không phải chứng chỉ.',
      'Nhận dạng giọng nói của máy có thể nghe nhầm. App chấm dễ tính và không bao giờ nói bé “sai”; khi cần, bố mẹ chấm thay.',
    ],
  ],
  [
    '4. Dùng app hợp lý',
    [
      'Nên cho bé học ngắn mỗi ngày (10–20 phút) và đặt giới hạn thời gian trong Khu bố mẹ. Cho bé nghỉ mắt và vận động giữa các lần học.',
      'Không dùng app để thu thập thông tin của trẻ khác, không sao chép hay bán lại nội dung app.',
    ],
  ],
  [
    '5. Bản quyền',
    'Nhân vật Bix, bài học, truyện, hình vẽ và phần mềm thuộc về người phát hành Bix English. Hình emoji dùng bộ Noto Color Emoji của Google, theo giấy phép SIL Open Font License 1.1.',
  ],
  [
    '6. Dữ liệu trên máy',
    'Tiến độ lưu trên máy (xem Chính sách quyền riêng tư). Xoá dữ liệu trình duyệt, gỡ app hoặc đổi máy có thể làm mất tiến độ, nên hãy sao lưu thường xuyên (Khu bố mẹ → Sao lưu).',
  ],
  [
    '7. Giới hạn trách nhiệm',
    'App được cung cấp như hiện có. Chúng tôi cố gắng để nội dung chính xác và app chạy ổn định, nhưng không bảo đảm app không bao giờ lỗi hay luôn chạy được trên mọi máy. Trong phạm vi pháp luật cho phép, chúng tôi không chịu trách nhiệm về thiệt hại gián tiếp do việc dùng app.',
  ],
  ['8. Thay đổi điều khoản', 'Điều khoản có thể được cập nhật. Ngày cập nhật ghi ở đầu trang. Tiếp tục dùng app nghĩa là bạn đồng ý với bản mới.'],
  ['9. Luật áp dụng', 'Điều khoản này theo pháp luật Việt Nam.'],
  ['10. Liên hệ', contact()],
];

export const LEGAL = {
  privacy: { title: 'Chính sách quyền riêng tư', sections: PRIVACY },
  terms: { title: 'Điều khoản sử dụng', sections: TERMS },
} as const;
export type LegalDoc = keyof typeof LEGAL;

/** ?legal=privacy / ?legal=terms in the address: open that page first (a link from an app store). */
export function legalFromLink(): LegalDoc | null {
  try {
    const d = new URLSearchParams(location.search).get('legal');
    return d === 'privacy' || d === 'terms' ? d : null;
  } catch {
    return null;
  }
}

export function legalScreen(ctx: Ctx): HTMLElement {
  const doc: LegalDoc = ctx.params.doc === 'terms' ? 'terms' : 'privacy';
  const { title, sections } = LEGAL[doc];
  const other: LegalDoc = doc === 'terms' ? 'privacy' : 'terms';
  const from = ctx.params.from;
  const back = () => (from === 'parent' ? ctx.go('parent', { back: 'legal' }) : from === 'welcome' ? ctx.go('welcome') : ctx.go('start'));
  const para = (p: string | string[]) => (Array.isArray(p) ? h('ul', { class: 'lg-list' }, p.map((x) => h('li', {}, x))) : h('p', {}, p));
  return h(
    'main',
    { class: 'legal', lang: 'vi' },
    h(
      'div',
      { class: 'p-wrap lg-wrap' },
      h(
        'div',
        { class: 'p-head' },
        h('button', { class: 'p-btn lg-back', onclick: back }, '← Quay lại'),
        h('button', { class: 'p-btn', 'data-doc': other, onclick: () => ctx.go('legal', { doc: other, ...(from ? { from } : {}) }) }, `📄 ${LEGAL[other].title}`),
      ),
      h(
        'article',
        { class: 'p-card lg-doc', 'data-legal': doc },
        h('h1', {}, title),
        h('p', { class: 'p-muted' }, `Bix English · cập nhật ${UPDATED}`),
        sections.map(([t, ...ps]) => h('section', {}, h('h2', {}, t), ps.map(para))),
      ),
    ),
  );
}
