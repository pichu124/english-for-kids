/** Where is the app running? Used to explain why the microphone may not work. */

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

export const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);
export const isAndroid = /Android/i.test(ua);
/** Opened inside another app (Zalo, Messenger, Facebook, Instagram…) instead of a real browser. */
export const inAppBrowser = /Zalo|FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\/|; wv\)/i.test(ua);
export const isChrome = /Chrome\/\d+/.test(ua) && !/Edg\/|OPR\/|SamsungBrowser|YaBrowser|CocCoc|coc_coc/i.test(ua) && !inAppBrowser;

export function browserLabel(): string {
  const m = ua.match(/(SamsungBrowser|CocCoc|coc_coc_browser|Edg|OPR|Chrome|CriOS|FxiOS|Firefox|Version)\/(\d+)/);
  const os = isAndroid ? 'Android' : isIOS ? 'iPhone/iPad' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'máy khác';
  if (inAppBrowser) return `trình duyệt bên trong một ứng dụng khác (Zalo/Messenger/Facebook…) trên ${os}`;
  if (!m) return `trình duyệt không rõ trên ${os}`;
  const name = ({ SamsungBrowser: 'Samsung Internet', CocCoc: 'Cốc Cốc', coc_coc_browser: 'Cốc Cốc', Edg: 'Edge', OPR: 'Opera', CriOS: 'Chrome (iPhone)', FxiOS: 'Firefox (iPhone)', Version: 'Safari' } as Record<string, string>)[m[1]] ?? m[1];
  return `${name} ${m[2]} trên ${os}`;
}

/** Advice for parents when the browser itself is the problem, or '' when it looks fine. */
export function browserAdvice(): string {
  if (inAppBrowser) return 'Trang đang mở bên trong Zalo/Messenger/Facebook. Các trình duyệt này không cho dùng micro. Bấm ⋮ → “Mở bằng trình duyệt” hoặc chép link sang Chrome.';
  if (isIOS) return 'Trên iPhone/iPad, nhận giọng nói chạy không ổn định. App làm cho Chrome trên Android.';
  if (isAndroid && !isChrome) return 'Nên mở bằng Chrome. Trình duyệt khác (Samsung Internet, Cốc Cốc…) thường không có nhận giọng nói.';
  return '';
}
