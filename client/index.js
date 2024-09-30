import { Input } from "./input.js";
import { Player } from "./player.js";
import { NetMsg, NetMsgId, NetMaxMsgLength, NetTickTime } from "../common/netcode.mjs";
import { Tile } from "./tile.js";
import { GMath } from "./gmath.js";
import { PerlinNoise } from "./perlinNoise.js";

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
};

// Noise.seed() function only supports 65535 seed values.
// Used for gameplay related rng, visual-only rng uses standard Math.random().
const seed = Math.random() * 65536;
const rng = GMath.sfc32(0, 0, 0, seed);
// Mix the rng state to account for simple seed.
// Otherwise starting numbers might be similar across plays.
for (let i = 0; i < 20; i++) {
    rng();
}

let localPlayerIndex = null;
const players = new Map();
const tileSize = 32;
const tilemapSize = 20; // TODO: The correct size is 40, make sure offscreen tiles aren't drawn.
const tilemap = new Array(tilemapSize * tilemapSize);
tilemap.fill(Tile.Air);

// Init tilemap:
{
    for (let y = 0; y < tilemapSize; y++) {
        for (let x = 0; x < tilemapSize; x++) {
            const noise = PerlinNoise.noise(x * 0.3, y * 0.3);

            if (noise > 0) {
                tilemap[x + y * tilemapSize] = Tile.Dirt;
            }
        }
    }
}

ws.addEventListener("open", (event) => {
    // ws.send(msgData);
});

ws.addEventListener("message", (event) => {
    NetMsg.read(packet, new DataView(event.data));

    switch (packet.id) {
        case NetMsgId.AddPlayer:
            players.set(packet.index, new Player(assets, packet.index, packet.x, packet.y));
            break;
        case NetMsgId.RemovePlayer:
            players.delete(packet.index);
            break;
        case NetMsgId.SetLocalPlayerIndex:
            localPlayerIndex = packet.index;
            break;
        case NetMsgId.MovePlayer:
            if (packet.index == localPlayerIndex) {
                break;
            }

            let player = players.get(packet.index);

            if (player === undefined) {
                break;
            }

            player.x = packet.x;
            player.y = packet.y;
            player.direction = packet.direction;
            break;
        default:
            console.log(`got unknown msg id: ${packet.id}`);
            break;
    }
});

let lastTime;
let tickTimer = 0;

function tick() {
    const player = players.get(localPlayerIndex);

    if (player === undefined) {
        return;
    }

    packet.id = NetMsgId.MovePlayer;
    packet.index = player.index;
    packet.x = player.x;
    packet.y = player.y
    packet.direction = player.direction;
    ws.send(NetMsg.write(packet, outMsgData));
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
            player.update(input, dt);
        } else {
            player.remoteUpdate(dt);
        }
    }

    tickTimer += dt;

    while (tickTimer > NetTickTime) {
        tickTimer -= NetTickTime;
        tick();
    }

    input.update();

    ctx.fillStyle = "#4c2300";
    ctx.fillRect(0, 0, 640, 480);

    for (let y = 0; y < tilemapSize; y++) {
        for (let x = 0; x < tilemapSize; x++) {
            let tileImage

            switch (tilemap[x + y * tilemapSize]) {
                case Tile.Air:
                    continue;
                case Tile.Dirt:
                    tileImage = assets.dirt;
                    break;
            }

            ctx.drawImage(tileImage, x * tileSize, y * tileSize);
        }
    }

    for (const playerIndex of players.keys()) {
        const player = players.get(playerIndex);
        player.draw(ctx);
    }

    requestAnimationFrame(update);
}

requestAnimationFrame(update);