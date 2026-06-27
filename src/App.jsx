import { useState, useEffect, useRef, useCallback } from 'react';
import { surahs } from './data/surahData';
import { drawFrame } from './utils/videoRenderer';
import { t } from './i18n';

// Transition effect post-processing
function applyTransition(ctx, canvas, fromCanvas, progress, effect) {
  const w = canvas.width, h = canvas.height;
  if (effect === 'none' || progress >= 1) return;

  if (effect === 'crossfade') {
    ctx.globalAlpha = 1 - progress;
    ctx.drawImage(fromCanvas, 0, 0);
    ctx.globalAlpha = 1;
  } else if (effect === 'fadetoblack') {
    if (progress < 0.5) {
      const p = progress * 2;
      ctx.fillStyle = `rgba(0,0,0,${p})`;
      ctx.fillRect(0, 0, w, h);
    } else {
      const p = (progress - 0.5) * 2;
      ctx.fillStyle = `rgba(0,0,0,${1 - p})`;
      ctx.fillRect(0, 0, w, h);
    }
  } else if (effect === 'slideleft') {
    ctx.drawImage(fromCanvas, -w * (1 - progress), 0);
  } else if (effect === 'slideright') {
    ctx.drawImage(fromCanvas, w * (1 - progress), 0);
  } else if (effect === 'slideup') {
    ctx.drawImage(fromCanvas, 0, -h * (1 - progress));
  } else if (effect === 'slidedown') {
    ctx.drawImage(fromCanvas, 0, h * (1 - progress));
  } else if (effect === 'zoomin') {
    const s = 1 + (1 - progress) * 0.3;
    const ox = w / 2, oy = h / 2;
    ctx.drawImage(fromCanvas, ox - (ox * s), oy - (oy * s), w * s, h * s);
  } else if (effect === 'zoomout') {
    const s = 1 + progress * 0.3;
    const ox = w / 2, oy = h / 2;
    ctx.globalAlpha = 1 - progress;
    ctx.drawImage(fromCanvas, ox - (ox * s), oy - (oy * s), w * s, h * s);
    ctx.globalAlpha = 1;
  } else if (effect === 'wipeleft') {
    ctx.save();
    ctx.beginPath();
    ctx.rect(w * progress, 0, w * (1 - progress), h);
    ctx.clip();
    ctx.drawImage(fromCanvas, 0, 0);
    ctx.restore();
  } else if (effect === 'wiperight') {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w * (1 - progress), h);
    ctx.clip();
    ctx.drawImage(fromCanvas, 0, 0);
    ctx.restore();
  } else if (effect === 'wipeup') {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, h * progress, w, h * (1 - progress));
    ctx.clip();
    ctx.drawImage(fromCanvas, 0, 0);
    ctx.restore();
  } else if (effect === 'wipedown') {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h * (1 - progress));
    ctx.clip();
    ctx.drawImage(fromCanvas, 0, 0);
    ctx.restore();
  } else if (effect === 'radialin') {
    const maxDist = Math.sqrt(w * w + h * h) / 2;
    const r = maxDist * progress;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.moveTo(w / 2 + r, h / 2);
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    ctx.clip('evenodd');
    ctx.drawImage(fromCanvas, 0, 0);
    ctx.restore();
  } else if (effect === 'radialout') {
    const maxDist = Math.sqrt(w * w + h * h) / 2;
    const r = maxDist * (1 - progress);
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(fromCanvas, 0, 0);
    ctx.restore();
  } else if (effect === 'blinds_h') {
    const strips = 12;
    const stripH = h / strips;
    for (let i = 0; i < strips; i++) {
      const y = i * stripH;
      const sh = stripH * progress;
      ctx.drawImage(fromCanvas, 0, y + (stripH - sh) / 2, w, sh, 0, y + (stripH - sh) / 2, w, sh);
    }
  } else if (effect === 'blinds_v') {
    const strips = 12;
    const stripW = w / strips;
    for (let i = 0; i < strips; i++) {
      const x = i * stripW;
      const sw = stripW * progress;
      ctx.drawImage(fromCanvas, x + (stripW - sw) / 2, 0, sw, h, x + (stripW - sw) / 2, 0, sw, h);
    }
  } else if (effect === 'checkerboard') {
    const cols = 8, rows = 12;
    const cw = w / cols, rh = h / rows;
    const total = cols * rows;
    const visible = Math.floor(total * progress);
    for (let i = 0; i < visible; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      ctx.drawImage(fromCanvas, col * cw, row * rh, cw, rh, col * cw, row * rh, cw, rh);
    }
  } else if (effect === 'diamond') {
    const cx = w / 2, cy = h / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);
    const d = maxDist * (1 - progress);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy - d);
    ctx.lineTo(cx + d, cy);
    ctx.lineTo(cx, cy + d);
    ctx.lineTo(cx - d, cy);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(fromCanvas, 0, 0);
    ctx.restore();
  } else if (effect === 'circle') {
    const maxDist = Math.sqrt(w * w + h * h) / 2;
    const r = maxDist * (1 - progress);
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(fromCanvas, 0, 0);
    ctx.restore();
  }
}

const RECITERS = [
  // Original 9
  { id: 'ar.alafasy', name: 'Mishary Rashid Alafasy', style: 'Murattal' },
  { id: 'ar.sudais', name: 'Abdul Rahman Al-Sudais', style: 'Murattal' },
  { id: 'ar.mahermuaiqly', name: 'Maher Al-Muaiqly', style: 'Murattal' },
  { id: 'ar.abdulbasitmurattal', name: 'Abdul Basit (Murattal)', style: 'Murattal' },
  { id: 'ar.abdulbasitmujawwad', name: 'Abdul Basit (Mujawwad)', style: 'Mujawwad' },
  { id: 'ar.minshawi', name: 'Muhammad Al-Minshawi', style: 'Murattal' },
  { id: 'ar.shaatree', name: 'Abu Bakr Al-Shatri', style: 'Murattal' },
  { id: 'ar.saadalgamidi', name: 'Saad Al-Ghamdi', style: 'Murattal' },
  { id: 'ar.hanirifai', name: 'Hani Ar-Rifai', style: 'Murattal' },
  // New from API
  { id: 'ar.abdullahbasfar', name: 'Abdullah Basfar', style: 'Murattal' },
  { id: 'ar.abdurrahmaansudais', name: 'Abdurrahmaan As-Sudais', style: 'Murattal' },
  { id: 'ar.abdulsamad', name: 'Abdul Samad', style: 'Murattal' },
  { id: 'ar.ahmedajamy', name: 'Ahmed ibn Ali al-Ajamy', style: 'Murattal' },
  { id: 'ar.husary', name: 'Mahmoud Khalil Al-Husary', style: 'Murattal' },
  { id: 'ar.husarymujawwad', name: 'Al-Husary (Mujawwad)', style: 'Mujawwad' },
  { id: 'ar.hudhaify', name: 'Ali Al-Hudhaify', style: 'Murattal' },
  { id: 'ar.ibrahimakhbar', name: 'Ibrahim Al-Akhdar', style: 'Murattal' },
  { id: 'ar.minshawimujawwad', name: 'Al-Minshawi (Mujawwad)', style: 'Mujawwad' },
  { id: 'ar.muhammadayyoub', name: 'Muhammad Ayyoub', style: 'Murattal' },
  { id: 'ar.muhammadjibreel', name: 'Muhammad Jibreel', style: 'Murattal' },
  { id: 'ar.saoodshuraym', name: 'Saood Ash-Shuraym', style: 'Murattal' },
  { id: 'ar.parhizgar', name: 'Parhizgar', style: 'Murattal' },
  { id: 'ar.aymanswoaid', name: 'Ayman Sowaid', style: 'Murattal' },
  // V2 editions (alternate recordings)
  { id: 'ar.alafasy-2', name: 'Alafasy (V2)', style: 'Murattal' },
  { id: 'ar.husary-2', name: 'Al-Husary (V2)', style: 'Murattal' },
  { id: 'ar.mahermuaiqly-2', name: 'Maher Al-Muaiqly (V2)', style: 'Murattal' },
  { id: 'ar.hudhaify-2', name: 'Al-Hudhaify (V2)', style: 'Murattal' },
  { id: 'ar.husarymujawwad-2', name: 'Al-Husary (Mujawwad V2)', style: 'Mujawwad' },
  { id: 'ar.minshawi-2', name: 'Al-Minshawi (V2)', style: 'Murattal' },
  { id: 'ar.muhammadayyoub-2', name: 'Muhammad Ayyoub (V2)', style: 'Murattal' },
  { id: 'ar.muhammadjibreel-2', name: 'Muhammad Jibreel (V2)', style: 'Murattal' },
  // CDN-only reciters (not in Alquran Cloud API)
  { id: 'ar.yasseraldossari', name: 'Yasser Al-Dosari', style: 'Murattal' },
];

// Reciters NOT available in Alquran Cloud API — audio comes from CDN directly
const CDN_ONLY_RECITERS = new Set(['ar.yasseraldossari']);

// Map CDN reciter IDs to EveryAyah folder names
const EVERYAYAH_FOLDERS = {
  'ar.yasseraldossari': 'Yasser_Ad-Dussary'
};

const pad3 = (n) => String(n).padStart(3, '0');

// Build cumulative ayah offsets: surahNum → global ayah offset (0-indexed)
const surahOffset = {};
let cum = 0;
for (const s of surahs) {
  surahOffset[s.number] = cum;
  cum += s.numberOfAyahs;
}

const getAudioPath = (url) => {
  if (!url) return '';
  try {
    const p = new URL(url).pathname;
    return p.startsWith('/quran') ? p : '/quran' + p;
  } catch { return ''; }
};

