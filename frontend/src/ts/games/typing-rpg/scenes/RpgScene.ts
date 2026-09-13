import { GameObjects, Scene, Structs } from "phaser";

import { turnDamage } from "../battle-rules";
import { appearanceForWave, type MonsterKind } from "../wave-appearance";
import {
  monsterCountForWave,
  playerMaxHp,
  type QuestMode,
  turnSecondsForWave,
} from "../endless-rules";
import {
  activeElapsedSeconds,
  canMoveNearPlayerDuringSafety,
  encounterIsSafe,
  remainingTurnMs,
} from "../quest-flow";

type Direction = "up" | "down" | "left" | "right";
type Monster = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  destinationX: number;
  destinationY: number;
  nextDecisionAt: number;
  name: string;
  kind: MonsterKind;
  hp: number;
  maxHp: number;
  attack: number;
};

type BattleStage = "typing" | "enemy";
const PLAYER_SPEED = 3.2;
const PLAYER_ACCELERATION = 14;
const PLAYER_DRAG = 12;
const MONSTER_SPEED = 1.2;
const MONSTER_ACCELERATION = 4;
const ENCOUNTER_DISTANCE = 0.55;
const SAFE_DISTANCE = 1.15;
const START_SAFETY_MS = 1500;
const POST_BATTLE_SAFETY_MS = 2500;

const COLS = 13;
const ROWS = 9;
const SPAWNS = [
  { x: 5, y: 3 },
  { x: 8, y: 5 },
  { x: 11, y: 4 },
  { x: 4, y: 6 },
  { x: 9, y: 2 },
  { x: 11, y: 6 },
];
const MONSTER_STATS = [
  { hp: 8, attack: 2 },
  { hp: 12, attack: 3 },
  { hp: 18, attack: 4 },
] as const;
const MONSTER_COLORS: Record<MonsterKind, number> = {
  slime: 0x79b874,
  imp: 0xf3cfa0,
  guardian: 0xa85d7a,
};

export class RpgScene extends Scene {
  private words: string[] = [];
  private player = { x: 1, y: 4 };
  private playerVelocity = { x: 0, y: 0 };
  private heldDirections = new Set<Direction>();
  private monsters: Monster[] = [];
  private playerVisual?: GameObjects.Container;
  private monsterVisuals = new Map<Monster, GameObjects.Container>();
  private targetIndex: number | null = null;
  private wave = 1;
  private completedWaves = 0;
  private betweenWaves = false;
  private finished = false;
  private hits = 0;
  private mistakes = 0;
  private mode: QuestMode = "normal";
  private playerHp = playerMaxHp("normal");
  private battleStage: BattleStage = "typing";
  private turnEndsAt = 0;
  private turnRemainingMs = 20_000;
  private turnWords = 0;
  private turnNumber = 0;
  private turnMistakes = 0;
  private wordCursor = 0;
  private lastClock = 0;
  private lastPrompt = "";
  private dialogueOpen = false;
  private startedAt = 0;
  private pausedDurationMs = 0;
  private interruptedAt = 0;
  private interrupted = false;
  private hasMoved = false;
  private safeUntilAt = 0;
  private keydownHandler?: (event: KeyboardEvent) => void;
  private keyupHandler?: (event: KeyboardEvent) => void;
  private windowBlurHandler?: () => void;
  private windowFocusHandler?: () => void;
  private visibilityHandler?: () => void;
  private resizeHandler?: (size: Structs.Size) => void;
  private moveStartHandler?: (direction: Direction) => void;
  private moveStopHandler?: (direction: Direction) => void;
  private nudgeHandler?: (direction: Direction) => void;
  private attackHandler?: () => void;
  private missHandler?: () => void;
  private focusHandler?: () => void;
  private blurHandler?: () => void;
  private closeDialogueHandler?: () => void;

  constructor() {
    super({ key: "Rpg" });
  }

