import { Input } from "./input.js";
import { Player } from "./player.js";
import { Zombie } from "./zombie.js";
import { NetMsg, NetMsgId, NetTickTime } from "../common/netcode.mjs";
import { Tile, TileSize, TileValues, TilemapSize } from "../common/tile.mjs";
import { GMath } from "../common/gmath.mjs";
import { Exit } from "./exit.js";
import { Room, RoomSize } from "../common/room.mjs";

const Debug = false;

let serverIp = "ws://localhost:8448";

if (!Debug) {
    serverIp = "wss://vps.zorbn.com:8448";
}

const ws = new WebSocket(serverIp);
ws.binaryType = "arraybuffer";
const packet = {};

const canvas = document.getElementById("game-view");
const ctx = canvas.getContext("2d", { alpha: false });
const input = new Input();
input.addListeners();

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function loadImage(path) {
    const image = new Image();
    image.src = path;
    return image;
}

const assets = {
    mineman: loadImage("assets/sprite_mineman_0.png"),
    dirt: loadImage("assets/sprite_dirt_0.png"),
    stone: loadImage("assets/sprite_stone_0.png"),
    coal: loadImage("assets/sprite_coal_0.png"),
    iron: loadImage("assets/sprite_iron_0.png"),
    gold: loadImage("assets/sprite_gold_0.png"),
    diamond: loadImage("assets/sprite_diamond_0.png"),
    breaking: loadImage("assets/breaking.png"),
    zombie: loadImage("assets/sprite_zombie_0.png"),
    villager: loadImage("assets/sprite_villager_0.png"),
    win: loadImage("assets/sprite_win_0.png"),
    death: loadImage("assets/sprite_title_death_0.png"),
};

const ShowResultTime = 3;
let showResultTimer = 0;
let didWin = false;
let localPlayerIndex = null;
let exitPrice = 0;
const room = new Room();

