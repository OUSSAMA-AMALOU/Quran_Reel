/**
 * Helper to wrap and draw text on canvas with centering and shadows
 */
let _filterCanvas = null;

export function wrapText(ctx, text, x, y, maxWidth, lineHeight, align = 'center') {
  if (!text) return 0;
  
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const testLine = currentLine + words[i] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    
    if (testWidth > maxWidth && i > 0) {
      lines.push(currentLine.trim());
      currentLine = words[i] + ' ';
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine.trim());

  ctx.textAlign = align;
  
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + (index * lineHeight));
  });

  return lines.length * lineHeight;
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
  const t = currentTime || 0;

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
  } else {
    // Programmatic backgrounds
    const bgId = config.backgroundId || 'starfield';

    if (bgId === 'stars') {
    // Starry Sky: dark gradient sky with twinkling stars
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0a0e1a');
    grad.addColorStop(0.4, '#0f1428');
    grad.addColorStop(0.7, '#090b14');
    grad.addColorStop(1, '#020306');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    const starCount = 80;
    for (let i = 0; i < starCount; i++) {
      const x = ((i * 137.5 + 50) % 1) * width;
      const yBase = (i * 83.3) % height;
      const size = 1 + (i % 4);
      const baseOpacity = 0.2 + (i % 6) * 0.1;
      const twinkle = 0.5 + 0.5 * Math.sin(t * (0.5 + (i % 3) * 0.3) + i * 2.1);
      const opacity = baseOpacity * twinkle;

      ctx.beginPath();
      ctx.arc(x, yBase, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      if (i % 10 === 0) {
        ctx.shadowColor = 'rgba(200, 220, 255, 0.6)';
        ctx.shadowBlur = 8;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fill();
    }
    ctx.restore();
  } else if (bgId === 'forest') {
    // Sunlit Forest: deep green with animated light rays
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0a1a0e');
    grad.addColorStop(0.3, '#0d2412');
    grad.addColorStop(0.6, '#081a0e');
    grad.addColorStop(1, '#030a06');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Tree silhouettes
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    for (let i = 0; i < 12; i++) {
      const tx = (i * 95 + 20) % width;
      const tw = 40 + (i % 5) * 20;
      const th = 400 + (i % 4) * 200;
      ctx.beginPath();
      ctx.moveTo(tx - tw / 2, height);
      ctx.lineTo(tx - tw / 4, height - th * 0.7);
      ctx.lineTo(tx, height - th);
      ctx.lineTo(tx + tw / 4, height - th * 0.7);
      ctx.lineTo(tx + tw / 2, height);
      ctx.closePath();
      ctx.fill();
    }

    // Animated light rays
    for (let r = 0; r < 5; r++) {
      const rx = (r * 250 + 80) % width;
      const rayShift = Math.sin(t * 0.3 + r * 1.7) * 40;
      ctx.fillStyle = `rgba(180, 230, 150, ${0.02 + 0.02 * Math.sin(t * 0.5 + r * 2.1)})`;
      ctx.beginPath();
      ctx.moveTo(rx + rayShift, 0);
      ctx.lineTo(rx - 30 + rayShift, height * 0.4);
      ctx.lineTo(rx + 30 + rayShift, height * 0.4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  } else if (bgId === 'rain') {
    // Rain Window: dark cool gradient with animated rain streaks
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0a1218');
    grad.addColorStop(0.3, '#101a24');
    grad.addColorStop(0.6, '#0a1218');
    grad.addColorStop(1, '#04080c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Occasional lightning flash
    const flash = Math.max(0, Math.sin(t * 0.7) ** 32 - 0.5) * 2;
    if (flash > 0) {
      ctx.fillStyle = `rgba(200, 220, 255, ${flash * 0.06})`;
      ctx.fillRect(0, 0, width, height);
    }

    // Rain streaks
    ctx.save();
    ctx.strokeStyle = 'rgba(180, 200, 220, 0.15)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 50; i++) {
      const rx = (i * 37.7 + 10) % width;
      const ry = ((i * 53.1 + t * 400 * (0.5 + (i % 3) * 0.25)) % (height * 1.5)) - height * 0.25;
      const rlen = 30 + (i % 5) * 15;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 8, ry + rlen);
      ctx.stroke();
    }
    ctx.restore();
    } else {
      // starfield (default): cosmic gradient with floating particles
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#080a14');
      grad.addColorStop(0.5, '#130e25');
      grad.addColorStop(1, '#020306');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      const particleCount = 60;
      for (let i = 0; i < particleCount; i++) {
        const speed = 0.2 + (i % 5) * 0.12;
        const size = 1.5 + (i % 3) * 2;
        const opacity = 0.15 + (i % 4) * 0.15;
        
        const x = ((i * 137.5) % 1) * width;
        const drift = t * 35 * speed;
        let y = (height - (((i * 83.3) + drift) % height)) % height;
        if (y < 0) y += height;
        
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        
        if (i % 8 === 0) {
          ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
          ctx.shadowBlur = 6;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // 2. Dark Overlay / Vignette
  const overlayOpacity = parseFloat(config.vignetteOpacity || 0.4);
  if (overlayOpacity > 0) {
    // Solid overlay
    ctx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity})`;
    ctx.fillRect(0, 0, width, height);

    // Vignette (radial gradient)
    const vignette = ctx.createRadialGradient(
      width / 2, height / 2, height * 0.2,
      width / 2, height / 2, height * 0.8
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, `rgba(0, 0, 0, ${overlayOpacity * 1.5})`);
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

  // 4. Draw Surah/Ayah Info Badge or Hadith Reference Badge
  if (currentAyah) {
    ctx.save();
    const infoText = config.referenceText || `${config.surahName} [${config.surahNumber}:${currentAyah.numberInSurah}]`;
    
    // Draw badge background
    ctx.font = '500 24px Outfit, Inter, sans-serif';
    const textWidth = ctx.measureText(infoText).width;
    const badgeW = textWidth + 40;
    const badgeH = 48;
    const badgeX = (width - badgeW) / 2;
    const badgeY = 135;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 24);
    ctx.fill();
    ctx.stroke();
    
    // Draw badge text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'center';
    ctx.fillText(infoText, width / 2, badgeY + 32);
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

    // Compute display text with word grouping and text effects
    const progress = isPlaying && config.ayahDuration > 0
      ? Math.min(config.ayahElapsed / config.ayahDuration, 1)
      : 1;
    let displayText = currentAyah.text;

    if (config.wordGroupSize && config.wordGroupSize !== 'all') {
      const allWords = currentAyah.text.split(' ');
      const groupSize = parseInt(config.wordGroupSize);
      const numGroups = Math.ceil(allWords.length / groupSize);
      const groupsToShow = Math.max(1, Math.ceil(numGroups * progress));
      const wordsToShow = Math.min(groupsToShow * groupSize, allWords.length);
      displayText = allWords.slice(0, wordsToShow).join(' ');
    }

    if (config.textEffect === 'typewriter') {
      const totalChars = displayText.length;
      const charsToShow = Math.floor(totalChars * progress);
      displayText = displayText.slice(0, charsToShow);
    }

    if (config.textEffect === 'reveal') {
      const allWords = displayText.split(' ');
      const wordsToShow = Math.max(1, Math.ceil(allWords.length * progress));
      displayText = allWords.slice(0, wordsToShow).join(' ');
    }

    ctx.font = `700 ${arabicFontSize}px ${arabicFontFamily}`;

    const tempArabicLines = [];
    const words = displayText.split(' ');
    let currentLine = '';
    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine + words[i] + ' ';
      if (ctx.measureText(testLine).width > maxWidth && i > 0) {
        tempArabicLines.push(currentLine.trim());
        currentLine = words[i] + ' ';
      } else {
        currentLine = testLine;
      }
    }
    tempArabicLines.push(currentLine.trim());
    const arabicHeight = tempArabicLines.length * (arabicFontSize * 1.5);

    // Measure Transliteration
    let transliterationHeight = 0;
    const tempTrLines = [];
    const showTr = config.showTransliteration && currentAyah.transliteration;
    if (showTr) {
      ctx.font = `400 ${transliterationFontSize}px 'Outfit', 'Inter', sans-serif`;
      const trWords = currentAyah.transliteration.split(' ');
      let trLine = '';
      for (let i = 0; i < trWords.length; i++) {
        const testLine = trLine + trWords[i] + ' ';
        if (ctx.measureText(testLine).width > maxWidth && i > 0) {
          tempTrLines.push(trLine.trim());
          trLine = trWords[i] + ' ';
        } else {
          trLine = testLine;
        }
      }
      tempTrLines.push(trLine.trim());
      transliterationHeight = tempTrLines.length * (transliterationFontSize * 1.4);
    }

    // Measure Translation
    let englishHeight = 0;
    const tempEnglishLines = [];
    if (config.showTranslation && currentAyah.translation) {
      ctx.font = `400 ${translationFontSize}px Outfit, Inter, sans-serif`;
      const engWords = currentAyah.translation.split(' ');
      let engLine = '';
      for (let i = 0; i < engWords.length; i++) {
        const testLine = engLine + engWords[i] + ' ';
        if (ctx.measureText(testLine).width > maxWidth && i > 0) {
          tempEnglishLines.push(engLine.trim());
          engLine = engWords[i] + ' ';
        } else {
          engLine = testLine;
        }
      }
      tempEnglishLines.push(engLine.trim());
      englishHeight = tempEnglishLines.length * (translationFontSize * 1.4);
    }

    const totalBlockHeight = arabicHeight
      + (showTr ? textSpacing + transliterationHeight : 0)
      + (config.showTranslation ? textSpacing + englishHeight : 0);
    const startY = centerY - (totalBlockHeight / 2);

    // Draw Arabic Text with effects
    ctx.font = `700 ${arabicFontSize}px ${arabicFontFamily}`;

    const effect = config.textEffect || 'none';
    let textAlpha = 1;
    let textOffsetY = 0;
    let textScale = 1;

    if (effect === 'fade') {
      textAlpha = Math.min(1, progress * 2);
    } else if (effect === 'slide-up') {
      textOffsetY = (1 - Math.min(1, progress * 1.5)) * 80;
    } else if (effect === 'scale') {
      textScale = 0.5 + 0.5 * Math.min(1, progress * 1.5);
    }

    ctx.save();

    if (effect === 'blur') {
      const blurPx = Math.max(0, (1 - progress) * 6);
      ctx.filter = `blur(${blurPx}px)`;
    }

    if (textAlpha < 1) ctx.globalAlpha = textAlpha;

    if (textScale !== 1) {
      const cx = width / 2, cy = startY + arabicFontSize / 2;
      ctx.translate(cx, cy);
      ctx.scale(textScale, textScale);
      ctx.translate(-cx, -cy);
    }

    if (effect === 'glow') {
      ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
      ctx.shadowBlur = 12 + progress * 40;
    }

    ctx.fillStyle = effect === 'gradient'
      ? (() => {
          const g = ctx.createLinearGradient(0, startY, width, startY + arabicHeight);
          g.addColorStop(0, '#ffd700');
          g.addColorStop(0.3, '#ff6b6b');
          g.addColorStop(0.6, '#a855f7');
          g.addColorStop(1, '#3b82f6');
          return g;
        })()
      : '#ffffff';

    let currentY = startY + arabicFontSize + textOffsetY;
    const arabicTextHeight = wrapText(
      ctx,
      displayText,
      width / 2,
      currentY,
      maxWidth,
      arabicFontSize * 1.5
    );

    ctx.restore();

    // Shimmer effect overlay
    if (effect === 'shimmer' && progress > 0 && progress < 1) {
      ctx.save();
      const shimmerX = (progress - 0.3) / 0.4 * width;
      const grad = ctx.createLinearGradient(shimmerX - 150, 0, shimmerX + 150, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.3)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, currentY - arabicTextHeight, width, arabicTextHeight);
      ctx.restore();
    }

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
