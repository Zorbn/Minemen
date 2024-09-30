import { WebSocketServer } from "ws";
import { Player } from "./player.js";
import { NetMsg, NetMapByteCount, NetMsgId, NetMaxMsgLength } from "../common/netcode.mjs";
import { Tile, TilemapSize, tilemapInit } from "../common/tile.mjs";

const packet = {
    bits: new Array(NetMapByteCount),
};
const outMsgData = new DataView(new ArrayBuffer(NetMaxMsgLength));

const tilemap = new Array(TilemapSize * TilemapSize);
tilemapInit(tilemap);

let nextPlayerIndex = 0;
const players = new Map();

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
            case NetMsgId.BreakTile:
                if (packet.x < 0 || packet.x >= TilemapSize || packet.y < 0 || packet.y >= TilemapSize) {
                    break;
                }

                tilemap[packet.x + packet.y * TilemapSize] = Tile.Air;

                broadcast(NetMsg.write(packet, outMsgData));
                break;
            default:
                console.log(`got unknown msg id: ${packet.id}`)
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
}