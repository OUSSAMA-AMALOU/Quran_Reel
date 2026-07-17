/**
 * Helper to wrap and draw text on canvas with centering and shadows
 */
const _wrapCache = new Map();
const _WRAP_CACHE_MAX = 200;
const _gradientCache = {};
let _bgImageCache = null;
let _playerBgCache = null;

const FONT_MAP = {
  amiri: "'Amiri', serif",
  'amiri-quran': '"Amiri Quran", serif',
  scheherazade: '"Scheherazade New", serif',
  'noto-naskh': '"Noto Naskh Arabic", serif',
  lateef: "'Lateef', serif",
  'aref-ruqaa': '"Aref Ruqaa", serif',
  'uthmanic-hafs': '"Uthmanic Hafs", serif',
  'decotype-naskh': '"DecoType Naskh", serif',
  cairo: "'Cairo', sans-serif",
  tajawal: "'Tajawal', sans-serif",
  almarai: "'Almarai', sans-serif",
  'noto-sans-arabic': '"Noto Sans Arabic", sans-serif',
  'reem-kufi': '"Reem Kufi", sans-serif',
  'noto-kufi-arabic': '"Noto Kufi Arabic", sans-serif',
  'el-messiri': '"El Messiri", sans-serif',
  'traditional-arabic': '"Traditional Arabic", serif',
}; // { url: string, img: HTMLImageElement }
const _wordPositions = {};

export function getWordPositions(ayahKey) {
  return _wordPositions[ayahKey] || [];
}

function _cachedSet(map, key, value) {
  map.set(key, value);
  if (map.size > _WRAP_CACHE_MAX) {
    const first = map.keys().next().value;
    if (first !== undefined) map.delete(first);
  }
}

