import { Scene } from "phaser";

export class BootScene extends Scene {
  constructor() {
    super({ key: "Boot" });
  }

  create(): void {
    // Generate soft white glow for pop particles
    if (!this.textures.exists("bp-particle")) {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillCircle(16, 16, 16);
      g.generateTexture("bp-particle", 32, 32);
      g.destroy();
    }
    this.scene.start("Game");
  }
}
