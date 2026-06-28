/**
 * Web Worker for VideoEncoder — keeps encoding off the main thread.
 * Receives ImageBitmap frames, encodes with VP9/VP8, sends chunks back.
 */
let encoder;

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    const { width, height, fps, bitrate, totalFrames } = msg;
    // Detect best codec
    const candidates = ['vp09.00.10.08', 'vp8'];
    let config;
    for (const codec of candidates) {
      const cfg = { codec, width, height, bitrate, framerate: fps };
      const supported = await VideoEncoder.isConfigSupported(cfg);
      if (supported.supported) { config = cfg; break; }
    }
    if (!config) { self.postMessage({ type: 'error', message: 'No supported codec' }); return; }

    let frameCount = 0;
    const chunks = [];

    encoder = new VideoEncoder({
      output: (chunk) => {
        const buf = new Uint8Array(chunk.byteLength);
        chunk.copyTo(buf);
        chunks.push({ data: buf.buffer, type: chunk.type, timestamp: chunk.timestamp, codec: config.codec.startsWith('vp09') ? 'vp9' : 'vp8' });
      },
      error: (e) => self.postMessage({ type: 'error', message: e.message }),
    });
    encoder.configure(config);

    self.onmessage = (e2) => {
      const m = e2.data;
      if (m.type === 'frame') {
        const frame = new VideoFrame(m.bitmap, { timestamp: m.timestamp });
        encoder.encode(frame);
        frame.close();
        m.bitmap.close();
        frameCount++;
        if (frameCount % 15 === 0) {
          self.postMessage({ type: 'progress', frames: frameCount, total: totalFrames });
        }
      } else if (m.type === 'flush') {
        encoder.flush().then(() => {
          encoder.close();
          encoder = null;
          self.postMessage({ type: 'done', chunks, numFrames: frameCount });
        });
      }
    };
    self.postMessage({ type: 'ready' });
  }
};
