export class Input {
  keys = new Set<string>();
  pressed = new Set<string>();
  constructor() {
    addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
        e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.clear());
  }
  down(...codes: string[]) {
    return codes.some((c) => this.keys.has(c));
  }
  take(code: string) {
    return this.pressed.delete(code);
  }
  clear() {
    this.keys.clear();
    this.pressed.clear();
  }
  endFrame() {
    this.pressed.clear();
  }
}