ws.addEventListener("message", (event) => {
    NetMsg.read(packet, new DataView(event.data));

    switch (packet.id) {
        case NetMsgId.AddPlayer:
            room.players.set(packet.index, new Player(packet.index, packet.x, packet.y, packet.health));
            break;
        case NetMsgId.RemovePlayer:
            room.players.delete(packet.index);
            break;
        case NetMsgId.SetLocalPlayerIndex:
            localPlayerIndex = packet.index;
            break;
        case NetMsgId.MovePlayer: {
            if (packet.index === localPlayerIndex) {
                break;
            }

            let player = room.players.get(packet.index);

            if (player === undefined) {
                break;
            }

            player.x = packet.x;
            player.y = packet.y;
            player.angle = packet.angle;
        } break;
        case NetMsgId.ServerMovePlayer: {
            let player = room.players.get(packet.index);

            if (player === undefined) {
                break;
            }

            player.x = packet.x;
            player.y = packet.y;
            player.visualX = player.x;
            player.visualY = player.y;

            if (player.index == localPlayerIndex) {
                packet.id = NetMsgId.ServerMovePlayer;
                ws.send(NetMsg.write(packet));
            }
        } break;
        case NetMsgId.SetPlayerHealth: {
            let player = room.players.get(packet.index);

            if (player === undefined) {
                break;
            }

            player.health = packet.health;
        } break;
        case NetMsgId.RespawnPlayer: {
            let player = room.players.get(packet.index);

            if (player === undefined) {
                break;
            }

            player.health = 100;
            player.money = 0;
            player.isRespawning = false;
            player.x = packet.x;
            player.y = packet.y;
            player.visualX = player.x;
            player.visualY = player.y;

            if (player.index == localPlayerIndex) {
                packet.id = NetMsgId.ServerMovePlayer;
                ws.send(NetMsg.write(packet));
            }
        } break;
        case NetMsgId.BreakTile: {
            if (packet.x < 0 || packet.x >= TilemapSize || packet.y < 0 || packet.y >= TilemapSize) {
                break;
            }

            const tileIndex = packet.x + packet.y * TilemapSize;
            const brokenTile = room.tilemap[tileIndex];
            room.tilemap[tileIndex] = Tile.Air;

            let player = room.players.get(packet.playerIndex);

            if (player !== undefined) {
                player.money += TileValues[brokenTile];
            }

        } break;
        case NetMsgId.SetTileState:
            for (let i = 0; i < TilemapSize * TilemapSize; i++) {
                const bitIndex = i % 8;
                const byteIndex = Math.floor(i / 8);

                if ((packet.bits[byteIndex] & (1 << bitIndex)) == 0) {
                    room.tilemap[i] = Tile.Air;
                }
            }
            break;
        case NetMsgId.AddZombie:
            room.zombies.set(packet.index, new Zombie(packet.index, packet.x, packet.y));
            break;
        case NetMsgId.MoveZombie: {
            let zombie = room.zombies.get(packet.index);

            if (zombie === undefined) {
                break;
            }

            zombie.x = packet.x;
            zombie.y = packet.y;
            zombie.angle = packet.angle;
        } break;
        case NetMsgId.AddExit: {
            room.exits.push(new Exit(packet.x, packet.y));
        } break;
        case NetMsgId.SetExitPrice: {
            exitPrice = packet.price;
        } break;
        case NetMsgId.GenerateRoom: {
            room.clearEntities();
            room.generate(packet.seed);
        } break;
        case NetMsgId.PlayerWon: {
            didWin = packet.index == localPlayerIndex;
            showResultTimer = ShowResultTime;
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
    const player = room.players.get(localPlayerIndex);

    if (player === undefined || player.health <= 0) {
        return;
    }

    packet.id = NetMsgId.MovePlayer;
    packet.index = player.index;
    packet.x = player.x;
    packet.y = player.y;
    packet.angle = player.angle;
    ws.send(NetMsg.write(packet));

    player.tryRequestBreak(ws, packet);
}

function update(time) {
    if (lastTime === undefined) {
        lastTime = time;
    }

    const dt = Math.min((time - lastTime) * 0.001, NetTickTime);
    lastTime = time;

    for (const playerIndex of room.players.keys()) {
        const player = room.players.get(playerIndex);

        if (playerIndex === localPlayerIndex) {
            room.darkness.update(player.x, player.y, 0);

            if (player.health > 0) {
                player.update(input, room.tilemap, dt);
                cameraX = player.x;
                cameraY = player.y;
            } else if (!player.isRespawning) {
                didWin = false;
                showResultTimer = ShowResultTime;

                player.isRespawning = true;

                packet.id = NetMsgId.RespawnPlayer;
                packet.index = player.index;
                packet.x = 0;
                packet.y = 0;
                ws.send(NetMsg.write(packet));
            }
        } else {
            player.remoteUpdate(room.tilemap, dt);
        }
    }

    for (const zombie of room.zombies.values()) {
        zombie.remoteUpdate(room.tilemap, dt);
    }

    showResultTimer -= dt;

    tickTimer += dt;

    while (tickTimer > NetTickTime) {
        tickTimer -= NetTickTime;
        tick();
    }

    input.update();

    ctx.save();
    ctx.translate(Math.floor(-cameraX + canvas.clientWidth / 2), Math.floor(-cameraY + canvas.clientHeight / 2));

    ctx.fillStyle = "#4c2300";
    ctx.fillRect(0, 0, RoomSize, RoomSize);

    const minVisibleX = GMath.clamp(Math.floor((cameraX - canvas.clientWidth / 2) / TileSize), 0, TilemapSize - 1);
    const maxVisibleX = GMath.clamp(Math.ceil((cameraX + canvas.clientWidth / 2) / TileSize), 0, TilemapSize - 1);
    const minVisibleY = GMath.clamp(Math.floor((cameraY - canvas.clientHeight / 2) / TileSize), 0, TilemapSize - 1);
    const maxVisibleY = GMath.clamp(Math.ceil((cameraY + canvas.clientHeight / 2) / TileSize), 0, TilemapSize - 1);

    for (let y = minVisibleY; y <= maxVisibleY; y++) {
        for (let x = minVisibleX; x <= maxVisibleX; x++) {
            const i = x + y * TilemapSize;

            if (room.darkness.areDark[i]) {
                continue;
            }

            let tileImage

            switch (room.tilemap[i]) {
                case Tile.Air:
                    continue;
                case Tile.Dirt:
                    tileImage = assets.dirt;
                    break;
                case Tile.Stone:
                    tileImage = assets.stone;
                    break;
                case Tile.Coal:
                    tileImage = assets.coal;
                    break;
                case Tile.Iron:
                    tileImage = assets.iron;
                    break;
                case Tile.Gold:
                    tileImage = assets.gold;
                    break;
                case Tile.Diamond:
                    tileImage = assets.diamond;
                    break;
            }

            ctx.drawImage(tileImage, x * TileSize, y * TileSize);
        }
    }

    for (const exit of room.exits.values()) {
        exit.draw(ctx, assets);
    }

    for (const player of room.players.values()) {
        player.draw(ctx, assets);
    }

    for (const zombie of room.zombies.values()) {
        zombie.draw(ctx, assets);
    }

    ctx.fillStyle = "black";

    for (let y = minVisibleY; y <= maxVisibleY; y++) {
        for (let x = minVisibleX; x <= maxVisibleX; x++) {
            const i = x + y * TilemapSize;

            if (!room.darkness.areDark[i]) {
                continue;
            }

            ctx.fillRect(x * TileSize, y * TileSize, TileSize, TileSize);
        }
    }

    // Draw darkness outside the map:
    {
        ctx.fillStyle = "black";

        const left = cameraX - canvas.clientWidth / 2;
        const right = cameraX + canvas.clientWidth / 2;

        const top = cameraY - canvas.clientHeight / 2;
        const bottom = cameraY + canvas.clientHeight / 2;

        if (left < 0) {
            ctx.fillRect(left, top, -left, canvas.clientHeight);
        }

        if (top < 0) {
            ctx.fillRect(left, top, canvas.clientWidth, -top);
        }

        if (right > RoomSize) {
            ctx.fillRect(RoomSize, top, right - RoomSize, canvas.clientHeight);
        }

        if (bottom > RoomSize) {
            ctx.fillRect(left, RoomSize, canvas.clientWidth, bottom - RoomSize);
        }
    }

    for (const player of room.players.values()) {
        if (room.darkness.isPositionDark(player.x, player.y)) {
            continue;
        }

        player.drawUI(ctx, assets);
    }

    for (const exit of room.exits.values()) {
        if (room.darkness.isPositionDark(exit.x, exit.y)) {
            continue;
        }

        exit.drawUI(ctx, assets, exitPrice);
    }

    ctx.restore();

    if (showResultTimer > 0) {
        const resultImage = didWin ? assets.win : assets.death;

        ctx.globalAlpha = GMath.clamp(showResultTimer, 0, 1);
        const winX = Math.floor((canvas.clientWidth - resultImage.width) / 2);
        const winY = Math.floor((canvas.clientHeight / 2 - resultImage.height) / 2);
        ctx.drawImage(resultImage, winX, winY);
        ctx.globalAlpha = 1;
    }

    requestAnimationFrame(update);
}

requestAnimationFrame(update);