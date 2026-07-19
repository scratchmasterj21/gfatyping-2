import { Scene } from "phaser";

export class BootScene extends Scene {
  constructor() {
    super({ key: "Boot" });
  }

  create(): void {
    this.scene.start("Game");
  }
}
