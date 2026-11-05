import { Scene } from "phaser";

import { tappyTextureDefs } from "../../shared/phaser-ui";
import { addSvgTextures, ensureKidFont } from "../../shared/svg-texture";
import { fruitTextureDefs } from "../art";

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
    void Promise.all([
      ensureKidFont(),
      addSvgTextures(this, { ...fruitTextureDefs(), ...tappyTextureDefs() }),
    ]).then(() => {
      if (this.scene.isActive()) this.scene.start("Game");
    });
  }
}
