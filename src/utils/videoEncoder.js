/**
 * WebCodecs-based video encoder with minimal WebM muxer.
 * Falls back to MediaRecorder when WebCodecs is unavailable.
 */

// ─── EBML/WebM primitives ───

function ebmlVint(value) {
  if (value < 0x7F) return new Uint8Array([0x80 | value]);
  if (value < 0x3FFF) return new Uint8Array([0x40 | (value >> 8), value & 0xFF]);
  if (value < 0x1FFFFF) return new Uint8Array([0x20 | (value >> 16), (value >> 8) & 0xFF, value & 0xFF]);
  if (value < 0x0FFFFFFF)
    return new Uint8Array([0x10 | (value >> 24), (value >> 16) & 0xFF, (value >> 8) & 0xFF, value & 0xFF]);
  const b = new Uint8Array(8);
  b[0] = 0x08 | ((value / 2 ** 56) & 0xff);
  b[1] = ((value / 2 ** 48) & 0xff);
  b[2] = ((value / 2 ** 40) & 0xff);
  b[3] = ((value / 2 ** 32) & 0xff);
  b[4] = ((value / 2 ** 24) & 0xff);
  b[5] = ((value / 2 ** 16) & 0xff);
  b[6] = ((value / 2 ** 8) & 0xff);
  b[7] = value & 0xff;
  return b;
}

function concatUint8(arrays) {
  let total = 0;
  for (const a of arrays) total += a.length;
  const r = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { r.set(a, off); off += a.length; }
  return r;
}

function strBytes(s) { return new TextEncoder().encode(s); }

function f64(v) {
  const b = new ArrayBuffer(8);
  new DataView(b).setFloat64(0, v, false);
  return new Uint8Array(b);
}

function u16(v) { return new Uint8Array([v >> 8, v & 0xff]); }
function u32(v) { return new Uint8Array([v >> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]); }

function elem(id, content) {
  const ids = [];
  if (id <= 0xff) ids.push(id);
  else if (id <= 0xffff) ids.push(id >> 8, id & 0xff);
  else if (id <= 0xffffff) ids.push(id >> 16, (id >> 8) & 0xff, id & 0xff);
  else ids.push((id >> 24) & 0xff, (id >> 16) & 0xff, (id >> 8) & 0xff, id & 0xff);
  const idB = new Uint8Array(ids);
  const sizeB = ebmlVint(content.length);
  const r = new Uint8Array(idB.length + sizeB.length + content.length);
  r.set(idB, 0);
  r.set(sizeB, idB.length);
  r.set(content, idB.length + sizeB.length);
  return r;
}

// ─── WebM builder ───

/**
 * Build a complete WebM blob from video and/or audio encoded chunks.
 * @param {Array} videoChunks - array of EncodedVideoChunk (with .codec string attached)
 * @param {Array} audioChunks - array of EncodedAudioChunk
 * @param {number} width
 * @param {number} height
 * @param {number} fps
 * @returns {Uint8Array} complete WebM byte array
 */
