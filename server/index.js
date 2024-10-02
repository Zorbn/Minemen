import { WebSocketServer } from "ws";
import { Player } from "./player.js";
import { NetMsg, NetMapByteCount, NetMsgId, NetMaxMsgLength, NetTickTime } from "../common/netcode.mjs";
import { Tile, TileValues, TilemapSize } from "../common/tile.mjs";
import { Zombie } from "./zombie.js";
import { Exit, ExitInteractRadius } from "./exit.js";
import { Room, RoomSize } from "../common/room.mjs";
import { GMath } from "../common/gmath.mjs";
import { PlayerBreakRadius } from "../common/breaker.mjs";

const DefaultExitPrice = 500;
const ExitPriceDecayTime = 10;
const ExitPriceDecayAmount = 10;

const wss = new WebSocketServer({ port: 8448 });

const packet = {
    bits: new Array(NetMapByteCount),
};
const outMsgData = new DataView(new ArrayBuffer(NetMaxMsgLength));

let nextPlayerIndex = 0;
let nextZombieIndex = 0;

const room = new Room();

let exitPrice = DefaultExitPrice;
let exitPriceDecayTimer = ExitPriceDecayTime;

function broadcast(data) {
    for (const socket of wss.clients) {
        socket.send(data);
    }
}

function randomCoord() {
    return Math.random() * RoomSize;
}

function generateRoom() {
    room.clearEntities();

    const seed = Math.random() * 65536;

    room.generate(seed);

    packet.id = NetMsgId.GenerateRoom;
    packet.seed = seed;
    broadcast(NetMsg.write(packet, outMsgData));

    for (let i = 0; i < 5; i++) {
        const zombie = new Zombie(nextZombieIndex, randomCoord(), randomCoord());
        room.zombies.set(nextZombieIndex, zombie);
        nextZombieIndex += 1;

        packet.id = NetMsgId.AddZombie;
        packet.index = zombie.index;
        packet.x = zombie.x;
        packet.y = zombie.y;
        broadcast(NetMsg.write(packet, outMsgData));
    }

    for (const player of room.players.values()) {
        player.doAcceptMovements = false;
        player.x = randomCoord();
        player.y = randomCoord();

        packet.id = NetMsgId.ServerMovePlayer;
        packet.index = player.index;
        packet.x = player.x;
        packet.y = player.y;
        broadcast(NetMsg.write(packet, outMsgData));
    }

    const exit = new Exit(randomCoord(), randomCoord());
    room.exits.push(exit);
    packet.id = NetMsgId.AddExit;
    packet.x = exit.x;
    packet.y = exit.y;
    broadcast(NetMsg.write(packet, outMsgData));
}

generateRoom();

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

    const playerIndex = nextPlayerIndex;
    const player = addPlayer();

    packet.id = NetMsgId.SetLocalPlayerIndex;
    packet.index = playerIndex;
    ws.send(NetMsg.write(packet, outMsgData));

    ws.on("message", (data) => {
        NetMsg.read(packet, new DataView(data));

        switch (packet.id) {
            case NetMsgId.MovePlayer:
                if (!player.doAcceptMovements) {
                    break;
                }

                // Never let a client move a player that isn't theirs.
                packet.index = playerIndex;
                player.x = packet.x;
                player.y = packet.y;

                broadcast(NetMsg.write(packet, outMsgData));
                break;
            case NetMsgId.ServerMovePlayer:
                player.doAcceptMovements = true;
                break;
            case NetMsgId.BreakTile: {
                if (packet.x < 0 || packet.x >= TilemapSize || packet.y < 0 || packet.y >= TilemapSize) {
                    break;
                }

                const tileIndex = packet.x + packet.y * TilemapSize;
                const brokenTile = room.tilemap[tileIndex];
                room.tilemap[tileIndex] = Tile.Air;

                let breakingPlayer = room.players.get(packet.playerIndex);

                if (breakingPlayer !== undefined) {
                    breakingPlayer.money += TileValues[brokenTile];
                }

                broadcast(NetMsg.write(packet, outMsgData));
            } break;
            case NetMsgId.RespawnPlayer: {
                player.x = randomCoord();
                player.y = randomCoord();
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
        delete room.players.delete(playerIndex);

        packet.id = NetMsgId.RemovePlayer;
        packet.index = playerIndex;
        broadcast(NetMsg.write(packet, outMsgData));
    });
}

function sendState(ws) {
    packet.id = NetMsgId.GenerateRoom;
    packet.seed = room.seed;
    ws.send(NetMsg.write(packet, outMsgData));

    for (const otherPlayerIndex of room.players.keys()) {
        const otherPlayer = room.players.get(otherPlayerIndex);

        packet.id = NetMsgId.AddPlayer;
        packet.index = otherPlayerIndex;
        packet.x = otherPlayer.x;
        packet.y = otherPlayer.y;
        packet.health = otherPlayer.health;
        ws.send(NetMsg.write(packet, outMsgData));
    }

    for (const zombieIndex of room.zombies.keys()) {
        const zombie = room.zombies.get(zombieIndex);

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

        if (room.tilemap[i] != Tile.Air) {
            packet.bits[byteIndex] |= 1 << bitIndex;
        }
    }

    ws.send(NetMsg.write(packet, outMsgData));

    for (const exit of room.exits) {
        packet.id = NetMsgId.AddExit;
        packet.x = exit.x;
        packet.y = exit.y;
        ws.send(NetMsg.write(packet, outMsgData));
    }

    packet.id = NetMsgId.SetExitPrice;
    packet.price = exitPrice;
    ws.send(NetMsg.write(packet, outMsgData));
}

function addPlayer() {
    const playerIndex = nextPlayerIndex++;
    const player = new Player(playerIndex, randomCoord(), randomCoord());
    room.players.set(playerIndex, player);

    packet.id = NetMsgId.AddPlayer;
    packet.index = playerIndex;
    packet.x = player.x;
    packet.y = player.y;
    packet.health = player.health;
    broadcast(NetMsg.write(packet, outMsgData));

    return player;
}

let lastTime;

function tick() {
    let time = performance.now();

    if (lastTime === undefined) {
        lastTime = time;
    }

    const dt = (time - lastTime) * 0.001;
    lastTime = time;

    for (const zombieIndex of room.zombies.keys()) {
        const zombie = room.zombies.get(zombieIndex);

        zombie.update(room, dt, broadcast, packet, outMsgData);

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

        if (exitPrice > 0) {
            exitPrice = Math.max(exitPrice - ExitPriceDecayAmount, 0);

            packet.id = NetMsgId.SetExitPrice;
            packet.price = exitPrice;
            broadcast(NetMsg.write(packet, outMsgData));
        }
    }

    let hasExited = false;

    for (const exit of room.exits) {
        for (const player of room.players.values()) {
            if (player.money >= exitPrice && GMath.distance(player.x, player.y, exit.x, exit.y) < ExitInteractRadius) {
                hasExited = true;
                break;
            }
        }

        if (hasExited) break;
    }

    if (hasExited) {
        generateRoom();
    }
}

setInterval(tick, NetTickTime * 1000);