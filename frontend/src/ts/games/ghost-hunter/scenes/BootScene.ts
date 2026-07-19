import { Scene } from "phaser";

// ASSETS: Add real asset loads here, e.g.:
//   this.load.image("ghost", "https://your-cdn.com/ghost.png");
//   this.load.image("player", "https://your-cdn.com/ghost-buster.png");
//   this.load.image("gh-bg", "https://your-cdn.com/haunted-bg.png");
// Then swap out the placeholder graphics in GameScene and Ghost.ts.

export class BootScene extends Scene {
  constructor() {
    super({ key: "Boot" });
  }

  create(): void {
    // Generate a soft glow particle texture for the pop effect
    if (!this.textures.exists("gh-particle")) {
      const g = this.add.graphics();
      g.fillStyle(0xaaddff, 1);
      g.fillCircle(12, 12, 12);
      g.generateTexture("gh-particle", 24, 24);
      g.destroy();
    }
    this.scene.start("Game");
  }
}
