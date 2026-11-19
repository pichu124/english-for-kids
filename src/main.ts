import '@fontsource/baloo-2/vietnamese-600.css';
import '@fontsource/baloo-2/vietnamese-800.css';
import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/latin-800.css';
import './styles/base.css';
import './styles/screens.css';
import './styles/lesson.css';
import './styles/world.css';
import './styles/parent.css';
import './styles/extras.css';

import { readDeepLink } from './lib/level';
import { initPWA } from './lib/pwa';
import { requestPersistence } from './lib/storage';
import { startUsageClock } from './lib/usage';
import { currentScreen, go, mount, onNavigate, register } from './router';
import { setBackground } from './lib/music';
import { homeScreen } from './screens/home';
import { lessonScreen } from './screens/lesson';
import { restScreen } from './screens/rest';
import { parentScreen } from './screens/parent';
import { startScreen } from './screens/start';
import { worldScreen } from './screens/world';
import { bookScreen } from './screens/book';
import { wardrobeScreen } from './screens/wardrobe';
import { gardenScreen } from './screens/garden';
import { gamesScreen } from './screens/games';
import { storiesScreen, storyScreen } from './screens/stories';
import { certificateScreen } from './screens/certificate';
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
setOutfitSource(() => getState().outfit ?? {});

mount(document.getElementById('app')!);
requestPersistence();
initPWA();
readDeepLink();
startUsageClock(() => {
  const s = currentScreen();
  return !!s && ['home', 'lesson', 'world', 'book', 'wardrobe', 'garden', 'games', 'stories', 'story'].includes(s);
});
// Soft background music (only if a parent turned it on) on the calm screens — never while
// Bix teaches, reads a story or listens to the microphone.
const MUSIC_SCREENS = ['home', 'world', 'book', 'wardrobe', 'garden', 'stories', 'games', 'certificate'];
onNavigate((name) => setBackground(MUSIC_SCREENS.includes(name) && !document.hidden));
document.addEventListener('visibilitychange', () => setBackground(!document.hidden && MUSIC_SCREENS.includes(currentScreen() ?? '')));
go('start');