  create(): void {
    this.mode = this.registry.get("rpgMode") === "fast" ? "fast" : "normal";
    this.words = (this.registry.get("rpgWords") as string[] | undefined) ?? [
      "forest",
      "river",
      "light",
    ];
    this.playerVelocity = { x: 0, y: 0 };
    this.heldDirections.clear();
    this.player = { x: 1, y: 4 };
    this.wave = 1;
    this.completedWaves = 0;
    this.betweenWaves = false;
    this.spawnWave();
    this.targetIndex = null;
    this.finished = false;
    this.hits = 0;
    this.mistakes = 0;
    this.playerHp = playerMaxHp(this.mode);
    this.wordCursor = 0;
    this.turnNumber = 0;
    this.turnEndsAt = 0;
    this.turnRemainingMs = this.turnMs();
    this.lastPrompt = "";
    this.dialogueOpen = false;
    this.startedAt = performance.now();
    this.pausedDurationMs = 0;
    this.interruptedAt = 0;
    this.interrupted = false;
    this.hasMoved = false;
    this.safeUntilAt = 0;
    this.time.paused = false;
    this.draw();

    this.keydownHandler = (event) => {
      if (
        this.finished ||
        this.betweenWaves ||
        this.targetIndex !== null ||
        this.dialogueOpen
      ) {
        return;
      }
      if ((event.target as HTMLElement | null)?.tagName === "INPUT") return;
      const direction = this.directionForKey(event.key);
      if (direction !== undefined) {
        event.preventDefault();
        this.heldDirections.add(direction);
      } else if (event.key === "Enter" || event.key === " ") {
        if ((event.target as HTMLElement | null)?.tagName === "BUTTON") return;
        event.preventDefault();
        if (!event.repeat) this.interact();
      }
    };
    this.keyupHandler = (event) => {
      const direction = this.directionForKey(event.key);
      if (direction !== undefined) this.heldDirections.delete(direction);
    };
    this.windowBlurHandler = () => this.pauseRun();
    this.windowFocusHandler = () => this.resumeRun();
    this.visibilityHandler = () => {
      if (document.hidden) this.pauseRun();
      else this.resumeRun();
    };
    document.addEventListener("keydown", this.keydownHandler);
    document.addEventListener("keyup", this.keyupHandler);
    document.addEventListener("visibilitychange", this.visibilityHandler);
    window.addEventListener("blur", this.windowBlurHandler);
    window.addEventListener("focus", this.windowFocusHandler);
    this.moveStartHandler = (direction) => this.heldDirections.add(direction);
    this.moveStopHandler = (direction) => this.heldDirections.delete(direction);
    this.nudgeHandler = (direction) => this.nudge(direction);
    this.attackHandler = () => this.attack();
    this.missHandler = () => {
      if (
        this.targetIndex !== null &&
        this.battleStage === "typing" &&
        this.turnEndsAt !== 0
      ) {
        this.mistakes++;
        this.turnMistakes++;
      }
    };
    this.game.events.on("rpg-move-start", this.moveStartHandler);
    this.game.events.on("rpg-move-stop", this.moveStopHandler);
    this.game.events.on("rpg-nudge", this.nudgeHandler);
    this.game.events.on("rpg-interact", this.interact, this);
    this.game.events.on("rpg-attack", this.attackHandler);
    this.game.events.on("rpg-miss", this.missHandler);
    this.game.events.on("rpg-continue", this.continueWave, this);
    this.game.events.on("rpg-leave", this.endRun, this);
    this.focusHandler = () => {
      if (
        this.targetIndex === null ||
        this.battleStage !== "typing" ||
        this.turnEndsAt !== 0 ||
        this.interrupted ||
        document.hidden ||
        !document.hasFocus()
      ) {
        return;
      }
      this.turnEndsAt = performance.now() + this.turnRemainingMs;
      this.emitBattle();
    };
    this.blurHandler = () => {
      if (
        this.targetIndex === null ||
        this.battleStage !== "typing" ||
        this.turnEndsAt === 0
      ) {
        return;
      }
      this.turnRemainingMs = remainingTurnMs(
        this.turnEndsAt,
        performance.now(),
      );
      this.turnEndsAt = 0;
      this.emitBattle();
    };
    this.game.events.on("rpg-input-focus", this.focusHandler);
    this.game.events.on("rpg-input-blur", this.blurHandler);
    this.closeDialogueHandler = () => {
      this.dialogueOpen = false;
    };
    this.game.events.on("rpg-close-dialogue", this.closeDialogueHandler);
    this.resizeHandler = () => this.draw();
    this.scale.on("resize", this.resizeHandler);
    this.events.once("shutdown", this.shutdown, this);
    if (document.hidden || !document.hasFocus()) this.pauseRun();
  }

  private turnMs(): number {
    return turnSecondsForWave(this.wave, this.mode) * 1000;
  }

