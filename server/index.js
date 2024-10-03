import { WebSocketServer } from "ws";
import { Player } from "./player.js";
import { NetMsg, NetMapByteCount, NetMsgId, NetTickTime } from "../common/netcode.mjs";
import { Tile, TileValues, TilemapSize } from "../common/tile.mjs";
import { Zombie } from "./zombie.js";
import { Exit, ExitInteractRadius } from "./exit.js";
import { Room } from "../common/room.mjs";
import { GMath } from "../common/gmath.mjs";
import { readFileSync } from "fs";
import { createServer } from "https";

const Debug = true;
const Port = 8448;
const DefaultExitPrice = 500;
const ExitPriceDecayTime = 10;
const ExitPriceDecayAmount = 10;

const wssParams = {};

if (Debug) {
    wssParams.port = Port;
} else {
    const key = readFileSync("ssl-cert/privkey.pem", "utf8");
    const cert = readFileSync("ssl-cert/fullchain.pem", "utf8");

    const server = createServer({ key, cert });
    server.listen(Port);

    wssParams.server = server;
}

const wss = new WebSocketServer(wssParams);

const packet = {
    bits: new Array(NetMapByteCount),
};

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

function generateRoom() {
    room.clearEntities();

    const seed = Math.random() * 65536;

    room.generate(seed);

    packet.id = NetMsgId.GenerateRoom;
    packet.seed = seed;
    broadcast(NetMsg.write(packet));

    for (let i = 0; i < 5; i++) {
        const tileIndex = room.findEmptyTileIndex();
        const zombie = new Zombie(nextZombieIndex, Room.tileIndexToX(tileIndex), Room.tileIndexToY(tileIndex));
        room.zombies.set(nextZombieIndex, zombie);
        nextZombieIndex += 1;

        packet.id = NetMsgId.AddZombie;
        packet.index = zombie.index;
        packet.x = zombie.x;
        packet.y = zombie.y;
        broadcast(NetMsg.write(packet));
    }

    for (const player of room.players.values()) {
        player.doAcceptMovements = false;
        const tileIndex = room.findEmptyTileIndex();
        player.x = Room.tileIndexToX(tileIndex);
        player.y = Room.tileIndexToY(tileIndex);

        packet.id = NetMsgId.ServerMovePlayer;
        packet.index = player.index;
        packet.x = player.x;
        packet.y = player.y;
        broadcast(NetMsg.write(packet));
    }

    const exitTileIndex = room.findEmptyTileIndex();
    const exit = new Exit(Room.tileIndexToX(exitTileIndex), Room.tileIndexToY(exitTileIndex));
    room.exits.push(exit);
    packet.id = NetMsgId.AddExit;
    packet.x = exit.x;
    packet.y = exit.y;
    broadcast(NetMsg.write(packet));
}

generateRoom();

wss.on("connection", (ws) => {
    ws.binaryType = "arraybuffer";
    ws.on("error", console.error);

    if (Debug) {
        onConnection(ws);
    } else {
        try {
            onConnection(ws);
        } catch (ex) {
            console.error(`Error while handling socket: ${ex}`);
        }
    }
});

function onConnection(ws) {
    sendState(ws);

    const playerIndex = nextPlayerIndex;
    const player = addPlayer();

    packet.id = NetMsgId.SetLocalPlayerIndex;
    packet.index = playerIndex;
    ws.send(NetMsg.write(packet));

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

                broadcast(NetMsg.write(packet));
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

                broadcast(NetMsg.write(packet));
            } break;
            case NetMsgId.RespawnPlayer: {
                const tileIndex = room.findEmptyTileIndex();
                player.x = Room.tileIndexToX(tileIndex);
                player.y = Room.tileIndexToY(tileIndex);
                player.health = 100;
                player.money = 0;

                packet.index = playerIndex;
                packet.x = player.x;
                packet.y = player.y;

                broadcast(NetMsg.write(packet));
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
        broadcast(NetMsg.write(packet));
    });
}

function sendState(ws) {
    packet.id = NetMsgId.GenerateRoom;
    packet.seed = room.seed;
    ws.send(NetMsg.write(packet));

    for (const otherPlayerIndex of room.players.keys()) {
        const otherPlayer = room.players.get(otherPlayerIndex);

        packet.id = NetMsgId.AddPlayer;
        packet.index = otherPlayerIndex;
        packet.x = otherPlayer.x;
        packet.y = otherPlayer.y;
        packet.health = otherPlayer.health;
        ws.send(NetMsg.write(packet));
    }

    for (const zombieIndex of room.zombies.keys()) {
        const zombie = room.zombies.get(zombieIndex);

        packet.id = NetMsgId.AddZombie;
        packet.index = zombieIndex;
        packet.x = zombie.x;
        packet.y = zombie.y;
        ws.send(NetMsg.write(packet));
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

    ws.send(NetMsg.write(packet));

    for (const exit of room.exits) {
        packet.id = NetMsgId.AddExit;
        packet.x = exit.x;
        packet.y = exit.y;
        ws.send(NetMsg.write(packet));
    }

    packet.id = NetMsgId.SetExitPrice;
    packet.price = exitPrice;
    ws.send(NetMsg.write(packet));
}

function addPlayer() {
    const playerIndex = nextPlayerIndex++;
    const tileIndex = room.findEmptyTileIndex();
    const player = new Player(playerIndex, Room.tileIndexToX(tileIndex), Room.tileIndexToY(tileIndex));
    room.players.set(playerIndex, player);

    packet.id = NetMsgId.AddPlayer;
    packet.index = playerIndex;
    packet.x = player.x;
    packet.y = player.y;
    packet.health = player.health;
    broadcast(NetMsg.write(packet));

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

        if (zombie.isSleeping && room.darkness.isPositionDark(zombie.x, zombie.y)) {
            continue;
        }

        zombie.isSleeping = false;
        zombie.update(room, dt, broadcast, packet);

        packet.id = NetMsgId.MoveZombie;
        packet.index = zombieIndex;
        packet.x = zombie.x;
        packet.y = zombie.y;
        packet.angle = zombie.angle;
        broadcast(NetMsg.write(packet));
    }

    for (const player of room.players.values()) {
        // Padding is used here to prevent players seeing the shoulder of a zombie without it being alerted.
        room.darkness.update(player.x, player.y, 1);
    }

    exitPriceDecayTimer -= dt;

    while (exitPriceDecayTimer <= 0) {
        exitPriceDecayTimer += ExitPriceDecayTime;

        if (exitPrice > 0) {
            exitPrice = Math.max(exitPrice - ExitPriceDecayAmount, 0);

            packet.id = NetMsgId.SetExitPrice;
            packet.price = exitPrice;
            broadcast(NetMsg.write(packet));
        }
    }

    let hasExited = false;

    for (const exit of room.exits) {
        for (const player of room.players.values()) {
            if (player.money >= exitPrice && GMath.distance(player.x, player.y, exit.x, exit.y) < ExitInteractRadius) {
                hasExited = true;

                packet.id = NetMsgId.PlayerWon;
                packet.index = player.index;
                broadcast(NetMsg.write(packet));

                generateRoom();

                break;
            }
        }

        if (hasExited) break;
    }
}

setInterval(tick, NetTickTime * 1000);