export function muxToWebM(videoChunks, audioChunks, width, height, fps) {
  const numFrames = videoChunks.length;
  const durationNs = (numFrames / fps) * 1e9;

  // EBML header
  const ebml = elem(0x1a45dfa3, concatUint8([
    elem(0x4286, new Uint8Array([1])),
    elem(0x42f7, new Uint8Array([1])),
    elem(0x42f2, new Uint8Array([4])),
    elem(0x42f3, new Uint8Array([8])),
    elem(0x4282, strBytes('webm')),
    elem(0x4287, new Uint8Array([2])),
    elem(0x4285, new Uint8Array([2])),
  ]));

  // Info
  const info = elem(0x1549a966, concatUint8([
    elem(0x2ad7b1, u32(1000000)),
    elem(0x4489, f64(durationNs)),
    elem(0x4d80, strBytes('QuranReel')),
    elem(0x5741, strBytes('QuranReel')),
  ]));

  // Video track
  const videoCodecId = videoChunks.codec === 'vp8' ? 'V_VP8' : 'V_VP9';
  const videoTrack = elem(0xae, concatUint8([
    elem(0xd7, new Uint8Array([0x81])),
    elem(0x73c5, new Uint8Array([0x01])),
    elem(0x83, new Uint8Array([1])),
    elem(0x86, strBytes(videoCodecId)),
    elem(0xe0, concatUint8([
      elem(0xb0, u16(width)),
      elem(0xba, u16(height)),
    ])),
  ]));

  // Audio track (if present)
  let audioTrack = new Uint8Array(0);
  if (audioChunks.length > 0) {
    const numChannels = audioChunks.numberOfChannels || 2;
    const sampleRate = audioChunks.sampleRate || 48000;
    const opusHead = new Uint8Array([
      0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64,
      0x01,
      numChannels,
      0x00, 0x00,
      0x80, 0x3e,
      0x00, 0x00,
      0x00,
    ]);
    audioTrack = elem(0xae, concatUint8([
      elem(0xd7, new Uint8Array([0x82])),
      elem(0x73c5, new Uint8Array([0x02])),
      elem(0x83, new Uint8Array([2])),
      elem(0x86, strBytes('A_OPUS')),
      elem(0x63a2, opusHead),
      elem(0xe1, concatUint8([
        elem(0xb5, u32(sampleRate)),
        elem(0x9b, new Uint8Array([numChannels])),
      ])),
    ]));
  }

  const tracks = elem(0x1654ae6b, concatUint8([videoTrack, audioTrack]));

  // Build block timeline
  const blocks = [];
  for (let i = 0; i < videoChunks.length; i++) {
    const c = videoChunks[i];
    const data = new Uint8Array(c.byteLength);
    c.copyTo(data);
    blocks.push({ tsUs: i * 1_000_000 / fps, data, track: 1, keyframe: c.type === 'key' });
  }
  let audioTs = 0;
  for (const c of audioChunks) {
    const data = new Uint8Array(c.byteLength);
    c.copyTo(data);
    blocks.push({ tsUs: audioTs, data, track: 2, keyframe: true });
    audioTs += c.duration || 0;
  }
  blocks.sort((a, b) => a.tsUs - b.tsUs);

  // Group into clusters
  const clusterMaxSize = 32 * 1024 * 1024;
  const clusters = [];
  let curBlocks = [];
  let curSize = 0;
  let clusterBaseUs = blocks[0]?.tsUs || 0;

  for (const b of blocks) {
    const sz = 4 + b.data.length;
    if (curSize + sz > clusterMaxSize && curBlocks.length) {
      clusters.push({ blocks: curBlocks, baseUs: clusterBaseUs });
      curBlocks = [];
      curSize = 0;
      clusterBaseUs = b.tsUs;
    }
    curBlocks.push(b);
    curSize += sz;
  }
  if (curBlocks.length) clusters.push({ blocks: curBlocks, baseUs: clusterBaseUs });

  const clusterElements = clusters.map(cl => {
    const baseMs = Math.round(cl.baseUs / 1000);
    const sbs = cl.blocks.map(b => {
      const relMs = Math.round(b.tsUs / 1000) - baseMs;
      const hdr = new Uint8Array(4);
      hdr[0] = b.track === 1 ? 0x81 : 0x82;
      hdr[1] = (relMs >> 8) & 0xff;
      hdr[2] = relMs & 0xff;
      hdr[3] = b.keyframe ? 0x80 : 0x00;
      return elem(0xa3, concatUint8([hdr, b.data]));
    });
    return elem(0x1f43b675, concatUint8([elem(0xe7, u32(baseMs)), concatUint8(sbs)]));
  });

  const segment = elem(0x18538067, concatUint8([info, tracks, concatUint8(clusterElements)]));
  return concatUint8([ebml, segment]);
}

