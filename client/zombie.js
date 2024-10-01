import { GMath } from "../common/gmath.mjs";
import { NetLerpSpeed } from "../common/netcode.mjs";
import { Breaker, ZombieBreakRadius } from "../common/breaker.mjs";
import { TileSize } from "../common/tile.mjs";

export class Zombie {
    constructor(index, x, y) {
        this.index = index;

        this.x = x;
        this.y = y;
        this.angle = 0;

        this.visualX = x;
        this.visualY = y;
        this.visualAngle = 0;

        this.breaker = new Breaker(ZombieBreakRadius);
    }

    remoteUpdate(tilemap, dt) {
        this.visualX = GMath.lerp(this.visualX, this.x, NetLerpSpeed * dt);
        this.visualY = GMath.lerp(this.visualY, this.y, NetLerpSpeed * dt);
        this.visualAngle = GMath.lerpAngle(this.visualAngle, this.angle, NetLerpSpeed * dt);

        this.breaker.update(tilemap, this.x, this.y, dt);
    }

    draw(ctx, assets) {
        if (this.breaker.isBreaking()) {
            ctx.drawImage(assets.breaking, this.breaker.getX() * TileSize, this.breaker.getY() * TileSize);
        }

        ctx.save();
        ctx.translate(Math.floor(this.visualX), Math.floor(this.visualY));
        ctx.rotate(this.visualAngle);
        ctx.drawImage(assets.zombie, Math.floor(-assets.zombie.width / 2), Math.floor(-assets.zombie.height / 2));
        ctx.restore();
    }
}