import { Input } from "./input.js";
import { Player } from "./player.js";
import { NetMsg, NetMsgId, NetMaxMsgLength, NetTickTime } from "../common/netcode.mjs";

const ws = new WebSocket("ws://localhost:8448");
ws.binaryType = "arraybuffer";
const packet = {};
const outMsgData = new DataView(new ArrayBuffer(NetMaxMsgLength));

const canvas = document.getElementById("game-view");
const ctx = canvas.getContext("2d");
const input = new Input();
input.addListeners();

function loadImage(path) {
    const image = new Image();
    image.src = path;
    return image;
}

const assets = {
    mineman: loadImage("assets/sprite_mineman_0.png"),
};

let localPlayerIndex = null;
const players = new Map();

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
            console.log(`got unknown msg id: ${packet.id}`)
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

    for (const playerIndex of players.keys()) {
        const player = players.get(playerIndex);
        player.draw(ctx);
    }

    requestAnimationFrame(update);
}

requestAnimationFrame(update);