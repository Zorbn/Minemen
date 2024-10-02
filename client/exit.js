export class Exit {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    draw(ctx, assets) {
        ctx.drawImage(assets.villager, Math.floor(this.x - assets.villager.width / 2), Math.floor(this.y - assets.villager.height / 2));
    }

    drawUI(ctx, assets, exitPrice) {
        const speechWidth = 256;
        const speechHeight = 32;
        const speechX = Math.floor(this.x);
        const speechY = Math.floor(this.y - assets.villager.height / 2);

        const backgroundX = speechX - speechWidth / 2;
        const backgroundY = speechY - speechHeight / 2;

        ctx.fillStyle = "black";
        ctx.fillRect(backgroundX, backgroundY, speechWidth, speechHeight);

        ctx.fillStyle = "white";
        ctx.fillRect(backgroundX + 1, backgroundY + 1, speechWidth - 2, speechHeight - 2);

        ctx.fillStyle = "black";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "14px serif";
        ctx.fillText(`I'll take you to the next level for $${exitPrice}.`, speechX, speechY);
    }
}