// 30 CC0 Islamic nasheeds and background sounds
const ISLAMIC_SOUNDS = [
  { id: 'none', name: 'None' },
  // === Nasheeds from Background Nasheed Library (CC0) ===
  { id: 'i01', name: '🤲 Alhamdulillah Nasheed', url: 'https://archive.org/download/background-nasheed-1/Alhamdulillah%20Nasheed.mp3' },
  { id: 'i02', name: '🤲 A\'dha al-Islam', url: 'https://archive.org/download/background-nasheed-1/A%27dha%20al-Islam.mp3' },
  { id: 'i03', name: '🤲 Deen al-Salam', url: 'https://archive.org/download/background-nasheed-1/Deen%20al-Salam.mp3' },
  { id: 'i04', name: '🤲 Ya Hala Marhaba', url: 'https://archive.org/download/background-nasheed-1/Ya%20Hala%20Marhaba%20%28online-audio-converter.com%29.mp3' },
  { id: 'i05', name: '🤲 Sirna', url: 'https://archive.org/download/background-nasheed-1/Sirna%20%28online-audio-converter.com%29.mp3' },
  { id: 'i06', name: '🤲 Namdi Sawiyya', url: 'https://archive.org/download/background-nasheed-1/Namdi%20Sawiyya%20%28online-audio-converter.com%29.mp3' },
  { id: 'i07', name: '🤲 Qad Udna', url: 'https://archive.org/download/background-nasheed-1/Qad%20Udna%20%28Here%20we%20come%20back%20to%20you%29.mp3' },
  { id: 'i08', name: '🤲 Riha Ula', url: 'https://archive.org/download/background-nasheed-1/Riha%20Ula%20%28Heaven%20called%20them%29.mp3' },
  { id: 'i09', name: '🤲 Salaktu Tariqi', url: 'https://archive.org/download/background-nasheed-1/Salaktu%20Tariqi%20%28online-audio-converter.com%29.mp3' },
  { id: 'i10', name: '🤲 Quranuna Dusturuna', url: 'https://archive.org/download/background-nasheed-1/Quranuna%20Dusturuna%20%28Our%20Quran%20is%20Our%20Constitution%29.mp3' },
  { id: 'i11', name: '🤲 Asmi\'ni Ya Ukhayyah', url: 'https://archive.org/download/background-nasheed-1/Asmi%27ni%20Ya%20Ukhayyah%20%28Let%20me%20hear%2C%20O%20sister%29.mp3' },
  { id: 'i12', name: '🤲 Fala Ya Qalbu La Tahzan', url: 'https://archive.org/download/background-nasheed-1/Fala%20Ya%20Qalbu%20La%20Tahzan%20%28online-audio-converter.com%29.mp3' },
  { id: 'i13', name: '🤲 Ummat al-Islami Bushra', url: 'https://archive.org/download/background-nasheed-1/Ummat%20al-Islami%20Bushra%20...%20Walidduna%20%28online-audio-converter.com%29.mp3' },
  { id: 'i14', name: '🤲 al-Ghuraba (The Strangers)', url: 'https://archive.org/download/background-nasheed-1/al-Ghuraba%20%28The%20Strangers%29.mp3' },
  { id: 'i15', name: '🤲 al-Akhira', url: 'https://archive.org/download/background-nasheed-1/al-Akhira%20%28online-audio-converter.com%29.mp3' },
  // === Islamic Background Sounds Aahat (30 tracks) ===
  { id: 'i16', name: '🎵 Islamic Ambience 01', url: 'https://archive.org/download/IslamicBackgroundSoundsAahat/01-ISLAMIC+BACKGROUND+SOUNDS.mp3' },
  { id: 'i17', name: '🎵 Islamic Ambience 02', url: 'https://archive.org/download/IslamicBackgroundSoundsAahat/02-ISLAMIC+BACKGROUND+SOUNDS.mp3' },
  { id: 'i18', name: '🎵 Islamic Ambience 03', url: 'https://archive.org/download/IslamicBackgroundSoundsAahat/03-ISLAMIC+BACKGROUND+SOUNDS.mp3' },
  { id: 'i19', name: '🎵 Islamic Ambience 04', url: 'https://archive.org/download/IslamicBackgroundSoundsAahat/04-ISLAMIC+BACKGROUND+SOUNDS.mp3' },
  { id: 'i20', name: '🎵 Islamic Ambience 05', url: 'https://archive.org/download/IslamicBackgroundSoundsAahat/05-ISLAMIC+BACKGROUND+SOUNDS.mp3' },
  { id: 'i21', name: '🎵 Islamic Ambience 06', url: 'https://archive.org/download/IslamicBackgroundSoundsAahat/06-ISLAMIC+BACKGROUND+SOUNDS.mp3' },
  { id: 'i22', name: '🎵 Islamic Ambience 07', url: 'https://archive.org/download/IslamicBackgroundSoundsAahat/07-ISLAMIC+BACKGROUND+SOUNDS.mp3' },
  { id: 'i23', name: '🎵 Islamic Ambience 08', url: 'https://archive.org/download/IslamicBackgroundSoundsAahat/08-ISLAMIC+BACKGROUND+SOUNDS.mp3' },
  { id: 'i24', name: '🎵 Islamic Ambience 09', url: 'https://archive.org/download/IslamicBackgroundSoundsAahat/09-ISLAMIC+BACKGROUND+SOUNDS.mp3' },
  { id: 'i25', name: '🎵 Islamic Ambience 10', url: 'https://archive.org/download/IslamicBackgroundSoundsAahat/10-ISLAMIC+BACKGROUND+SOUNDS.mp3' },
  // === Adhan (Public Domain) ===
  { id: 'i26', name: '📿 Fajr Adhan (Doha)', url: 'https://archive.org/download/adhan.recordings.from.doha.qatar/Adhan_Doha_Qatar_01_Fajr_Adhan.mp3' },
  { id: 'i27', name: '📿 Dhuhr Adhan (Doha)', url: 'https://archive.org/download/adhan.recordings.from.doha.qatar/Adhan_Doha_Qatar_02_Dhuhr_Adhan.mp3' },
  { id: 'i28', name: '📿 Asr Adhan (Doha)', url: 'https://archive.org/download/adhan.recordings.from.doha.qatar/Adhan_Doha_Qatar_03_Asr_Adhan.mp3' },
  { id: 'i29', name: '📿 Maghrib Adhan (Doha)', url: 'https://archive.org/download/adhan.recordings.from.doha.qatar/Adhan_Doha_Qatar_04_Maghrib_Adhan.mp3' },
  { id: 'i30', name: '📿 Isha Adhan (Doha)', url: 'https://archive.org/download/adhan.recordings.from.doha.qatar/Adhan_Doha_Qatar_05_Isha_Adhan.mp3' },
];

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('quran-theme') || 'dark');
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('quran-theme', next);
  };

  // Configuration States
  const [surahNum, setSurahNum] = useState(1);
  const [startAyah, setStartAyah] = useState(1);
  const [endAyah, setEndAyah] = useState(7);
  const [startInput, setStartInput] = useState('1');
  const [endInput, setEndInput] = useState('7');
  const [reciterId, setReciterId] = useState('ar.alafasy');
  
  // Customization States
  const backgroundType = 'upload';
  const [uploadedBgUrl, setUploadedBgUrl] = useState(null);
  const [videoMode, setVideoMode] = useState('single'); // 'single' | 'per-ayah'
  const [perAyahVideos, setPerAyahVideos] = useState({}); // { ayahNum: blobUrl }
  const uploadedForAyahRef = useRef(null);
  
  // Styling configuration
  const [fontSize, setFontSize] = useState(48);
  const [translationFontSize, setTranslationFontSize] = useState(26);
  const [textPosition, setTextPosition] = useState('center'); // 'top', 'center', 'bottom'
  const [vignetteOpacity, setVignetteOpacity] = useState(0.4);
  const [fontFamily, setFontFamily] = useState('amiri');
  const [showTranslation, setShowTranslation] = useState(false);
  const [translationLang, setTranslationLang] = useState('en');
  const [uiLang, setUiLang] = useState('en');
  const [showTransliteration, setShowTransliteration] = useState(false);
  const [watermark, setWatermark] = useState('');
  const [visualizerStyle, setVisualizerStyle] = useState('none'); // 'waves', 'bars', 'none'
  const [visualizerColor, setVisualizerColor] = useState('#60a5fa');
  const [colorEffect, setColorEffect] = useState('none');
  const [transitionEffect, setTransitionEffect] = useState('none');
  const [wordGroupSize, setWordGroupSize] = useState('all');
  const [textEffect, setTextEffect] = useState('none');

const COLOR_EFFECTS = [
  { id: 'none', name: '♾ None' },
  { id: 'warm', name: '🌅 Warm Glow', filter: 'saturate(1.1) sepia(0.2) brightness(1.05)' },
  { id: 'cool', name: '❄ Cool Mist', filter: 'saturate(0.9) hue-rotate(10deg) brightness(1.05)' },
  { id: 'vintage', name: '📜 Vintage', filter: 'sepia(0.5) saturate(0.7) contrast(0.85) brightness(1.1)' },
  { id: 'noir', name: '🖤 Noir', filter: 'grayscale(1) contrast(1.3) brightness(0.9)' },
  { id: 'golden', name: '✨ Golden Hour', filter: 'sepia(0.3) saturate(1.3) hue-rotate(-5deg) brightness(1.1)' },
  { id: 'ocean', name: '🌊 Ocean', filter: 'saturate(1.2) hue-rotate(180deg) brightness(0.95) contrast(1.1)' },
  { id: 'forest', name: '🌲 Forest', filter: 'saturate(1.3) sepia(0.2) hue-rotate(60deg) brightness(0.9)' },
  { id: 'sunset', name: '🌇 Sunset', filter: 'sepia(0.4) saturate(1.4) hue-rotate(-15deg) brightness(1.05)' },
  { id: 'moody', name: '🌧 Moody', filter: 'grayscale(0.3) saturate(0.6) brightness(0.8) contrast(1.2)' },
  { id: 'fade', name: '🌫 Fade', filter: 'saturate(0.5) contrast(0.8) brightness(1.15) opacity(0.9)' },
  { id: 'cinematic', name: '🎬 Cinematic', filter: 'contrast(1.15) saturate(0.85) brightness(0.9) sepia(0.15)' },
  { id: 'grayscale', name: '⚫ Grayscale', filter: 'grayscale(1) brightness(1.05)' },
  { id: 'sepia', name: '🟫 Sepia', filter: 'sepia(0.8) saturate(0.9) brightness(1.05)' },
  { id: 'vibrant', name: '🌈 Vibrant', filter: 'saturate(1.8) contrast(1.15) brightness(1.05)' },
  { id: 'soft', name: '☁ Soft', filter: 'brightness(1.1) contrast(0.85) saturate(0.8) blur(0.3px)' },
  { id: 'dramatic', name: '🎭 Dramatic', filter: 'contrast(1.5) brightness(0.75) saturate(0.7)' },
  { id: 'retro', name: '📺 Retro', filter: 'sepia(0.6) saturate(0.6) contrast(0.9) hue-rotate(-20deg)' },
  { id: 'coolblue', name: '🧊 Cool Blue', filter: 'saturate(1.1) hue-rotate(200deg) brightness(1.05) contrast(0.9)' },
  { id: 'warmglow', name: '🔥 Warm Glow', filter: 'sepia(0.2) saturate(1.2) hue-rotate(-10deg) brightness(1.1)' },
];

