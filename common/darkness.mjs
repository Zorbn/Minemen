import { GMath } from "./gmath.mjs";
import { TilemapSize, TileSize } from "./tile.mjs";

const LightRadius = 5;

export class Darkness {
    constructor() {
        this.areDark = new Array(TilemapSize * TilemapSize);
        this.areDark.fill(true);
    }

    clear() {
        this.areDark.fill(true);
    }

    update(x, y, padding) {
        const radius = LightRadius + padding;

        const tileX = Math.floor(x / TileSize);
        const tileY = Math.floor(y / TileSize);

        const minTileX = GMath.clamp(tileX - LightRadius, 0, TilemapSize);
        const maxTileX = GMath.clamp(tileX + LightRadius, 0, TilemapSize);
        const minTileY = GMath.clamp(tileY - LightRadius, 0, TilemapSize);
        const maxTileY = GMath.clamp(tileY + LightRadius, 0, TilemapSize);

        for (let iy = minTileY; iy <= maxTileY; iy++) {
            for (let ix = minTileX; ix <= maxTileX; ix++) {
                if (GMath.distance(ix, iy, tileX, tileY) <= radius) {
                    this.areDark[ix + iy * TilemapSize] = false;
                }
            }
        }
    }

    isPositionDark(x, y) {
        const tileX = Math.floor(x / TileSize);
        const tileY = Math.floor(y / TileSize);

        if (tileX < 0 || tileX >= TilemapSize || tileY < 0 || tileY >= TilemapSize) {
            return true;
        }

        return this.areDark[tileX + tileY * TilemapSize];
    }
}