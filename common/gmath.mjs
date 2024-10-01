export class GMath {
    static lerp(a, b, delta) {
        return a + (b - a) * delta;
    }

    static lerpAngle(a, b, delta) {
        // https://stackoverflow.com/questions/2708476/rotation-interpolation
        const shortestAngle = (((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        return (a + shortestAngle * delta) % (Math.PI * 2);
    }

    static distance(x0, y0, x1, y1) {
        const displacementX = x0 - x1;
        const displacementY = y0 - y1;
        return Math.sqrt(displacementX * displacementX + displacementY * displacementY);
    }

    // Create a random number generator using the "Simple Fast Counter"
    // algorithm. Uses a 128bit seed provided in 4 parts (a, b, c, d).
    static sfc32(a, b, c, d) {
        return () => {
            // >>>= 0 and | 0 cause interpreter to switch
            // numbers to int32 mode, useful for performance.
            a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
            let t = (a + b) | 0;
            a = b ^ b >>> 9;
            b = c + (c << 3) | 0;
            c = (c << 21 | c >>> 11);
            d = d + 1 | 0;
            t = t + d | 0;
            c = c + t | 0;
            return (t >>> 0) / 4294967296;
        }
    }
}