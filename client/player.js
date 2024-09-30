import { Direction } from "./direction.js";
import { GMath } from "./gmath.js";

const MoveSpeed = 50;
const LerpSpeed = 10;

export class Player {
    constructor(assets, index, x, y) {
        this.sprite = assets.mineman;

        this.index = index;
        this.x = x;
        this.y = y;
        this.visualX = x;
        this.visualY = y;

        this.direction = Direction.Right;
    }

    update(input, dt) {
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

        if (directionY > 0) {
            this.direction = Direction.Down;
        } else if (directionY < 0) {
            this.direction = Direction.Up;
        } else if (directionX > 0) {
            this.direction = Direction.Right;
        } else if (directionX < 0) {
            this.direction = Direction.Left;
        }

        let velocityMag = MoveSpeed * dt;

        let directionMag = Math.sqrt(directionX * directionX + directionY * directionY);
        if (directionMag === 0) directionMag = 1;

        let velocityX = velocityMag * directionX / directionMag;
        let velocityY = velocityMag * directionY / directionMag;

        this.x += velocityX;
        this.y += velocityY;

        this.visualX = this.x;
        this.visualY = this.y;
    }

    remoteUpdate(dt) {
        this.visualX = GMath.lerp(this.visualX, this.x, LerpSpeed * dt);
        this.visualY = GMath.lerp(this.visualY, this.y, LerpSpeed * dt);
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(Math.floor(this.visualX), Math.floor(this.visualY));
        ctx.rotate(Math.PI * 0.5 * this.direction);
        ctx.drawImage(this.sprite, Math.floor(-this.sprite.width / 2), Math.floor(-this.sprite.height / 2));
        ctx.restore();
    }
}