// ─── Video encoder ───

function pickVideoCodec(width, height, bitrate, framerate) {
  const candidates = ['vp09.00.10.08', 'vp8'];
  return candidates.reduce(async (acc, codec) => {
    const resolved = await acc;
    if (resolved) return resolved;
    const cfg = { codec, width, height, bitrate, framerate };
    const support = await VideoEncoder.isConfigSupported(cfg);
    return support.supported ? { config: cfg, raw: codec.startsWith('vp09') ? 'vp9' : 'vp8' } : null;
  }, Promise.resolve(null));
}

/**
 * Encode all video frames using WebCodecs VideoEncoder.
 * Uses a Web Worker when available to keep main thread responsive.
 * @returns {Array} chunks array with .codec property attached
 */
export async function encodeVideoFrames(canvas, renderFrameFn, totalFrames, fps = 30, bitrate = 2_000_000, signal) {
  // Try worker path first
  try {
    return await encodeViaWorker(canvas, renderFrameFn, totalFrames, fps, bitrate, signal);
  } catch (_) {
    // Fallback to main thread encoding
  }

  const codecInfo = await pickVideoCodec(canvas.width, canvas.height, bitrate, fps);
  if (!codecInfo) throw new Error('No supported video codec found');

  const chunks = [];
  const encoder = new VideoEncoder({
    output: (chunk) => chunks.push(chunk),
    error: (e) => { throw e; },
  });
  encoder.configure(codecInfo.config);

  for (let i = 0; i < totalFrames; i++) {
    if (signal?.aborted) { encoder.flush(); encoder.close(); throw new DOMException('Aborted'); }
    renderFrameFn(i);
    const frame = new VideoFrame(canvas, { timestamp: i * 1_000_000 / fps });
    encoder.encode(frame);
    frame.close();
    // Yield every 15 frames to keep UI responsive
    if (i % 15 === 0) await new Promise(r => setTimeout(r, 0));
  }

  await encoder.flush();
  encoder.close();
  chunks.codec = codecInfo.raw;
  return chunks;
}

