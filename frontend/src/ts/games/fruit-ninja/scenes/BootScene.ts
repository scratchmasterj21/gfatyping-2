import { Scene } from "phaser";

// ASSETS: Add real asset loads here, e.g.:
//   this.load.image("banana", "https://your-cdn.com/banana.png");
//   this.load.image("apple", "https://your-cdn.com/apple.png");
//   this.load.image("watermelon", "https://your-cdn.com/watermelon.png");
//   this.load.image("orange", "https://your-cdn.com/orange.png");
//   this.load.image("grape", "https://your-cdn.com/grape.png");
//   this.load.image("fn-bg", "https://your-cdn.com/wood-bg.png");
//   this.load.image("ninja", "https://your-cdn.com/ninja.png");
// Then remove drawBody() placeholder in Fruit.ts and drawBackground/drawPlayer in GameScene.ts.

export class BootScene extends Scene {
  constructor() {
    super({ key: "Boot" });
  }

  create(): void {
    if (!this.textures.exists("fn-particle")) {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillCircle(8, 8, 8);
      g.generateTexture("fn-particle", 16, 16);
      g.destroy();
    }
    this.scene.start("Game");
  }
}
