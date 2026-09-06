import { Kart, type Controls } from './Kart';
import { Input } from '../utils/Input';
export class PlayerKart extends Kart {
  constructor(readonly input: Input) {
    super(0, 'YOU', 0xff714f);
  }
  controls(): Controls {
    return {
      throttle:
        Number(this.input.down('KeyW', 'ArrowUp')) - Number(this.input.down('KeyS', 'ArrowDown')),
      steer:
        Number(this.input.down('KeyA', 'ArrowLeft')) -
        Number(this.input.down('KeyD', 'ArrowRight')),
      drift: this.input.down('Space'),
    };
  }
}
