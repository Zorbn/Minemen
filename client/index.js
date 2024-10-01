import { Input } from "./input.js";
import { Player } from "./player.js";
import { Zombie } from "./zombie.js";
import { NetMsg, NetMsgId, NetMaxMsgLength, NetTickTime } from "../common/netcode.mjs";
import { Tile, TileSize, TilemapSize, tilemapInit } from "../common/tile.mjs";
import { GMath } from "../common/gmath.mjs";

const ws = new WebSocket("ws://localhost:8448");
ws.binaryType = "arraybuffer";
const packet = {};
const outMsgData = new DataView(new ArrayBuffer(NetMaxMsgLength));

const canvas = document.getElementById("game-view");
const ctx = canvas.getContext("2d", { alpha: false });
const input = new Input();
input.addListeners();

function loadImage(path) {
    const image = new Image();
    image.src = path;
    return image;
}

const assets = {
    mineman: loadImage("assets/sprite_mineman_0.png"),
    dirt: loadImage("assets/sprite_dirt_0.png"),
    breaking: loadImage("assets/breaking.png"),
    zombie: loadImage("assets/sprite_zombie_0.png"),
};

// // Noise.seed() function only supports 65535 seed values.
// // Used for gameplay related rng, visual-only rng uses standard Math.random().
// const seed = 0.77 * 65536;
// const rng = GMath.sfc32(0, 0, 0, seed);
// // Mix the rng state to account for simple seed.
// // Otherwise starting numbers might be similar across plays.
// for (let i = 0; i < 20; i++) {
//     rng();
// }

let localPlayerIndex = null;
const players = new Map();
const zombies = new Map();
const tilemap = new Array(TilemapSize * TilemapSize);
tilemapInit(tilemap);

ws.addEventListener("open", (event) => {
    // ws.send(msgData);
});

ws.addEventListener("message", (event) => {
    NetMsg.read(packet, new DataView(event.data));

    switch (packet.id) {
        case NetMsgId.AddPlayer:
            players.set(packet.index, new Player(packet.index, packet.x, packet.y, packet.health));
            break;
        case NetMsgId.RemovePlayer:
            players.delete(packet.index);
            break;
        case NetMsgId.SetLocalPlayerIndex:
            localPlayerIndex = packet.index;
            break;
        case NetMsgId.MovePlayer: {
            if (packet.index === localPlayerIndex) {
                break;
            }

            let player = players.get(packet.index);

            if (player === undefined) {
                break;
            }

            player.x = packet.x;
            player.y = packet.y;
            player.angle = packet.angle;
        } break;
        case NetMsgId.SetPlayerHealth: {
            let player = players.get(packet.index);

            if (player === undefined) {
                break;
            }

            player.health = packet.health;
        } break;
        case NetMsgId.RespawnPlayer: {
            let player = players.get(packet.index);

            if (player === undefined) {
                break;
            }

            player.health = 100;
            player.isRespawning = false;
            player.x = packet.x;
            player.y = packet.y;
            player.visualX = player.x;
            player.visualY = player.y;
        } break;
        case NetMsgId.BreakTile:
            if (packet.x < 0 || packet.x >= TilemapSize || packet.y < 0 || packet.y >= TilemapSize) {
                break;
            }

            tilemap[packet.x + packet.y * TilemapSize] = Tile.Air;
            break;
        case NetMsgId.SetTileState:
            for (let i = 0; i < TilemapSize * TilemapSize; i++) {
                const bitIndex = i % 8;
                const byteIndex = Math.floor(i / 8);

                if ((packet.bits[byteIndex] & (1 << bitIndex)) == 0) {
                    tilemap[i] = Tile.Air;
                }
            }
            break;
        case NetMsgId.AddZombie:
            zombies.set(packet.index, new Zombie(packet.index, packet.x, packet.y));
            break;
        case NetMsgId.MoveZombie: {
            let zombie = zombies.get(packet.index);

            if (zombie === undefined) {
                break;
            }

            zombie.x = packet.x;
            zombie.y = packet.y;
            zombie.angle = packet.angle;
        } break;
        default:
            console.log(`got unknown msg id: ${packet.id}`);
            break;
    }
});

let lastTime;
let tickTimer = 0;
let cameraX = 0;
let cameraY = 0;

function tick() {
    const player = players.get(localPlayerIndex);

    if (player === undefined || player.health <= 0) {
        return;
    }

    packet.id = NetMsgId.MovePlayer;
    packet.index = player.index;
    packet.x = player.x;
    packet.y = player.y;
    packet.angle = player.angle;
    ws.send(NetMsg.write(packet, outMsgData));

    player.tryRequestBreak(ws, packet, outMsgData);
}

function update(time) {
    if (lastTime === undefined) {
        lastTime = time;
    }

    const dt = Math.min((time - lastTime) * 0.001, NetTickTime);
    lastTime = time;

    for (const playerIndex of players.keys()) {
        const player = players.get(playerIndex);

        if (playerIndex === localPlayerIndex) {
            if (player.health > 0) {
                player.update(input, tilemap, dt);
                cameraX = player.x;
                cameraY = player.y;
            } else if (!player.isRespawning) {
                player.isRespawning = true;

                packet.id = NetMsgId.RespawnPlayer;
                packet.index = player.index;
                packet.x = 0;
                packet.y = 0;
                ws.send(NetMsg.write(packet, outMsgData));
            }
        } else {
            player.remoteUpdate(tilemap, dt);
        }
    }

    for (const zombie of zombies.values()) {
        zombie.remoteUpdate(tilemap, dt);
    }

    tickTimer += dt;

    while (tickTimer > NetTickTime) {
        tickTimer -= NetTickTime;
        tick();
    }

    input.update();

    ctx.save();
    ctx.fillStyle = "#4c2300";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx.translate(Math.floor(-cameraX + canvas.clientWidth / 2), Math.floor(-cameraY + canvas.clientHeight / 2));

    const minVisibleX = GMath.clamp(Math.floor((cameraX - canvas.clientWidth / 2) / TileSize), 0, TilemapSize - 1);
    const maxVisibleX = GMath.clamp(Math.ceil((cameraX + canvas.clientWidth / 2) / TileSize), 0, TilemapSize - 1);
    const minVisibleY = GMath.clamp(Math.floor((cameraY - canvas.clientHeight / 2) / TileSize), 0, TilemapSize - 1);
    const maxVisibleY = GMath.clamp(Math.ceil((cameraY + canvas.clientHeight / 2) / TileSize), 0, TilemapSize - 1);

    for (let y = minVisibleY; y <= maxVisibleY; y++) {
        for (let x = minVisibleX; x <= maxVisibleX; x++) {
            let tileImage

            switch (tilemap[x + y * TilemapSize]) {
                case Tile.Air:
                    continue;
                case Tile.Dirt:
                    tileImage = assets.dirt;
                    break;
            }

            ctx.drawImage(tileImage, x * TileSize, y * TileSize);
        }
    }

    for (const player of players.values()) {
        player.draw(ctx, assets);
    }

    for (const zombie of zombies.values()) {
        zombie.draw(ctx, assets);
    }

    for (const player of players.values()) {
        player.drawUI(ctx, assets);
    }

    ctx.restore();

    requestAnimationFrame(update);
}

requestAnimationFrame(update);