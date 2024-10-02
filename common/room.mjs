import { Darkness } from "./darkness.mjs";
import { GMath } from "./gmath.mjs";
import { Tile, tilemapInit, TilemapSize, TileSize } from "./tile.mjs";

export const RoomSize = TilemapSize * TileSize;

export class Room {
    constructor() {
        this.rng = null;
        this.seed = 0;

        this.tilemap = new Array(TilemapSize * TilemapSize);
        this.tilemap.fill(Tile.Air);
        this.darkness = new Darkness();
        this.players = new Map();
        this.zombies = new Map();
        this.exits = [];
    }

    generate(seed) {
        this.darkness.clear();

        this.rng = GMath.sfc32(0, 0, 0, seed);
        this.seed = seed;

        // Mix the rng state to account for simple seed.
        // Otherwise starting numbers might be similar across plays.
        for (let i = 0; i < 20; i++) {
            this.rng();
        }

        tilemapInit(this.tilemap, this.rng);
    }

    clearEntities() {
        this.zombies.clear();
        this.exits.length = 0;

        for (const player of this.players.values()) {
            player.health = 100;
            player.money = 0;
        }
    }

    // Doesn't use the rooms RNG, intended to be called on the server and sent to clients.
    // May return a non-empty tile if no empty tile could be found.
    findEmptyTileIndex() {
        const tilemapLength = TilemapSize * TilemapSize;

        let i = Math.floor(Math.random() * tilemapLength);

        for (let step = 0; step < tilemapLength; step++) {
            if (this.tilemap[i] == Tile.Air) {
                return i;
            }

            i = (i + 1) % tilemapLength;
        }

        return i;
    }

    static tileIndexToX(index) {
        return (index % TilemapSize + 0.5) * TileSize;
    }

    static tileIndexToY(index) {
        return (Math.floor(index / TilemapSize) + 0.5) * TileSize;
    }
}