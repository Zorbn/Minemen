export const NetMaxMsgLength = 128;
export const NetTickRate = 20;
export const NetTickTime = 1 / 20;

export const NetMsgId = {
    AddPlayer: 0,
    RemovePlayer: 1,
    SetLocalPlayerIndex: 2,
    MovePlayer: 3,
    BreakTile: 4,
}

export const NetType = {
    F32: 0,
    F64: 1,
}

export class NetMsg {
    constructor(fields) {
        this.fields = new Map(Object.entries(fields));
        this.length = 4; // id

        for (const fieldName of this.fields.keys()) {
            const fieldType = this.fields.get(fieldName);

            switch (fieldType) {
                case NetType.F32:
                    this.length += 4;
                    break;
                case NetType.F64:
                    this.length += 8;
                    break;
                default:
                    throw `invalid NetMsg field type: ${fieldType}`;
            }
        }
    }

    static write(packet, msgData) {
        const msg = NetMsgs[packet.id];

        msgData.setFloat32(0, packet.id);
        let offset = 4;

        for (const fieldName of msg.fields.keys()) {
            const fieldType = msg.fields.get(fieldName);

            switch (fieldType) {
                case NetType.F32:
                    msgData.setFloat32(offset, packet[fieldName]);
                    offset += 4;
                    break;
                case NetType.F64:
                    msgData.setFloat64(offset, packet[fieldName]);
                    offset += 8;
                    break;
            }
        }

        return new DataView(msgData.buffer, 0, msg.length);
    }

    static read(packet, msgData) {
        const id = msgData.getFloat32(0);
        packet.id = id;

        const msg = NetMsgs[id];

        let offset = 4;

        for (const fieldName of msg.fields.keys()) {
            const fieldType = msg.fields.get(fieldName);

            switch (fieldType) {
                case NetType.F32:
                    packet[fieldName] = msgData.getFloat32(offset);
                    offset += 4;
                    break;
                case NetType.F64:
                    packet[fieldName] = msgData.getFloat64(offset);
                    offset += 8;
                    break;
            }
        }
    }
}

export const NetMsgs = {
    [NetMsgId.AddPlayer]: new NetMsg({
        index: NetType.F64,
        x: NetType.F32,
        y: NetType.F32,
    }),
    [NetMsgId.RemovePlayer]: new NetMsg({
        index: NetType.F64,
    }),
    [NetMsgId.SetLocalPlayerIndex]: new NetMsg({
        index: NetType.F64,
    }),
    [NetMsgId.MovePlayer]: new NetMsg({
        index: NetType.F64,
        x: NetType.F32,
        y: NetType.F32,
        angle: NetType.F32,
    }),
    [NetMsgId.BreakTile]: new NetMsg({
        x: NetType.F32,
        y: NetType.F32,
    }),
}