export const Tile = {
    Air: 0,
    Dirt: 1,
};

export const TileSize = 32;

export const TilemapSize = 20; // TODO: The correct size is 40, make sure offscreen tiles aren't drawn.

export function checkTileCollisions(tilemap, x, y, result) {
    const tileX = Math.floor(x / TileSize);
    const tileY = Math.floor(y / TileSize);

    if (tileX < 0 || tileX >= TilemapSize || tileY < 0 || tileY >= TilemapSize) {
        return false;
    }

    const tile = tilemap[tileX + tileY * TilemapSize];

    if (tile != Tile.Air) {
        result.x = tileX;
        result.y = tileY;
        return true;
    }

    return false;
}