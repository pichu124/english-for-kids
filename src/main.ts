import '@fontsource/baloo-2/vietnamese-600.css';
import '@fontsource/baloo-2/vietnamese-800.css';
import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/latin-800.css';
import './styles/base.css';
import './styles/screens.css';
import './styles/lesson.css';

import { requestPersistence } from './lib/storage';
import { startUsageClock } from './lib/usage';
import { currentScreen, go, mount, register } from './router';
import { homeScreen } from './screens/home';
import { lessonScreen } from './screens/lesson';
import { restScreen } from './screens/rest';
import { startScreen } from './screens/start';
import { h } from './lib/dom';

register('start', startScreen);
register('home', homeScreen);
register('rest', restScreen);
register('lesson', lessonScreen);
for (const name of ['world', 'parent'] as const) {
  register(name, (ctx) => h('main', { onclick: () => ctx.go('home') }, `${name} — coming soon`));
}

mount(document.getElementById('app')!);
requestPersistence();
startUsageClock(() => {
  const s = currentScreen();
  return s === 'home' || s === 'lesson' || s === 'world';
});
go('start');
