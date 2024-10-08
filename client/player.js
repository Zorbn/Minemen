import { GMath } from "../common/gmath.mjs";
import { HumanoidHitboxRadius } from "../common/collision.mjs";
import { checkRadiusTileCollisions, TileSize } from "../common/tile.mjs";
import { NetLerpSpeed, NetMsg, NetMsgId } from "../common/netcode.mjs";
import { Breaker, PlayerBreakRadius } from "../common/breaker.mjs";
import { RoomSize } from "../common/room.mjs";

const MoveSpeed = 75;

export class Player {
    constructor(index, x, y, health) {
        this.index = index;

        this.x = x;
        this.y = y;
        this.visualX = x;
        this.visualY = y;

        this.angle = 0;

        this.breaker = new Breaker(PlayerBreakRadius);

        this.health = health;
        this.isRespawning = false;

        this.money = 0;
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

        if (checkRadiusTileCollisions(tilemap, this.x + velocityX, this.y, HumanoidHitboxRadius, null)) {
            didHitTile = true;
        } else {
            this.x += velocityX;
        }

        let velocityY = velocityMag * directionY / directionMag;

        if (checkRadiusTileCollisions(tilemap, this.x, this.y + velocityY, HumanoidHitboxRadius, null)) {
            didHitTile = true;
        } else {
            this.y += velocityY;
        }

        this.x = GMath.clamp(this.x, 0, RoomSize);
        this.y = GMath.clamp(this.y, 0, RoomSize);

        this.breaker.update(tilemap, this.x, this.y, dt);

        this.visualX = this.x;
        this.visualY = this.y;
    }

    tryRequestBreak(ws, packet) {
        if (!this.breaker.isReady()) {
            return;
        }

        packet.id = NetMsgId.BreakTile;
        packet.playerIndex = this.index;
        packet.x = this.breaker.getX();
        packet.y = this.breaker.getY();
        ws.send(NetMsg.write(packet));
    }

    remoteUpdate(tilemap, dt) {
        this.visualX = GMath.lerp(this.visualX, this.x, NetLerpSpeed * dt);
        this.visualY = GMath.lerp(this.visualY, this.y, NetLerpSpeed * dt);

        this.breaker.update(tilemap, this.x, this.y, dt);
    }

    draw(ctx, assets) {
        if (this.breaker.isBreaking()) {
            ctx.drawImage(assets.breaking, this.breaker.getX() * TileSize, this.breaker.getY() * TileSize);
        }

        ctx.save();
        ctx.translate(Math.floor(this.visualX), Math.floor(this.visualY));
        ctx.rotate(this.angle);
        ctx.drawImage(assets.mineman, Math.floor(-assets.mineman.width / 2), Math.floor(-assets.mineman.height / 2));
        ctx.restore();
    }

    drawUI(ctx, assets) {
        const visualX = Math.floor(this.visualX);
        const visualY = Math.floor(this.visualY);

        const width = 64;
        const height = 6;
        const x = visualX - width / 2;
        const y = visualY + (assets.mineman.height - height) / 2;

        ctx.fillStyle = "black";
        ctx.fillRect(x, y, width, height);
        ctx.fillStyle = "red";
        ctx.fillRect(x + 1, y + 1, Math.max(this.health / 100, 0) * (width - 2), height - 2);

        const moneyText = `$${this.money}`;

        ctx.fillStyle = "black";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.font = "16px serif";
        ctx.fillText(moneyText, visualX - 1, y + height + 2);
        ctx.fillStyle = "orange";
        ctx.fillText(moneyText, visualX + 1, y + height + 2);
    }
}