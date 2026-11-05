import { Scene } from "phaser";

import { tappyTextureDefs } from "../../shared/phaser-ui";
import { addSvgTextures, ensureKidFont } from "../../shared/svg-texture";
import { ghostTextureDefs } from "../art";

export class BootScene extends Scene {
  constructor() {
    super({ key: "Boot" });
  }

  create(): void {
    if (!this.textures.exists("gh-fog")) {
      // soft round glow for the fog drifting over the fence
      const size = 256;
      const tex = this.textures.createCanvas("gh-fog", size, size);
      const ctx = tex?.getContext();
      if (tex && ctx) {
        const g = ctx.createRadialGradient(
          size / 2,
          size / 2,
          0,
          size / 2,
          size / 2,
          size / 2,
        );
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        tex.refresh();
      }
    }
    void Promise.all([
      ensureKidFont(),
      addSvgTextures(this, { ...ghostTextureDefs(), ...tappyTextureDefs() }),
    ]).then(() => {
      if (this.scene.isActive()) this.scene.start("Game");
    });
  }
}
