/**
 * GameState — score, vies, jauge solidarité, slug actif.
 * Toutes mutations passent par l'EventBus.
 */
import { EventBus, EVENTS } from './EventBus';
import { Constants } from './Constants';

class GameStateManager {
  private _score: number = 0;
  private _lives: number = 3;
  private _solidarite: number = 0;
  private _activeSlug: string = '';
  private _activeGameId: number = 1;
  private _isGameOver: boolean = false;
  private _timer: number = 0;

  reset(gameId: number, slug: string): void {
    const global = Constants.scoringGlobal;
    this._score = 0;
    this._lives = global.vies_initiales;
    this._solidarite = 0;
    this._activeSlug = slug;
    this._activeGameId = gameId;
    this._isGameOver = false;
    this._timer = 0;
  }

  get score(): number { return this._score; }
  get lives(): number { return this._lives; }
  get solidarite(): number { return this._solidarite; }
  get activeSlug(): string { return this._activeSlug; }
  get activeGameId(): number { return this._activeGameId; }
  get isGameOver(): boolean { return this._isGameOver; }
  get timer(): number { return this._timer; }

  addScore(points: number): void {
    this._score = Math.max(0, this._score + points);
    EventBus.emit(EVENTS.SCORE_CHANGE, this._score);
  }

  loseLife(): void {
    this._lives = Math.max(0, this._lives - 1);
    EventBus.emit(EVENTS.LIFE_LOST, this._lives);
    if (this._lives <= 0) {
      this._isGameOver = true;
      EventBus.emit(EVENTS.GAME_OVER, this._score, this._solidarite);
    }
  }

  gainLife(): void {
    this._lives += 1;
    EventBus.emit(EVENTS.LIFE_GAINED, this._lives);
  }

  addSolidarite(amount: number): void {
    const max = Constants.scoringGlobal.jauge_solidarite_max;
    this._solidarite = Math.max(0, Math.min(max, this._solidarite + amount));
    EventBus.emit(EVENTS.SOLIDARITE_CHANGE, this._solidarite);
  }

  setTimer(seconds: number): void {
    this._timer = seconds;
    EventBus.emit(EVENTS.TIMER_TICK, this._timer);
  }

  triggerGameOver(): void {
    this._isGameOver = true;
    EventBus.emit(EVENTS.GAME_OVER, this._score, this._solidarite);
  }
}

export const GameState = new GameStateManager();
