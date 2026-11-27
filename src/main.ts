import '@fontsource/baloo-2/vietnamese-600.css';
import '@fontsource/baloo-2/vietnamese-800.css';
import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/latin-800.css';
import './styles/emoji-font.css';
import './styles/base.css';
import './styles/screens.css';
import './styles/lesson.css';
import './styles/world.css';
import './styles/parent.css';
import './styles/extras.css';
import './styles/learn.css';
import './styles/phone.css';
import './styles/printables.css';
import './styles/duo.css';

import { readDeepLink } from './lib/level';
import { initPWA } from './lib/pwa';
import { requestPersistence } from './lib/storage';
import { loadVoice } from './lib/voice';
import { startUsageClock } from './lib/usage';
import { currentScreen, go, mount, onNavigate, register } from './router';
import { setBackground } from './lib/music';
import { Bix } from './art/bix';
import { h } from './lib/dom';
import { homeScreen } from './screens/home';
import { lessonScreen } from './screens/lesson';
import { restScreen } from './screens/rest';
import { lockParent, parentScreen } from './screens/parent';
import { startScreen } from './screens/start';
import { worldScreen } from './screens/world';
import { bookScreen } from './screens/book';
import { wardrobeScreen } from './screens/wardrobe';
import { gardenScreen } from './screens/garden';
import { gamesScreen } from './screens/games';
import { storiesScreen, storyScreen } from './screens/stories';
import { certificateScreen } from './screens/certificate';
import { abcScreen } from './screens/abc';
import { todayScreen } from './screens/today';
import { reportScreen } from './screens/report';
import { testScreen } from './screens/test';
import { phonicsScreen } from './screens/phonics';
import { talkScreen } from './screens/talk';
import { worksheetScreen } from './screens/worksheet';
import { welcomeScreen } from './screens/welcome';
import { setOutfitSource } from './art/bix';
import { getState } from './lib/storage';

register('start', startScreen);
register('home', homeScreen);
register('rest', restScreen);
register('lesson', lessonScreen);
register('world', worldScreen);
register('parent', parentScreen);
register('book', bookScreen);
register('wardrobe', wardrobeScreen);
register('garden', gardenScreen);
register('games', gamesScreen);
register('stories', storiesScreen);
register('story', storyScreen);
register('certificate', certificateScreen);
register('abc', abcScreen);
register('today', todayScreen);
register('report', reportScreen);
register('test', testScreen);
register('phonics', phonicsScreen);
register('talk', talkScreen);
register('worksheet', worksheetScreen);
register('welcome', welcomeScreen);
setOutfitSource(() => getState().outfit ?? {});

void loadVoice(); // recorded lines, if the app ships any (public/audio)
readDeepLink(); // before the first screen: a teacher's link skips the parents' welcome
mount(document.getElementById('app')!);
requestPersistence();
initPWA();
startUsageClock(() => {
  const s = currentScreen();
  return !!s && ['home', 'lesson', 'world', 'book', 'wardrobe', 'garden', 'games', 'stories', 'story', 'abc', 'today', 'test', 'phonics', 'talk'].includes(s);
});
// Soft background music (only if a parent turned it on) on the calm screens — never while
// Bix teaches, reads a story or listens to the microphone.
const MUSIC_SCREENS = ['home', 'world', 'book', 'wardrobe', 'garden', 'stories', 'games', 'certificate'];
// any child screen locks the parent area again (the gate asks next time)
onNavigate((name) => name !== 'parent' && name !== 'report' && name !== 'worksheet' && lockParent());
onNavigate((name) => setBackground(MUSIC_SCREENS.includes(name) && !document.hidden));
document.addEventListener('visibilitychange', () => setBackground(!document.hidden && MUSIC_SCREENS.includes(currentScreen() ?? '')));
// Phones held upright: kid screens ask to turn the phone (they are made for landscape);
// the parent area works either way.
{
  const bix = new Bix({ size: 'md', bubble: false }).setMood('hello');
  document.body.appendChild(
    h('div', { class: 'rotate', role: 'dialog', 'aria-label': 'Turn your phone' },
      bix.el,
      h('div', { class: 'rotate-phone', 'aria-hidden': 'true' }, '📱'),
      h('p', { class: 'rotate-en' }, 'Turn me sideways!'),
      h('p', { class: 'rotate-vi', lang: 'vi' }, 'Xoay ngang điện thoại để bé học nhé'),
    ),
  );
  onNavigate((name) => document.body.classList.toggle('allow-portrait', name === 'parent' || name === 'rest' || name === 'report' || name === 'worksheet' || name === 'welcome'));
}
go('start');
