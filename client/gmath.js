export class GMath {
    static lerp(a, b, dt) {
        return a + (b - a) * dt;
    }
}