function _drawGradientBg(ctx, width, height, cache, config) {
  const c1 = config.bgColor1 || '';
  const c2 = config.bgColor2 || '';
  if (c1 && c2) {
    const key = `custom_${c1}_${c2}`;
    let grad = cache[key];
    if (!grad) {
      grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      cache[key] = grad;
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    return;
  }
  const bgId = config.backgroundId || 'starfield';
  let grad;
  if (bgId === 'stars') {
    grad = cache['stars'];
    if (!grad) {
      grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#0a0e1a');
      grad.addColorStop(0.4, '#0f1428');
      grad.addColorStop(0.7, '#090b14');
      grad.addColorStop(1, '#020306');
      cache['stars'] = grad;
    }
  } else if (bgId === 'forest') {
    grad = cache['forest'];
    if (!grad) {
      grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#0a1a0e');
      grad.addColorStop(0.3, '#0d2412');
      grad.addColorStop(0.6, '#081a0e');
      grad.addColorStop(1, '#030a06');
      cache['forest'] = grad;
    }
  } else if (bgId === 'rain') {
    grad = cache['rain'];
    if (!grad) {
      grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#0a1218');
      grad.addColorStop(0.3, '#101a24');
      grad.addColorStop(0.6, '#0a1218');
      grad.addColorStop(1, '#04080c');
      cache['rain'] = grad;
    }
  } else {
    grad = cache['starfield'];
    if (!grad) {
      grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#080a14');
      grad.addColorStop(0.5, '#130e25');
      grad.addColorStop(1, '#020306');
      cache['starfield'] = grad;
    }
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function wrapTextCached(ctx, text, x, y, maxWidth, lineHeight, font, align = 'center') {
  const key = `${text}|${font}|${maxWidth}`;
  let cached = _wrapCache.get(key);
  if (!cached) {
    ctx.font = font;
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine + words[i] + ' ';
      if (ctx.measureText(testLine).width > maxWidth && i > 0) {
        lines.push(currentLine.trim());
        currentLine = words[i] + ' ';
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine.trim());
    cached = { lines, height: lines.length * lineHeight };
    _cachedSet(_wrapCache, key, cached);
  }
  ctx.font = font;
  ctx.textAlign = align;
  cached.lines.forEach((line, index) => {
    ctx.fillText(line, x, y + (index * lineHeight));
  });
  return cached.height;
}

export function wrapText(ctx, text, x, y, maxWidth, lineHeight, align = 'center') {
  return wrapTextCached(ctx, text, x, y, maxWidth, lineHeight, ctx.font, align);
}

/**
 * Main function to draw a single frame of the reel onto the canvas.
 * Handles background cropping (object-fit: cover), text wrapping,
 * vignettes, watermarks, and audio visualizers.
 */
// ─── Visual Effects ───

function _drawVisualEffect(ctx, width, height, effect, time) {
  if (!effect || effect === 'none') return;
  const t = (time || 0);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  switch (effect) {
    // ── 1. Floating Particles (Pro) ──
    case 'particles': {
      const count = 60;
      for (let i = 0; i < count; i++) {
        const s = i * 137.5;
        const x = (Math.sin(s + t * 0.15 + i * 0.3) * 0.5 + 0.5) * width;
        const y = ((s * 1.7 + t * 12 + i * 50) % (height + 120)) - 60;
        const sz = 1.5 + Math.sin(s + t * 0.8 + i) * 1.2;
        const alpha = 0.25 + Math.sin(s + t * 0.5 + i * 0.7) * 0.2;
        const hue = 40 + Math.sin(s + t * 0.3) * 20;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5, sz), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue},80%,70%,${Math.max(0, alpha)})`;
        ctx.shadowColor = `hsla(${hue},80%,70%,0.3)`;
        ctx.shadowBlur = 6;
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      break;
    }

    // ── 2. Light Halos (Pro) ──
    case 'halos': {
      const haloColors = [
        { h: 45, s: 80 },
        { h: 330, s: 70 },
        { h: 200, s: 70 },
        { h: 120, s: 60 },
        { h: 280, s: 60 },
        { h: 15, s: 75 },
      ];
      for (let i = 0; i < 6; i++) {
        const s = i * 97.3;
        const cx = (Math.sin(s + t * 0.08 + i * 0.5) * 0.5 + 0.5) * width;
        const cy = (Math.cos(s * 1.3 + t * 0.06 + i * 0.3) * 0.5 + 0.5) * height;
        const radius = 100 + Math.sin(t * 0.4 + i * 1.2) * 40;
        const { h, s: sat } = haloColors[i % 6];
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        const a1 = 0.1 + Math.sin(t * 0.3 + i * 0.9) * 0.05;
        const a2 = 0.04 + Math.sin(t * 0.2 + i * 0.7) * 0.02;
        grad.addColorStop(0, `hsla(${h},${sat}%,70%,${Math.max(0, a1)})`);
        grad.addColorStop(0.4, `hsla(${h},${sat}%,60%,${Math.max(0, a2)})`);
        grad.addColorStop(1, `hsla(${h},${sat}%,50%,0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }
      break;
    }

    // ── 3. Breathing Frame (Pro) ──
    case 'breathing': {
      const pulse = 0.5 + Math.sin(t * 0.9) * 0.5;
      const bw = 2 + pulse * 5;
      ctx.strokeStyle = `rgba(255,255,255,${0.15 + pulse * 0.35})`;
      ctx.lineWidth = bw;
      ctx.shadowColor = `hsla(45,80%,70%,${0.1 + pulse * 0.2})`;
      ctx.shadowBlur = 8 + pulse * 25;
      ctx.strokeRect(15, 15, width - 30, height - 30);
      // Inner glow ring
      ctx.strokeStyle = `hsla(45,60%,60%,${0.05 + pulse * 0.12})`;
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
      ctx.strokeRect(30, 30, width - 60, height - 60);
      ctx.shadowBlur = 0;
      break;
    }

    // ── 4. Scan Light (Pro) ──
    case 'scanline': {
      const scanY = ((t * 50) % (height + 150)) - 75;
      const grad = ctx.createLinearGradient(0, scanY - 80, 0, scanY + 80);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.3, `rgba(255,255,255,${0.04 + Math.sin(t * 2.5) * 0.02})`);
      grad.addColorStop(0.5, `rgba(255,255,255,${0.12 + Math.sin(t * 2) * 0.04})`);
      grad.addColorStop(0.7, `rgba(255,255,255,${0.04 + Math.sin(t * 2.5) * 0.02})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.shadowColor = 'rgba(255,255,255,0.05)';
      ctx.shadowBlur = 20;
      ctx.fillRect(0, scanY - 80, width, 160);
      ctx.shadowBlur = 0;
      break;
    }

    // ── 5. Falling Stars (Pro) ──
    case 'stars': {
      for (let i = 0; i < 30; i++) {
        const s = i * 211.7;
        const startX = (Math.sin(s) * 0.5 + 0.5) * width * 1.2 - width * 0.1;
        const x = startX - (t * 60 + s * 0.3) * 0.3;
        const y = ((s * 2.1 + t * 90 + i * 30) % (height + 120)) - 60;
        const sz = 1 + Math.sin(s + t * 1.5 + i) * 1.2;
        const alpha = 0.5 + Math.sin(s + t * 1.2 + i * 0.5) * 0.3;
        // Glow core
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5, sz * 0.6), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, alpha)})`;
        ctx.shadowColor = `rgba(255,240,200,${Math.max(0, alpha * 0.4)})`;
        ctx.shadowBlur = 8;
        ctx.fill();
        // Tail
        ctx.shadowBlur = 0;
        const tailLen = 15 + sz * 5;
        const grad = ctx.createLinearGradient(x, y, x + tailLen * 0.6, y + tailLen * 0.8);
        grad.addColorStop(0, `rgba(255,240,200,${Math.max(0, alpha * 0.6)})`);
        grad.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + tailLen * 0.6, y + tailLen * 0.8);
        ctx.lineTo(x + tailLen * 0.3, y + tailLen * 0.4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      break;
    }

    // ── 6. Light Rays (Pro) ──
    case 'rays': {
      const cx = width / 2;
      const cy = height / 2;
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + t * 0.03;
        const spread = 0.15 + Math.sin(t * 0.2 + i * 0.5) * 0.05;
        const grad = ctx.createLinearGradient(
          cx, cy,
          cx + Math.cos(angle) * width, cy + Math.sin(angle) * height
        );
        const a1 = 0.04 + Math.sin(t * 0.2 + i * 0.8) * 0.025;
        const a2 = 0.015 + Math.sin(t * 0.15 + i * 0.6) * 0.01;
        grad.addColorStop(0, `rgba(255,220,100,${Math.max(0, a1)})`);
        grad.addColorStop(0.3, `rgba(255,200,80,${Math.max(0, a2)})`);
        grad.addColorStop(1, 'rgba(255,200,80,0)');
        ctx.save();
        ctx.fillStyle = grad;
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.fillRect(0, -width * spread, width * 1.2, width * spread * 2);
        ctx.restore();
      }
      break;
    }

    // ── 7. Shimmer (Pro) ──
    case 'shimmer': {
      for (let b = 0; b < 3; b++) {
        const offset = b * (width + 200) / 3;
        const shimmerX = ((t * 35 + offset) % (width + 300)) - 150;
        const grad = ctx.createLinearGradient(shimmerX - 100, 0, shimmerX + 100, height);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.3, `rgba(255,255,255,${0.03 + Math.sin(t * 1.5 + b) * 0.015})`);
        grad.addColorStop(0.5, `rgba(255,255,255,${0.08 + Math.sin(t * 1.2 + b * 0.5) * 0.03})`);
        grad.addColorStop(0.7, `rgba(255,255,255,${0.03 + Math.sin(t * 1.5 + b) * 0.015})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }
      break;
    }

    // ── 8. Soft Fog (Pro) ──
    case 'fog': {
      const fogColors = [
        { h: 210, s: 30, l: 80 },
        { h: 270, s: 25, l: 75 },
        { h: 180, s: 20, l: 80 },
        { h: 320, s: 15, l: 78 },
      ];
      for (let i = 0; i < 5; i++) {
        const s = i * 137.5;
        const fx = (Math.sin(s + t * 0.05 + i * 8) * 0.5 + 0.5) * width;
        const fy = (Math.cos(s * 1.3 + t * 0.035 + i * 15) * 0.5 + 0.5) * height;
        const radius = 200 + i * 100 + Math.sin(t * 0.1 + i * 0.7) * 40;
        const { h, s: sat, l } = fogColors[i % 4];
        const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, radius);
        grad.addColorStop(0, `hsla(${h},${sat}%,${l}%,${0.035 + Math.sin(t * 0.15 + i * 0.5) * 0.015})`);
        grad.addColorStop(1, `hsla(${h},${sat}%,${l}%,0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }
      break;
    }

    // ── 9. Bokeh ──
    case 'bokeh': {
      ctx.save();
      ctx.filter = 'blur(4px)';
      for (let i = 0; i < 18; i++) {
        const s = i * 173.3;
        const bx = (Math.sin(s * 0.7 + t * 0.02 + i * 0.1) * 0.5 + 0.5) * width;
        const by = (Math.cos(s * 0.9 + t * 0.015 + i * 0.2) * 0.5 + 0.5) * height;
        const r = 12 + Math.sin(s + t * 0.1 + i) * 8;
        const hue = (i * 37 + t * 5) % 360;
        const alpha = 0.04 + Math.sin(s + t * 0.05 + i * 0.3) * 0.02;
        ctx.beginPath();
        ctx.arc(bx, by, Math.max(4, r), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue},60%,70%,${Math.max(0, alpha)})`;
        ctx.fill();
      }
      ctx.restore();
      break;
    }

    // ── 10. Fireflies ──
    case 'fireflies': {
      for (let i = 0; i < 14; i++) {
        const s = i * 251.3;
        const fx = (Math.sin(s * 0.3 + t * 0.04 + i * 0.5) * 0.5 + 0.5) * width;
        const fy = (Math.cos(s * 0.4 + t * 0.03 + i * 0.3) * 0.5 + 0.5) * height;
        const glow = 0.4 + Math.sin(s + t * 0.8 + i * 1.5) * 0.3;
        // Glow halo
        const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, 20 + glow * 10);
        grad.addColorStop(0, `rgba(255,240,150,${Math.max(0, glow * 0.25)})`);
        grad.addColorStop(1, 'rgba(255,240,150,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        // Core dot
        ctx.beginPath();
        ctx.arc(fx, fy, 1.5 + glow * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,220,${Math.max(0, glow * 0.7)})`;
        ctx.shadowColor = 'rgba(255,240,150,0.5)';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      break;
    }

    // ── 11. Aurora ──
    case 'aurora': {
      ctx.save();
      ctx.filter = 'blur(25px)';
      const layers = 4;
      for (let i = 0; i < layers; i++) {
        ctx.beginPath();
        const hue = 180 + i * 30 + Math.sin(t * 0.02) * 20;
        const alpha = 0.03 + Math.sin(t * 0.05 + i * 1.2) * 0.015;
        const centerY = height * (0.15 + i * 0.12);
        ctx.moveTo(0, centerY);
        for (let x = 0; x <= width; x += 15) {
          const wave = Math.sin(x * 0.008 + t * 0.04 + i * 2.5) * height * 0.08
                     + Math.sin(x * 0.02 + t * 0.06 + i * 1.3) * height * 0.04;
          ctx.lineTo(x, centerY + wave);
        }
        ctx.lineTo(width, centerY + 80);
        ctx.lineTo(0, centerY + 80);
        ctx.closePath();
        ctx.fillStyle = `hsla(${hue},70%,60%,${Math.max(0, alpha)})`;
        ctx.fill();
      }
      ctx.restore();
      break;
    }

    // ── 12. Snowfall ──
    case 'snow': {
      for (let i = 0; i < 40; i++) {
        const s = i * 157.1;
        const x = ((s * 0.7 + t * 8 + Math.sin(s + t * 0.3 + i) * 20) % (width + 40)) - 20;
        const y = ((s * 1.3 + t * 35 + i * 15) % (height + 60)) - 30;
        const sz = 1.5 + Math.sin(s + t * 0.2 + i) * 1.2;
        const alpha = 0.2 + Math.sin(s + t * 0.4 + i * 0.6) * 0.15;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5, sz), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, alpha)})`;
        ctx.shadowColor = 'rgba(255,255,255,0.1)';
        ctx.shadowBlur = 4;
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      break;
    }

    // ── 13. Light Leak ──
    case 'lightleak': {
      const leaks = [
        { angle: -0.3 + Math.sin(t * 0.1) * 0.2, hue: 30, w: 0.3 },
        { angle: 0.8 + Math.sin(t * 0.08 + 1) * 0.15, hue: 320, w: 0.2 },
        { angle: 2.5 + Math.sin(t * 0.06 + 2) * 0.2, hue: 200, w: 0.25 },
      ];
      for (const L of leaks) {
        const alpha = 0.04 + Math.sin(t * 0.12 + L.hue) * 0.02;
        const centerX = width * (0.3 + Math.sin(t * 0.05 + L.angle) * 0.2);
        const centerY = height * (0.3 + Math.cos(t * 0.04 + L.angle) * 0.2);
        const grad = ctx.createRadialGradient(
          centerX, centerY, 0,
          centerX, centerY, width * L.w
        );
        grad.addColorStop(0, `hsla(${L.hue},70%,60%,${Math.max(0, alpha)})`);
        grad.addColorStop(0.5, `hsla(${L.hue},60%,50%,${Math.max(0, alpha * 0.5)})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }
      break;
    }

    // ── 14. Sparkle ──
    case 'sparkle': {
      for (let i = 0; i < 20; i++) {
        const s = i * 189.7;
        const sx = (Math.sin(s * 0.5 + t * 0.03 + i * 0.2) * 0.5 + 0.5) * width;
        const sy = (Math.cos(s * 0.6 + t * 0.02 + i * 0.3) * 0.5 + 0.5) * height;
        const pulse = 0.3 + Math.sin(s + t * 1.5 + i * 2) * 0.4;
        const sz = 2 + pulse * 5;
        if (pulse < 0.1) continue;
        const hue = (45 + i * 25 + t * 20) % 360;
        // 4-point star
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(t * 0.1 + i * 0.5);
        ctx.beginPath();
        for (let p = 0; p < 4; p++) {
          const a = (p / 4) * Math.PI * 2;
          const ox = Math.cos(a) * sz;
          const oy = Math.sin(a) * sz;
          const ix = Math.cos(a + Math.PI / 4) * sz * 0.3;
          const iy = Math.sin(a + Math.PI / 4) * sz * 0.3;
          if (p === 0) ctx.moveTo(ox, oy);
          else ctx.lineTo(ox, oy);
          ctx.lineTo(ix, iy);
        }
        ctx.closePath();
        ctx.fillStyle = `hsla(${hue},80%,70%,${Math.max(0, pulse * 0.5)})`;
        ctx.shadowColor = `hsla(${hue},80%,70%,0.3)`;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();
      }
      ctx.shadowBlur = 0;
      break;
    }

    // ── 15. Islamic Geometric ──
    case 'islamic': {
      const repeat = 6;
      const cellW = width / repeat;
      const cellH = height / (repeat * 1.5);
      const rot = t * 0.02;
      ctx.strokeStyle = `rgba(255,215,150,${0.06 + Math.sin(t * 0.1) * 0.02})`;
      ctx.lineWidth = 1;
      for (let r = 0; r < repeat * 1.5; r++) {
        for (let c = 0; c < repeat; c++) {
          const cx2 = c * cellW + cellW / 2;
          const cy2 = r * cellH + cellH / 2;
          ctx.save();
          ctx.translate(cx2, cy2);
          ctx.rotate(rot + r * 0.1 + c * 0.05);
          ctx.beginPath();
          const sz2 = Math.min(cellW, cellH) * 0.35;
          for (let p = 0; p < 8; p++) {
            const a = (p / 8) * Math.PI * 2;
            const dist = p % 2 === 0 ? sz2 : sz2 * 0.4;
            ctx[p === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * dist, Math.sin(a) * dist);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }
      }
      break;
    }
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

export function drawFrame({
  ctx,
  canvas,
  videoElement,
  audioAnalyser,
  currentAyah,
  config,
  isPlaying,
  currentTime,
  highlightedWords = []
}) {
  // Store word positions for this ayah (for click detection)
  const ayahKey = currentAyah ? `a${currentAyah.number || currentAyah.numberInSurah || 0}` : '';
  const positions = [];
  const width = canvas.width; // 1080
  const height = canvas.height; // 1920

  // Check for intro override
  const introConfig = config.intro;
  if (introConfig && introConfig.enabled && currentTime !== undefined && currentTime < introConfig.duration) {
    _drawIntro(ctx, width, height, introConfig, currentTime);
    _drawVisualEffect(ctx, width, height, config.visualEffect, currentTime);
    return;
  }

  // Player video style (full-screen audio player design)
  if (config.videoStyle === 'player') {
    _drawPlayerDesign(ctx, width, height, config, currentTime, isPlaying, audioAnalyser, currentAyah);
    _drawVisualEffect(ctx, width, height, config.visualEffect, currentTime);
    return;
  }

  // 1. Draw Background

  if (config.backgroundType === 'upload' && videoElement && videoElement.readyState >= 2) {
    const canvasAspect = width / height;
    const videoAspect = videoElement.videoWidth / videoElement.videoHeight;
    let sx, sy, sWidth, sHeight;
    if (videoAspect > canvasAspect) {
      sHeight = videoElement.videoHeight;
      sWidth = sHeight * canvasAspect;
      sx = (videoElement.videoWidth - sWidth) / 2;
      sy = 0;
    } else {
      sWidth = videoElement.videoWidth;
      sHeight = sWidth / canvasAspect;
      sx = 0;
      sy = (videoElement.videoHeight - sHeight) / 2;
    }
    ctx.drawImage(videoElement, sx, sy, sWidth, sHeight, 0, 0, width, height);
  } else if (config.bgImage) {
    if (!_bgImageCache || _bgImageCache.url !== config.bgImage) {
      _bgImageCache = { url: config.bgImage, img: new Image() };
      _bgImageCache.img.src = config.bgImage;
    }
    const img = _bgImageCache.img;
    if (img.complete && img.naturalWidth > 0) {
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const canvasAspect = width / height;
      let sx2, sy2, sWidth2, sHeight2;
      if (imgAspect > canvasAspect) {
        sHeight2 = img.naturalHeight;
        sWidth2 = sHeight2 * canvasAspect;
        sx2 = (img.naturalWidth - sWidth2) / 2;
        sy2 = 0;
      } else {
        sWidth2 = img.naturalWidth;
        sHeight2 = sWidth2 / canvasAspect;
        sx2 = 0;
        sy2 = (img.naturalHeight - sHeight2) / 2;
      }
      ctx.drawImage(img, sx2, sy2, sWidth2, sHeight2, 0, 0, width, height);
    } else {
      _drawGradientBg(ctx, width, height, _gradientCache, config);
    }
  } else {
    _drawGradientBg(ctx, width, height, _gradientCache, config);
  }

  // 2. Dark Overlay / Vignette
  const overlayOpacity = parseFloat(config.vignetteOpacity || 0.4);
  if (overlayOpacity > 0) {
    // Solid overlay
    ctx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity})`;
    ctx.fillRect(0, 0, width, height);

    // Vignette (radial gradient)
    const vKey = `vignette_${overlayOpacity}`;
    let vignette = _gradientCache[vKey];
    if (!vignette) {
      vignette = ctx.createRadialGradient(
        width / 2, height / 2, height * 0.2,
        width / 2, height / 2, height * 0.8
      );
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(1, `rgba(0, 0, 0, ${overlayOpacity * 1.5})`);
      _gradientCache[vKey] = vignette;
    }
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  // 3. Draw Watermark / Top Header (only if text is set)
  if (config.watermark) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '700 28px Outfit, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(config.watermark, width / 2, 100);
    ctx.restore();
  }

  // 4. Draw Quranic Arabic Text, Transliteration & Translation
  let textBlockBottom = height * 0.85;
  if (currentAyah) {
    ctx.save();
    
    // Text animation
    const textAnim = config.textAnim || 'none';
    if (textAnim !== 'none' && currentTime !== undefined) {
      const progress = Math.min(currentTime / 0.4, 1);
      if (textAnim === 'fade') {
        ctx.globalAlpha = progress;
      } else if (textAnim === 'slide-up') {
        ctx.globalAlpha = progress;
        ctx.translate(0, 30 * (1 - progress));
      } else if (textAnim === 'slide-down') {
        ctx.globalAlpha = progress;
        ctx.translate(0, -30 * (1 - progress));
      } else if (textAnim === 'zoom') {
        ctx.globalAlpha = progress;
        const s = 0.8 + 0.2 * progress;
        ctx.translate(width / 2, height / 2);
        ctx.scale(s, s);
        ctx.translate(-width / 2, -height / 2);
      }
    }

    // Setup shadow for text legibility
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;

    const arabicFontSize = parseInt(config.fontSize || 42);
    const translationFontSize = parseInt(config.translationFontSize || 26);
    const transliterationFontSize = Math.max(18, translationFontSize - 4);
    
    const textSpacing = 40;
    const paddingX = 80;
    const maxWidth = width - (paddingX * 2);

    // Calculate position based on X/Y percentages
    const centerX = ((config.textX ?? 50) / 100) * width;
    let centerY = ((config.textY ?? 50) / 100) * height;
    // Legacy textPosition fallback
    if (config.textY == null && config.textPosition === 'top') {
      centerY = height * 0.35;
    } else if (config.textY == null && config.textPosition === 'bottom') {
      centerY = height * 0.65;
    }

    // Measure heights first to center the block as a whole
    const arabicFontFamily = FONT_MAP[config.fontFamily] || "'Amiri', serif";
    const arabicFontStr = `700 ${arabicFontSize}px ${arabicFontFamily}`;
    const arabicKey = `${currentAyah.text}|${arabicFontStr}|${maxWidth}`;
    let arabicLayout = _wrapCache.get(arabicKey);
    if (!arabicLayout) {
      ctx.font = arabicFontStr;
      const aWords = currentAyah.text.split(' ');
      const aLines = [];
      let aLine = '';
      for (let i = 0; i < aWords.length; i++) {
        const testLine = aLine + aWords[i] + ' ';
        if (ctx.measureText(testLine).width > maxWidth && i > 0) {
          aLines.push(aLine.trim());
          aLine = aWords[i] + ' ';
        } else {
          aLine = testLine;
        }
      }
      aLines.push(aLine.trim());
      arabicLayout = { lines: aLines, height: aLines.length * (arabicFontSize * 1.5) };
      _cachedSet(_wrapCache, arabicKey, arabicLayout);
    }
    const arabicHeight = arabicLayout.height;

    // Measure Transliteration
    let transliterationHeight = 0;
    const transliterationFontStr = `400 ${transliterationFontSize}px 'Outfit', 'Inter', sans-serif`;
    const showTr = config.showTransliteration && currentAyah.transliteration;
    if (showTr) {
      const trKey = `${currentAyah.transliteration}|${transliterationFontStr}|${maxWidth}`;
      let trLayout = _wrapCache.get(trKey);
      if (!trLayout) {
        ctx.font = transliterationFontStr;
        const trWords = currentAyah.transliteration.split(' ');
        const trLines = [];
        let trLine = '';
        for (let i = 0; i < trWords.length; i++) {
          const testLine = trLine + trWords[i] + ' ';
          if (ctx.measureText(testLine).width > maxWidth && i > 0) {
            trLines.push(trLine.trim());
            trLine = trWords[i] + ' ';
          } else {
            trLine = testLine;
          }
        }
        trLines.push(trLine.trim());
        trLayout = { lines: trLines, height: trLines.length * (transliterationFontSize * 1.4) };
        _cachedSet(_wrapCache, trKey, trLayout);
      }
      transliterationHeight = trLayout.height;
    }

    // Measure Translation
    let englishHeight = 0;
    const translationFontStr = `400 ${translationFontSize}px Outfit, Inter, sans-serif`;
    if (config.showTranslation && currentAyah.translation) {
      const enKey = `${currentAyah.translation}|${translationFontStr}|${maxWidth}`;
      let enLayout = _wrapCache.get(enKey);
      if (!enLayout) {
        ctx.font = translationFontStr;
        const enWords = currentAyah.translation.split(' ');
        const enLines = [];
        let enLine = '';
        for (let i = 0; i < enWords.length; i++) {
          const testLine = enLine + enWords[i] + ' ';
          if (ctx.measureText(testLine).width > maxWidth && i > 0) {
            enLines.push(enLine.trim());
            enLine = enWords[i] + ' ';
          } else {
            enLine = testLine;
          }
        }
        enLines.push(enLine.trim());
        enLayout = { lines: enLines, height: enLines.length * (translationFontSize * 1.4) };
        _cachedSet(_wrapCache, enKey, enLayout);
      }
      englishHeight = enLayout.height;
    }

    // Measure Tafsir
    let tafsirHeight = 0;
    const tafsirFontSize = 18;
    if (config.showTafsir && currentAyah.tafsir) {
      ctx.font = `400 ${tafsirFontSize}px Outfit, Inter, sans-serif`;
      const tWords = currentAyah.tafsir.split(' ');
      const tLines = [];
      let tLine = '';
      for (let i = 0; i < tWords.length; i++) {
        const testLine = tLine + tWords[i] + ' ';
        if (ctx.measureText(testLine).width > maxWidth && i > 0) {
          tLines.push(tLine.trim());
          tLine = tWords[i] + ' ';
        } else {
          tLine = testLine;
        }
      }
      tLines.push(tLine.trim());
      tafsirHeight = tLines.length * (tafsirFontSize * 1.4);
    }

    const totalBlockHeight = arabicHeight
      + (showTr ? textSpacing + transliterationHeight : 0)
      + (config.showTranslation ? textSpacing + englishHeight : 0)
      + (config.showTafsir ? textSpacing + tafsirHeight : 0);
    const startY = centerY - (totalBlockHeight / 2);
    textBlockBottom = startY + totalBlockHeight;

    // Draw Arabic Text (word-by-word with highlight)
    ctx.font = `700 ${arabicFontSize}px ${arabicFontFamily}`;
    ctx.textAlign = 'right';
    const aWords = currentAyah.text.split(' ');
    const aWordLines = [];
    let curLine = [];
    let curLineWidth = 0;
    const spaceW = ctx.measureText(' ').width;
    for (let i = 0; i < aWords.length; i++) {
      const w = aWords[i];
      const ww = ctx.measureText(w).width + (curLine.length > 0 ? spaceW : 0);
      if (curLineWidth + ww > maxWidth && curLine.length > 0) {
        aWordLines.push(curLine);
        curLine = [{ word: w, idx: i }];
        curLineWidth = ctx.measureText(w).width;
      } else {
        curLine.push({ word: w, idx: i });
        curLineWidth += ww;
      }
    }
    if (curLine.length > 0) aWordLines.push(curLine);

    let currentY = startY + arabicFontSize;
    const lineHeight = arabicFontSize * 1.5;
    for (const line of aWordLines) {
      let totalWidth = 0;
      for (let j = 0; j < line.length; j++) {
        totalWidth += ctx.measureText(line[j].word).width;
        if (j < line.length - 1) totalWidth += spaceW;
      }
      let drawX = width / 2 + totalWidth / 2;
      for (const { word, idx } of line) {
        const ww = ctx.measureText(word).width;
        const isHighlighted = highlightedWords.includes(idx);
        const wordColors = config.wordCustomColors || {};
        const ayahWordColors = wordColors[ayahKey || ''] || {};
        const customColor = ayahWordColors[idx];
        ctx.fillStyle = customColor || (isHighlighted ? (config.highlightColor || '#fbbf24') : (config.arabicTextColor || '#ffffff'));
        ctx.fillText(word, drawX, currentY);
        positions.push({
          idx, word,
          x: drawX - ww,
          y: currentY - arabicFontSize * 1.5,
          width: ww + spaceW,
          height: arabicFontSize * 1.5,
        });
        drawX -= (ww + spaceW);
      }
      currentY += lineHeight;
    }
    const arabicTextHeight = aWordLines.length * lineHeight;
    if (ayahKey) _wordPositions[ayahKey] = positions;

    // Draw Transliteration
    if (showTr) {
      currentY += textSpacing;
      ctx.font = `400 italic ${transliterationFontSize}px 'Outfit', 'Inter', sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.textAlign = 'center';
      const trHeight = wrapText(
        ctx,
        currentAyah.transliteration,
        width / 2,
        currentY + transliterationFontSize,
        maxWidth,
        transliterationFontSize * 1.4
      );
      currentY += trHeight;
    }

    // Draw Translation
    if (config.showTranslation && currentAyah.translation) {
      currentY += textSpacing;
      ctx.font = `400 ${translationFontSize}px Outfit, Inter, sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.textAlign = 'center';
      wrapText(
        ctx,
        currentAyah.translation,
        width / 2,
        currentY + translationFontSize,
        maxWidth,
        translationFontSize * 1.4
      );
    }

    // Draw Tafsir
    if (config.showTafsir && currentAyah.tafsir) {
      currentY += textSpacing;
      ctx.font = `400 ${tafsirFontSize}px Outfit, Inter, sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.textAlign = 'center';
      wrapText(ctx, currentAyah.tafsir, width / 2, currentY + tafsirFontSize, maxWidth, tafsirFontSize * 1.4);
    }

    if (config.showTimer && currentTime !== undefined) {
      const t = config.timerDuration ? Math.max(0, config.timerDuration - currentTime) : currentTime;
      const mins = Math.floor(t / 60);
      const secs = Math.floor(t % 60);
      const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      const s = (config.timerSize || 100) / 100;
      const tc = config.timerColor || '#ffffff';
      const timerX = ((config.timerX ?? 50) / 100) * width;
      const timerY = ((config.timerY ?? 70) / 100) * height;
      const style = config.timerStyle || 'analog';
      const progress = config.timerDuration ? Math.min(1, Math.max(0, t / config.timerDuration)) : 1;

      ctx.save();
      ctx.translate(timerX, timerY);
      ctx.scale(s, s);
      ctx.translate(-timerX, -timerY);

      if (style === 'digital') {
        ctx.save();
        const dW = 110, dH = 44;
        const dX = timerX - dW / 2, dY = timerY + 2;
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = 'rgba(10,10,20,0.75)';
        ctx.beginPath();
        ctx.roundRect(dX, dY, dW, dH, 10);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.fillStyle = tc;
        ctx.shadowColor = tc + '66';
        ctx.font = '600 24px Courier New, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 8;
        ctx.fillText(timeStr, timerX, dY + dH / 2);
        ctx.restore();
      } else if (style === 'ring') {
        ctx.save();
        const r = 34;
        const cx = timerX, cy = timerY + r + 6;
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(cx, cy, r - 2, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        ctx.strokeStyle = tc;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = tc;
        ctx.font = '500 16px Outfit, Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(timeStr, cx, cy + 1);
        ctx.restore();
      } else if (style === 'flip') {
        ctx.save();
        const fW = 120, fH = 46;
        const fX = timerX - fW / 2, fY = timerY;
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = 'rgba(20,18,28,0.85)';
        ctx.beginPath();
        ctx.roundRect(fX, fY, fW, fH, 8);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(fX, fY, fW, fH, 8);
        ctx.stroke();
        const midY = fY + fH / 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(fX + 8, midY);
        ctx.lineTo(fX + fW - 8, midY);
        ctx.stroke();
        ctx.font = '600 22px Courier New, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.save();
        ctx.beginPath();
        ctx.rect(fX, fY, fW, fH / 2);
        ctx.clip();
        ctx.fillStyle = tc;
        ctx.fillText(timeStr, timerX, midY);
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.rect(fX, midY, fW, fH / 2);
        ctx.clip();
        ctx.fillStyle = tc + 'aa';
        ctx.fillText(timeStr, timerX, midY);
        ctx.restore();
        ctx.restore();
      } else if (style === 'pie') {
        ctx.save();
        const r = 34;
        const cx = timerX, cy = timerY + r + 6;
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = tc;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, r - 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();
        ctx.fillStyle = tc;
        ctx.font = '500 16px Outfit, Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(timeStr, cx, cy + 1);
        ctx.restore();
      } else if (style === 'bar') {
        ctx.save();
        const barW = 180, barH = 8;
        const barX = timerX - barW / 2, barY = timerY + 26;
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 4);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        if (progress > 0) {
          ctx.fillStyle = tc;
          ctx.beginPath();
          ctx.roundRect(barX, barY, Math.max(barH, barW * progress), barH, 4);
          ctx.fill();
        }
        ctx.fillStyle = tc;
        ctx.font = '500 17px Outfit, Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(timeStr, timerX, barY - 6);
        ctx.restore();
      } else if (style === 'nixie') {
        ctx.save();
        const nH = 44;
        const chars = timeStr.split('');
        const cW = 22, gap = 4;
        const totalW = chars.length * cW + (chars.length - 1) * gap;
        const startX = timerX - totalW / 2;
        const nY = timerY;
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 3;
        chars.forEach((ch, i) => {
          const cx = startX + i * (cW + gap);
          ctx.fillStyle = 'rgba(15,10,5,0.8)';
          ctx.beginPath();
          ctx.roundRect(cx, nY, cW, nH, ch === ':' ? 2 : 4);
          ctx.fill();
          ctx.fillStyle = tc;
          ctx.shadowColor = tc + '80';
          ctx.shadowBlur = ch === ':' ? 4 : 10;
          ctx.font = '600 22px Courier New, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(ch, cx + cW / 2, nY + nH / 2);
          ctx.shadowBlur = 0;
        });
        ctx.shadowColor = 'transparent';
        ctx.restore();
      } else if (style === 'slimline') {
        ctx.save();
        const lY = timerY;
        const maxLW = 200;
        const lX = timerX - maxLW / 2;
        ctx.fillStyle = tc + '80';
        ctx.font = '400 13px Outfit, Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(timeStr, timerX, lY - 10);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.roundRect(lX, lY, maxLW, 2, 1);
        ctx.fill();
        if (progress > 0) {
          ctx.fillStyle = tc;
          ctx.beginPath();
          ctx.roundRect(lX, lY, Math.max(2, maxLW * progress), 2, 1);
          ctx.fill();
        }
        ctx.restore();
      } else if (style === 'segmented') {
        ctx.save();
        const sH = 42;
        const chars = timeStr.split('');
        const sW = 20, sgGap = 3;
        const totalW = chars.length * sW + (chars.length - 1) * sgGap;
        const sX = timerX - totalW / 2;
        const sY = timerY;
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;
        chars.forEach((ch, i) => {
          const cx = sX + i * (sW + sgGap);
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.beginPath();
          ctx.roundRect(cx, sY, sW, sH, ch === ':' ? 2 : 3);
          ctx.fill();
          ctx.fillStyle = ch === ':' ? (tc + '99') : tc;
          ctx.shadowColor = tc + '40';
          ctx.shadowBlur = ch === ':' ? 2 : 6;
          ctx.font = '600 22px Courier New, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(ch, cx + sW / 2, sY + sH / 2 + 1);
          ctx.shadowBlur = 0;
        });
        ctx.shadowColor = 'transparent';
        ctx.restore();
      } else {
        ctx.save();
        const r = 32;
        const cx = timerX, cy = timerY + r + 6;
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * (r - 5), cy + Math.sin(a) * (r - 5), 1.2, 0, Math.PI * 2);
          ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)';
          ctx.fill();
        }
        const angle = progress * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * (r - 8), cy + Math.sin(angle) * (r - 8));
        ctx.strokeStyle = tc;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = tc;
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  // 5b. Draw Hijri Date
  if (config.showHijriDate) {
    const hijriDate = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    const ds = (config.hijriDateSize || 100) / 100;
    const hx = ((config.hijriDateX ?? 50) / 100) * width;
    const hy = ((config.hijriDateY ?? 92) / 100) * height;
    const hc = config.hijriDateColor || '#ffffff';
    const hf = config.hijriDateFont || 'Inter';
    ctx.save();
    ctx.font = `400 ${Math.round(13 * ds)}px ${hf}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = hc;
    ctx.fillText(hijriDate, hx, hy);
    ctx.restore();
  }

  // Icon symbols mapping
  const iconChars = {
    heart: '\u2665',
    heartFilled: '\u2764',
    star: '\u2605',
    starOutline: '\u2606',
    thumbsUp: '\uD83D\uDC4D',
    fire: '\uD83D\uDD25',
    plus: '\u271A',
    bell: '\uD83D\uDD14',
    play: '\u25B6'
  };

  // Draw icon with text at configurable position
  function drawIconWithText(cfg, icon, text, x, y, scale, textPos, textSize = 11, color = '#ffffff', effect = 'none', effectColor = '#60a5fa', textEffect = 'none', currentTime = 0) {
    const iconChar = iconChars[icon] || '\u2665';
    const iconSize = Math.round(28 * scale);
    let displayText = text;
    if (textEffect === 'typing' && text) {
      const charsPerSec = 10;
      const charsToShow = Math.min(text.length, Math.floor(Math.max(0, currentTime) * charsPerSec));
      displayText = text.slice(0, charsToShow);
    }
    const ts = Math.round(textSize * scale);
    const gap = Math.round(8 * scale);
    const textProgress = Math.min(1, Math.max(0, currentTime * 2)); // 0.5s duration

    const applyEffect = (str, sx, sy) => {
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.save();
      // Text animation transform
      if (textEffect === 'fade') {
        ctx.globalAlpha = textProgress;
      } else if (textEffect === 'slide-up') {
        ctx.translate(0, (1 - textProgress) * 30);
      } else if (textEffect === 'slide-down') {
        ctx.translate(0, -(1 - textProgress) * 30);
      } else if (textEffect === 'zoom') {
        const s = 0.3 + 0.7 * textProgress;
        ctx.translate(sx, sy);
        ctx.scale(s, s);
        ctx.translate(-sx, -sy);
      }
      if (effect === 'glow') {
        ctx.shadowColor = effectColor;
        ctx.shadowBlur = 20;
      } else if (effect === 'stroke' || effect === 'neon') {
        ctx.lineWidth = 3;
        ctx.strokeStyle = effectColor;
        ctx.shadowColor = effect === 'neon' ? effectColor : 'transparent';
        ctx.shadowBlur = effect === 'neon' ? 15 : 0;
        if (typeof ctx.strokeText === 'function') ctx.strokeText(str, sx, sy);
        ctx.lineWidth = 1;
      }
      ctx.fillStyle = color;
      ctx.shadowColor = effect === 'glow' || effect === 'neon' ? effectColor : 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = effect === 'glow' ? 20 : effect === 'neon' ? 15 : 6;
      ctx.shadowOffsetY = effect === 'none' ? 2 : 0;
      ctx.fillText(str, sx, sy);
      ctx.restore();
    };

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (!text || textPos === 'none' || (textEffect === 'typing' && !displayText) || ((textEffect === 'fade' || textEffect === 'slide-up' || textEffect === 'slide-down' || textEffect === 'zoom') && textProgress <= 0)) {
      ctx.font = `700 ${iconSize}px Outfit, Inter, sans-serif`;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = effect === 'none' ? 2 : 0;
      if (effect === 'glow') {
        ctx.shadowColor = effectColor;
        ctx.shadowBlur = 20;
        ctx.fillStyle = color;
        ctx.fillText(iconChar, x, y);
      } else if (effect === 'stroke' || effect === 'neon') {
        ctx.lineWidth = 3;
        ctx.strokeStyle = effectColor;
        ctx.shadowColor = effect === 'neon' ? effectColor : 'transparent';
        ctx.shadowBlur = effect === 'neon' ? 15 : 0;
        ctx.strokeText(iconChar, x, y);
        ctx.fillStyle = color;
        ctx.fillText(iconChar, x, y);
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = color;
        ctx.fillText(iconChar, x, y);
      }
    } else {
      ctx.font = `400 ${ts}px Outfit, Inter, sans-serif`;
      const textW = ctx.measureText(displayText).width;
      const halfTotal = (iconSize + gap + textW) / 2;

      if (textPos === 'right') {
        ctx.font = `700 ${iconSize}px Outfit, Inter, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const startX = x - halfTotal;
        applyEffect(iconChar, startX, y);
        ctx.font = `400 ${ts}px Outfit, Inter, sans-serif`;
        applyEffect(displayText, startX + iconSize + gap, y);
      } else if (textPos === 'left') {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const startX = x - halfTotal;
        ctx.font = `400 ${ts}px Outfit, Inter, sans-serif`;
        applyEffect(displayText, startX, y);
        ctx.font = `700 ${iconSize}px Outfit, Inter, sans-serif`;
        applyEffect(iconChar, startX + textW + gap, y);
      } else if (textPos === 'top') {
        ctx.textAlign = 'center';
        ctx.font = `400 ${ts}px Outfit, Inter, sans-serif`;
        ctx.textBaseline = 'bottom';
        applyEffect(displayText, x, y - gap);
        ctx.font = `700 ${iconSize}px Outfit, Inter, sans-serif`;
        ctx.textBaseline = 'top';
        applyEffect(iconChar, x, y);
      } else { // bottom (default)
        ctx.font = `700 ${iconSize}px Outfit, Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        applyEffect(iconChar, x, y - gap);
        ctx.font = `400 ${ts}px Outfit, Inter, sans-serif`;
        ctx.textBaseline = 'top';
        applyEffect(displayText, x, y);
      }
    }
    ctx.restore();
  }

  const likeScale = (config.likeBtnSize ?? 100) / 100;
  const likeX = ((config.likeBtnX ?? 95) / 100) * width;
  const likeY = ((config.likeBtnY ?? 50) / 100) * height;
  if (config.showLikeBtn) {
    drawIconWithText(config, config.likeIcon || 'heart', config.likeText || '', likeX, likeY, likeScale, config.likeTextPos || 'bottom', config.likeTextSize || 11, config.likeColor || '#ffffff', config.likeEffect || 'none', config.likeEffectColor || '#60a5fa', config.likeTextEffect || 'none', currentTime);
  }
  if (config.showFollowBtn && (config.followIcon || config.followText)) {
    const followScale = (config.followBtnSize ?? 100) / 100;
    const followX = ((config.followBtnX ?? 95) / 100) * width;
    const followY = ((config.followBtnY ?? 58) / 100) * height;
    drawIconWithText(config, config.followIcon || 'plus', config.followText || '', followX, followY, followScale, config.followTextPos || 'bottom', config.followTextSize || 11, config.followColor || '#ffffff', config.followEffect || 'none', config.followEffectColor || '#60a5fa', config.followTextEffect || 'none', currentTime);
  }

  // 6. Draw Audio Visualizer at the Bottom
  if (config.visualizerStyle !== 'none' && isPlaying) {
    ctx.save();

    const visColor = config.visualizerColor || '#3b82f6';
    ctx.strokeStyle = visColor;
    ctx.fillStyle = visColor;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    const visY = height - 200; // Place visualizer near bottom

    // Try real analyser data first; fall back to simulated if all zeros
    let dataArray = null;
    let hasRealData = false;

    if (audioAnalyser) {
      const bufferLength = audioAnalyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
      audioAnalyser.getByteFrequencyData(dataArray);
      // Check if we got real data (at least one non-zero value)
      hasRealData = dataArray.some(v => v > 0);
    }

    if (config.visualizerStyle === 'waves') {
      ctx.beginPath();
      const totalPoints = 128;
      const sliceWidth = width / totalPoints;
      let x = 0;

      for (let i = 0; i < totalPoints; i++) {
        let v;
        if (hasRealData) {
          v = dataArray[i] / 128.0;
        } else {
          // Simulated wave based on currentTime
          const t = (currentTime || 0);
          v = 1 + Math.sin(t * 3.5 + i * 0.15) * 0.4
                + Math.sin(t * 5.2 + i * 0.08) * 0.25
                + Math.sin(t * 1.8 + i * 0.22) * 0.15;
        }
        const y = visY + (v - 1) * 90;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(width, visY);
      ctx.stroke();
    } else if (config.visualizerStyle === 'bars') {
      const barWidth = 12;
      const barGap = 6;
      const totalBars = Math.floor(width / (barWidth + barGap));

      ctx.shadowColor = visColor;
      ctx.shadowBlur = 8;

      for (let i = 0; i < totalBars; i++) {
        let value;
        if (hasRealData) {
          const startBin = 2;
          const binIndex = startBin + Math.floor((i / totalBars) * (dataArray.length * 0.4));
          value = dataArray[binIndex] || 0;
        } else {
          // Simulated bar heights using multiple overlapping sine waves
          const t = (currentTime || 0);
          value = Math.abs(
            Math.sin(t * 2.8 + i * 0.3) * 120
            + Math.sin(t * 4.1 + i * 0.15) * 80
            + Math.sin(t * 6.5 + i * 0.45) * 55
          );
          value = Math.min(255, value);
        }

        const barHeight = (value / 255.0) * 160;
        const x = i * (barWidth + barGap) + barGap / 2;

        // Draw double-sided bars extending up and down
        ctx.fillRect(x, visY - barHeight / 2, barWidth, barHeight);
      }
    } else if (config.visualizerStyle === 'ring') {
      const cx = width / 2;
      const cy = height * 0.28;
      const baseRadius = Math.min(width, height) * 0.12;
      const bands = 36;
      for (let i = 0; i < bands; i++) {
        let value;
        if (hasRealData) {
          const binIndex = Math.floor((i / bands) * dataArray.length * 0.5);
          value = dataArray[binIndex] || 0;
        } else {
          const t = (currentTime || 0);
          value = Math.abs(Math.sin(t * 3 + i * 0.2) * 120 + Math.sin(t * 5 + i * 0.1) * 80);
          value = Math.min(255, value);
        }
        const angle = (i / bands) * Math.PI * 2 - Math.PI / 2;
        const r = baseRadius + (value / 255) * 50;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        const px = cx + Math.cos(angle) * baseRadius;
        const py = cy + Math.sin(angle) * baseRadius;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.strokeStyle = visColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // 7. Visual Effects Overlay
  _drawVisualEffect(ctx, width, height, config.visualEffect, currentTime);
}

function _drawIntro(ctx, width, height, intro, currentTime) {
  // 1. Draw background
  const bgType = intro.bgType || 'gradient';
  if (bgType === 'image' && intro.bgImage) {
    if (!_bgImageCache || _bgImageCache.url !== intro.bgImage) {
      _bgImageCache = { url: intro.bgImage, img: new Image() };
      _bgImageCache.img.src = intro.bgImage;
    }
    const img = _bgImageCache.img;
    if (img.complete && img.naturalWidth > 0) {
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const canvasAspect = width / height;
      let sx, sy, sWidth, sHeight;
      if (imgAspect > canvasAspect) {
        sHeight = img.naturalHeight;
        sWidth = sHeight * canvasAspect;
        sx = (img.naturalWidth - sWidth) / 2;
        sy = 0;
      } else {
        sWidth = img.naturalWidth;
        sHeight = sWidth / canvasAspect;
        sx = 0;
        sy = (img.naturalHeight - sHeight) / 2;
      }
      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);
    } else {
      fallbackGradient(ctx, width, height, intro);
    }
  } else if (bgType === 'color') {
    ctx.fillStyle = intro.bgColor1 || '#0a1628';
    ctx.fillRect(0, 0, width, height);
  } else {
    fallbackGradient(ctx, width, height, intro);
  }

  // 2. Vignette
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 0, width, height);

  // 3. Main title (no typing, just fade in)
  ctx.save();
  const dur = intro.duration || 4;
  const rawText = intro.text || '';
  const subtext = intro.subtext || '';

  if (rawText) {
    const textSize = parseInt(intro.fontSize || 52);
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = intro.textColor || '#ffffff';
    const titleFamily = FONT_MAP[intro.fontFamily] || "'Amiri', serif";
    ctx.font = `700 ${textSize}px ${titleFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textFadeIn = Math.min(currentTime / (dur * 0.25), 1);
    ctx.globalAlpha = textFadeIn;
    ctx.fillText(rawText, width / 2, height * 0.48);
  }

  // 5. Subtitle
  if (subtext) {
    const subSize = parseInt(intro.subFontSize || 30);
    const subFamily = FONT_MAP[intro.subFontFamily] || FONT_MAP[intro.fontFamily] || "'Amiri', serif";
    const subColor = intro.subTextColor || '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = subColor;
    ctx.globalAlpha = 0.8;
    ctx.font = `400 ${subSize}px ${subFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const subDelay = dur * 0.45;
    const subAppear = Math.max(0, Math.min((currentTime - subDelay) / (dur * 0.25), 1));
    ctx.globalAlpha = subAppear * 0.85;
    ctx.fillText(subtext, width / 2, height * 0.56);
  }

  ctx.restore();
}

function _drawPlayerDesign(ctx, width, height, config, currentTime, isPlaying, audioAnalyser, currentAyah) {
  const t = currentTime || 0;
  const duration = config.duration || 30;

  const c = {
    bg: '#f5f3ed',
    bgCard: '#ffffff',
    textPrimary: '#1a1a1a',
    textSecondary: '#555555',
    textMuted: '#999999',
    accent: '#000000',
    line: 'rgba(0,0,0,0.06)',
    lineMed: 'rgba(0,0,0,0.12)',
    surface: 'rgba(0,0,0,0.02)',
    shadow: 'rgba(0,0,0,0.06)',
    shadowStrong: 'rgba(0,0,0,0.12)',
  };

  // --- BACKGROUND ---
  const bgSrc = config.playerBgImage;
  if (bgSrc) {
    if (_playerBgCache && _playerBgCache.url === bgSrc && _playerBgCache.img.complete && _playerBgCache.img.naturalWidth > 0) {
      ctx.drawImage(_playerBgCache.img, 0, 0, width, height);
    } else if (!_playerBgCache || _playerBgCache.url !== bgSrc) {
      _playerBgCache = { url: bgSrc, img: new Image() };
      _playerBgCache.img.src = bgSrc;
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, width, height);
  }

  const margin = width * 0.04;

  // --- DECORATIVE GEOMETRIC BACKGROUND PATTERN ---
  ctx.save();
  const patternSize = Math.min(width, height) * 0.12;
  ctx.strokeStyle = 'rgba(0,0,0,0.03)';
  ctx.lineWidth = 0.5;
  for (let row = -1; row < Math.ceil(height / patternSize) + 1; row++) {
    for (let col = -1; col < Math.ceil(width / patternSize) + 1; col++) {
      const px = col * patternSize + (row % 2) * patternSize * 0.5;
      const py = row * patternSize * 0.86;
      ctx.beginPath();
      ctx.moveTo(px + patternSize * 0.5, py);
      ctx.lineTo(px + patternSize, py + patternSize * 0.33);
      ctx.lineTo(px + patternSize * 0.5, py + patternSize * 0.66);
      ctx.lineTo(px, py + patternSize * 0.33);
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();

  // --- LARGE GEOMETRIC FRAME with double border ---
  const m2 = margin;
  ctx.save();
  ctx.strokeStyle = c.line;
  ctx.lineWidth = 1;
  ctx.strokeRect(m2, m2, width - m2 * 2, height - m2 * 2);

  ctx.strokeStyle = 'rgba(0,0,0,0.03)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(m2 + 8, m2 + 8, width - m2 * 2 - 16, height - m2 * 2 - 16);
  ctx.restore();

  // --- CORNER ORNAMENTS (geometric diamond accents) ---
  const ornamentSize = 32;
  const corners = [
    [margin - 4, margin - 4],
    [width - margin + 4, margin - 4],
    [margin - 4, height - margin + 4],
    [width - margin + 4, height - margin + 4],
  ];
  ctx.save();
  ctx.fillStyle = c.accent;
  corners.forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.moveTo(cx - ornamentSize * 0.3, cy);
    ctx.lineTo(cx, cy - ornamentSize * 0.3);
    ctx.lineTo(cx + ornamentSize * 0.3, cy);
    ctx.lineTo(cx, cy + ornamentSize * 0.3);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();

  // --- TOP BAND with surah number prominence ---
  const surahNum = config.surahNumber || 1;
  ctx.save();
  ctx.fillStyle = c.accent;
  ctx.globalAlpha = 0.04;
  ctx.fillRect(margin + 20, margin + 20, width - margin * 2 - 40, 2);
  ctx.globalAlpha = 1;

  // Large surah number on the left
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = c.accent;
  ctx.globalAlpha = 0.06;
  ctx.font = `800 ${Math.min(width, height) * 0.1}px Outfit, Inter, sans-serif`;
  ctx.fillText(`#${surahNum}`, margin + 20, margin + 20);
  ctx.globalAlpha = 1;

  // Decorative line from number
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(margin + 20, margin + 42 + Math.min(width, height) * 0.1);
  ctx.lineTo(margin + 80, margin + 42 + Math.min(width, height) * 0.1);
  ctx.stroke();

  // Small label above
  ctx.fillStyle = c.textMuted;
  ctx.font = `400 ${Math.min(width * 0.012, 12)}px Outfit, Inter, sans-serif`;
  ctx.fillText('SŪRAH', margin + 20, margin + 20 + Math.min(width, height) * 0.1 + 6);
  ctx.restore();

  // --- ARTWORK (larger, centered vertically in upper half) ---
  const artR = Math.min(width, height) * 0.17;
  const artCX = width / 2;
  const artCY = height * 0.28;

  // Artwork shadow
  ctx.save();
  ctx.shadowColor = c.shadowStrong;
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 10;
  ctx.beginPath();
  ctx.arc(artCX, artCY, artR + 3, 0, Math.PI * 2);
  ctx.fillStyle = c.bgCard;
  ctx.fill();
  ctx.restore();

  // Artwork circle
  ctx.save();
  ctx.translate(artCX, artCY);
  ctx.beginPath();
  ctx.arc(0, 0, artR, 0, Math.PI * 2);
  ctx.clip();

  const artSrc = config.playerArtwork;
  if (artSrc) {
    if (!_bgImageCache || _bgImageCache.url !== artSrc) {
      _bgImageCache = { url: artSrc, img: new Image() };
      _bgImageCache.img.src = artSrc;
    }
    const img = _bgImageCache.img;
    if (img.complete && img.naturalWidth > 0) {
      const scale = Math.min((artR * 2) / img.naturalWidth, (artR * 2) / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, -dw / 2, -dh / 2, dw, dh);
    } else {
      _drawMonogram(ctx, artR);
    }
  } else {
    _drawMonogram(ctx, artR);
  }
  ctx.restore();

  // Decorative rings around artwork
  ctx.save();
  ctx.translate(artCX, artCY);
  // Outer thin ring
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.arc(0, 0, artR + 6, 0, Math.PI * 2);
  ctx.stroke();
  // Inner ring
  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, artR + 2, 0, Math.PI * 2);
  ctx.stroke();
  // Tiny dot ornaments at cardinal points
  ctx.fillStyle = c.accent;
  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const dx = Math.cos(angle) * (artR + 14);
    const dy = Math.sin(angle) * (artR + 14);
    ctx.beginPath();
    ctx.arc(dx, dy, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  function _drawMonogram(ctx, r) {
    ctx.fillStyle = '#ece8de';
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1a1a1a';
    ctx.font = `300 ${r * 1.1}px Outfit, Inter, sans-serif`;
    ctx.fillText('Q', 0, 2);
  }

  // --- SURAH INFO PANEL (below artwork, centered) ---
  const infoY = artCY + artR + 28;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Arabic name
  if (config.surahNameAr) {
    ctx.fillStyle = c.textPrimary;
    ctx.font = `600 ${Math.min(width * 0.03, 34)}px 'Amiri', serif`;
    ctx.fillText(config.surahNameAr, width / 2, infoY);
  }

  let infoY2 = infoY + (config.surahNameAr ? Math.min(width * 0.038, 40) : 0);

  // English name
  ctx.fillStyle = c.accent;
  ctx.font = `800 ${Math.min(width * 0.032, 38)}px Outfit, Inter, sans-serif`;
  ctx.fillText(config.surahName || 'Surah', width / 2, infoY2);
  infoY2 += Math.min(width * 0.04, 44);

  // Revelation type + Ayahs + Number
  const revType = config.revelationType || 'Meccan';
  const ayahCount = config.numberOfAyahs || 0;
  const metaText = `${revType} · ${ayahCount} verses · № ${surahNum}`;
  ctx.fillStyle = c.textMuted;
  ctx.font = `400 ${Math.min(width * 0.016, 16)}px Outfit, Inter, sans-serif`;
  ctx.fillText(metaText, width / 2, infoY2);
  infoY2 += Math.min(width * 0.028, 30);

  // Decorative divider
  ctx.strokeStyle = c.lineMed;
  ctx.lineWidth = 1;
  const divW = Math.min(width * 0.12, 60);
  ctx.beginPath();
  ctx.moveTo(width / 2 - divW, infoY2);
  ctx.lineTo(width / 2 + divW, infoY2);
  ctx.stroke();

  // Ayah range
  if (config.ayahRange) {
    infoY2 += 14;
    ctx.fillStyle = c.textSecondary;
    ctx.font = `400 ${Math.min(width * 0.014, 14)}px Outfit, Inter, sans-serif`;
    ctx.fillText(config.ayahRange, width / 2, infoY2);
  }
  ctx.restore();

  // --- LYRICS AREA (below surah info) ---
  const showLyrics = config.showPlayerLyrics !== false && currentAyah;
  if (showLyrics && currentAyah) {
    const ayahText = currentAyah.text || '';
    const ayahTrans = currentAyah.translation || '';
    const lyrW = width * 0.72;
    const lyrX = (width - lyrW) / 2;
    const ayahFs = Math.min(width * 0.03, 36);
    const transFs = Math.min(width * 0.018, 20);

    ctx.save();
    ctx.font = `700 ${ayahFs}px 'Amiri', serif`;
    const aW = ctx.measureText(ayahText).width;
    const aLines = Math.max(1, Math.ceil(aW / (lyrW - 40)));
    const aH = aLines * ayahFs * 1.4;
    ctx.font = `400 ${transFs}px Outfit, Inter, sans-serif`;
    const tW = ctx.measureText(ayahTrans).width;
    const tLines = ayahTrans ? Math.max(1, Math.ceil(tW / (lyrW - 40))) : 0;
    const tH = tLines * transFs * 1.4;
    ctx.restore();

    const totalH = aH + (tLines > 0 ? 10 + tH : 0);
    const lyrY = height * 0.65 - totalH / 2;
    const lyrMaxH = height * 0.12;

    ctx.save();
    ctx.shadowColor = c.shadow;
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = c.bgCard;
    ctx.beginPath();
    ctx.roundRect(lyrX, lyrY, lyrW, Math.min(totalH + 24, lyrMaxH), 10);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.04;
    ctx.fillRect(lyrX, lyrY, Math.min(totalH + 24, lyrMaxH), 2);
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = c.textPrimary;
    ctx.font = `700 ${ayahFs}px 'Amiri', serif`;
    _drawWrappedText(ctx, ayahText, width / 2, lyrY + 12, lyrW - 44, ayahFs * 1.4, 'center');

    if (ayahTrans) {
      ctx.fillStyle = c.textSecondary;
      ctx.font = `400 ${transFs}px Outfit, Inter, sans-serif`;
      _drawWrappedText(ctx, ayahTrans, width / 2, lyrY + 12 + aH + 8, lyrW - 44, transFs * 1.4, 'center');
    }
    ctx.restore();
  }

  // --- WAVEFORM (positioned based on lyrics presence) ---
  const waveTop = showLyrics && currentAyah ? height * 0.80 : height * 0.78;
  const waveH = height * 0.035;
  const waveW = width * 0.65;
  const waveX = (width - waveW) / 2 + width * 0.04;
  const barCount = 48;
  const barGap = 2;
  const barW = (waveW - barGap * (barCount - 1)) / barCount;

  let dataArray = null;
  if (audioAnalyser) {
    const bufferLength = audioAnalyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    audioAnalyser.getByteFrequencyData(dataArray);
  }

  ctx.save();
  for (let i = 0; i < barCount; i++) {
    let value;
    if (dataArray) {
      const binIdx = Math.floor((i / barCount) * dataArray.length * 0.4);
      value = dataArray[binIdx] || 0;
    } else {
      value = Math.abs(Math.sin(t * 2.8 + i * 0.22) * 110 + Math.sin(t * 3.6 + i * 0.14) * 60 + Math.sin(t * 5.2 + i * 0.3) * 30);
      value = Math.min(255, Math.max(8, value));
    }
    const barH = (value / 255) * waveH * 0.8;
    const bx = waveX + i * (barW + barGap);
    const by = waveTop + (waveH - barH) / 2;
    const alpha = 0.08 + (value / 255) * 0.55;
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.roundRect(bx, by, barW, barH, [barW / 2, barW / 2, barW / 2, barW / 2]);
    ctx.fill();
  }
  ctx.restore();

  // --- PROGRESS BAR ---
  const progY = height * 0.87;
  const progH = 2;
  const progW = width * 0.55;
  const progX = (width - progW) / 2 + width * 0.04;
  const progress = duration > 0 ? Math.min(t / duration, 1) : 0;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.beginPath();
  ctx.roundRect(progX, progY, progW, progH, 1);
  ctx.fill();

  const fillW = progress * progW;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.roundRect(progX, progY, fillW, progH, 1);
  ctx.fill();

  if (fillW > 0) {
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(progX + fillW, progY + progH / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // --- TIME ---
  ctx.save();
  const timeFs = Math.min(width * 0.013, 12);
  ctx.font = `500 ${timeFs}px Outfit, Inter, sans-serif`;
  ctx.fillStyle = c.textMuted;
  const fmtTime = (s) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };
  ctx.textAlign = 'left';
  ctx.fillText(fmtTime(t), progX, progY + progH + 9);
  ctx.textAlign = 'right';
  ctx.fillText(fmtTime(duration), progX + progW, progY + progH + 9);
  ctx.restore();

  // --- BOTTOM ROW: branding + decorative elements ---
  const botY = height - margin - 16;
  ctx.save();

  // Left decorative line
  ctx.strokeStyle = 'rgba(0,0,0,0.04)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(margin + 20, botY);
  ctx.lineTo(width * 0.3, botY);
  ctx.stroke();

  // Right decorative line
  ctx.beginPath();
  ctx.moveTo(width * 0.7, botY);
  ctx.lineTo(width - margin - 20, botY);
  ctx.stroke();

  // Center dot
  ctx.fillStyle = c.accent;
  ctx.globalAlpha = 0.1;
  ctx.beginPath();
  ctx.arc(width / 2, botY, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Branding
  ctx.fillStyle = c.textMuted;
  ctx.font = `300 ${Math.min(width * 0.011, 10)}px Outfit, Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('QuranReel', width / 2, botY + 8);
  ctx.restore();
}

function _drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, align) {
  if (!text) return;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'top';
  const words = text.split(' ');
  let line = '';
  let ly = y;
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, ly);
      line = word + ' ';
      ly += lineHeight;
    } else {
      line = test;
    }
  }
  if (line.trim()) ctx.fillText(line.trim(), x, ly);
}

function fallbackGradient(ctx, width, height, intro) {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, intro.bgColor1 || '#0a1628');
  g.addColorStop(0.5, intro.bgColor2 || '#1a2a4a');
  g.addColorStop(1, intro.bgColor1 || '#0a1628');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}
