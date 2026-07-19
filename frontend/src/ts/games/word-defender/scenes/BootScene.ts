import { Scene } from "phaser";

export class BootScene extends Scene {
  constructor() {
    super({ key: "Boot" });
  }

  preload(): void {
    this.load.crossOrigin = "anonymous";
    this.load.image("ship", "https://i.imgur.com/Tz1r5fg.png");
    this.load.image("base", "https://i.imgur.com/U6dJDDv.png");
  }

  create(): void {
    this.scene.start("Game");
  }
}