async function encodeViaWorker(canvas, renderFrameFn, totalFrames, fps, bitrate, signal) {
  if (typeof Worker === 'undefined') throw new Error('No Worker support');
  const worker = new Worker(new URL('./encoderWorker.js', import.meta.url), { type: 'module' });

  return new Promise((resolve, reject) => {
    let chunks = [];
    let frameCount = 0;
    let workerReady = false;
    let flushing = false;

    worker.onmessage = async (e) => {
      const msg = e.data;
      if (msg.type === 'ready') {
        workerReady = true;
        // Start sending frames
        sendNextFrame();
      } else if (msg.type === 'chunk') {
        chunks.push(msg);
      } else if (msg.type === 'progress') {
        // noop
      } else if (msg.type === 'done') {
        // Reconstruct chunks with codec info
        const first = msg.chunks[0];
        chunks = msg.chunks.map(c => ({
          byteLength: c.data.byteLength,
          copyTo: (dst) => { new Uint8Array(dst).set(new Uint8Array(c.data)); },
          type: c.type,
          timestamp: c.timestamp,
        }));
        chunks.codec = first?.codec || 'vp9';
        worker.terminate();
        resolve(chunks);
      } else if (msg.type === 'error') {
        worker.terminate();
        reject(new Error(msg.message));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };

    async function sendNextFrame() {
      if (signal?.aborted) {
        worker.postMessage({ type: 'flush' });
        return;
      }
      if (frameCount >= totalFrames) {
        if (!flushing) { flushing = true; worker.postMessage({ type: 'flush' }); }
        return;
      }
      renderFrameFn(frameCount);
      let bitmap;
      try {
        bitmap = await createImageBitmap(canvas);
      } catch (e) {
        worker.terminate();
        reject(e);
        return;
      }
      const ts = frameCount * 1_000_000 / fps;
      worker.postMessage({ type: 'frame', bitmap, timestamp: ts }, [bitmap]);
      frameCount++;
      // Yield every 15 frames for UI responsiveness
      if (frameCount % 15 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
      sendNextFrame();
    }

    // Init worker
    worker.postMessage({
      type: 'init',
      width: canvas.width,
      height: canvas.height,
      fps,
      bitrate,
      totalFrames,
    });
  });
}

// ─── Audio encoder ───

/**
 * Capture PCM from a Web Audio pipeline and encode with AudioEncoder (Opus).
 * Uses ScriptProcessorNode to intercept audio.
 * @param {AudioContext} audioCtx
 * @param {number} durationMs - how long to capture
 * @param {AbortSignal} [signal]
 * @returns {Array} audio chunks with .sampleRate and .numberOfChannels attached
 */
export async function encodeAudioFromContext(audioCtx, durationMs, signal) {
  const sampleRate = audioCtx.sampleRate;
  const numChannels = 2;
  const bufferSize = 4096;
  const maxFrames = Math.ceil((durationMs / 1000) * sampleRate);

  const chunks = [];
  const audioEncoder = new AudioEncoder({
    output: (chunk) => chunks.push(chunk),
    error: (e) => { throw e; },
  });
  audioEncoder.configure({
    codec: 'opus',
    sampleRate: 48000,
    numberOfChannels: numChannels,
    bitrate: 128000,
  });

  let scriptNode;
  let totalSamples = 0;
  let encoderFlushed = false;

  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Audio capture timed out')), durationMs + 5000);

      scriptNode = audioCtx.createScriptProcessor(bufferSize, numChannels, numChannels);
      scriptNode.onaudioprocess = (e) => {
        if (signal?.aborted) return;
        if (totalSamples >= maxFrames) return;

        const input = e.inputBuffer;
        const numFrames = input.length;
        if (numFrames === 0) return;
        totalSamples += numFrames;

        const data = new Float32Array(numFrames * numChannels);
        for (let ch = 0; ch < numChannels; ch++) {
          const chData = input.getChannelData(ch);
          for (let s = 0; s < numFrames; s++) data[s * numChannels + ch] = chData[s];
        }

        const audioData = new AudioData({
          format: 'f32',
          sampleRate: input.sampleRate,
          numberOfFrames: numFrames,
          numberOfChannels: numChannels,
          timestamp: (totalSamples - numFrames) * 1_000_000 / sampleRate,
          data,
        });
        audioEncoder.encode(audioData);
        audioData.close();

        if (totalSamples >= maxFrames && !encoderFlushed) {
          encoderFlushed = true;
          clearTimeout(timeout);
          audioEncoder.flush().then(resolve).catch(reject);
        }
      };

      scriptNode.connect(audioCtx.destination);
    });
  } finally {
    if (scriptNode) {
      try { scriptNode.disconnect(); } catch (_) {}
    }
  }

  audioEncoder.close();
  chunks.sampleRate = 48000;
  chunks.numberOfChannels = numChannels;
  return chunks;
}

/**
 * Encode a decoded AudioBuffer into Opus packets (non-real-time, fast).
 * Used for background audio files that can be decoded ahead of time.
 */
