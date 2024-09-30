export class Input {
    constructor() {
        this.pressedKeys = new Set();
        this.keyWasPressed = new Set();
        this.hasListeners = false;
    }

    isKeyPressed(key) {
        return this.pressedKeys.has(key);
    }

    wasKeyPressed(key) {
        return this.keyWasPressed.has(key);
    }

    update() {
        this.keyWasPressed.clear();
    }

    addListeners() {
        this.hasListeners = true;

        this.keyDownListener = (event) => {
            if (!this.pressedKeys.has(event.code)) {
                this.keyWasPressed.add(event.code);
            }

            this.pressedKeys.add(event.code);
        }
        document.addEventListener("keydown", this.keyDownListener);

        this.keyUpListener = (event) => {
            this.pressedKeys.delete(event.code);
        }
        document.addEventListener("keyup", this.keyUpListener);
    }

    removeListeners() {
        this.hasListeners = false;

        document.removeEventListener("keydown", this.keyDownListener);
        document.removeEventListener("keyup", this.keyUpListener);

        this.pressedKeys.clear();
        this.keyWasPressed.clear();
    }
}