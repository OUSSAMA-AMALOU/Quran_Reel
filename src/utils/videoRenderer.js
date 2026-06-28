/**
 * Helper to wrap and draw text on canvas with centering and shadows
 */
let _filterCanvas = null;
const _wrapCache = new Map();
const _gradientCache = {};
let _bgImageCache = null; // { url: string, img: HTMLImageElement }

function _drawGradientBg(ctx, width, height, cache, config) {
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
    _wrapCache.set(key, cached);
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
export function drawFrame({
  ctx,
  canvas,
  videoElement,
  audioAnalyser,
  currentAyah,
  config,
  isPlaying,
  currentTime
}) {
  const width = canvas.width; // 1080
  const height = canvas.height; // 1920

  // 1. Draw Background

  // Uploaded custom video takes priority
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
    // Uploaded image background (object-fit: cover) — cached to avoid blink
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
      // Fallback to gradient if image not loaded
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

  // 5. Draw Quranic Arabic Text, Transliteration & Translation
  if (currentAyah) {
    ctx.save();
    
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

    // Calculate Y Position based on setting
    let centerY = height / 2;
    if (config.textPosition === 'top') {
      centerY = height * 0.35;
    } else if (config.textPosition === 'bottom') {
      centerY = height * 0.65;
    }

    // Measure heights first to center the block as a whole
    const arabicFontFamily = {
      amiri: "'Amiri', serif",
      scheherazade: '"Scheherazade New", serif',
      'noto-naskh': '"Noto Naskh Arabic", serif',
      lateef: "'Lateef', serif",
      'reem-kufi': '"Reem Kufi", sans-serif',
      cairo: "'Cairo', sans-serif",
      tajawal: "'Tajawal', sans-serif",
      markazi: '"Markazi Text", serif',
      'el-messiri': '"El Messiri", sans-serif',
      lemonada: "'Lemonada', display",
      changa: "'Changa', sans-serif",
      harmattan: "'Harmattan', sans-serif",
      katibeh: "'Katibeh', display",
      mada: "'Mada', sans-serif",
      mirza: "'Mirza', serif",
      rakkas: "'Rakkas', display",
      almarai: "'Almarai', sans-serif",
      'aref-ruqaa': '"Aref Ruqaa", serif',
      'ibm-plex-sans-arabic': '"IBM Plex Sans Arabic", sans-serif',
      jomhuria: "'Jomhuria', display",
      kufam: "'Kufam', sans-serif",
      lalezar: "'Lalezar', display",
      'noto-kufi-arabic': '"Noto Kufi Arabic", sans-serif',
      'noto-sans-arabic': '"Noto Sans Arabic", sans-serif',
      qahiri: "'Qahiri', sans-serif",
      ruwudu: "'Ruwudu', serif",
      'reem-kufi-fun': '"Reem Kufi Fun", sans-serif',
      'reem-kufi-ink': '"Reem Kufi Ink", sans-serif',
      'cairo-play': '"Cairo Play", sans-serif',
      'amiri-quran': '"Amiri Quran", serif',
      bidaya: "'Bidaya', display",
      thabit: "'Thabit', monospace",
      'traditional-arabic': '"Traditional Arabic", serif',
      'arabic-typesetting': '"Arabic Typesetting", serif',
      'sakkal-majalla': '"Sakkal Majalla", serif',
      'simplified-arabic': '"Simplified Arabic", sans-serif',
      'diwani-letter': '"Diwani Letter", cursive',
      andalus: "'Andalus', serif",
      tahoma: "'Tahoma', sans-serif",
      arial: "'Arial', sans-serif",
      'times-new-roman': '"Times New Roman", serif',
      'courier-new': '"Courier New", monospace',
      'uthmanic-hafs': '"Uthmanic Hafs", serif',
      'decotype-naskh': '"DecoType Naskh", serif',
      'decotype-thuluth': '"DecoType Thuluth", serif',
      'decotype-kufi': '"DecoType Kufi", serif',
      'kacst-book': "'KacstBook', sans-serif",
      'kacst-letter': "'KacstLetter', sans-serif",
      'hacen-sudan': '"Hacen Sudan", sans-serif',
      'hacen-tunisia': '"Hacen Tunisia", sans-serif',
    }[config.fontFamily] || "'Amiri', serif";
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
      _wrapCache.set(arabicKey, arabicLayout);
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
        _wrapCache.set(trKey, trLayout);
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
        _wrapCache.set(enKey, enLayout);
      }
      englishHeight = enLayout.height;
    }

    const totalBlockHeight = arabicHeight
      + (showTr ? textSpacing + transliterationHeight : 0)
      + (config.showTranslation ? textSpacing + englishHeight : 0);
    const startY = centerY - (totalBlockHeight / 2);

    // Draw Arabic Text
    ctx.font = `700 ${arabicFontSize}px ${arabicFontFamily}`;
    ctx.fillStyle = '#ffffff';
    let currentY = startY + arabicFontSize;
    const arabicTextHeight = wrapText(
      ctx,
      currentAyah.text,
      width / 2,
      currentY,
      maxWidth,
      arabicFontSize * 1.5
    );

    currentY += arabicTextHeight;

    // Draw Transliteration
    if (showTr) {
      currentY += textSpacing;
      ctx.font = `400 italic ${transliterationFontSize}px 'Outfit', 'Inter', sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
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
      wrapText(
        ctx,
        currentAyah.translation,
        width / 2,
        currentY + translationFontSize,
        maxWidth,
        translationFontSize * 1.4
      );
    }

    ctx.restore();
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
    }

    ctx.restore();
  }

  // 7. Apply Color Effect (CSS filter)
  const effect = config.colorEffect || 'none';
  if (effect !== 'none') {
    const effectDef = {
      warm: 'saturate(1.1) sepia(0.2) brightness(1.05)',
      cool: 'saturate(0.9) hue-rotate(10deg) brightness(1.05)',
      vintage: 'sepia(0.5) saturate(0.7) contrast(0.85) brightness(1.1)',
      noir: 'grayscale(1) contrast(1.3) brightness(0.9)',
      golden: 'sepia(0.3) saturate(1.3) hue-rotate(-5deg) brightness(1.1)',
      ocean: 'saturate(1.2) hue-rotate(180deg) brightness(0.95) contrast(1.1)',
      forest: 'saturate(1.3) sepia(0.2) hue-rotate(60deg) brightness(0.9)',
      sunset: 'sepia(0.4) saturate(1.4) hue-rotate(-15deg) brightness(1.05)',
      moody: 'grayscale(0.3) saturate(0.6) brightness(0.8) contrast(1.2)',
      fade: 'saturate(0.5) contrast(0.8) brightness(1.15) opacity(0.9)',
      cinematic: 'contrast(1.15) saturate(0.85) brightness(0.9) sepia(0.15)',
      grayscale: 'grayscale(1) brightness(1.05)',
      sepia: 'sepia(0.8) saturate(0.9) brightness(1.05)',
      vibrant: 'saturate(1.8) contrast(1.15) brightness(1.05)',
      soft: 'brightness(1.1) contrast(0.85) saturate(0.8) blur(0.3px)',
      dramatic: 'contrast(1.5) brightness(0.75) saturate(0.7)',
      retro: 'sepia(0.6) saturate(0.6) contrast(0.9) hue-rotate(-20deg)',
      coolblue: 'saturate(1.1) hue-rotate(200deg) brightness(1.05) contrast(0.9)',
      warmglow: 'sepia(0.2) saturate(1.2) hue-rotate(-10deg) brightness(1.1)',
    };
    const filter = effectDef[effect];
    if (filter) {
      const w = canvas.width, h = canvas.height;
      if (!_filterCanvas || _filterCanvas.width !== w || _filterCanvas.height !== h) {
        _filterCanvas = document.createElement('canvas');
        _filterCanvas.width = w;
        _filterCanvas.height = h;
      }
      const fc = _filterCanvas.getContext('2d');
      fc.clearRect(0, 0, w, h);
      fc.drawImage(canvas, 0, 0);
      ctx.save();
      ctx.filter = filter;
      ctx.drawImage(_filterCanvas, 0, 0);
      ctx.restore();
    }
  }
}
