// One Limiter per network (hashed IP). Counts wrong codes and locks the
// network out for a while after too many, so 4-digit codes can't be guessed.

import { DurableObject } from 'cloudflare:workers';

export class Limiter extends DurableObject {
  async read() {
    return (await this.ctx.storage.get('v')) || { fails: 0, until: 0, windowStart: 0 };
  }

  async check() {
    const v = await this.read();
    return { locked: v.until > Date.now(), until: v.until };
  }

  async fail({ tries, lockMs }) {
    const now = Date.now();
    const v = await this.read();
    // Wrong guesses are counted over a 1-hour window.
    if (now - v.windowStart > 3600 * 1000) { v.fails = 0; v.windowStart = now; }
    v.fails += 1;
    let justLocked = false;
    if (v.fails >= tries) {
      v.until = now + lockMs;
      v.fails = 0;
      v.windowStart = now;
      justLocked = true;
    }
    await this.ctx.storage.put('v', v);
    return { locked: v.until > now, until: v.until, left: Math.max(0, tries - v.fails), justLocked };
  }

  async reset() {
    await this.ctx.storage.delete('v');
    return { ok: true };
  }
}
