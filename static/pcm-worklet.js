/* AudioWorklet: capture mic Float32 frames, downsample to 16 kHz, emit Int16 PCM. */
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this._ratio = sampleRate / 16000;
    this._phase = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const samples = input[0];
    const inLen = samples.length;

    // Linear-interpolation downsample to 16 kHz with cross-block phase continuity
    const pcmChunks = [];
    while (this._phase < inLen - 1) {
      const lo = Math.floor(this._phase);
      const hi = lo + 1;
      const frac = this._phase - lo;
      const s = samples[lo] + (samples[hi] - samples[lo]) * frac;
      const clamped = Math.max(-32768, Math.min(32767, Math.round(s * 32767)));
      pcmChunks.push(clamped);
      this._phase += this._ratio;
    }
    this._phase -= inLen;
    if (this._phase < 0) this._phase = 0;

    if (pcmChunks.length > 0) {
      const pcm = new Int16Array(pcmChunks);
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }
    return true;
  }
}
registerProcessor('pcm-capture', PcmCapture);
