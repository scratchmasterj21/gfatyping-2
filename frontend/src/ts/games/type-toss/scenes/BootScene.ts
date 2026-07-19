import { Scene } from "phaser";

// ASSETS: Add real asset loads here, e.g.:
//   this.load.image("duck", "https://your-cdn.com/duck.png");
//   this.load.image("panda", "https://your-cdn.com/panda.png");
//   this.load.image("tt-bg", "https://your-cdn.com/carnival-bg.png");
//   this.load.image("shelf", "https://your-cdn.com/shelf.png");
// Then replace placeholder drawing in Target.drawBody() and GameScene methods.

export class BootScene extends Scene {
  constructor() {
    super({ key: "Boot" });
  }

  create(): void {
    if (!this.textures.exists("tt-particle")) {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillCircle(8, 8, 8);
      g.generateTexture("tt-particle", 16, 16);
      g.destroy();
    }
    this.scene.start("Game");
  }
}
