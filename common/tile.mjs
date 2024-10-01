import { PerlinNoise } from "./perlinNoise.mjs";

export const Tile = {
    Air: 0,
    Dirt: 1,
};

export const TileValues = {
    [Tile.Air]: 0,
    [Tile.Dirt]: 1,
}

export const TileSize = 32;

export const TilemapSize = 40;

export function checkTileCollisions(tilemap, x, y, result) {
    const tileX = Math.floor(x / TileSize);
    const tileY = Math.floor(y / TileSize);

    if (tileX < 0 || tileX >= TilemapSize || tileY < 0 || tileY >= TilemapSize) {
        return false;
    }

    const tile = tilemap[tileX + tileY * TilemapSize];

    if (tile != Tile.Air) {
        if (result !== null) {
            result.x = tileX;
            result.y = tileY;
        }

        return true;
    }

    return false;
}

export function checkRadiusTileCollisions(tilemap, x, y, radius, result) {
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

export function tilemapInit(tilemap) {
    tilemap.fill(Tile.Air);

    for (let y = 0; y < TilemapSize; y++) {
        for (let x = 0; x < TilemapSize; x++) {
            const noise = PerlinNoise.noise(x * 0.3, y * 0.3);

            if (noise > 0) {
                tilemap[x + y * TilemapSize] = Tile.Dirt;
            }
        }
    }
}