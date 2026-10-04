// Splits a live audio stream into pieces at natural pauses.
//
// Why: Whisper garbles or invents words when a piece starts or ends mid-word
// (we saw "??? ???" and repeated phrases on Hindi cut at fixed 30 s marks), and
// a long, dense Hindi piece can exceed Whisper's per-window output budget and
// get truncated. Short pieces that end in silence avoid both.
//
// Pure logic, no browser APIs, so it can be tested in Node.

export const TARGET_RATE = 16000; // Whisper's native rate; 32 KB/s as 16-bit WAV
const FRAME = 320; // 20 ms at 16 kHz

export interface ChunkerOptions {
  minSec?: number; // never cut before this
  maxSec?: number; // always cut by this
  pauseMs?: number; // a quiet stretch this long counts as a pause
}

export class PauseChunker {
  private readonly minSamples: number;
  private readonly maxSamples: number;
  private readonly pauseFrames: number;

  private buf = new Int16Array(0);
  private frameRms: number[] = []; // per 20 ms frame of `buf`
  private pending = new Float32Array(0); // downsampled samples not yet a full frame
  private resampleCarry = 0;
  private emitted = 0; // samples already handed out, for offsets
  private noiseFloor = 0.01;
  private quietRun = 0;

  constructor(
    private readonly inputRate: number,
    private readonly onPiece: (pcm: Int16Array, offsetSec: number) => void,
    opts: ChunkerOptions = {},
  ) {
    // Short pieces at sentence/turn pauses: Whisper picks ONE language per piece,
    // so a piece holding a Hindi turn and then an English turn came back with the
    // English mangled into Devanagari (or dropped). ~2.5 s is still long enough
    // for reliable language detection.
    this.minSamples = (opts.minSec ?? 2.5) * TARGET_RATE;
    this.maxSamples = (opts.maxSec ?? 20) * TARGET_RATE;
    this.pauseFrames = Math.round((opts.pauseMs ?? 500) / 20);
  }

  /** Feed mono float samples at `inputRate`. Returns the latest frame loudness (0–1) for meters. */
  push(input: Float32Array): number {
    const down = this.downsample(input);
    const joined = new Float32Array(this.pending.length + down.length);
    joined.set(this.pending);
    joined.set(down, this.pending.length);

    let level = 0;
    let i = 0;
    for (; i + FRAME <= joined.length; i += FRAME) {
      level = this.addFrame(joined.subarray(i, i + FRAME));
    }
    this.pending = joined.slice(i);
    return level;
  }

  /** Emit whatever is buffered (on pause or stop). */
  flush() {
    this.cut(this.buf.length);
    this.pending = new Float32Array(0);
  }

  /** Seconds of audio received so far. */
  get elapsedSec() {
    return (this.emitted + this.buf.length) / TARGET_RATE;
  }

  private threshold() {
    // Speech is several times louder than the room. The floor stops a dead-silent
    // mic from making every tiny sound "speech".
    return Math.max(0.006, this.noiseFloor * 3);
  }

  private addFrame(frame: Float32Array): number {
    let sum = 0;
    for (let k = 0; k < frame.length; k++) sum += frame[k] * frame[k];
    const rms = Math.sqrt(sum / frame.length);

    // Track the noise floor: follow quiet frames down fast, drift up slowly.
    this.noiseFloor = rms < this.noiseFloor ? rms * 0.5 + this.noiseFloor * 0.5 : this.noiseFloor * 1.0015;

    const pcm = new Int16Array(frame.length);
    for (let k = 0; k < frame.length; k++) {
      const s = Math.max(-1, Math.min(1, frame[k]));
      pcm[k] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const next = new Int16Array(this.buf.length + pcm.length);
    next.set(this.buf);
    next.set(pcm, this.buf.length);
    this.buf = next;
    this.frameRms.push(rms);

    this.quietRun = rms < this.threshold() ? this.quietRun + 1 : 0;

    if (this.buf.length >= this.minSamples && this.quietRun >= this.pauseFrames) {
      // Cut in the middle of the pause so both pieces keep a little silence.
      this.cut(this.buf.length - Math.floor(this.quietRun / 2) * FRAME);
    } else if (this.buf.length >= this.maxSamples) {
      this.cut(this.quietestCutPoint());
    }
    return Math.min(1, rms * 4);
  }

  // No pause found in time: cut at the quietest frame of the last 4 seconds.
  private quietestCutPoint() {
    const lookback = Math.min(this.frameRms.length - 1, (4 * TARGET_RATE) / FRAME);
    let best = this.frameRms.length - 1;
    for (let f = this.frameRms.length - 1; f >= this.frameRms.length - lookback; f--) {
      if (this.frameRms[f] < this.frameRms[best]) best = f;
    }
    return (best + 1) * FRAME;
  }

  private cut(at: number) {
    const piece = this.buf.slice(0, at);
    const pieceRms = this.frameRms.slice(0, Math.ceil(at / FRAME));
    const offset = this.emitted / TARGET_RATE;

    this.emitted += piece.length;
    this.buf = this.buf.slice(at);
    this.frameRms = this.frameRms.slice(Math.ceil(at / FRAME));
    this.quietRun = 0;

    // Skip pieces with no speech: they waste quota and Whisper tends to invent
    // text ("धन्यवाद", "Thank you") over silence.
    const thr = this.threshold();
    const voiced = pieceRms.filter((r) => r >= thr).length;
    if (piece.length < TARGET_RATE * 0.6 || voiced < 10) return;

    this.onPiece(piece, offset);
  }

  // Average-then-pick decimation: a cheap low-pass that avoids aliasing hiss.
  private downsample(input: Float32Array): Float32Array {
    if (this.inputRate === TARGET_RATE) return input;
    const ratio = this.inputRate / TARGET_RATE;
    const out: number[] = [];
    // `resampleCarry` = where the next output window starts, in this chunk's coordinates.
    let pos = this.resampleCarry;
    while (pos + ratio <= input.length) {
      const start = Math.max(0, Math.floor(pos));
      const end = Math.floor(pos + ratio);
      let sum = 0;
      for (let k = start; k < end; k++) sum += input[k];
      out.push(end > start ? sum / (end - start) : 0);
      pos += ratio;
    }
    this.resampleCarry = pos - input.length; // in (-ratio, 0]
    return Float32Array.from(out);
  }
}

export function encodeWav(pcm: Int16Array, rate = TARGET_RATE): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + pcm.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, pcm.length * 2, true);
  new Int16Array(buffer, 44).set(pcm);
  return buffer;
}