const TRANSITIONS = [
  { id: 'none', name: '— None (Cut)' },
  { id: 'crossfade', name: '🌀 Crossfade' },
  { id: 'fadetoblack', name: '⬛ Fade to Black' },
  { id: 'slideleft', name: '◀ Slide Left' },
  { id: 'slideright', name: '▶ Slide Right' },
  { id: 'slideup', name: '▲ Slide Up' },
  { id: 'slidedown', name: '▼ Slide Down' },
  { id: 'zoomin', name: '🔍 Zoom In' },
  { id: 'zoomout', name: '🔎 Zoom Out' },
  { id: 'wipeleft', name: '▮ Wipe Right' },
  { id: 'wiperight', name: '▯ Wipe Left' },
  { id: 'wipeup', name: '▬ Wipe Down' },
  { id: 'wipedown', name: '▬ Wipe Up' },
  { id: 'radialin', name: '◎ Radial In' },
  { id: 'radialout', name: '◉ Radial Out' },
  { id: 'blinds_h', name: '〓 H Blinds' },
  { id: 'blinds_v', name: '≡ V Blinds' },
  { id: 'checkerboard', name: '◫ Checkerboard' },
  { id: 'diamond', name: '◇ Diamond' },
  { id: 'circle', name: '○ Circle' },
];
  
  // Mode: quran or hadith
  const [mode, setMode] = useState('quran');

  // Hadith-specific states
  const HADITH_BOOKS = [
    { id: 'bukhari', name: 'Sahih Bukhari', arabic: 'صحيح البخاري' },
    { id: 'muslim', name: 'Sahih Muslim', arabic: 'صحيح مسلم' },
    { id: 'abudawud', name: 'Sunan Abi Dawud', arabic: 'سنن أبي داود' },
    { id: 'tirmidhi', name: 'Jami At-Tirmidhi', arabic: 'جامع الترمذي' },
    { id: 'nasai', name: 'Sunan An-Nasai', arabic: 'سنن النسائي' },
    { id: 'ibnmajah', name: 'Sunan Ibn Majah', arabic: 'سنن ابن ماجه' },
    { id: 'malik', name: 'Muwatta Malik', arabic: 'موطأ مالك' },
  ];
  const FRENCH_HADITH_EDITIONS = {
    bukhari: 'fra-bukhari',
    muslim: 'fra-muslim',
    abudawud: 'fra-abudawud',
    tirmidhi: 'fra-tirmidhi',
    nasai: 'fra-nasai',
    ibnmajah: 'fra-ibnmajah',
    malik: 'fra-malik',
  };
  const [hadithBook, setHadithBook] = useState('bukhari');
  const [hadithNumber, setHadithNumber] = useState(1);
  const [hadithData, setHadithData] = useState([]);
  const [currentHadithIndex, setCurrentHadithIndex] = useState(0);
  
  // Dua-specific states
  const DUA_SHORTCUTS = [
    { id: 'morning', name: 'Morning Adhkar', arabic: 'أذكار الصباح' },
    { id: 'evening', name: 'Evening Adhkar', arabic: 'أذكار المساء' },
    { id: 'after-prayer', name: 'After Prayer', arabic: 'أذكار بعد الصلاة' },
    { id: 'before-sleep', name: 'Before Sleep', arabic: 'أذكار النوم' },
    { id: 'waking-up', name: 'Waking Up', arabic: 'أذكار الاستيقاظ' },
    { id: 'prayer', name: 'Prayer', arabic: 'أذكار الصلاة' },
    { id: 'mosque', name: 'Mosque', arabic: 'أذكار المسجد' },
    { id: 'travel', name: 'Travel', arabic: 'أذكار السفر' },
    { id: 'food', name: 'Eating', arabic: 'أذكار الطعام' },
    { id: 'home', name: 'Home', arabic: 'أذكار المنزل' },
    { id: 'anxiety', name: 'Anxiety & Sorrow', arabic: 'أدعية الهم والحزن' },
    { id: 'protection', name: 'Protection', arabic: 'أدعية التحصين' },
    { id: 'forgiveness', name: 'Forgiveness', arabic: 'أدعية الاستغفار' },
    { id: 'hajj', name: 'Hajj & Umrah', arabic: 'أذكار الحج والعمرة' },
  ];
  const [duaCategory, setDuaCategory] = useState('morning');
  const [duaCategories, setDuaCategories] = useState([]);
  const [duaData, setDuaData] = useState([]);
  const [currentDuaIndex, setCurrentDuaIndex] = useState(0);
  
  // Background Audio
  const [bgAudioFile, setBgAudioFile] = useState(null);
  const [selectedBgSound, setSelectedBgSound] = useState('none');
  const [bgAudioEnabled, setBgAudioEnabled] = useState(false);
  const [bgAudioVolume, setBgAudioVolume] = useState(50);
  
  // Data States
  const [passageAyahs, setPassageAyahs] = useState([]);
  const [currentAyahIndex, setCurrentAyahIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const T = (key, vars) => t(key, uiLang, vars);
  // Mobile section tab
  const [mobileSection, setMobileSection] = useState('passage');

  // Player States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Recording / Export States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [recordingStatus, setRecordingStatus] = useState('');
  const [itemDuration, setItemDuration] = useState(10);
  
  // DOM References
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const nextAudioRef = useRef(null);
  const bgAudioRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  
  // Web Audio API References
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const audioSourceNodeRef = useRef(null);
  const nextAudioSourceNodeRef = useRef(null);
  const bgAudioSourceNodeRef = useRef(null);
  const bgGainNodeRef = useRef(null);
  const recorderRef = useRef(null);
  const prevFrameRef = useRef(null); // cached previous frame for transitions
  const transitionRef = useRef({ active: false, startTime: 0, duration: 0, effect: 'none' });
  
  // Track which audio element is currently active for playback
  const activeIsPrimaryRef = useRef(true);
  const getAudio = () => activeIsPrimaryRef.current ? audioRef.current : nextAudioRef.current;
  const getIdleAudio = () => activeIsPrimaryRef.current ? nextAudioRef.current : audioRef.current;

  const selectedSurahDetails = surahs.find(s => s.number === parseInt(surahNum));

  // Handle Fetching Surah Data (Arabic text, translation, audio)
  const fetchPassage = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsPlaying(false);
    const a = getAudio();
    if (a) a.pause();
    
    try {
      let arData, enData, combined;

      if (CDN_ONLY_RECITERS.has(reciterId)) {
        // CDN-only reciter: fetch text/translation from API, build audio URL directly
        const [arRes, enRes, frRes, trRes] = await Promise.all([
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/quran-uthmani`),
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/en.sahih`),
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/fr.hamidullah`),
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/en.transliteration`)
        ]);
        if (!arRes.ok || !enRes.ok) throw new Error('Failed to fetch Quran data from API.');
        arData = await arRes.json();
        enData = await enRes.json();
        const frData = await frRes.json();
        const trData = await trRes.json();
        const folder = EVERYAYAH_FOLDERS[reciterId];
        combined = arData.data.ayahs
          .map((ayah, idx) => ({
            numberInSurah: ayah.numberInSurah,
            number: ayah.number,
            text: ayah.text,
            translationEn: enData.data.ayahs[idx]?.text || '',
            translationFr: frData.data.ayahs[idx]?.text || '',
            transliteration: trData.data.ayahs[idx]?.text || '',
            audio: `/everyayah/data/${folder}_128kbps/${pad3(surahNum)}${pad3(ayah.numberInSurah)}.mp3`
          }));
      } else {
        // API reciter: fetch everything from Alquran Cloud
        const [arRes, enRes, frRes, trRes, audioRes] = await Promise.all([
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/quran-uthmani`),
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/en.sahih`),
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/fr.hamidullah`),
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/en.transliteration`),
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/${reciterId}`)
        ]);
        if (!arRes.ok || !enRes.ok || !audioRes.ok) {
          throw new Error('Failed to fetch Quran data from API. Please try again.');
        }
        arData = await arRes.json();
        enData = await enRes.json();
        const frData = await frRes.json();
        const trData = await trRes.json();
        const audioData = await audioRes.json();
        combined = arData.data.ayahs
          .map((ayah, idx) => ({
            numberInSurah: ayah.numberInSurah,
            number: ayah.number,
            text: ayah.text,
            translationEn: enData.data.ayahs[idx]?.text || '',
            translationFr: frData.data.ayahs[idx]?.text || '',
            transliteration: trData.data.ayahs[idx]?.text || '',
            audio: getAudioPath(audioData.data.ayahs[idx]?.audio)
          }))
          .filter(a => a.audio);
      }

      if (combined.length === 0) {
        throw new Error('No audio available for this reciter/surah combination. Try a different reciter.');
      }

      // Slice to selected ayah range
      const rangeSlice = combined.slice(startAyah - 1, endAyah);
      setPassageAyahs(rangeSlice);
      setCurrentAyahIndex(0);
      
      // Load first audio URL
      if (rangeSlice.length > 0 && audioRef.current) {
        audioRef.current.src = rangeSlice[0].audio;
        audioRef.current.load();
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred while fetching the passage.');
    } finally {
      setLoading(false);
    }
  }, [surahNum, reciterId, startAyah, endAyah]);

  // Fetch passage initially on mount and configuration changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPassage();
  }, [fetchPassage]);

  // Sync range settings locally (slice existing dataset without fetching)
  const applyLocalRangeChange = async () => {
    setLoading(true);
    setError(null);
    setIsPlaying(false);
    const a = getAudio();
    if (a) a.pause();

    try {
      let arData, enData, combined;

      if (CDN_ONLY_RECITERS.has(reciterId)) {
        const [arRes, enRes, frRes, trRes] = await Promise.all([
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/quran-uthmani`),
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/en.sahih`),
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/fr.hamidullah`),
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/en.transliteration`)
        ]);
        if (!arRes.ok || !enRes.ok) throw new Error('Failed to fetch Quran data from API.');
        arData = await arRes.json();
        enData = await enRes.json();
        const frData = await frRes.json();
        const trData = await trRes.json();
        const folder = EVERYAYAH_FOLDERS[reciterId];
        combined = arData.data.ayahs
          .map((ayah, idx) => ({
            numberInSurah: ayah.numberInSurah,
            number: ayah.number,
            text: ayah.text,
            translationEn: enData.data.ayahs[idx]?.text || '',
            translationFr: frData.data.ayahs[idx]?.text || '',
            transliteration: trData.data.ayahs[idx]?.text || '',
            audio: `/everyayah/data/${folder}_128kbps/${pad3(surahNum)}${pad3(ayah.numberInSurah)}.mp3`
          }));
      } else {
        const [arRes, enRes, frRes, trRes, audioRes] = await Promise.all([
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/quran-uthmani`),
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/en.sahih`),
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/fr.hamidullah`),
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/en.transliteration`),
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/${reciterId}`)
        ]);
        if (!arRes.ok || !enRes.ok || !audioRes.ok) {
          throw new Error('Failed to fetch Quran data from API. Try again.');
        }
        arData = await arRes.json();
        enData = await enRes.json();
        const frData = await frRes.json();
        const trData = await trRes.json();
        const audioData = await audioRes.json();
        combined = arData.data.ayahs
          .map((ayah, idx) => ({
            numberInSurah: ayah.numberInSurah,
            number: ayah.number,
            text: ayah.text,
            translationEn: enData.data.ayahs[idx]?.text || '',
            translationFr: frData.data.ayahs[idx]?.text || '',
            transliteration: trData.data.ayahs[idx]?.text || '',
            audio: getAudioPath(audioData.data.ayahs[idx]?.audio)
          }))
          .filter(a => a.audio);
      }

      if (combined.length === 0) {
        throw new Error('No audio available for this reciter/surah combination. Try a different reciter.');
      }

      const rangeSlice = combined.slice(startAyah - 1, endAyah);
      setPassageAyahs(rangeSlice);
      setCurrentAyahIndex(0);

      if (rangeSlice.length > 0 && audioRef.current) {
        audioRef.current.src = rangeSlice[0].audio;
        audioRef.current.load();
      }
    } catch (err) {
      setError(err.message || 'Error updating ayah range.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Hadiths from fawazahmed0 hadith-api
  const fetchHadiths = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsPlaying(false);
    setCurrentHadithIndex(0);

    try {
      const num = hadithNumber;
      const frEdition = FRENCH_HADITH_EDITIONS[hadithBook] || `fra-${hadithBook}`;
      const [araRes, engRes, fraRes] = await Promise.all([
        fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-${hadithBook}/${num}.json`),
        fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-${hadithBook}/${num}.json`),
        fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${frEdition}/${num}.json`)
      ]);
      if (!araRes.ok || !engRes.ok) {
        throw new Error(`Hadith ${num} not found in ${hadithBook}.`);
      }
      const araData = await araRes.json();
      const engData = await engRes.json();
      let fraHadith = null;
      if (fraRes.ok) {
        const fraData = await fraRes.json();
        fraHadith = fraData.hadiths?.[0];
      }
      const araHadith = araData.hadiths?.[0];
      const engHadith = engData.hadiths?.[0];
      if (!araHadith || !engHadith) {
        throw new Error(`Hadith ${num} not found.`);
      }
      const result = [{
        number: num,
        text: araHadith.text,
        translationEn: engHadith.text,
        translationFr: fraHadith?.text || '',
        bookName: araData.metadata?.name || hadithBook,
      }];
      setHadithData(result);
      console.log('Loaded hadith:', result[0]);
    } catch (err) {
      console.error('fetchHadiths error:', err);
      setError(err.message || 'Failed to fetch hadith.');
    } finally {
      setLoading(false);
    }
  }, [hadithNumber, hadithBook]);

  // Fetch Duas from islamic.app API (Hisn al-Muslim)
  const fetchDuaCategories = useCallback(async () => {
    try {
      const res = await fetch('https://api.islamic.app/v1/dhikr');
      const json = await res.json();
      if (json.code === 200 && json.data) {
        setDuaCategories(json.data.categories);
      }
    } catch (err) {
      console.error('Failed to fetch dua categories:', err);
    }
  }, []);

  const fetchDuas = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsPlaying(false);
    setCurrentDuaIndex(0);
    try {
      const res = await fetch(`https://api.islamic.app/v1/dhikr/${duaCategory}`);
      const json = await res.json();
      if (json.code !== 200 || !json.data) {
        throw new Error('Failed to fetch duas.');
      }
      const items = json.data.duas.map((d, i) => ({
        text: d.ar?.text || d.ar?.body || '',
        translationEn: d.en?.text || d.en?.body || '',
        transliteration: d.transliteration?.en || '',
        numberInSurah: i + 1,
        number: d.number,
        slug: d.slug,
      }));
      setDuaData(items);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch duas.');
    } finally {
      setLoading(false);
    }
  }, [duaCategory]);

  // Auto-load hadiths when switching to hadith mode
  useEffect(() => {
    if (mode === 'hadith') {
      fetchHadiths();
    }
  }, [mode, fetchHadiths]);

  // Fetch dua categories on mount
  useEffect(() => {
    fetchDuaCategories();
  }, [fetchDuaCategories]);

  // Auto-load duas when switching to dua mode
  useEffect(() => {
    if (mode === 'dua') {
      fetchDuas();
    }
  }, [mode, fetchDuas]);

  // Stop bg audio when switching to Quran mode
  useEffect(() => {
    if (mode === 'quran' && bgAudioRef.current) {
      bgAudioRef.current.pause();
      setBgAudioEnabled(false);
    }
  }, [mode]);

  // Setup Web Audio API on first play
  const initWebAudio = () => {
    if (audioCtxRef.current) return;
    
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      
      // Connect primary audio element
      const primarySource = audioCtx.createMediaElementSource(audioRef.current);
      primarySource.connect(audioCtx.destination);
      primarySource.connect(analyser);
      
      // Connect secondary audio element for seamless ayah transitions
      const secondarySource = audioCtx.createMediaElementSource(nextAudioRef.current);
      secondarySource.connect(audioCtx.destination);
      secondarySource.connect(analyser);
      
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      audioSourceNodeRef.current = primarySource;
      nextAudioSourceNodeRef.current = secondarySource;
      
      // Connect background audio element if available
      if (bgAudioRef.current) {
        const bgSource = audioCtx.createMediaElementSource(bgAudioRef.current);
        const bgGain = audioCtx.createGain();
        bgGain.gain.value = bgAudioVolume / 100;
        bgSource.connect(bgGain);
        bgGain.connect(audioCtx.destination);
        bgAudioSourceNodeRef.current = bgSource;
        bgGainNodeRef.current = bgGain;
      }
    } catch (e) {
      console.warn("Web Audio API not fully initialized (user interaction required or already running)", e);
    }
  };

  const preloadNextAyah = () => {
    const nextIdx = currentAyahIndex + 1;
    if (nextIdx < passageAyahs.length && passageAyahs[nextIdx]?.audio) {
      const idleAudio = getIdleAudio();
      if (idleAudio) {
        idleAudio.src = passageAyahs[nextIdx].audio;
        idleAudio.load();
      }
    }
  };

  // Playback Control
  const togglePlay = async () => {
    if (mode === 'hadith' || mode === 'dua') {
      const data = mode === 'hadith' ? hadithData : duaData;
      if (data.length === 0) return;
      setIsPlaying(!isPlaying);
      return;
    }
    if (passageAyahs.length === 0 || !getAudio()) return;
    
    initWebAudio();
    
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }

    if (isPlaying) {
      const a = getAudio();
      if (a) a.pause();
      setIsPlaying(false);
    } else {
      const ayah = passageAyahs[currentAyahIndex];
      if (!ayah || !ayah.audio) return;
      const a = getAudio();
      if (!a) return;
      if (!a.src || a.src === location.href) {
        a.src = ayah.audio;
        a.load();
      }
      a.play().then(() => {
        setIsPlaying(true);
        preloadNextAyah();
      }).catch(err => {
        console.error("Audio playback error:", err);
      });
    }
  };

  // Handle Audio events
  const handleTimeUpdate = () => {
    const a = getAudio();
    if (a) {
      setCurrentTime(a.currentTime);
    }
  };

  const handleAudioEnded = () => {
    if (mode === 'hadith' || mode === 'dua') return;
    const nextIdx = currentAyahIndex + 1;
    if (nextIdx < passageAyahs.length) {
      // Capture current frame for transition
      if (transitionEffect !== 'none' && canvasRef.current) {
        const w = canvasRef.current.width, h = canvasRef.current.height;
        if (!prevFrameRef.current || prevFrameRef.current.width !== w || prevFrameRef.current.height !== h) {
          prevFrameRef.current = document.createElement('canvas');
          prevFrameRef.current.width = w;
          prevFrameRef.current.height = h;
        }
        prevFrameRef.current.getContext('2d').drawImage(canvasRef.current, 0, 0);
        transitionRef.current = { active: true, startTime: performance.now(), duration: 500, effect: transitionEffect };
      }
      setCurrentAyahIndex(nextIdx);
      // Toggle active audio element
      activeIsPrimaryRef.current = !activeIsPrimaryRef.current;
      const nextA = getAudio();
      if (nextA) {
        nextA.play().then(() => {
          setIsPlaying(true);
          // Preload next ayah into the idle element
          const nextNextIdx = nextIdx + 1;
          if (nextNextIdx < passageAyahs.length && passageAyahs[nextNextIdx]?.audio) {
            const idle = getIdleAudio();
            if (idle) {
              idle.src = passageAyahs[nextNextIdx].audio;
              idle.load();
            }
          }
        }).catch(err => {
          console.error("Audio playback error:", err);
        });
      }
    } else {
      setIsPlaying(false);
      setCurrentAyahIndex(0);
      // Reset: make primary active and preload first ayah
      activeIsPrimaryRef.current = true;
      const a = getAudio();
      if (a && passageAyahs[0]) {
        a.src = passageAyahs[0].audio;
        a.load();
      }
      
      // If we are recording, stop the recording on end
      if (isRecording && recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop();
      }
    }
  };

  // Handle Custom Video File Upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const targetAyah = uploadedForAyahRef.current;
    if (videoMode === 'per-ayah' && targetAyah !== null) {
      setPerAyahVideos(prev => {
        const old = prev[targetAyah];
        if (old) URL.revokeObjectURL(old);
        return { ...prev, [targetAyah]: URL.createObjectURL(file) };
      });
      uploadedForAyahRef.current = null;
    } else {
      if (uploadedBgUrl) URL.revokeObjectURL(uploadedBgUrl);
      setUploadedBgUrl(URL.createObjectURL(file));
    }
  };

  // Handle Background Audio Upload
  const handleBgAudioUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (bgAudioFile && !bgAudioFile.startsWith('https://')) URL.revokeObjectURL(bgAudioFile);
      setBgAudioFile(URL.createObjectURL(file));
      setSelectedBgSound('__custom__');
    }
  };

  // Per-ayah video: swap video source when ayah changes
  useEffect(() => {
    if (videoMode !== 'per-ayah') return;
    if (mode === 'quran') {
      const ayahNum = passageAyahs[currentAyahIndex]?.numberInSurah;
      if (ayahNum && perAyahVideos[ayahNum] && videoRef.current) {
        videoRef.current.src = perAyahVideos[ayahNum];
        videoRef.current.loop = false;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [currentAyahIndex, currentDuaIndex, currentHadithIndex, videoMode, perAyahVideos, mode]);

  const handleSelectBgSound = (id) => {
    setSelectedBgSound(id);
    if (id === 'none') {
      setBgAudioFile(null);
      if (bgAudioRef.current) bgAudioRef.current.pause();
      setBgAudioEnabled(false);
    } else if (id === '__custom__') {
      // file upload handles itself
    } else {
      const preset = ISLAMIC_SOUNDS.find(s => s.id === id);
      if (preset && bgAudioRef.current) {
        setBgAudioFile(preset.url);
        bgAudioRef.current.src = preset.url;
        bgAudioRef.current.loop = true;
        bgAudioRef.current.play().catch(console.error);
        setBgAudioEnabled(true);
      }
    }
  };

  const toggleBgAudio = () => {
    if (!bgAudioRef.current || !bgAudioFile) return;
    if (bgAudioEnabled) {
      bgAudioRef.current.pause();
      setBgAudioEnabled(false);
    } else {
      if (!bgAudioRef.current.src || bgAudioRef.current.src === location.href) {
        bgAudioRef.current.src = bgAudioFile;
      }
      bgAudioRef.current.loop = true;
      bgAudioRef.current.play().catch(console.error);
      setBgAudioEnabled(true);
    }
  };

  // Canvas Drawing animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Instagram Reels 9:16
    canvas.width = 1080;
    canvas.height = 1920;

    let animId;
    let lastTransitionTime = 0;
    const renderLoop = (now) => {
      const rawItem = mode === 'hadith'
        ? hadithData[currentHadithIndex]
        : mode === 'dua'
          ? duaData[currentDuaIndex]
          : passageAyahs[currentAyahIndex];
      const currentItem = rawItem ? {
        ...rawItem,
        translation: translationLang === 'fr'
          ? (rawItem.translationFr || rawItem.translationEn || '')
          : (rawItem.translationEn || rawItem.translationFr || ''),
        transliteration: rawItem.transliteration || ''
      } : null;
      const ayahElapsed = isPlaying ? performance.now() - ayahStartRef.current : 0;
      const activeAudio = getAudio();
      const audioDur = activeAudio?.duration;
      const ayahProgress = isPlaying && audioDur && isFinite(audioDur) && audioDur > 0
        ? Math.min((activeAudio?.currentTime || 0) / audioDur, 1)
        : 1;
      const referenceText = mode === 'hadith' && currentItem
        ? `${currentItem.bookName}, Hadith ${currentItem.number}`
        : mode === 'dua' && currentItem
          ? `${DUA_SHORTCUTS.find(s => s.id === duaCategory)?.name || 'Dua'} #${currentItem.number}`
          : undefined;
      drawFrame({
        ctx,
        canvas,
        videoElement: videoRef.current,
        audioAnalyser: analyserRef.current,
        currentAyah: currentItem,
        config: {
          fontSize,
          translationFontSize,
          textPosition,
          vignetteOpacity,
          fontFamily,
          showTranslation,
          translationLang,
          showTransliteration,
          watermark,
          visualizerStyle,
          visualizerColor,
          colorEffect,
          surahName: selectedSurahDetails?.englishName,
          surahNumber: surahNum,
          backgroundType,
          referenceText,
          wordGroupSize,
          textEffect,
          ayahProgress,
        },
        isPlaying,
        currentTime
      });

      // Apply transition post-processing
      const tr = transitionRef.current;
      if (tr.active && prevFrameRef.current) {
        const elapsed = now - tr.startTime;
        const progress = Math.min(elapsed / tr.duration, 1);
        applyTransition(ctx, canvas, prevFrameRef.current, progress, tr.effect);
        if (progress >= 1) {
          tr.active = false;
          prevFrameRef.current = null;
        }
      }

      animId = requestAnimationFrame(renderLoop);
    };

    renderLoop(performance.now());

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [
    mode,
    passageAyahs, 
    currentAyahIndex, 
    hadithData,
    currentHadithIndex,
    duaData,
    currentDuaIndex,
    duaCategory,
    isPlaying, 
    fontSize, 
    translationFontSize, 
    textPosition, 
    vignetteOpacity, 
    fontFamily, 
    showTranslation, 
    translationLang,
    showTransliteration,
    watermark, 
    visualizerStyle, 
    visualizerColor, 
    colorEffect,
    selectedSurahDetails, 
    surahNum,
    currentTime,
    wordGroupSize,
    textEffect,
  ]);

  // Export / Record video logic
  const handleExportVideo = async () => {
    if (mode === 'hadith' || mode === 'dua') {
      if (mode === 'hadith') await handleExportHadith();
      else await handleExportDua();
      return;
    }
    if (passageAyahs.length === 0) return;
    
    // Stop any current playback
    setIsPlaying(false);
    const currAudio = getAudio();
    if (currAudio) currAudio.pause();

    setIsRecording(true);
    setRecordingProgress(5);
    setRecordingStatus(T('status.initMedia'));

    try {
      // Reset to primary audio element
      activeIsPrimaryRef.current = true;
      setCurrentAyahIndex(0);
      if (!audioRef.current) throw new Error('Audio element not available.');
      audioRef.current.src = passageAyahs[0].audio;

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Audio load timed out.')), 15000);
        audioRef.current.oncanplaythrough = () => {
          clearTimeout(timeout);
          audioRef.current.oncanplaythrough = null;
          resolve();
        };
        audioRef.current.load();
      });

      // Preload second ayah into secondary element
      if (passageAyahs[1]?.audio && nextAudioRef.current) {
        nextAudioRef.current.src = passageAyahs[1].audio;
        nextAudioRef.current.load();
      }

      // 2. Setup Web Audio routing for recording
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      let audioCtx;
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtx = audioCtxRef.current;
      } else {
        audioCtx = new AudioContextClass();
        audioCtxRef.current = audioCtx;
      }
      if (audioCtx.state === 'suspended') await audioCtx.resume();

      // Helper to connect an audio element to the Web Audio pipeline for recording
      const connectAudioForRecording = (el, sourceNodeRef) => {
        let source;
        if (!sourceNodeRef.current) {
          source = audioCtx.createMediaElementSource(el);
          sourceNodeRef.current = source;
        } else {
          source = sourceNodeRef.current;
          source.disconnect();
        }
        return source;
      };

      // Connect primary audio element
      const primarySource = connectAudioForRecording(audioRef.current, audioSourceNodeRef);
      // Connect secondary audio element (for seamless ayah transitions)
      const secondarySource = connectAudioForRecording(nextAudioRef.current, nextAudioSourceNodeRef);

      // Disconnect analyser from previous setup
      if (analyserRef.current) analyserRef.current.disconnect();

      // Create destination node for capturing audio
      const destNode = audioCtx.createMediaStreamDestination();

      // Setup analyser for visualizer
      if (!analyserRef.current) {
        analyserRef.current = audioCtx.createAnalyser();
        analyserRef.current.fftSize = 256;
      }

      // Route both sources: -> destNode (recording), -> speakers, -> analyser (visualizer)
      primarySource.connect(destNode);
      primarySource.connect(audioCtx.destination);
      primarySource.connect(analyserRef.current);
      
      secondarySource.connect(destNode);
      secondarySource.connect(audioCtx.destination);
      secondarySource.connect(analyserRef.current);

      // Connect background audio if available
      if (bgAudioFile && bgAudioRef.current) {
        let bgSource;
        if (!bgAudioSourceNodeRef.current) {
          bgSource = audioCtx.createMediaElementSource(bgAudioRef.current);
          bgAudioSourceNodeRef.current = bgSource;
        } else {
          bgSource = bgAudioSourceNodeRef.current;
          bgSource.disconnect();
        }
        const bgGain = audioCtx.createGain();
        bgGain.gain.value = bgAudioVolume / 100;
        bgSource.connect(bgGain);
        bgGain.connect(destNode);
        bgGainNodeRef.current = bgGain;
        if (bgAudioRef.current.paused) {
          bgAudioRef.current.loop = true;
          bgAudioRef.current.play().catch(console.error);
        }
      }

      // 3. Capture canvas video + audio from destination node
      const canvasStream = canvasRef.current.captureStream(30);
      const videoTrack = canvasStream.getVideoTracks()[0];
      const audioTrack = destNode.stream.getAudioTracks()[0];

      if (!videoTrack) throw new Error('Failed to capture canvas video track.');
      if (!audioTrack) throw new Error('Failed to capture audio track.');

      const combinedTracks = [videoTrack, audioTrack];
      const recorderStream = new MediaStream(combinedTracks);

      // 4. Set up MediaRecorder options (try MP4 first, fall back to webm)
      let options;
      if (MediaRecorder.isTypeSupported('video/mp4;codecs=h264,aac')) {
        options = { mimeType: 'video/mp4;codecs=h264,aac' };
      } else if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E,mp4a.40.2')) {
        options = { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2' };
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        options = { mimeType: 'video/mp4' };
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        options = { mimeType: 'video/webm;codecs=vp9,opus' };
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        options = { mimeType: 'video/webm;codecs=vp8,opus' };
      } else {
        options = { mimeType: 'video/webm' };
      }

      // 5. Start recording
      const chunks = [];
      recorderRef.current = new MediaRecorder(recorderStream, options);

      recorderRef.current.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorderRef.current.onstop = () => {
        setRecordingStatus(T('status.compiling'));
        setRecordingProgress(95);

        const blob = new Blob(chunks, { type: options.mimeType });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        const surahClean = selectedSurahDetails?.englishName.replace(/\s+/g, '_') || 'Surah';
        const extension = options.mimeType.includes('mp4') ? 'mp4' : 'webm';
        a.download = `QuranReel_${surahClean}_Ayah_${startAyah}-${endAyah}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => {
          setIsRecording(false);
          setRecordingProgress(0);
          setRecordingStatus('');
        }, 1500);
      };

      recorderRef.current.start();

      // 6. Begin playback
      const activeA = getAudio();
      if (activeA) await activeA.play();
      setIsPlaying(true);
      setRecordingProgress(10);
      setRecordingStatus(T('status.recordingAyah', { n: startAyah, total: endAyah }));

    } catch (err) {
      console.error(err);
      setError(`Recording failed: ${err.message}`);
      setIsRecording(false);
      setRecordingProgress(0);
    }
  };

  // Export Hadith reel (silent video, no audio)
  const handleExportHadith = async () => {
    if (hadithData.length === 0) return;

    setIsPlaying(false);
    setIsRecording(true);
    setRecordingProgress(5);
    setRecordingStatus(T('status.initHadith'));

    try {
      setCurrentHadithIndex(0);

      // Setup Web Audio for background audio capture (same approach as Quran export)
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      let audioCtx;
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtx = audioCtxRef.current;
        if (audioCtx.state === 'suspended') await audioCtx.resume();
      } else {
        audioCtx = new AudioContextClass();
        audioCtxRef.current = audioCtx;
      }

      const destNode = audioCtx.createMediaStreamDestination();

      let hasBgAudio = false;
      if (bgAudioFile && bgAudioRef.current) {
        // Set source and start playing
        bgAudioRef.current.src = bgAudioFile;
        bgAudioRef.current.loop = true;
        await bgAudioRef.current.play();

        // Connect bg audio to Web Audio pipeline
        if (bgAudioSourceNodeRef.current) {
          bgAudioSourceNodeRef.current.disconnect();
        } else {
          const src = audioCtx.createMediaElementSource(bgAudioRef.current);
          bgAudioSourceNodeRef.current = src;
        }
        const bgGain = audioCtx.createGain();
        bgGain.gain.value = bgAudioVolume / 100;
        bgAudioSourceNodeRef.current.connect(bgGain);
        bgGain.connect(destNode);
        bgGainNodeRef.current = bgGain;

        const audioTrack = destNode.stream.getAudioTracks()[0];
        if (audioTrack) hasBgAudio = true;
      }

      // Capture canvas video
      const canvasStream = canvasRef.current.captureStream(30);
      const videoTrack = canvasStream.getVideoTracks()[0];
      if (!videoTrack) throw new Error('Failed to capture canvas video track.');

      const tracks = [videoTrack];
      if (hasBgAudio) {
        const audioTrack = destNode.stream.getAudioTracks()[0];
        if (audioTrack) tracks.push(audioTrack);
      }
      const recorderStream = new MediaStream(tracks);

      // Set up MediaRecorder
      let options;
      if (MediaRecorder.isTypeSupported('video/mp4;codecs=h264,aac')) {
        options = { mimeType: 'video/mp4;codecs=h264,aac' };
      } else if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E,mp4a.40.2')) {
        options = { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2' };
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        options = { mimeType: 'video/mp4' };
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        options = { mimeType: 'video/webm;codecs=vp9,opus' };
      } else {
        options = { mimeType: 'video/webm' };
      }

      const chunks = [];
      recorderRef.current = new MediaRecorder(recorderStream, options);

      recorderRef.current.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorderRef.current.onstop = () => {
        setRecordingStatus(T('status.compiling'));
        setRecordingProgress(95);

        const blob = new Blob(chunks, { type: options.mimeType });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        const bookName = HADITH_BOOKS.find(b => b.id === hadithBook)?.name || 'Hadith';
        const extension = options.mimeType.includes('mp4') ? 'mp4' : 'webm';
        a.download = `HadithReel_${bookName}_${hadithNumber}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => {
          setIsRecording(false);
          setRecordingProgress(0);
          setRecordingStatus('');
        }, 1500);
      };

      recorderRef.current.start();

      // Auto-advance through hadiths every 10 seconds
      setIsPlaying(true);
      setRecordingStatus(T('status.recordingHadith', { n: 1, total: hadithData.length }));
      setRecordingProgress(10);

      for (let i = 0; i < hadithData.length; i++) {
        setCurrentHadithIndex(i);
        setRecordingStatus(T('status.recordingHadith', { n: i + 1, total: hadithData.length }));
        setRecordingProgress(Math.round(((i + 1) / hadithData.length) * 80 + 10));

        const secondsPerHadith = itemDuration;
        if (i === hadithData.length - 1) {
          // Last hadith: wait then stop
          await new Promise(resolve => setTimeout(resolve, secondsPerHadith * 1000));
        } else {
          await new Promise(resolve => setTimeout(resolve, secondsPerHadith * 1000));
        }
      }

      setIsPlaying(false);
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop();
      }
      if (bgAudioRef.current) bgAudioRef.current.pause();
    } catch (err) {
      console.error(err);
      setError(`Recording failed: ${err.message}`);
      setIsRecording(false);
      setRecordingProgress(0);
    }
  };

  // Export Dua reel (silent video, no audio — same pattern as hadith)
  const handleExportDua = async () => {
    if (duaData.length === 0) return;

    setIsPlaying(false);
    setIsRecording(true);
    setRecordingProgress(5);
    setRecordingStatus(T('status.initDua'));

    try {
      setCurrentDuaIndex(0);

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      let audioCtx;
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtx = audioCtxRef.current;
        if (audioCtx.state === 'suspended') await audioCtx.resume();
      } else {
        audioCtx = new AudioContextClass();
        audioCtxRef.current = audioCtx;
      }

      const destNode = audioCtx.createMediaStreamDestination();
      let hasBgAudio = false;
      if (bgAudioFile && bgAudioRef.current) {
        bgAudioRef.current.src = bgAudioFile;
        bgAudioRef.current.loop = true;
        await bgAudioRef.current.play();

        if (bgAudioSourceNodeRef.current) {
          bgAudioSourceNodeRef.current.disconnect();
        } else {
          const src = audioCtx.createMediaElementSource(bgAudioRef.current);
          bgAudioSourceNodeRef.current = src;
        }
        const bgGain = audioCtx.createGain();
        bgGain.gain.value = bgAudioVolume / 100;
        bgAudioSourceNodeRef.current.connect(bgGain);
        bgGain.connect(destNode);
        bgGainNodeRef.current = bgGain;

        const audioTrack = destNode.stream.getAudioTracks()[0];
        if (audioTrack) hasBgAudio = true;
      }

      const canvasStream = canvasRef.current.captureStream(30);
      const videoTrack = canvasStream.getVideoTracks()[0];
      if (!videoTrack) throw new Error('Failed to capture canvas video track.');

      const tracks = [videoTrack];
      if (hasBgAudio) {
        const audioTrack = destNode.stream.getAudioTracks()[0];
        if (audioTrack) tracks.push(audioTrack);
      }
      const recorderStream = new MediaStream(tracks);

      let options;
      if (MediaRecorder.isTypeSupported('video/mp4;codecs=h264,aac')) {
        options = { mimeType: 'video/mp4;codecs=h264,aac' };
      } else if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E,mp4a.40.2')) {
        options = { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2' };
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        options = { mimeType: 'video/mp4' };
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        options = { mimeType: 'video/webm;codecs=vp9,opus' };
      } else {
        options = { mimeType: 'video/webm' };
      }

      const chunks = [];
      recorderRef.current = new MediaRecorder(recorderStream, options);

      recorderRef.current.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorderRef.current.onstop = () => {
        setRecordingStatus(T('status.compiling'));
        setRecordingProgress(95);

        const blob = new Blob(chunks, { type: options.mimeType });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        const categoryName = DUA_SHORTCUTS.find(s => s.id === duaCategory)?.name || 'Dua';
        const duaNum = duaData[currentDuaIndex]?.number || (currentDuaIndex + 1);
        const extension = options.mimeType.includes('mp4') ? 'mp4' : 'webm';
        a.download = `DuaReel_${categoryName}_${duaNum}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => {
          setIsRecording(false);
          setRecordingProgress(0);
          setRecordingStatus('');
        }, 1500);
      };

      recorderRef.current.start();

      setIsPlaying(true);
      setRecordingStatus(T('status.recordingDua', { n: 1, total: 1 }));
      setRecordingProgress(10);

      await new Promise(resolve => setTimeout(resolve, itemDuration * 1000));

      setIsPlaying(false);
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop();
      }
      if (bgAudioRef.current) bgAudioRef.current.pause();
    } catch (err) {
      console.error(err);
      setError(`Recording failed: ${err.message}`);
      setIsRecording(false);
      setRecordingProgress(0);
    }
  };

  // Stop recording early and finalize the video with captured chunks
  const stopRecording = () => {
    if (audioRef.current) audioRef.current.pause();
    if (nextAudioRef.current) nextAudioRef.current.pause();
    if (bgAudioRef.current) bgAudioRef.current.pause();
    setIsPlaying(false);
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
  };

  // Monitor ayah index to update recording progress messages
  const prevAyahIndexRef = useRef(-1);
  useEffect(() => {
    if (isRecording && passageAyahs.length > 0 && currentAyahIndex !== prevAyahIndexRef.current) {
      prevAyahIndexRef.current = currentAyahIndex;
      setRecordingStatus(T('status.recordingAyah', { n: startAyah + currentAyahIndex, total: endAyah }));
      setRecordingProgress(Math.round((currentAyahIndex / passageAyahs.length) * 80 + 10));
    }
  }, [currentAyahIndex, isRecording, passageAyahs.length, startAyah, endAyah]);

  // Visual style JSX (used in right sidebar on desktop, and in left sidebar on mobile)
  const visualStyleContent = (
    <>
      <h2 className="section-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          <path d="M2 12h20"/>
        </svg>
        {T('style.visualStyle')}
      </h2>

      <div className="form-group">
        <label>{T('style.arabicFont')}</label>
        <select 
          value={fontFamily} 
          onChange={(e) => setFontFamily(e.target.value)}
          disabled={isRecording}
        >
          <option value="amiri">Amiri</option>
          <option value="scheherazade">Scheherazade New</option>
          <option value="noto-naskh">Noto Naskh Arabic</option>
          <option value="lateef">Lateef</option>
          <option value="reem-kufi">Reem Kufi</option>
          <option value="cairo">Cairo</option>
          <option value="tajawal">Tajawal</option>
          <option value="markazi">Markazi Text</option>
          <option value="el-messiri">El Messiri</option>
          <option value="lemonada">Lemonada</option>
          <option value="changa">Changa</option>
          <option value="harmattan">Harmattan</option>
          <option value="katibeh">Katibeh</option>
          <option value="mada">Mada</option>
          <option value="mirza">Mirza</option>
          <option value="rakkas">Rakkas</option>
          <option value="almarai">Almarai</option>
          <option value="aref-ruqaa">Aref Ruqaa</option>
          <option value="ibm-plex-sans-arabic">IBM Plex Sans Arabic</option>
          <option value="jomhuria">Jomhuria</option>
          <option value="kufam">Kufam</option>
          <option value="lalezar">Lalezar</option>
          <option value="noto-kufi-arabic">Noto Kufi Arabic</option>
          <option value="noto-sans-arabic">Noto Sans Arabic</option>
          <option value="qahiri">Qahiri</option>
          <option value="ruwudu">Ruwudu</option>
          <option value="reem-kufi-fun">Reem Kufi Fun</option>
          <option value="reem-kufi-ink">Reem Kufi Ink</option>
          <option value="cairo-play">Cairo Play</option>
          <option value="amiri-quran">Amiri Quran</option>
          <option value="bidaya">Bidaya</option>
          <option value="thabit">Thabit</option>
          <option value="traditional-arabic">Traditional Arabic</option>
          <option value="arabic-typesetting">Arabic Typesetting</option>
          <option value="sakkal-majalla">Sakkal Majalla</option>
          <option value="simplified-arabic">Simplified Arabic</option>
          <option value="diwani-letter">Diwani Letter</option>
          <option value="andalus">Andalus</option>
          <option value="tahoma">Tahoma</option>
          <option value="arial">Arial</option>
          <option value="times-new-roman">Times New Roman</option>
          <option value="courier-new">Courier New</option>
          <option value="uthmanic-hafs">Uthmanic Hafs</option>
          <option value="decotype-naskh">DecoType Naskh</option>
          <option value="decotype-thuluth">DecoType Thuluth</option>
          <option value="decotype-kufi">DecoType Kufi</option>
          <option value="kacst-book">KacstBook</option>
          <option value="kacst-letter">KacstLetter</option>
          <option value="hacen-sudan">Hacen Sudan</option>
          <option value="hacen-tunisia">Hacen Tunisia</option>
        </select>
      </div>

      <div className="form-group">
        <label>{T('style.arabicFontSize')}</label>
        <div className="slider-group">
          <input 
            type="range" 
            min="30" 
            max="80" 
            value={fontSize} 
            onChange={(e) => setFontSize(parseInt(e.target.value))}
            disabled={isRecording}
          />
          <span>{fontSize}px</span>
        </div>
      </div>

      <div className="form-group">
        <label className="checkbox-group">
          <input 
            type="checkbox" 
            checked={showTranslation} 
            onChange={(e) => setShowTranslation(e.target.checked)}
            disabled={isRecording}
          />
          <div className="checkmark"></div>
          <span>{T('style.showTranslation')}</span>
        </label>
      </div>

      {showTranslation && (
        <div className="form-group">
          <label>{T('style.translationFontSize')}</label>
          <div className="slider-group">
            <input 
              type="range" 
              min="18" 
              max="40" 
              value={translationFontSize} 
              onChange={(e) => setTranslationFontSize(parseInt(e.target.value))}
              disabled={isRecording}
            />
            <span>{translationFontSize}px</span>
          </div>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="textPosition">{T('style.textAlignment')}</label>
        <select 
          id="textPosition" 
          value={textPosition} 
          onChange={(e) => setTextPosition(e.target.value)}
          disabled={isRecording}
        >
          <option value="top">{T('style.alignTop')}</option>
          <option value="center">{T('style.alignCenter')}</option>
          <option value="bottom">{T('style.alignBottom')}</option>
        </select>
      </div>

      <div className="form-group">
        <label>{T('style.vignette')}</label>
        <div className="slider-group">
          <input 
            type="range" 
            min="0" 
            max="0.9" 
            step="0.05"
            value={vignetteOpacity} 
            onChange={(e) => setVignetteOpacity(parseFloat(e.target.value))}
            disabled={isRecording}
          />
          <span>{Math.round(vignetteOpacity * 100)}%</span>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="watermark">{T('style.watermark')}</label>
        <input 
          type="text" 
          id="watermark" 
          value={watermark} 
          onChange={(e) => setWatermark(e.target.value.toUpperCase())}
          placeholder={T('style.watermarkPlaceholder')}
          maxLength="20"
          disabled={isRecording}
        />
      </div>

      <div className="form-group">
        <label htmlFor="visStyle">{T('style.visualizer')}</label>
        <select 
          id="visStyle" 
          value={visualizerStyle} 
          onChange={(e) => setVisualizerStyle(e.target.value)}
          disabled={isRecording}
        >
          <option value="bars">{T('style.visBars')}</option>
          <option value="waves">{T('style.visWaves')}</option>
          <option value="none">{T('style.visDisabled')}</option>
        </select>
      </div>

      {visualizerStyle !== 'none' && (
        <div className="form-group">
          <label htmlFor="visColor">{T('style.visColor')}</label>
          <select 
            id="visColor" 
            value={visualizerColor} 
            onChange={(e) => setVisualizerColor(e.target.value)}
            disabled={isRecording}
          >
            <option value="#60a5fa">{T('style.colorBlue')}</option>
            <option value="#34d399">{T('style.colorGreen')}</option>
            <option value="#fbbf24">{T('style.colorGold')}</option>
            <option value="#f472b6">{T('style.colorPink')}</option>
            <option value="#ffffff">{T('style.colorWhite')}</option>
          </select>
        </div>
      )}

    </>
  );

  return (
    <div className="app-container" data-theme={theme}>
      <div className="bg-grid"></div>
      <div className="bg-orb bg-orb-1"></div>
      <div className="bg-orb bg-orb-2"></div>
      <div className="bg-orb bg-orb-3"></div>
      <div className="bg-orb bg-orb-4"></div>
      <div className="bg-orb bg-orb-5"></div>
      <div className="bg-particle bg-p1"></div>
      <div className="bg-particle bg-p2"></div>
      <div className="bg-particle bg-p3"></div>
      <div className="bg-particle bg-p4"></div>
      <div className="bg-particle bg-p5"></div>
      <div className="bg-particle bg-p6"></div>
      <div className="bg-particle bg-p7"></div>
      <div className="bg-particle bg-p8"></div>
      <div className="bg-particle bg-p9"></div>
      <div className="bg-particle bg-p10"></div>
      {/* Header */}
      <header className="app-header">
        <div className="logo-section">
          <h1>
            <img src="/Quran.svg" alt="Quran" style={{height: 100, width: 'auto'}} />
          </h1>
          <button className="theme-toggle" onClick={toggleTheme} title={T('header.toggleTheme')}>
            {theme === 'dark' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
        </div>
      </header>

      <main className="main-content">

        {/* Left Config Panel */}
        <section className="sidebar glass-panel anim-fade-in-left anim-delay-1">
          <div className="mobile-tabs">
            <button 
              className={`tab-btn ${mobileSection === 'passage' ? 'active' : ''}`}
              onClick={() => setMobileSection('passage')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              {T('mobile.settings')}
            </button>
            <button 
              className={`tab-btn ${mobileSection === 'style' ? 'active' : ''}`}
              onClick={() => setMobileSection('style')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                <path d="M2 12h20"/>
              </svg>
              {T('mobile.style')}
            </button>
          </div>

          <div className={`desktop-content ${mobileSection !== 'passage' ? 'mobile-hidden' : ''}`}>
          <h2 className="section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            {T('mode.contentSettings')}
          </h2>

          <div className="form-group mode-toggle">
            <label>{T('mode.contentType')}</label>
            <div className="btn-group">
              <button 
                className={`btn-sm ${mode === 'quran' ? 'btn-active' : ''}`}
                onClick={() => setMode('quran')}
                disabled={isRecording}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M20 2H6.5a2.5 2.5 0 0 0 0 5H20v14H6.5A2.5 2.5 0 0 1 4 18.5V4"/>
                </svg>
                {T('mode.quran')}
              </button>
              <button 
                className={`btn-sm ${mode === 'hadith' ? 'btn-active' : ''}`}
                onClick={() => setMode('hadith')}
                disabled={isRecording}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                {T('mode.hadith')}
              </button>
              <button 
                className={`btn-sm ${mode === 'dua' ? 'btn-active' : ''}`}
                onClick={() => setMode('dua')}
                disabled={isRecording}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"/>
                  <path d="M9 10a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4z"/>
                  <path d="M12 7v2M12 15v2"/>
                </svg>
                {T('mode.dua')}
              </button>
            </div>
          </div>

          {mode === 'quran' ? (
            <>
            <div className="form-group">
              <label htmlFor="reciter">{T('quran.reciter')}</label>
              <select 
                id="reciter" 
                value={reciterId} 
                onChange={(e) => setReciterId(e.target.value)}
                disabled={isRecording}
              >
                {RECITERS.map(reciter => (
                  <option key={reciter.id} value={reciter.id}>
                    {reciter.name} ({reciter.style})
                  </option>
                ))}
        </select>
      </div>

      <div className="form-group">
        <label>Word Group</label>
        <select value={wordGroupSize} onChange={(e) => setWordGroupSize(e.target.value)} disabled={isRecording || mode !== 'quran'}>
          <option value="all">All words</option>
          <option value="2">2 words at a time</option>
          <option value="3">3 words at a time</option>
        </select>
      </div>

      <div className="form-group">
        <label>Text Effect</label>
        <select value={textEffect} onChange={(e) => setTextEffect(e.target.value)} disabled={isRecording}>
          <option value="none">None</option>
          <option value="typewriter">Typewriter</option>
          <option value="reveal">Word Reveal</option>
          <option value="fade">Fade In</option>
          <option value="slide-up">Slide Up</option>
          <option value="scale">Scale In</option>
          <option value="glow">Glow</option>
          <option value="gradient">Gradient</option>
          <option value="shimmer">Shimmer</option>
          <option value="blur">Blur In</option>
        </select>
      </div>

      <div className="form-group">
              <label htmlFor="surah">{T('quran.surah')}</label>
              <select 
                id="surah" 
                value={surahNum} 
                onChange={(e) => {
                  const newSurah = parseInt(e.target.value);
                  setSurahNum(newSurah);
                  const details = surahs.find(s => s.number === newSurah);
                  if (details) {
                    setStartAyah(1);
                    setStartInput('1');
                    const newEnd = Math.min(7, details.numberOfAyahs);
                    setEndAyah(newEnd);
                    setEndInput(String(newEnd));
                  }
                }}
                disabled={isRecording}
              >
                {surahs.map(s => (
                  <option key={s.number} value={s.number}>
                    {s.number}. {s.englishName} ({s.name})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="startAyah">{T('quran.startAyah')}</label>
                <input 
                  type="number" 
                  id="startAyah"
                  min="1" 
                  max={selectedSurahDetails?.numberOfAyahs || 7} 
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  onBlur={() => {
                    const maxAyahs = selectedSurahDetails?.numberOfAyahs || 7;
                    const val = Math.min(Math.max(1, parseInt(startInput) || 1), maxAyahs);
                    setStartAyah(val);
                    setStartInput(String(val));
                    if (val > endAyah) {
                      setEndAyah(val);
                      setEndInput(String(val));
                    }
                  }}
                  disabled={isRecording}
                />
              </div>
              <div className="form-group">
                <label htmlFor="endAyah">{T('quran.endAyah')}</label>
                <input 
                  type="number" 
                  id="endAyah"
                  min={startAyah} 
                  max={selectedSurahDetails?.numberOfAyahs || 7} 
                  value={endInput}
                  onChange={(e) => setEndInput(e.target.value)}
                  onBlur={() => {
                    const maxAyahs = selectedSurahDetails?.numberOfAyahs || 7;
                    const val = Math.max(startAyah, Math.min(maxAyahs, parseInt(endInput) || 1));
                    setEndAyah(val);
                    setEndInput(String(val));
                  }}
                  disabled={isRecording}
                />
              </div>
            </div>

            <button 
              className="btn-ghost" 
              onClick={applyLocalRangeChange} 
              disabled={loading || isRecording}
            >
              {T('quran.applyRange')}
            </button>
            </>
          ) : mode === 'hadith' ? (
            <>
            <div className="form-group">
              <label htmlFor="hadithBook">{T('hadith.book')}</label>
              <select 
                id="hadithBook" 
                value={hadithBook} 
                onChange={(e) => setHadithBook(e.target.value)}
                disabled={isRecording}
              >
                {HADITH_BOOKS.map(book => (
                  <option key={book.id} value={book.id}>
                    {book.name} ({book.arabic})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="hadithNumber">{T('hadith.number')}</label>
                <input 
                  type="number" 
                  id="hadithNumber"
                  min="1" 
                  value={hadithNumber}
                  onChange={(e) => setHadithNumber(parseInt(e.target.value) || 1)}
                  disabled={isRecording}
                />
              </div>
            </div>

            <button 
              className="btn-ghost" 
              onClick={fetchHadiths} 
              disabled={loading || isRecording}
            >
              {T('hadith.load')}
            </button>

            <div className="form-group">
              <label>{T('export.duration')}: {itemDuration}s</label>
              <div className="slider-group">
                <input 
                  type="range" 
                  min="3" 
                  max="30" 
                  value={itemDuration} 
                  onChange={(e) => setItemDuration(parseInt(e.target.value))}
                  disabled={isRecording}
                />
                <span>{itemDuration}s</span>
              </div>
            </div>
            </>
          ) : (
            <>
            <div className="form-group">
              <label htmlFor="duaCategory">{T('dua.category')}</label>
              <select 
                id="duaCategory" 
                value={duaCategory} 
                onChange={(e) => setDuaCategory(e.target.value)}
                disabled={isRecording}
              >
                {DUA_SHORTCUTS.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.arabic})
                  </option>
                ))}
              </select>
            </div>

            {duaData.length > 0 && (
            <div className="form-group">
              <label>{T('dua.choose')}</label>
              <select
                value={currentDuaIndex}
                onChange={(e) => setCurrentDuaIndex(parseInt(e.target.value))}
                disabled={isRecording}
              >
                {duaData.map((d, i) => (
                  <option key={i} value={i}>
                    {T('dua.prefix')} #{d.number} ({i + 1}/{duaData.length})
                  </option>
                ))}
              </select>
        </div>
      )}

            <div className="form-group">
              <label>{T('export.duration')}: {itemDuration}s</label>
              <div className="slider-group">
                <input 
                  type="range" 
                  min="3" 
                  max="30" 
                  value={itemDuration} 
                  onChange={(e) => setItemDuration(parseInt(e.target.value))}
                  disabled={isRecording}
                />
                <span>{itemDuration}s</span>
              </div>
            </div>
            </>
          )}


          <hr />

          <h2 className="section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            {T('bg.video')}
          </h2>

          {mode === 'quran' && (
          <div className="form-group mode-toggle">
            <label>{T('bg.videoMode')}</label>
            <div className="btn-group">
              <button
                className={`btn-sm ${videoMode === 'single' ? 'btn-active' : ''}`}
                onClick={() => setVideoMode('single')}
                disabled={isRecording}
              >
                {T('bg.single')}
              </button>
              {mode === 'quran' && (
              <button
                className={`btn-sm ${videoMode === 'per-ayah' ? 'btn-active' : ''}`}
                onClick={() => setVideoMode('per-ayah')}
                disabled={isRecording}
              >
                {T('bg.perAyah')}
              </button>
              )}
            </div>
          </div>
          )}

          {videoMode === 'single' ? (
          <div className="file-upload">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
            <span>{uploadedBgUrl ? T('bg.uploaded') : T('bg.upload')}</span>
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="video/*" 
              onChange={handleFileUpload} 
              disabled={isRecording}
            />
          </div>
          ) : (
          <div className="per-ayah-videos">
            {passageAyahs.map((a, i) => {
              const ayahNum = a.numberInSurah;
              const hasVideo = !!perAyahVideos[ayahNum];
              return (
                <div key={ayahNum} className={`ayah-video-item ${hasVideo ? 'uploaded' : ''}`}>
                  <span className="ayah-label">{mode === 'quran' ? `Ayah ${ayahNum}` : mode === 'hadith' ? `#${a.number || (a.numberInSurah || i + 1)}` : `${T('dua.prefix')} #${a.number || (a.numberInSurah || i + 1)}`}</span>
                  <button
                    className="btn-ghost btn-xs"
                    onClick={() => {
                      uploadedForAyahRef.current = ayahNum;
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'video/*';
                      input.onchange = handleFileUpload;
                      input.click();
                    }}
                    disabled={isRecording}
                  >
                    {hasVideo ? '✓' : '+'}
                  </button>
                </div>
              );
            })}
          </div>
          )}

          {videoMode === 'per-ayah' && (
          <div className="form-group">
            <label htmlFor="transitionEffect">{T('bg.transition')}</label>
            <select 
              id="transitionEffect" 
              value={transitionEffect} 
              onChange={(e) => setTransitionEffect(e.target.value)}
              disabled={isRecording}
            >
              {TRANSITIONS.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          )}

          <div className="form-group">
            <label htmlFor="colorEffect">{T('bg.colorEffect')}</label>
            <select 
              id="colorEffect" 
              value={colorEffect} 
              onChange={(e) => setColorEffect(e.target.value)}
              disabled={isRecording}
            >
              {COLOR_EFFECTS.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          {mode !== 'quran' && (<>
          <hr />

          <h2 className="section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
            {T('audio.title')}
          </h2>

          <div className="form-group">
            <label>{T('audio.chooseSound')}</label>
            <select
              value={selectedBgSound}
              onChange={(e) => handleSelectBgSound(e.target.value)}
              disabled={isRecording}
            >
              <optgroup label="🎵 Islamic Nasheeds & Ambience (30)">
                {ISLAMIC_SOUNDS.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
              <option value="__custom__">{T('audio.uploadCustom')}</option>
            </select>
          </div>

          {selectedBgSound === '__custom__' && (
            <div className="file-upload">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13"/>
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="16" r="3"/>
              </svg>
              <span>{bgAudioFile && selectedBgSound === '__custom__' ? T('audio.uploaded') : T('audio.upload')}</span>
              <input 
                type="file" 
                accept="audio/*" 
                onChange={handleBgAudioUpload} 
                disabled={isRecording}
              />
            </div>
          )}

          {bgAudioFile && selectedBgSound !== 'none' && (
            <div className="bg-audio-player">
              <div className="bg-audio-info">
                <span className="bg-audio-label">
                  {selectedBgSound === '__custom__' ? T('audio.customLabel') : ISLAMIC_SOUNDS.find(s => s.id === selectedBgSound)?.name || T('audio.title')}
                </span>
              </div>
              <div className="bg-audio-controls">
                <button className={`btn-circle-sm ${bgAudioEnabled ? 'active' : ''}`} onClick={toggleBgAudio} title={bgAudioEnabled ? T('audio.pause') : T('audio.play')}>
                  {bgAudioEnabled ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" rx="1"/>
                      <rect x="14" y="4" width="4" height="16" rx="1"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="8 4 20 12 8 20 8 4"/>
                    </svg>
                  )}
                </button>
                <input
                  type="range" min="0" max="100" value={bgAudioVolume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setBgAudioVolume(v);
                    if (bgGainNodeRef.current) bgGainNodeRef.current.gain.value = v / 100;
                  }}
                />
              </div>
            </div>
          )}
          </>)}

          <button 
            className="btn-generate" 
            onClick={handleExportVideo} 
            disabled={loading || isRecording || (mode === 'quran' ? passageAyahs.length === 0 : mode === 'hadith' ? hadithData.length === 0 : duaData.length === 0)}
          >
            {isRecording ? (
              <>
                <span className="pulse-icon"></span>
                {T('export.exporting')}
              </>
            ) : (
              <>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
                {T('export.generate')}
              </>
            )}
          </button>

          {isRecording && (
            <div className="status-card recording">
              <strong>{recordingStatus}</strong>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill" 
                  style={{width: `${recordingProgress}%`}}
                ></div>
              </div>
              <button 
                className="btn-stop"
                onClick={stopRecording}
              >
                {T('export.stop')}
              </button>
            </div>
          )}

          {error && (
            <div className="status-card" style={{borderLeftColor: 'var(--danger)', color: 'var(--danger)'}}>
              <strong>{T('export.error')}</strong> {error}
            </div>
          )}
          </div>

          <div className={`mobile-content ${mobileSection !== 'style' ? 'mobile-hidden' : ''}`}>
            {mobileSection === 'style' && visualStyleContent}
          </div>
        </section>

        {/* Center Live Preview Mockup */}
        <section className="preview-container anim-fade-in anim-delay-2">
          <div className="phone-mockup anim-float">
            <div className="phone-notch"></div>
            <div className="phone-lang-toggle">
              <button 
                className={`lang-btn ${uiLang === 'en' ? 'active' : ''}`}
                onClick={() => setUiLang('en')}
              >EN</button>
              <button 
                className={`lang-btn ${uiLang === 'ar' ? 'active' : ''}`}
                onClick={() => setUiLang('ar')}
              >AR</button>
              <button 
                className={`lang-btn ${uiLang === 'fr' ? 'active' : ''}`}
                onClick={() => setUiLang('fr')}
              >FR</button>
            </div>
            
            <div className="video-frame">
              {/* Actual loop canvas */}
              <canvas ref={canvasRef} className="canvas-preview"></canvas>
            </div>

            {/* Hidden Video element for uploaded background */}
            <video 
              ref={videoRef}
              src={videoMode === 'single' ? (uploadedBgUrl || undefined) : undefined}
              className="hidden-video"
              loop={videoMode === 'single'}
              muted 
              autoPlay 
              playsInline
            />

            {/* Hidden Audio elements for seamless playback */}
            <audio 
              ref={audioRef}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleAudioEnded}
              preload="auto"
            />
            <audio 
              ref={nextAudioRef}
              onEnded={handleAudioEnded}
              preload="auto"
            />
            <audio 
              ref={bgAudioRef}
              preload="auto"
              loop
              crossOrigin="anonymous"
            />
          </div>

          {/* Real-time playback controls */}
          <div className="preview-controls">
            <button 
              className={`btn-circle ${isPlaying ? 'active' : ''}`} 
              onClick={togglePlay}
            disabled={loading || isRecording || (mode === 'quran' ? passageAyahs.length === 0 : mode === 'hadith' ? hadithData.length === 0 : duaData.length === 0)}
              title={isPlaying ? T('preview.pause') : T('preview.play')}
            >
              {isPlaying ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              )}
            </button>
          </div>
        </section>

        {/* Right Sidebar Customization Panel */}
        <section className="sidebar glass-panel desktop-only anim-fade-in-right anim-delay-3">
          {visualStyleContent}
        </section>

      </main>
    </div>
  );
}

export default App;
