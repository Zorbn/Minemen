import { PerlinNoise } from "./perlinNoise.mjs";

export const Tile = {
    Air: 0,
    Dirt: 1,
    Stone: 2,
    Coal: 3,
    Iron: 4,
    Gold: 5,
    Diamond: 6,
};

export const TileValues = {
    [Tile.Air]: 0,
    [Tile.Dirt]: 1,
    [Tile.Stone]: 1,
    [Tile.Coal]: 10,
    [Tile.Iron]: 25,
    [Tile.Gold]: 50,
    [Tile.Diamond]: 100,
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

export function tilemapInit(tilemap, rng) {
    tilemap.fill(Tile.Air);

    const scale = 0.3;
    const offsetX = rng() * 1000;
    const offsetY = rng() * 1000;

    for (let y = 0; y < TilemapSize; y++) {
        for (let x = 0; x < TilemapSize; x++) {
            const noise = PerlinNoise.noise(x * scale + offsetX, y * scale + offsetY);

            if (noise < -0.1) {
                continue;
            }

            let tile = Tile.Stone;

            if (rng() > 0.9) {
                tile = Tile.Coal;

                while (tile < Tile.Diamond && rng() > 0.6) {
                    tile += 1;
                }
            }

            tilemap[x + y * TilemapSize] = tile;
        }
    }
}