  private spawnWave(): void {
    const appearance = appearanceForWave(this.wave);
    this.monsters = Array.from(
      { length: monsterCountForWave(this.wave) },
      (_, index) => {
        const spawn = SPAWNS[index] ?? { x: 5, y: 3 };
        const typeIndex = (index + this.wave - 1) % MONSTER_STATS.length;
        const type = MONSTER_STATS[typeIndex] ?? MONSTER_STATS[0];
        const creature = appearance.monsters[typeIndex] ?? {
          name: "Moss Slime",
          kind: "slime",
        };
        const hp = type.hp + Math.floor((this.wave - 1) / 3) * 2;
        return {
          ...spawn,
          vx: 0,
          vy: 0,
          destinationX: spawn.x,
          destinationY: spawn.y,
          nextDecisionAt: 0,
          name: creature.name,
          kind: creature.kind,
          hp,
          maxHp: hp,
          attack: type.attack,
        };
      },
    );
  }

  private continueWave(): void {
    if (!this.betweenWaves || this.finished) return;
    this.wave++;
    this.betweenWaves = false;
    this.player = { x: 1, y: 4 };
    this.playerVelocity = { x: 0, y: 0 };
    this.heldDirections.clear();
    this.safeUntilAt = performance.now() + POST_BATTLE_SAFETY_MS;
    this.spawnWave();
    this.game.events.emit("rpg-wave-clear", null);
    this.draw();
  }

  private endRun(outcome: "left" | "defeated" = "left"): void {
    if (this.finished || (outcome === "left" && !this.betweenWaves)) return;
    this.finished = true;
    this.betweenWaves = false;
    const elapsed = activeElapsedSeconds(
      this.startedAt,
      performance.now(),
      this.pausedDurationMs,
    );
    this.game.events.emit("rpg-result", {
      score: Math.max(
        100,
        500 + 100 * (this.completedWaves - 1) - elapsed - this.mistakes * 5,
      ),
      elapsed,
      hits: this.hits,
      mistakes: this.mistakes,
      completedWaves: this.completedWaves,
      outcome,
    });
  }

  override update(_time: number, delta: number): void {
    if (this.interrupted) return;
    if (
      !this.finished &&
      !this.betweenWaves &&
      this.targetIndex === null &&
      !this.dialogueOpen
    ) {
      const seconds = Math.min(delta / 1000, 0.05);
      this.movePlayer(seconds);
      if (this.targetIndex === null) this.moveMonsters(seconds);
      const nextPrompt = this.prompt();
      if (nextPrompt !== this.lastPrompt) {
        this.lastPrompt = nextPrompt;
        this.game.events.emit("rpg-prompt", nextPrompt);
      }
    }
    if (
      this.targetIndex === null ||
      this.battleStage !== "typing" ||
      this.turnEndsAt === 0
    ) {
      return;
    }
    const remaining = remainingTurnMs(this.turnEndsAt, performance.now());
    if (remaining === 0) {
      this.endPlayerTurn();
    } else if (performance.now() - this.lastClock >= 100) {
      this.lastClock = performance.now();
      this.emitBattle();
    }
  }

  private pauseRun(): void {
    if (this.interrupted) return;
    this.interruptedAt = performance.now();
    if (this.turnEndsAt !== 0 && this.battleStage === "typing") {
      this.turnRemainingMs = remainingTurnMs(
        this.turnEndsAt,
        this.interruptedAt,
      );
      this.turnEndsAt = 0;
      this.emitBattle();
    }
    this.interrupted = true;
    this.time.paused = true;
    this.heldDirections.clear();
    this.playerVelocity = { x: 0, y: 0 };
    for (const monster of this.monsters) {
      monster.vx = 0;
      monster.vy = 0;
    }
  }

  private resumeRun(): void {
    if (!this.interrupted || document.hidden || !document.hasFocus()) return;
    const pauseMs = performance.now() - this.interruptedAt;
    this.pausedDurationMs += pauseMs;
    if (this.safeUntilAt > 0) this.safeUntilAt += pauseMs;
    for (const monster of this.monsters) {
      if (monster.nextDecisionAt > 0) monster.nextDecisionAt += pauseMs;
    }
    this.interrupted = false;
    this.interruptedAt = 0;
    this.time.paused = false;
    if (this.targetIndex !== null && this.battleStage === "typing") {
      this.game.events.emit("rpg-resume-input");
      this.emitBattle();
    }
  }

  private layout(): { size: number; left: number; top: number } {
    const size = Math.max(
      20,
      Math.floor(
        Math.min(
          (this.scale.width - 24) / COLS,
          (this.scale.height - 100) / ROWS,
        ),
      ),
    );
    return {
      size,
      left: Math.floor((this.scale.width - size * COLS) / 2),
      top: Math.max(25, Math.floor((this.scale.height - 70 - size * ROWS) / 2)),
    };
  }

  private center(x: number, y: number): { x: number; y: number } {
    const { size, left, top } = this.layout();
    return { x: left + (x + 0.5) * size, y: top + (y + 0.5) * size };
  }