export async function encodeAudioFromBuffer(audioBuffer, signal) {
  const sampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;
  const numFrames = audioBuffer.length;
  if (numFrames === 0) return [];

  const chunks = [];
  const encoder = new AudioEncoder({
    output: (chunk) => chunks.push(chunk),
    error: (e) => { throw e; },
  });
  encoder.configure({
    codec: 'opus',
    sampleRate: 48000,
    numberOfChannels: numChannels,
    bitrate: 128000,
  });

  const blockSize = 4096;
  for (let offset = 0; offset < numFrames; offset += blockSize) {
    if (signal?.aborted) { encoder.flush(); encoder.close(); throw new DOMException('Aborted'); }
    const frames = Math.min(blockSize, numFrames - offset);
    const data = new Float32Array(frames * numChannels);
    for (let ch = 0; ch < numChannels; ch++) {
      const chData = audioBuffer.getChannelData(ch);
      for (let s = 0; s < frames; s++) data[s * numChannels + ch] = chData[offset + s];
    }
    const ad = new AudioData({
      format: 'f32',
      sampleRate,
      numberOfFrames: frames,
      numberOfChannels: numChannels,
      timestamp: offset * 1_000_000 / sampleRate,
      data,
    });
    encoder.encode(ad);
    ad.close();
  }

  await encoder.flush();
  encoder.close();
  chunks.sampleRate = 48000;
  chunks.numberOfChannels = numChannels;
  return chunks;
}

/**
 * Fetch an audio URL, decode it, and return the AudioBuffer.
 */
export async function decodeAudioFile(url, signal) {
  const res = await fetch(url, { signal });
  const buf = await res.arrayBuffer();
  const ctx = new OfflineAudioContext(2, 1, 48000);
  const audioBuf = await ctx.decodeAudioData(buf);
  ctx.close();
  return audioBuf;
}

/**
 * Loop an AudioBuffer to fill a target duration (in seconds), trimming excess.
 */
export function loopAudioBuffer(buffer, targetDurationSec) {
  const srcSampleRate = buffer.sampleRate;
  const srcChannels = buffer.numberOfChannels;
  const srcLength = buffer.length;
  const targetLength = Math.round(targetDurationSec * srcSampleRate);
  if (srcLength >= targetLength) return buffer; // already long enough

  // Create a new buffer of target length by looping
  const ctx = new OfflineAudioContext(srcChannels, targetLength, srcSampleRate);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.connect(ctx.destination);
  src.start(0);
  const rendered = ctx.startRendering();
  ctx.close();
  return rendered;
}

// ─── Feature detection ───

export async function isWebCodecsSupported() {
  return typeof VideoEncoder !== 'undefined'
    && typeof VideoFrame !== 'undefined'
    && typeof AudioEncoder !== 'undefined'
    && typeof AudioData !== 'undefined';
}

// ─── High-level export ───

/**
 * Full export: encode video (offline, fast) + optional audio capture + mux into WebM.
 */
export async function exportVideo(opts) {
  const {
    canvas, renderFrame, totalFrames, fps = 30, bitrate = 2_000_000,
    audioCtx, audioDurationMs, signal, onProgress, onStatus,
  } = opts;

  onStatus?.('Encoding video frames...');
  const videoChunks = await encodeVideoFrames(canvas, renderFrame, totalFrames, fps, bitrate, signal);

  let audioChunks = [];
  if (audioCtx && audioDurationMs) {
    onStatus?.('Capturing audio...');
    audioChunks = await encodeAudioFromContext(audioCtx, audioDurationMs, signal);
  }

  onStatus?.('Muxing final video...');
  const webm = muxToWebM(videoChunks, audioChunks, canvas.width, canvas.height, fps);
  return new Blob([webm], { type: 'video/webm' });
}

// ─── MediaRecorder fallback ───

export async function exportWithMediaRecorder(canvas, renderFrame, totalFrames, fps = 30) {
  const stream = canvas.captureStream(fps);
  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) throw new Error('Failed to capture canvas.');

  let mimeType = 'video/webm;codecs=vp9,opus';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm;codecs=vp8,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    const recorder = new MediaRecorder(new MediaStream([videoTrack]), { mimeType });
    recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = () => reject(new Error('MediaRecorder error'));
    recorder.start();

    let idx = 0;
    const next = () => {
      if (idx >= totalFrames) { recorder.stop(); return; }
      renderFrame(idx);
      idx++;
      requestAnimationFrame(next);
    };
    requestAnimationFrame(next);
  });
}
