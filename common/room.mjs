import { GMath } from "./gmath.mjs";
import { Tile, tilemapInit, TilemapSize, TileSize } from "./tile.mjs";

export const RoomSize = TilemapSize * TileSize;

export class Room {
    constructor() {
        this.rng = null;
        this.seed = 0;

        this.tilemap = new Array(TilemapSize * TilemapSize);
        this.tilemap.fill(Tile.Air);
        this.players = new Map();
        this.zombies = new Map();
        this.exits = [];
    }

    generate(seed) {
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
    }
}