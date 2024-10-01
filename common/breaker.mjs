import { checkRadiusTileCollisions } from "./tile.mjs";

export const PlayerBreakRadius = 12;
export const ZombieBreakRadius = 14;
const BreakTime = 0.5;

export class Breaker {
    constructor(breakRadius) {
        this.breakRadius = breakRadius;
        this.breakTileResult = { x: 0, y: 0 };
        this.breakProgress = { isBreaking: false, breakingTime: 0 };
    }

    isReady() {
        return this.breakProgress.isBreaking && this.breakProgress.breakingTime >= BreakTime;
    }

    isBreaking() {
        return this.breakProgress.isBreaking;
    }

    getX() {
        return this.breakTileResult.x;
    }

    getY() {
        return this.breakTileResult.y;
    }

    update(tilemap, x, y, dt) {
        let lastBreakTileX = this.breakTileResult.x;
        let lastBreakTileY = this.breakTileResult.y;
        let isBreaking = checkRadiusTileCollisions(tilemap, x, y, this.breakRadius, this.breakTileResult);

        this.breakProgress.isBreaking = isBreaking;

        if (!this.breakProgress.isBreaking || lastBreakTileX != this.breakTileResult.x || lastBreakTileY != this.breakTileResult.y) {
            this.breakProgress.breakingTime = 0;
        } else {
            this.breakProgress.breakingTime += dt;
        }
    }
}