import { GMath } from "./gmath.mjs";

const W = 8 * 4; // 8 * sizeof(uint);
const S = W / 2;

export class PerlinNoise {
    static randomGradient(x, y) {
        // Cast to uint.
        let a = x >>> 0;
        let b = y >>> 0;

        a *= 3284157443;
        b ^= a << S | a >>> W - S;
        b *= 1911520717;
        a ^= b << S | b >>> W - S;
        a *= 2048419325;

        const random = a * (3.14159265 / ~(0x7FFFFFFF));

        return random;
    }

    static dotGridGradient(ix, iy, x, y) {
        const random = this.randomGradient(ix, iy);
        const gradientX = Math.cos(random);
        const gradientY = Math.sin(random);
        const displacementX = x - ix;
        const displacementY = y - iy;

        return displacementX * gradientX + displacementY * gradientY;
    }

    static noise(x, y) {
        // Determine grid cell coordinates
        const x0 = Math.floor(x);
        const x1 = x0 + 1;
        const y0 = Math.floor(y);
        const y1 = y0 + 1;

        // Determine interpolation weights
        // Could also use higher order polynomial/s-curve here
        const sx = x - x0;
        const sy = y - y0;

        // Interpolate between grid point gradients
        let n0 = this.dotGridGradient(x0, y0, x, y);
        let n1 = this.dotGridGradient(x1, y0, x, y);
        const ix0 = GMath.lerp(n0, n1, sx);

        n0 = this.dotGridGradient(x0, y1, x, y);
        n1 = this.dotGridGradient(x1, y1, x, y);
        const ix1 = GMath.lerp(n0, n1, sx);

        return GMath.lerp(ix0, ix1, sy);
    }
}