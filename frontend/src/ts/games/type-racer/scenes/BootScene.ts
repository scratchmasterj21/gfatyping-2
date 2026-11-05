import { Scene } from "phaser";

import { tappyTextureDefs } from "../../shared/phaser-ui";
import { addSvgTextures, ensureKidFont } from "../../shared/svg-texture";
import { racerTextureDefs } from "../art";

export class BootScene extends Scene {
  constructor() {
    super({ key: "Boot" });
  }

  create(): void {
    void Promise.all([
      ensureKidFont(),
      addSvgTextures(this, { ...racerTextureDefs(), ...tappyTextureDefs() }),
    ]).then(() => {
      if (this.scene.isActive()) this.scene.start("Game");
    });
  }
}
