import { WebSocketServer } from "ws";
import { Player } from "./player.js";
import { NetMsg, NetMapByteCount, NetMsgId, NetMaxMsgLength, NetTickTime } from "../common/netcode.mjs";
import { Tile, TileValues, TilemapSize, tilemapInit } from "../common/tile.mjs";
import { Zombie } from "./zombie.js";
import { Exit } from "./exit.js";

const DefaultExitPrice = 500;
const ExitPriceDecayTime = 10;
const ExitPriceDecayAmount = 10;

const packet = {
    bits: new Array(NetMapByteCount),
};
const outMsgData = new DataView(new ArrayBuffer(NetMaxMsgLength));

const tilemap = new Array(TilemapSize * TilemapSize);
tilemapInit(tilemap);

let nextPlayerIndex = 0;
const players = new Map();
let nextZombieIndex = 0;
const zombies = new Map();

// Init zombies:
{
    for (let i = 0; i < 5; i++) {
        zombies.set(nextZombieIndex, new Zombie(nextZombieIndex, Math.random() * 640, Math.random() * 480));
        nextZombieIndex += 1;
    }
}

const exit = new Exit(Math.random() * 640, Math.random() * 480);
let exitPrice = DefaultExitPrice;
let exitPriceDecayTimer = ExitPriceDecayTime;

function broadcast(data) {
    for (const socket of wss.clients) {
        socket.send(data);
    }
}

const wss = new WebSocketServer({ port: 8448 });

wss.on("connection", (ws) => {
    ws.binaryType = "arraybuffer";
    ws.on("error", console.error);

    // try {
    //     onConnection(ws);
    // } catch (ex) {
    //     console.error(`Error while handling socket: ${ex}`);
    // }
    onConnection(ws);
});

function onConnection(ws) {
    sendState(ws);

    const playerIndex = nextPlayerIndex++;
    const player = new Player(playerIndex, Math.random() * 640, Math.random() * 480);
    players.set(playerIndex, player);

    packet.id = NetMsgId.AddPlayer;
    packet.index = playerIndex;
    packet.x = player.x;
    packet.y = player.y;
    packet.health = player.health;
    broadcast(NetMsg.write(packet, outMsgData));

    packet.id = NetMsgId.SetLocalPlayerIndex;
    packet.index = playerIndex;
    ws.send(NetMsg.write(packet, outMsgData));

    ws.on("message", (data) => {
        NetMsg.read(packet, new DataView(data));

        switch (packet.id) {
            case NetMsgId.MovePlayer:
                // Never let a client move a player that isn't theirs.
                packet.index = playerIndex;
                player.x = packet.x;
                player.y = packet.y;

                broadcast(NetMsg.write(packet, outMsgData));
                break;
            case NetMsgId.BreakTile: {
                if (packet.x < 0 || packet.x >= TilemapSize || packet.y < 0 || packet.y >= TilemapSize) {
                    break;
                }

                const tileIndex = packet.x + packet.y * TilemapSize;
                const brokenTile = tilemap[tileIndex];
                tilemap[tileIndex] = Tile.Air;

                let breakingPlayer = players.get(packet.playerIndex);

                if (breakingPlayer !== undefined) {
                    breakingPlayer.money += TileValues[brokenTile];
                }

                broadcast(NetMsg.write(packet, outMsgData));
            } break;
            case NetMsgId.RespawnPlayer: {
                player.x = Math.random() * 640;
                player.y = Math.random() * 480;
                player.health = 100;
                player.money = 0;

                packet.index = playerIndex;
                packet.x = player.x;
                packet.y = player.y;

                broadcast(NetMsg.write(packet, outMsgData));
            } break;
            default:
                console.log(`got unknown msg id: ${packet.id}`);
                break;
        }
    });

    ws.on("close", () => {
        delete players.delete(playerIndex);

        packet.id = NetMsgId.RemovePlayer;
        packet.index = playerIndex;
        broadcast(NetMsg.write(packet, outMsgData));
    });
}

function sendState(ws) {
    for (const otherPlayerIndex of players.keys()) {
        const otherPlayer = players.get(otherPlayerIndex);

        packet.id = NetMsgId.AddPlayer;
        packet.index = otherPlayerIndex;
        packet.x = otherPlayer.x;
        packet.y = otherPlayer.y;
        packet.health = otherPlayer.health;
        ws.send(NetMsg.write(packet, outMsgData));
    }

    for (const zombieIndex of zombies.keys()) {
        const zombie = zombies.get(zombieIndex);

        packet.id = NetMsgId.AddZombie;
        packet.index = zombieIndex;
        packet.x = zombie.x;
        packet.y = zombie.y;
        ws.send(NetMsg.write(packet, outMsgData));
    }

    packet.id = NetMsgId.SetTileState;
    packet.bits.fill(0);

    for (let i = 0; i < TilemapSize * TilemapSize; i++) {
        const bitIndex = i % 8;
        const byteIndex = Math.floor(i / 8);

        if (tilemap[i] != Tile.Air) {
            packet.bits[byteIndex] |= 1 << bitIndex;
        }
    }

    ws.send(NetMsg.write(packet, outMsgData));

    packet.id = NetMsgId.AddExit;
    packet.x = exit.x;
    packet.y = exit.y;
    ws.send(NetMsg.write(packet, outMsgData));

    packet.id = NetMsgId.SetExitPrice;
    packet.price = exitPrice;
    ws.send(NetMsg.write(packet, outMsgData));
}

let lastTime;

function tick() {
    let time = performance.now();

    if (lastTime === undefined) {
        lastTime = time;
    }

    const dt = (time - lastTime) * 0.001;
    lastTime = time;

    for (const zombieIndex of zombies.keys()) {
        const zombie = zombies.get(zombieIndex);

        zombie.update(players, zombies, tilemap, dt, broadcast, packet, outMsgData);

        packet.id = NetMsgId.MoveZombie;
        packet.index = zombieIndex;
        packet.x = zombie.x;
        packet.y = zombie.y;
        packet.angle = zombie.angle;
        broadcast(NetMsg.write(packet, outMsgData));
    }

    exitPriceDecayTimer -= dt;

    while (exitPriceDecayTimer <= 0) {
        exitPriceDecayTimer += ExitPriceDecayTime;
        exitPrice -= ExitPriceDecayAmount;

        packet.id = NetMsgId.SetExitPrice;
        packet.price = exitPrice;
        broadcast(NetMsg.write(packet, outMsgData));
    }
}

setInterval(tick, NetTickTime * 1000);