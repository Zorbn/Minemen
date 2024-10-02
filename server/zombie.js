import { GMath } from "../common/gmath.mjs";
import { HumanoidHitboxRadius } from "../common/collision.mjs";
import { checkRadiusTileCollisions, TilemapSize, Tile } from "../common/tile.mjs";
import { Breaker, ZombieBreakRadius } from "../common/breaker.mjs";
import { NetMsg, NetMsgId } from "../common/netcode.mjs";
import { RoomSize } from "../common/room.mjs";

const MoveSpeed = 50;
const AttackRange = 24;
const AttackDamage = 20;
const AttackCooldownTime = 1 / 5;

export class Zombie {
    constructor(index, x, y) {
        this.index = index;

        this.x = x;
        this.y = y;

        this.angle = 0;

        this.breaker = new Breaker(ZombieBreakRadius);

        this.attackTimer = 0;
    }

    update(room, dt, broadcast, packet, outMsgData) {
        this.attackTimer -= dt;

        this.breaker.update(room.tilemap, this.x, this.y, dt);

        if (this.breaker.isReady()) {
            const x = this.breaker.getX();
            const y = this.breaker.getY();

            if (x >= 0 && x < TilemapSize && y >= 0 && y < TilemapSize) {
                room.tilemap[x + y * TilemapSize] = Tile.Air;

                packet.id = NetMsgId.BreakTile;
                packet.playerIndex = -1;
                packet.x = x;
                packet.y = y;
                broadcast(NetMsg.write(packet, outMsgData));
            }
        }

        let targetPlayer = null;
        let targetDistance = Infinity;

        for (const player of room.players.values()) {
            const distance = GMath.distance(player.x, player.y, this.x, this.y);

            if (distance < targetDistance) {
                targetPlayer = player;
                targetDistance = distance;
            }
        }

        if (targetPlayer == null) {
            return;
        }

        if (targetDistance > AttackRange) {
            this.angle = Math.atan2(targetPlayer.y - this.y, targetPlayer.x - this.x);

            // Soft collisions with other zombies: zombies choose to let each other go ahead, they are so nice!
            for (const otherZombieIndex of room.zombies.keys()) {
                if (otherZombieIndex <= this.index) {
                    // You are lesser than me!!!
                    // Or... you are me...
                    continue;
                }

                const otherZombie = room.zombies.get(otherZombieIndex);

                if (GMath.distance(otherZombie.x, otherZombie.y, this.x, this.y) < AttackRange) {
                    // We're overlapping, my bad, you go ahead.
                    return;
                }
            }

            const directionX = Math.cos(this.angle);
            const directionY = Math.sin(this.angle);

            const velocityX = directionX * MoveSpeed * dt;
            const velocityY = directionY * MoveSpeed * dt;

            if (!checkRadiusTileCollisions(room.tilemap, this.x + velocityX, this.y, HumanoidHitboxRadius, null)) {
                this.x += velocityX;
            }

            if (!checkRadiusTileCollisions(room.tilemap, this.x, this.y + velocityY, HumanoidHitboxRadius, null)) {
                this.y += velocityY;
            }

            this.x = GMath.clamp(this.x, 0, RoomSize);
            this.y = GMath.clamp(this.y, 0, RoomSize);
        } else if (this.attackTimer <= 0) {
            this.attackTimer = AttackCooldownTime;

            targetPlayer.takeDamage(AttackDamage);

            packet.id = NetMsgId.SetPlayerHealth;
            packet.index = targetPlayer.index;
            packet.health = targetPlayer.health;
            broadcast(NetMsg.write(packet, outMsgData));
        }
    }
}