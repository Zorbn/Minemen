export class Player {
    constructor(index, x, y) {
        this.index = index;
        this.x = x;
        this.y = y;
        this.health = 100;
        this.money = 0;
        this.doAcceptMovements = true;
    }

    takeDamage(damage) {
        this.health -= damage;

        if (this.health <= 0) {
            this.doAcceptMovements = false;
        }
    }
}