import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/silkscreen/400.css';
import { App } from './app/app';
import { audio } from './audio/audio';
import { Input } from './core/input';
import { startLoop } from './core/loop';
import { Screen } from './core/screen';
import type { Game } from './game/game';
import { loadArt } from './render/art/assets';

declare global {
  interface Window {
    /** Dev builds only: the whole app, for poking at state from the browser console. */
    __app?: App;
    /** Dev builds only: the running game, if one is running. */
    readonly __gpp?: Game | null;
  }
}

/** Text is measured as it's drawn, so wait for the fonts (but not forever). */
async function loadFonts(): Promise<void> {
  const fonts = Promise.all([
    document.fonts.load('8px "Pixelify Sans"'),
    document.fonts.load('bold 8px "Pixelify Sans"'),
    document.fonts.load('8px Silkscreen'),
  ]);
  await Promise.race([fonts, new Promise((resolve) => setTimeout(resolve, 2500))]);
}

async function boot(): Promise<void> {
  await Promise.all([loadFonts(), loadArt()]);
  const screen = new Screen(
    document.getElementById('game') as HTMLCanvasElement,
    document.getElementById('ui') as HTMLCanvasElement,
  );
  const input = new Input(window, screen.toGamePx);
  const app = new App(screen, input);

  // Browsers only allow sound after the player does something.
  const unlock = (): void => audio.unlock();
  window.addEventListener('keydown', unlock);
  window.addEventListener('mousedown', unlock);

  if (import.meta.env.DEV) {
    window.__app = app;
    Object.defineProperty(window, '__gpp', { get: () => app.game, configurable: true });
  }

  startLoop(
    (dt) => {
      app.update(dt);
      input.endTick();
    },
    (_alpha, fps) => {
      app.render(fps);
      audio.update();
    },
  );
}

void boot();
