import { audio } from '../audio/audio';
import type { Input } from '../core/input';
import { clamp } from '../core/math';
import { isFullscreen, setFullscreen, stageOrigin, type Screen } from '../core/screen';
import { saveSettings, settings } from '../core/settings';
import { Game } from '../game/game';
import { clearSave, hasSave, loadSave, newSave } from '../game/save';
import { Hud } from '../ui/hud';
import { ChapterCard, IntroScreen } from './intro';
import { TitleScreen } from './title';

/** Black between screens, so nothing cuts hard. */
const FADE_IN = 0.6;

type Stage = { kind: 'title' } | { kind: 'intro'; screen: IntroScreen } | { kind: 'chapter'; screen: ChapterCard } | { kind: 'game' };

/**
 * The whole program: title, the story intro, the chapter card, then the game.
 * Owns which of those is showing and hands control between them.
 */
export class App {
  game: Game | null = null;
  private stage: Stage = { kind: 'title' };
  private readonly title: TitleScreen;
  private readonly hud: Hud;
  private fadeT = 0;

  constructor(private readonly screen: Screen, private readonly input: Input) {
    this.hud = new Hud(screen.game, screen.ui, () => screen.uiScale);
    this.title = new TitleScreen(input, {
      hasSave,
      continueGame: () => this.continueGame(),
      newGame: () => this.newGame(),
    });
    audio.music('title');
  }

  private go(stage: Stage): void {
    this.stage = stage;
    this.fadeT = 0;
  }

  private newGame(): void {
    clearSave();
    audio.music(null);
    this.go({ kind: 'intro', screen: new IntroScreen(this.input, () => this.showChapter()) });
  }

  private showChapter(): void {
    this.go({ kind: 'chapter', screen: new ChapterCard(this.input, () => this.startGame(true)) });
  }

  private continueGame(): void {
    const save = loadSave();
    if (!save) {
      this.newGame();
      return;
    }
    this.game = new Game(this.screen, this.input, save, this.gameHooks(), false);
    this.go({ kind: 'game' });
  }

  private startGame(opening: boolean): void {
    this.game = new Game(this.screen, this.input, newSave(), this.gameHooks(), opening);
    this.go({ kind: 'game' });
  }

  private gameHooks(): ConstructorParameters<typeof Game>[3] {
    return {
      quit: () => this.backToTitle(),
      reset: () => {
        clearSave();
        this.backToTitle();
      },
    };
  }

  private backToTitle(): void {
    this.game = null;
    this.title.returnTo();
    this.go({ kind: 'title' });
  }

  update(dt: number): void {
    this.fadeT += dt;
    // Alt+Enter flips fullscreen anywhere, like most PC games.
    if (this.input.wasPressed('Enter') && (this.input.isDown('AltLeft') || this.input.isDown('AltRight'))) {
      settings.fullscreen = !isFullscreen();
      saveSettings();
      setFullscreen(settings.fullscreen);
      return;
    }
    // Screens laid out at the base size sit on a centered stage; the game uses the whole view.
    const o = this.stage.kind === 'game' ? { x: 0, y: 0 } : stageOrigin();
    this.input.setOrigin(o.x, o.y);
    switch (this.stage.kind) {
      case 'title':
        this.title.update(dt);
        break;
      case 'intro':
      case 'chapter':
        this.stage.screen.update(dt);
        break;
      case 'game':
        this.game?.update(dt);
        break;
    }
  }

  render(fps: number): void {
    const ctx = this.screen.game;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    switch (this.stage.kind) {
      case 'title':
        this.title.render(ctx, this.hud);
        break;
      case 'intro':
      case 'chapter':
        this.stage.screen.render(ctx, this.hud);
        break;
      case 'game':
        this.game?.render(fps);
        break;
    }
    const k = clamp(1 - this.fadeT / FADE_IN, 0, 1);
    if (k > 0) this.hud.fade(k);
    this.screen.present();
  }
}