  private draw(): void {
    this.children.removeAll(true);
    this.monsterVisuals.clear();
    const { size, left, top } = this.layout();
    const graphics = this.add.graphics();
    const appearance = appearanceForWave(this.wave);
    const theme = getComputedStyle(document.documentElement);
    const themeColor = (key: string, fallback: number): number => {
      const value = theme.getPropertyValue(key).trim();
      const hex = /^#([\da-f]{6})$/i.exec(value)?.[1];
      return hex === undefined ? fallback : Number.parseInt(hex, 16);
    };
    const accent = themeColor("--main-color", 0x79b874);
    const secondary = themeColor("--sub-color", 0x36744b);
    const highlight = themeColor("--text-color", 0xf3cfa0);
    graphics.fillStyle(0x172c2b);
    graphics.fillRect(0, 0, this.scale.width, this.scale.height);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        graphics.fillStyle((x + y) % 2 ? 0x4a7844 : 0x52804c);
        graphics.fillRect(left + x * size, top + y * size, size, size);
        const tileX = left + x * size;
        const tileY = top + y * size;
        const marker = (x * 7 + y * 11 + appearance.tier) % 5;
        if (appearance.floorIndex === 1) {
          graphics.fillStyle(accent, marker === 0 ? 0.36 : 0.12);
          graphics.fillTriangle(
            tileX + size * 0.25,
            tileY + size * 0.7,
            tileX + size * 0.5,
            tileY + size * 0.18,
            tileX + size * 0.75,
            tileY + size * 0.7,
          );
        } else if (appearance.floorIndex === 2) {
          graphics.fillStyle(secondary, marker < 2 ? 0.52 : 0.2);
          graphics.fillRect(
            tileX + size * 0.14,
            tileY + size * 0.42,
            size * 0.72,
            size * 0.12,
          );
          if (marker === 0) {
            graphics.fillStyle(accent, 0.6);
            graphics.fillCircle(
              tileX + size * 0.72,
              tileY + size * 0.28,
              size * 0.09,
            );
          }
        } else if (appearance.floorIndex === 3) {
          graphics.lineStyle(
            Math.max(1, size * 0.035),
            highlight,
            marker === 0 ? 0.62 : 0.22,
          );
          graphics.strokeCircle(
            tileX + size * 0.5,
            tileY + size * 0.5,
            size * 0.2,
          );
          graphics.fillStyle(secondary, 0.2);
          graphics.fillCircle(
            tileX + size * 0.5,
            tileY + size * 0.5,
            size * 0.06,
          );
        } else if (marker === 0 || appearance.tier > 0) {
          graphics.fillStyle(accent, appearance.tier > 0 ? 0.3 : 0.16);
          graphics.fillCircle(
            tileX + size * 0.48,
            tileY + size * 0.55,
            size * 0.09,
          );
        }
        if (x === 0 || x === COLS - 1 || y === 0 || y === ROWS - 1) {
          const p = this.center(x, y);
          if (appearance.floorIndex % 2 === 0) {
            graphics.fillStyle(0x245338);
            graphics.fillCircle(p.x, p.y + size * 0.06, size * 0.28);
            graphics.fillStyle(secondary, 0.8);
            graphics.fillCircle(p.x, p.y - size * 0.12, size * 0.24);
          } else {
            graphics.fillStyle(secondary, 0.7);
            graphics.fillRoundedRect(
              p.x - size * 0.3,
              p.y - size * 0.28,
              size * 0.6,
              size * 0.56,
              size * 0.1,
            );
            graphics.fillStyle(accent, 0.35);
            graphics.fillCircle(p.x, p.y, size * 0.12);
          }
        }
      }
    }

    const npc = this.center(1, 2);
    graphics.fillStyle(0x7f68ac);
    graphics.fillRoundedRect(
      npc.x - size * 0.18,
      npc.y - size * 0.15,
      size * 0.36,
      size * 0.48,
      4,
    );
    graphics.fillStyle(0xf3cfa0);
    graphics.fillCircle(npc.x, npc.y - size * 0.18, size * 0.14);
    this.label(npc.x, npc.y - size * 0.42, "Guide", Math.max(10, size * 0.16));

    for (const monster of this.monsters) {
      if (monster.hp === 0) continue;
      const p = this.center(monster.x, monster.y);
      const visual = this.add.container(p.x, p.y);
      const body = this.add.graphics();
      const bodyColor = MONSTER_COLORS[monster.kind];
      body.fillStyle(bodyColor);
      body.fillRoundedRect(
        -size * 0.28,
        -size * 0.2,
        size * 0.56,
        size * 0.48,
        size * 0.16,
      );
      if (monster.kind !== "slime") {
        body.fillStyle(bodyColor);
        body.fillTriangle(
          -size * 0.23,
          -size * 0.11,
          -size * 0.25,
          -size * 0.42,
          -size * 0.04,
          -size * 0.18,
        );
        body.fillTriangle(
          size * 0.23,
          -size * 0.11,
          size * 0.25,
          -size * 0.42,
          size * 0.04,
          -size * 0.18,
        );
      }
      body.fillStyle(0xffffff);
      body.fillCircle(-size * 0.09, 0, size * 0.055);
      body.fillCircle(size * 0.09, 0, size * 0.055);
      body.fillStyle(0x172c2b);
      body.fillCircle(-size * 0.09, 0, size * 0.025);
      body.fillCircle(size * 0.09, 0, size * 0.025);
      visual.add(body);
      visual.add(
        this.label(
          0,
          -size * 0.41,
          `${monster.name} ${monster.hp}/${monster.maxHp}`,
          Math.max(9, size * 0.14),
        ),
      );
      this.monsterVisuals.set(monster, visual);
    }

    const p = this.center(this.player.x, this.player.y);
    this.playerVisual = this.add.container(p.x, p.y);
    const playerBody = this.add.graphics();
    playerBody.fillStyle(0x395fbd);
    playerBody.fillRoundedRect(
      -size * 0.19,
      -size * 0.02,
      size * 0.38,
      size * 0.48,
      4,
    );
    this.playerVisual.add(playerBody);
    this.emitPlayerPosition();
    this.label(
      this.scale.width / 2,
      14,
      `${this.mode === "fast" ? "FAST · " : ""}${appearance.name} · Wave ${this.wave} · HP ${this.playerHp}/${playerMaxHp(this.mode)} · ${this.monsters.filter((monster) => monster.hp === 0).length}/${this.monsters.length} monsters`,
      15,
    );
    this.lastPrompt = this.prompt();
    this.game.events.emit("rpg-prompt", this.lastPrompt);
    const defeated = this.monsters.filter((monster) => monster.hp === 0).length;
    this.game.events.emit(
      "rpg-objective",
      this.betweenWaves
        ? `Wave ${this.wave} cleared · Choose your next move`
        : `${appearance.name} · Wave ${this.wave} · Defeat monsters · ${defeated}/${this.monsters.length}`,
    );
  }

  private emitPlayerPosition(): void {
    if (this.playerVisual === undefined) return;
    const { size } = this.layout();
    this.game.events.emit("rpg-player-position", {
      x: this.playerVisual.x,
      y: this.playerVisual.y - size * 0.16,
      size: Math.min(34, size * 0.42),
    });
  }

  private directionForKey(key: string): Direction | undefined {
    const directions: Record<string, Direction> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      s: "down",
      a: "left",
      d: "right",
    };
    return directions[key.toLowerCase()] ?? directions[key];
  }

  private approach(current: number, target: number, maxChange: number): number {
    return (
      current + Math.max(-maxChange, Math.min(maxChange, target - current))
    );
  }

  private nudge(direction: Direction): void {
    if (
      this.finished ||
      this.betweenWaves ||
      this.targetIndex !== null ||
      this.dialogueOpen
    ) {
      return;
    }
    const impulse = PLAYER_SPEED;
    if (direction === "left") this.playerVelocity.x = -impulse;
    if (direction === "right") this.playerVelocity.x = impulse;
    if (direction === "up") this.playerVelocity.y = -impulse;
    if (direction === "down") this.playerVelocity.y = impulse;
  }

  private encounterSafe(now = performance.now()): boolean {
    return encounterIsSafe(this.hasMoved, this.safeUntilAt, now);
  }

  private label(
    x: number,
    y: number,
    value: string,
    size: number,
  ): GameObjects.Text {
    return this.add
      .text(x, y, value, {
        fontFamily: "monospace",
        fontSize: `${size}px`,
        color: "#ffffff",
        stroke: "#173028",
        strokeThickness: 3,
      })
      .setOrigin(0.5);
  }

  private prompt(): string {
    if (this.betweenWaves) {
      return `Wave ${this.wave} cleared. Continue or leave with your reward.`;
    }
    if (Math.hypot(this.player.x - 1, this.player.y - 2) <= 1.2) {
      return "Press Enter to talk to the Guide.";
    }
    if (this.hasMoved && this.encounterSafe()) {
      return "Safe for a moment—move away from nearby monsters.";
    }
    return "Hold arrows or WASD to move. Monsters roam this floor.";
  }

  private movePlayer(seconds: number): void {
    const horizontal =
      Number(this.heldDirections.has("right")) -
      Number(this.heldDirections.has("left"));
    const vertical =
      Number(this.heldDirections.has("down")) -
      Number(this.heldDirections.has("up"));
    const length = Math.hypot(horizontal, vertical) || 1;
    const acceleration =
      horizontal === 0 && vertical === 0 ? PLAYER_DRAG : PLAYER_ACCELERATION;
    this.playerVelocity.x = this.approach(
      this.playerVelocity.x,
      (horizontal / length) * PLAYER_SPEED,
      acceleration * seconds,
    );
    this.playerVelocity.y = this.approach(
      this.playerVelocity.y,
      (vertical / length) * PLAYER_SPEED,
      acceleration * seconds,
    );
    const oldX = this.player.x;
    const oldY = this.player.y;
    this.player.x = Math.max(
      1,
      Math.min(COLS - 2, this.player.x + this.playerVelocity.x * seconds),
    );
    this.player.y = Math.max(
      1,
      Math.min(ROWS - 2, this.player.y + this.playerVelocity.y * seconds),
    );
    if (this.player.x === 1 || this.player.x === COLS - 2) {
      this.playerVelocity.x = 0;
    }
    if (this.player.y === 1 || this.player.y === ROWS - 2) {
      this.playerVelocity.y = 0;
    }
    const guideDistance = Math.hypot(this.player.x - 1, this.player.y - 2);
    if (guideDistance < 0.42) {
      const angle = Math.atan2(this.player.y - 2, this.player.x - 1);
      this.player.x = Math.max(1, 1 + Math.cos(angle) * 0.42);
      this.player.y = 2 + Math.sin(angle) * 0.42;
      this.playerVelocity = { x: 0, y: 0 };
    }
    if (this.player.x === oldX && this.player.y === oldY) return;
    if (!this.hasMoved) {
      this.hasMoved = true;
      this.safeUntilAt = performance.now() + START_SAFETY_MS;
    }
    const visual = this.playerVisual;
    if (visual !== undefined) {
      const position = this.center(this.player.x, this.player.y);
      visual.setPosition(position.x, position.y);
      this.emitPlayerPosition();
    }
    const target = this.encounterSafe()
      ? -1
      : this.monsters.findIndex(
          (monster) =>
            monster.hp > 0 &&
            Math.hypot(monster.x - this.player.x, monster.y - this.player.y) <
              ENCOUNTER_DISTANCE,
        );
    if (target >= 0) {
      this.beginBattle(target);
    }
  }

  private attack(): void {
    if (
      this.targetIndex === null ||
      this.finished ||
      this.battleStage !== "typing" ||
      this.turnEndsAt === 0
    ) {
      return;
    }
    this.turnWords++;
    this.hits++;
    this.wordCursor++;
    this.game.events.emit("rpg-word-hit");
    this.emitBattle();
  }

  private beginBattle(index: number): void {
    if (
      this.targetIndex !== null ||
      this.finished ||
      this.betweenWaves ||
      this.encounterSafe()
    ) {
      return;
    }
    this.targetIndex = index;
    this.heldDirections.clear();
    this.playerVelocity = { x: 0, y: 0 };
    for (const monster of this.monsters) {
      monster.vx = 0;
      monster.vy = 0;
    }
    this.battleStage = "typing";
    this.turnWords = 0;
    this.turnNumber++;
    this.turnMistakes = 0;
    this.turnEndsAt = 0;
    this.turnRemainingMs = this.turnMs();
    this.game.events.emit("rpg-dialogue", null);
    this.emitBattle();
  }

  private emitBattle(message?: string): void {
    const monster =
      this.targetIndex === null ? undefined : this.monsters[this.targetIndex];
    if (monster === undefined) return;
    this.game.events.emit("rpg-battle", {
      wave: this.wave,
      name: monster.name,
      kind: monster.kind,
      word: this.words[this.wordCursor % this.words.length],
      hp: monster.hp,
      maxHp: monster.maxHp,
      playerHp: this.playerHp,
      stage: this.battleStage,
      ready: this.turnEndsAt !== 0,
      seconds: Math.ceil(
        Math.max(
          0,
          this.turnEndsAt === 0
            ? this.turnRemainingMs
            : this.turnEndsAt - performance.now(),
        ) / 1000,
      ),
      turnSeconds: turnSecondsForWave(this.wave, this.mode),
      wordsTyped: this.turnWords,
      mistakesThisTurn: this.turnMistakes,
      turn: this.turnNumber,
      message,
    });
  }

  private endPlayerTurn(): void {
    if (this.targetIndex === null || this.battleStage !== "typing") return;
    const monster = this.monsters[this.targetIndex];
    if (monster === undefined) return;
    this.battleStage = "enemy";
    const damage = turnDamage(this.turnWords, this.turnMistakes);
    monster.hp = Math.max(0, monster.hp - damage);
    this.game.events.emit("rpg-turn-hit", damage);
    this.emitBattle(
      monster.hp === 0
        ? `You dealt ${damage} damage! ${monster.name} is defeated!`
        : `You dealt ${damage} damage! ${monster.name} is winding up…`,
    );
    this.draw();
    if (monster.hp === 0) {
      this.time.delayedCall(1100, () => {
        this.targetIndex = null;
        this.safeUntilAt = performance.now() + POST_BATTLE_SAFETY_MS;
        this.game.events.emit("rpg-battle", null);
        if (this.monsters.every((next) => next.hp === 0)) {
          this.completedWaves = this.wave;
          this.betweenWaves = true;
          this.heldDirections.clear();
          this.playerVelocity = { x: 0, y: 0 };
          this.game.events.emit("rpg-wave-clear", {
            wave: this.wave,
            hp: this.playerHp,
            nextTurnSeconds: turnSecondsForWave(this.wave + 1, this.mode),
            nextMonsterCount: monsterCountForWave(this.wave + 1),
            nextFloorName: appearanceForWave(this.wave + 1).name,
          });
        }
        this.draw();
      });
      return;
    }
    this.time.delayedCall(1200, () => {
      if (this.targetIndex === null || this.finished) return;
      this.playerHp = Math.max(0, this.playerHp - monster.attack);
      this.game.events.emit("rpg-enemy-hit", monster.attack);
      this.emitBattle(`${monster.name} hit you for ${monster.attack}!`);
      this.draw();
      if (this.playerHp === 0) {
        this.time.delayedCall(900, () => this.endRun("defeated"));
      } else {
        this.time.delayedCall(900, () => {
          if (this.finished) return;
          this.battleStage = "typing";
          this.turnWords = 0;
          this.turnNumber++;
          this.turnMistakes = 0;
          this.turnEndsAt = 0;
          this.turnRemainingMs = this.turnMs();
          this.emitBattle();
        });
      }
    });
  }

  private chooseMonsterDestination(monster: Monster): void {
    for (let attempt = 0; attempt < 12; attempt++) {
      const x = 1 + Math.random() * (COLS - 3);
      const y = 1 + Math.random() * (ROWS - 3);
      if (Math.hypot(x - 1, y - 2) < 0.8) {
        continue;
      }
      monster.destinationX = x;
      monster.destinationY = y;
      break;
    }
    monster.nextDecisionAt = performance.now() + 1800 + Math.random() * 2200;
  }

  private moveMonsters(seconds: number): void {
    const now = performance.now();
    const safe = this.encounterSafe(now);
    for (let index = 0; index < this.monsters.length; index++) {
      const monster = this.monsters[index];
      if (monster === undefined || monster.hp === 0) continue;
      const playerDistance = Math.hypot(
        monster.x - this.player.x,
        monster.y - this.player.y,
      );
      if (
        now >= monster.nextDecisionAt ||
        Math.hypot(
          monster.x - monster.destinationX,
          monster.y - monster.destinationY,
        ) < 0.25
      ) {
        this.chooseMonsterDestination(monster);
      }
      const fleeing = safe && playerDistance < SAFE_DISTANCE + 0.5;
      const isImp = monster.kind === "imp";
      const isGuardian = monster.kind === "guardian";
      const aggroRange = isImp ? 3.2 : isGuardian ? 1.7 : 2.4;
      const chasing = !safe && playerDistance < aggroRange;
      const awayX =
        playerDistance > 0
          ? (monster.x - this.player.x) / playerDistance
          : index % 2 === 0
            ? 1
            : -1;
      const awayY =
        playerDistance > 0 ? (monster.y - this.player.y) / playerDistance : 0;
      const destinationX = fleeing
        ? monster.x + awayX * 2
        : chasing
          ? this.player.x
          : monster.destinationX;
      const destinationY = fleeing
        ? monster.y + awayY * 2
        : chasing
          ? this.player.y
          : monster.destinationY;
      const distance = Math.hypot(
        destinationX - monster.x,
        destinationY - monster.y,
      );
      const typeSpeed = isImp ? 1.25 : isGuardian ? 0.85 : 1;
      const speed = MONSTER_SPEED * typeSpeed * (chasing ? 1.2 : 1);
      const targetVx =
        distance < 0.15 ? 0 : ((destinationX - monster.x) / distance) * speed;
      const targetVy =
        distance < 0.15 ? 0 : ((destinationY - monster.y) / distance) * speed;
      monster.vx = this.approach(
        monster.vx,
        targetVx,
        MONSTER_ACCELERATION * seconds,
      );
      monster.vy = this.approach(
        monster.vy,
        targetVy,
        MONSTER_ACCELERATION * seconds,
      );
      const x = Math.max(
        1,
        Math.min(COLS - 2, monster.x + monster.vx * seconds),
      );
      const y = Math.max(
        1,
        Math.min(ROWS - 2, monster.y + monster.vy * seconds),
      );
      const blocked =
        Math.hypot(x - 1, y - 2) < 0.55 ||
        (safe &&
          !canMoveNearPlayerDuringSafety(
            playerDistance,
            Math.hypot(x - this.player.x, y - this.player.y),
            SAFE_DISTANCE,
          )) ||
        this.monsters.some(
          (other) =>
            other !== monster &&
            other.hp > 0 &&
            Math.hypot(x - other.x, y - other.y) < 0.54,
        );
      if (blocked) {
        monster.vx = 0;
        monster.vy = 0;
        monster.nextDecisionAt = 0;
        continue;
      }
      monster.x = x;
      monster.y = y;
      const visual = this.monsterVisuals.get(monster);
      if (visual !== undefined) {
        const position = this.center(x, y);
        visual.setPosition(position.x, position.y);
      }
      if (
        !safe &&
        Math.hypot(x - this.player.x, y - this.player.y) < ENCOUNTER_DISTANCE
      ) {
        this.beginBattle(index);
        return;
      }
    }
  }

  private interact(): void {
    if (
      this.finished ||
      this.betweenWaves ||
      this.targetIndex !== null ||
      this.dialogueOpen
    ) {
      return;
    }
    if (Math.hypot(this.player.x - 1, this.player.y - 2) <= 1.2) {
      this.dialogueOpen = true;
      this.heldDirections.clear();
      this.playerVelocity = { x: 0, y: 0 };
      this.game.events.emit(
        "rpg-dialogue",
        `Defeat every monster to clear a wave. You have ${playerMaxHp(this.mode)} HP with no recovery. ${this.mode === "fast" ? "Every typing turn is 8 seconds." : "Typing turns start at 20 seconds and shrink to 8 seconds by wave 7."} Continue or leave after each wave.`,
      );
      return;
    }
  }

  private shutdown(): void {
    if (this.keydownHandler !== undefined) {
      document.removeEventListener("keydown", this.keydownHandler);
    }
    if (this.keyupHandler !== undefined) {
      document.removeEventListener("keyup", this.keyupHandler);
    }
    if (this.windowBlurHandler !== undefined) {
      window.removeEventListener("blur", this.windowBlurHandler);
    }
    if (this.windowFocusHandler !== undefined) {
      window.removeEventListener("focus", this.windowFocusHandler);
    }
    if (this.visibilityHandler !== undefined) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
    }
    if (this.resizeHandler !== undefined) {
      this.scale.off("resize", this.resizeHandler);
    }
    if (this.moveStartHandler !== undefined) {
      this.game.events.off("rpg-move-start", this.moveStartHandler);
    }
    if (this.moveStopHandler !== undefined) {
      this.game.events.off("rpg-move-stop", this.moveStopHandler);
    }
    if (this.nudgeHandler !== undefined) {
      this.game.events.off("rpg-nudge", this.nudgeHandler);
    }
    this.game.events.off("rpg-interact", this.interact, this);
    this.game.events.off("rpg-continue", this.continueWave, this);
    this.game.events.off("rpg-leave", this.endRun, this);
    if (this.attackHandler !== undefined) {
      this.game.events.off("rpg-attack", this.attackHandler);
    }
    if (this.missHandler !== undefined) {
      this.game.events.off("rpg-miss", this.missHandler);
    }
    if (this.focusHandler !== undefined) {
      this.game.events.off("rpg-input-focus", this.focusHandler);
    }
    if (this.blurHandler !== undefined) {
      this.game.events.off("rpg-input-blur", this.blurHandler);
    }
    if (this.closeDialogueHandler !== undefined) {
      this.game.events.off("rpg-close-dialogue", this.closeDialogueHandler);
    }
  }
}
