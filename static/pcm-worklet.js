/* AudioWorklet: capture mic Float32 frames, downsample to 16 kHz, emit Int16 PCM. */
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this._ratio = sampleRate / 16000;
    this._carry = [];
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const samples = input[0];

    // linear-interpolation downsample to 16 kHz
    const outLen = Math.floor(samples.length / this._ratio);
    const pcm = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const pos = i * this._ratio;
      const lo = Math.floor(pos);
      const hi = Math.min(lo + 1, samples.length - 1);
      const s = samples[lo] + (samples[hi] - samples[lo]) * (pos - lo);
      pcm[i] = Math.max(-32768, Math.min(32767, Math.round(s * 32767)));
    }
    this.port.postMessage(pcm.buffer, [pcm.buffer]);
    return true;
  }
}
registerProcessor('pcm-capture', PcmCapture);
