import { GMath } from "../common/gmath.mjs";
import { HumanoidHitboxRadius } from "../common/collision.mjs";
import { checkRadiusTileCollisions, TilemapSize, Tile } from "../common/tile.mjs";
import { Breaker, ZombieBreakRadius } from "../common/breaker.mjs";
import { NetMsg, NetMsgId } from "../common/netcode.mjs";

const MoveSpeed = 25;
const AttackRange = 24;
const AttackDamage = 10;
const AttackCooldownTime = 1 / 10;

export class Zombie {
    constructor(index, x, y) {
        this.index = index;

        this.x = x;
        this.y = y;

        this.angle = 0;

        this.breaker = new Breaker(ZombieBreakRadius);

        this.attackTimer = 0;
    }

    update(players, zombies, tilemap, dt, broadcast, packet, outMsgData) {
        this.attackTimer -= dt;

        this.breaker.update(tilemap, this.x, this.y, dt);

        if (this.breaker.isReady()) {
            const x = this.breaker.getX();
            const y = this.breaker.getY();

            if (x >= 0 && x < TilemapSize && y >= 0 && y < TilemapSize) {
                tilemap[x + y * TilemapSize] = Tile.Air;

                packet.id = NetMsgId.BreakTile;
                packet.x = x;
                packet.y = y;
                broadcast(NetMsg.write(packet, outMsgData));
            }
        }

        let targetPlayer = null;
        let targetDistance = Infinity;

        for (const player of players.values()) {
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
            for (const otherZombieIndex of zombies.keys()) {
                if (otherZombieIndex <= this.index) {
                    // You are lesser than me!!!
                    // Or... you are me...
                    continue;
                }

                const otherZombie = zombies.get(otherZombieIndex);

                if (GMath.distance(otherZombie.x, otherZombie.y, this.x, this.y) < AttackRange) {
                    // We're overlapping, my bad, you go ahead.
                    return;
                }
            }

            const directionX = Math.cos(this.angle);
            const directionY = Math.sin(this.angle);

            const velocityX = directionX * MoveSpeed * dt;
            const velocityY = directionY * MoveSpeed * dt;

            if (!checkRadiusTileCollisions(tilemap, this.x + velocityX, this.y, HumanoidHitboxRadius, null)) {
                this.x += velocityX;
            }

            if (!checkRadiusTileCollisions(tilemap, this.x, this.y + velocityY, HumanoidHitboxRadius, null)) {
                this.y += velocityY;
            }
        } else if (this.attackTimer <= 0) {
            this.attackTimer = AttackCooldownTime;

            targetPlayer.health -= AttackDamage;

            packet.id = NetMsgId.SetPlayerHealth;
            packet.index = targetPlayer.index;
            packet.health = targetPlayer.health;
            broadcast(NetMsg.write(packet, outMsgData));
        }
    }
}