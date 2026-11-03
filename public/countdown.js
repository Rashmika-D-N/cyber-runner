// A single game-loop clock: pause/restart cannot leave delayed start callbacks.
export class StartCountdown {
  remaining = 0;
  get active() { return this.remaining > 0; }
  get value() { return Math.ceil(this.remaining); }
  start() { this.remaining = 3; return this.value; }
  cancel() { this.remaining = 0; }
  advance(seconds) {
    const before = this.value;
    if (!this.active) return {changed: false, complete: false, value: 0};
    this.remaining = Math.max(0, this.remaining - Math.max(0, seconds));
    return {changed: before !== this.value, complete: !this.active, value: this.value};
  }
}
