import { GMath } from "./gmath.js";
import { checkTileCollisions, TileSize } from "./tile.js";
import { NetMsg, NetMsgId } from "../common/netcode.mjs";

const MoveSpeed = 50;
const LerpSpeed = 10;
const HitboxRadius = 12;
const BreakRadius = 14;

export class Player {
    constructor(index, x, y) {
        this.index = index;
        this.x = x;
        this.y = y;
        this.visualX = x;
        this.visualY = y;

        this.angle = 0;

        this.hitTileResult = { x: 0, y: 0 };
        this.breakTileResult = { x: 0, y: 0 };
        this.breakProgress = { isBreaking: false, breakingTime: 0 };
    }

    update(input, tilemap, dt) {
        let directionX = 0;
        let directionY = 0;

        if (input.isKeyPressed("KeyW")) {
            directionY -= 1;
        }
        if (input.isKeyPressed("KeyS")) {
            directionY += 1;
        }
        if (input.isKeyPressed("KeyA")) {
            directionX -= 1;
        }
        if (input.isKeyPressed("KeyD")) {
            directionX += 1;
        }

        if (directionX != 0 || directionY != 0) {
            this.angle = Math.atan2(directionY, directionX);
        }

        let velocityMag = MoveSpeed * dt;

        let directionMag = Math.sqrt(directionX * directionX + directionY * directionY);
        if (directionMag === 0) directionMag = 1;

        let velocityX = velocityMag * directionX / directionMag;
        let didHitTile = false;

        if (this.checkTileCollisions(tilemap, this.x + velocityX, this.y, HitboxRadius, this.hitTileResult)) {
            didHitTile = true;
        } else {
            this.x += velocityX;
        }

        let velocityY = velocityMag * directionY / directionMag;

        if (this.checkTileCollisions(tilemap, this.x, this.y + velocityY, HitboxRadius, this.hitTileResult)) {
            didHitTile = true;
        } else {
            this.y += velocityY;
        }

        this.updateBreakingAnimation(tilemap, dt);

        this.visualX = this.x;
        this.visualY = this.y;
    }

    tryRequestBreak(ws, packet, outMsgData) {
        if (!this.breakProgress.isBreaking || this.breakProgress.breakingTime < 1) {
            return;
        }

        packet.id = NetMsgId.BreakTile;
        packet.x = this.breakTileResult.x;
        packet.y = this.breakTileResult.y;
        ws.send(NetMsg.write(packet, outMsgData));
    }

    updateBreakingAnimation(tilemap, dt) {
        let lastBreakTileX = this.breakTileResult.x;
        let lastBreakTileY = this.breakTileResult.y;
        let isBreaking = this.checkTileCollisions(tilemap, this.x, this.y, BreakRadius, this.breakTileResult);

        this.breakProgress.isBreaking = isBreaking;

        if (!this.breakProgress.isBreaking || lastBreakTileX != this.breakTileResult.x || lastBreakTileY != this.breakTileResult.y) {
            this.breakProgress.breakingTime = 0;
        } else {
            this.breakProgress.breakingTime += dt;
        }
    }

    checkTileCollisions(tilemap, x, y, radius, result) {
        for (let offsetY = -1; offsetY <= 1; offsetY++) {
            for (let offsetX = -1; offsetX <= 1; offsetX++) {
                const pointX = x + offsetX * radius;
                const pointY = y + offsetY * radius;

                if (checkTileCollisions(tilemap, pointX, pointY, result)) {
                    return true;
                }
            }
        }

        return false;
    }

    remoteUpdate(tilemap, dt) {
        this.visualX = GMath.lerp(this.visualX, this.x, LerpSpeed * dt);
        this.visualY = GMath.lerp(this.visualY, this.y, LerpSpeed * dt);

        this.updateBreakingAnimation(tilemap, dt);
    }

    draw(ctx, assets) {
        if (this.breakProgress.isBreaking) {
            // ctx.globalAlpha = Math.min(this.breakProgress.breakingTime, 1);
            // ctx.fillStyle = "black";
            // ctx.drawImage(assets.this.hitTileResult.x * TileSize, this.hitTileResult.y * TileSize, TileSize, TileSize);
            // ctx.globalAlpha = 1;
            ctx.drawImage(assets.breaking, this.breakTileResult.x * TileSize, this.breakTileResult.y * TileSize);
        }

        ctx.save();
        ctx.translate(Math.floor(this.visualX), Math.floor(this.visualY));
        ctx.rotate(this.angle);
        ctx.drawImage(assets.mineman, Math.floor(-assets.mineman.width / 2), Math.floor(-assets.mineman.height / 2));
        ctx.restore();
    }
}