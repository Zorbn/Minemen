export const NetMaxMsgLength = 256;
export const NetTickRate = 20;
export const NetTickTime = 1 / 20;
export const NetMapByteCount = 200;
export const NetLerpSpeed = 10;

export const NetMsgId = {
    AddPlayer: 0,
    RemovePlayer: 1,
    SetLocalPlayerIndex: 2,
    MovePlayer: 3,
    SetPlayerHealth: 4,
    RespawnPlayer: 5,
    BreakTile: 6,
    SetTileState: 7,
    AddZombie: 8,
    MoveZombie: 9,
    AddExit: 10,
    SetExitPrice: 11,
    ServerMovePlayer: 12,
    GenerateRoom: 13,
}

export const NetType = {
    F32: 0,
    F64: 1,
    U8: 2,
}

export class NetMsg {
    constructor(fields) {
        this.fields = new Map(Object.entries(fields));
        this.length = 1; // id

        for (const fieldName of this.fields.keys()) {
            const field = this.fields.get(fieldName);

            switch (field.fieldType) {
                case NetType.F32:
                    this.length += 4 * field.fieldCount;
                    break;
                case NetType.F64:
                    this.length += 8 * field.fieldCount;
                    break;
                case NetType.U8:
                    this.length += 1 * field.fieldCount;
                    break;
                default:
                    throw `invalid NetMsg field type: ${fieldType}`;
            }
        }
    }

    static write(packet, msgData) {
        const msg = NetMsgs[packet.id];

        msgData.setUint8(0, packet.id);
        let offset = 1;

        for (const fieldName of msg.fields.keys()) {
            const field = msg.fields.get(fieldName);

            if (field.fieldCount === 1) {
                switch (field.fieldType) {
                    case NetType.F32:
                        msgData.setFloat32(offset, packet[fieldName]);
                        offset += 4;
                        break;
                    case NetType.F64:
                        msgData.setFloat64(offset, packet[fieldName]);
                        offset += 8;
                        break;
                    case NetType.U8:
                        msgData.setUint8(offset, packet[fieldName]);
                        offset += 1;
                        break;
                }
            } else {
                const array = packet[fieldName];

                switch (field.fieldType) {
                    case NetType.F32:
                        for (let i = 0; i < field.fieldCount; i++) {
                            msgData.setFloat32(offset, array[i]);
                            offset += 4;
                        }
                        break;
                    case NetType.F64:
                        for (let i = 0; i < field.fieldCount; i++) {
                            msgData.setFloat64(offset, array[i]);
                            offset += 8;
                        }
                        break;
                    case NetType.U8:
                        for (let i = 0; i < field.fieldCount; i++) {
                            msgData.setUint8(offset, array[i]);
                            offset += 1;
                        }
                        break;
                }
            }
        }

        return new DataView(msgData.buffer, 0, msg.length);
    }

    static read(packet, msgData) {
        const id = msgData.getUint8(0);
        packet.id = id;

        const msg = NetMsgs[id];

        let offset = 1;

        for (const fieldName of msg.fields.keys()) {
            const field = msg.fields.get(fieldName);

            if (field.fieldCount === 1) {
                switch (field.fieldType) {
                    case NetType.F32:
                        packet[fieldName] = msgData.getFloat32(offset);
                        offset += 4;
                        break;
                    case NetType.F64:
                        packet[fieldName] = msgData.getFloat64(offset);
                        offset += 8;
                        break;
                    case NetType.U8:
                        packet[fieldName] = msgData.getUint8(offset);
                        offset += 1;
                        break;
                }
            } else {
                const array = new Array(field.fieldCount);
                packet[fieldName] = array;

                switch (field.fieldType) {
                    case NetType.F32:
                        for (let i = 0; i < field.fieldCount; i++) {
                            array[i] = msgData.getFloat32(offset);
                            offset += 4;
                        }
                        break;
                    case NetType.F64:
                        for (let i = 0; i < field.fieldCount; i++) {
                            array[i] = msgData.getFloat64(offset);
                            offset += 8;
                        }
                        break;
                    case NetType.U8:
                        for (let i = 0; i < field.fieldCount; i++) {
                            array[i] = msgData.getUint8(offset);
                            offset += 1;
                        }
                        break;
                }
            }
        }
    }
}

export const NetMsgs = {
    [NetMsgId.AddPlayer]: new NetMsg({
        index: { fieldType: NetType.F64, fieldCount: 1 },
        x: { fieldType: NetType.F32, fieldCount: 1 },
        y: { fieldType: NetType.F32, fieldCount: 1 },
        health: { fieldType: NetType.F32, fieldCount: 1 },
    }),
    [NetMsgId.RemovePlayer]: new NetMsg({
        index: { fieldType: NetType.F64, fieldCount: 1 },
    }),
    [NetMsgId.SetLocalPlayerIndex]: new NetMsg({
        index: { fieldType: NetType.F64, fieldCount: 1 },
    }),
    [NetMsgId.MovePlayer]: new NetMsg({
        index: { fieldType: NetType.F64, fieldCount: 1 },
        x: { fieldType: NetType.F32, fieldCount: 1 },
        y: { fieldType: NetType.F32, fieldCount: 1 },
        angle: { fieldType: NetType.F32, fieldCount: 1 },
    }),
    [NetMsgId.SetPlayerHealth]: new NetMsg({
        index: { fieldType: NetType.F64, fieldCount: 1 },
        health: { fieldType: NetType.F32, fieldCount: 1 },
    }),
    [NetMsgId.RespawnPlayer]: new NetMsg({
        index: { fieldType: NetType.F64, fieldCount: 1 },
        x: { fieldType: NetType.F32, fieldCount: 1 },
        y: { fieldType: NetType.F32, fieldCount: 1 },
    }),
    [NetMsgId.BreakTile]: new NetMsg({
        playerIndex: { fieldType: NetType.F64, fieldCount: 1 },
        x: { fieldType: NetType.F32, fieldCount: 1 },
        y: { fieldType: NetType.F32, fieldCount: 1 },
    }),
    [NetMsgId.SetTileState]: new NetMsg({
        bits: { fieldType: NetType.U8, fieldCount: NetMapByteCount },
    }),
    [NetMsgId.AddZombie]: new NetMsg({
        index: { fieldType: NetType.F64, fieldCount: 1 },
        x: { fieldType: NetType.F32, fieldCount: 1 },
        y: { fieldType: NetType.F32, fieldCount: 1 },
    }),
    [NetMsgId.MoveZombie]: new NetMsg({
        index: { fieldType: NetType.F64, fieldCount: 1 },
        x: { fieldType: NetType.F32, fieldCount: 1 },
        y: { fieldType: NetType.F32, fieldCount: 1 },
        angle: { fieldType: NetType.F32, fieldCount: 1 },
    }),
    [NetMsgId.AddExit]: new NetMsg({
        x: { fieldType: NetType.F32, fieldCount: 1 },
        y: { fieldType: NetType.F32, fieldCount: 1 },
    }),
    [NetMsgId.SetExitPrice]: new NetMsg({
        price: { fieldType: NetType.F32, fieldCount: 1 },
    }),
    [NetMsgId.ServerMovePlayer]: new NetMsg({
        index: { fieldType: NetType.F64, fieldCount: 1 },
        x: { fieldType: NetType.F32, fieldCount: 1 },
        y: { fieldType: NetType.F32, fieldCount: 1 },
    }),
    [NetMsgId.GenerateRoom]: new NetMsg({
        seed: { fieldType: NetType.F64, fieldCount: 1 },
    }),
}