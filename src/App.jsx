import { useState, useEffect, useRef, useCallback } from 'react';
import { surahs } from './data/surahData';
import { drawFrame } from './utils/videoRenderer';

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
  
  // Styling configuration
  const [fontSize, setFontSize] = useState(48);
  const [translationFontSize, setTranslationFontSize] = useState(26);
  const [textPosition, setTextPosition] = useState('center'); // 'top', 'center', 'bottom'
  const [vignetteOpacity, setVignetteOpacity] = useState(0.4);
  const [fontFamily, setFontFamily] = useState('amiri');
  const [showTranslation, setShowTranslation] = useState(true);
  const [watermark, setWatermark] = useState('');
  const [visualizerStyle, setVisualizerStyle] = useState('none'); // 'waves', 'bars', 'none'
  const [visualizerColor, setVisualizerColor] = useState('#60a5fa');
  
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
  const [hadithBook, setHadithBook] = useState('bukhari');
  const [hadithNumber, setHadithNumber] = useState(1);
  const [hadithData, setHadithData] = useState([]);
  const [currentHadithIndex, setCurrentHadithIndex] = useState(0);
  
  // Background Audio
  const [bgAudioFile, setBgAudioFile] = useState(null);
  const [bgAudioEnabled, setBgAudioEnabled] = useState(false);
  const [bgAudioVolume, setBgAudioVolume] = useState(50);
  
  // Data States
  const [passageAyahs, setPassageAyahs] = useState([]);
  const [currentAyahIndex, setCurrentAyahIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Mobile section tab
  const [mobileSection, setMobileSection] = useState('passage');

  // Player States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Recording / Export States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [recordingStatus, setRecordingStatus] = useState('');
  
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
        const [arRes, enRes] = await Promise.all([
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/quran-uthmani`),
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/en.sahih`)
        ]);
        if (!arRes.ok || !enRes.ok) throw new Error('Failed to fetch Quran data from API.');
        arData = await arRes.json();
        enData = await enRes.json();
        const folder = EVERYAYAH_FOLDERS[reciterId];
        combined = arData.data.ayahs
          .map((ayah, idx) => ({
            numberInSurah: ayah.numberInSurah,
            number: ayah.number,
            text: ayah.text,
            translation: enData.data.ayahs[idx]?.text || '',
            audio: `/everyayah/data/${folder}_128kbps/${pad3(surahNum)}${pad3(ayah.numberInSurah)}.mp3`
          }));
      } else {
        // API reciter: fetch everything from Alquran Cloud
        const [arRes, enRes, audioRes] = await Promise.all([
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/quran-uthmani`),
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/en.sahih`),
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/${reciterId}`)
        ]);
        if (!arRes.ok || !enRes.ok || !audioRes.ok) {
          throw new Error('Failed to fetch Quran data from API. Please try again.');
        }
        arData = await arRes.json();
        enData = await enRes.json();
        const audioData = await audioRes.json();
        combined = arData.data.ayahs
          .map((ayah, idx) => ({
            numberInSurah: ayah.numberInSurah,
            number: ayah.number,
            text: ayah.text,
            translation: enData.data.ayahs[idx]?.text || '',
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
        const [arRes, enRes] = await Promise.all([
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/quran-uthmani`),
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/en.sahih`)
        ]);
        if (!arRes.ok || !enRes.ok) throw new Error('Failed to fetch Quran data from API.');
        arData = await arRes.json();
        enData = await enRes.json();
        const folder = EVERYAYAH_FOLDERS[reciterId];
        combined = arData.data.ayahs
          .map((ayah, idx) => ({
            numberInSurah: ayah.numberInSurah,
            number: ayah.number,
            text: ayah.text,
            translation: enData.data.ayahs[idx]?.text || '',
            audio: `/everyayah/data/${folder}_128kbps/${pad3(surahNum)}${pad3(ayah.numberInSurah)}.mp3`
          }));
      } else {
        const [arRes, enRes, audioRes] = await Promise.all([
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/quran-uthmani`),
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/en.sahih`),
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/${reciterId}`)
        ]);
        if (!arRes.ok || !enRes.ok || !audioRes.ok) {
          throw new Error('Failed to fetch Quran data from API. Try again.');
        }
        arData = await arRes.json();
        enData = await enRes.json();
        const audioData = await audioRes.json();
        combined = arData.data.ayahs
          .map((ayah, idx) => ({
            numberInSurah: ayah.numberInSurah,
            number: ayah.number,
            text: ayah.text,
            translation: enData.data.ayahs[idx]?.text || '',
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
      const [araRes, engRes] = await Promise.all([
        fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-${hadithBook}/${num}.json`),
        fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-${hadithBook}/${num}.json`)
      ]);
      if (!araRes.ok || !engRes.ok) {
        throw new Error(`Hadith ${num} not found in ${hadithBook}.`);
      }
      const araData = await araRes.json();
      const engData = await engRes.json();
      const araHadith = araData.hadiths?.[0];
      const engHadith = engData.hadiths?.[0];
      if (!araHadith || !engHadith) {
        throw new Error(`Hadith ${num} not found.`);
      }
      const result = [{
        number: num,
        text: araHadith.text,
        translation: engHadith.text,
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

  // Auto-load hadiths when switching to hadith mode
  useEffect(() => {
    if (mode === 'hadith') {
      fetchHadiths();
    }
  }, [mode, fetchHadiths]);

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
    if (mode === 'hadith') {
      if (hadithData.length === 0) return;
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
    if (mode === 'hadith') return;
    const nextIdx = currentAyahIndex + 1;
    if (nextIdx < passageAyahs.length) {
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
    if (file) {
      if (uploadedBgUrl) URL.revokeObjectURL(uploadedBgUrl);
      setUploadedBgUrl(URL.createObjectURL(file));
    }
  };

  // Handle Background Audio Upload
  const handleBgAudioUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (bgAudioFile) URL.revokeObjectURL(bgAudioFile);
      setBgAudioFile(URL.createObjectURL(file));
    }
  };

  const toggleBgAudio = () => {
    if (!bgAudioRef.current || !bgAudioFile) return;
    if (bgAudioEnabled) {
      bgAudioRef.current.pause();
    } else {
      bgAudioRef.current.src = bgAudioFile;
      bgAudioRef.current.loop = true;
      bgAudioRef.current.play().catch(console.error);
    }
    setBgAudioEnabled(!bgAudioEnabled);
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
    const renderLoop = () => {
      const currentItem = mode === 'hadith'
        ? hadithData[currentHadithIndex]
        : passageAyahs[currentAyahIndex];
      const referenceText = mode === 'hadith' && currentItem
        ? `${currentItem.bookName}, Hadith ${currentItem.number}`
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
          watermark,
          visualizerStyle,
          visualizerColor,
          surahName: selectedSurahDetails?.englishName,
          surahNumber: surahNum,
          backgroundType,
          referenceText,
        },
        isPlaying,
        currentTime
      });
      animId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [
    mode,
    passageAyahs, 
    currentAyahIndex, 
    hadithData,
    currentHadithIndex,
    isPlaying, 
    fontSize, 
    translationFontSize, 
    textPosition, 
    vignetteOpacity, 
    fontFamily, 
    showTranslation, 
    watermark, 
    visualizerStyle, 
    visualizerColor, 
    selectedSurahDetails, 
    surahNum,
    currentTime,
  ]);

  // Export / Record video logic
  const handleExportVideo = async () => {
    if (mode === 'hadith') {
      await handleExportHadith();
      return;
    }
    if (passageAyahs.length === 0) return;
    
    // Stop any current playback
    setIsPlaying(false);
    const currAudio = getAudio();
    if (currAudio) currAudio.pause();

    setIsRecording(true);
    setRecordingProgress(5);
    setRecordingStatus('Initializing media recorder...');

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

      // Connect background audio if uploaded
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
        bgAudioRef.current.loop = true;
        bgAudioRef.current.play().catch(console.error);
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
        setRecordingStatus('Compiling video file...');
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
      setRecordingStatus(`Recording Ayah ${startAyah} of ${endAyah}...`);

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
    setRecordingStatus('Initializing hadith reel...');

    try {
      setCurrentHadithIndex(0);

      let hasBgAudio = false;
      let bgTrack = null;
      if (bgAudioFile && bgAudioRef.current) {
        bgAudioRef.current.src = bgAudioFile;
        bgAudioRef.current.loop = true;
        try {
          await bgAudioRef.current.play();
          // Capture audio track directly from the audio element
          const bgStream = bgAudioRef.current.captureStream();
          bgTrack = bgStream.getAudioTracks()[0];
          if (bgTrack) hasBgAudio = true;
        } catch (e) {
          console.warn('Background audio failed:', e);
        }
      }

      // Capture canvas video
      const canvasStream = canvasRef.current.captureStream(30);
      const videoTrack = canvasStream.getVideoTracks()[0];
      if (!videoTrack) throw new Error('Failed to capture canvas video track.');

      const tracks = [videoTrack];
      if (hasBgAudio && bgTrack) tracks.push(bgTrack);
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
        setRecordingStatus('Compiling video file...');
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
      setRecordingStatus(`Recording Hadith 1 of ${hadithData.length}...`);

      for (let i = 0; i < hadithData.length; i++) {
        setCurrentHadithIndex(i);
        setRecordingStatus(`Recording Hadith ${i + 1} of ${hadithData.length}...`);
        setRecordingProgress(Math.round(((i + 1) / hadithData.length) * 80 + 10));

        const secondsPerHadith = 10;
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
      setRecordingStatus(`Recording Ayah ${startAyah + currentAyahIndex} of ${endAyah}...`);
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
        Visual Style
      </h2>

      <div className="form-group">
        <label>Arabic Script Font</label>
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
        </select>
      </div>

      <div className="form-group">
        <label>Arabic Font Size</label>
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
          <span>Show English Translation</span>
        </label>
      </div>

      {showTranslation && (
        <div className="form-group">
          <label>Translation Font Size</label>
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
        <label htmlFor="textPosition">Text Center Alignment</label>
        <select 
          id="textPosition" 
          value={textPosition} 
          onChange={(e) => setTextPosition(e.target.value)}
          disabled={isRecording}
        >
          <option value="top">Top Third</option>
          <option value="center">Center</option>
          <option value="bottom">Bottom Third</option>
        </select>
      </div>

      <div className="form-group">
        <label>Dark Vignette Opacity</label>
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
        <label htmlFor="watermark">Watermark Header</label>
        <input 
          type="text" 
          id="watermark" 
          value={watermark} 
          onChange={(e) => setWatermark(e.target.value.toUpperCase())}
          placeholder="e.g. QURAN REEL"
          maxLength="20"
          disabled={isRecording}
        />
      </div>

      <div className="form-group">
        <label htmlFor="visStyle">Audio Visualizer</label>
        <select 
          id="visStyle" 
          value={visualizerStyle} 
          onChange={(e) => setVisualizerStyle(e.target.value)}
          disabled={isRecording}
        >
          <option value="bars">Symmetric Glow Bars</option>
          <option value="waves">Continuous Waves</option>
          <option value="none">Disabled</option>
        </select>
      </div>

      {visualizerStyle !== 'none' && (
        <div className="form-group">
          <label htmlFor="visColor">Visualizer Glow Color</label>
          <select 
            id="visColor" 
            value={visualizerColor} 
            onChange={(e) => setVisualizerColor(e.target.value)}
            disabled={isRecording}
          >
            <option value="#60a5fa">Deep Blue</option>
            <option value="#34d399">Emerald Green</option>
            <option value="#fbbf24">Aesthetic Gold</option>
            <option value="#f472b6">Blossom Pink</option>
            <option value="#ffffff">Minimal White</option>
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
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
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
              Settings
            </button>
            <button 
              className={`tab-btn ${mobileSection === 'style' ? 'active' : ''}`}
              onClick={() => setMobileSection('style')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                <path d="M2 12h20"/>
              </svg>
              Style
            </button>
          </div>

          <div className={`desktop-content ${mobileSection !== 'passage' ? 'mobile-hidden' : ''}`}>
          <h2 className="section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            Passage Settings
          </h2>

          <div className="form-group mode-toggle">
            <label>Content Type</label>
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
                Quran
              </button>
              <button 
                className={`btn-sm ${mode === 'hadith' ? 'btn-active' : ''}`}
                onClick={() => setMode('hadith')}
                disabled={isRecording}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                Hadith
              </button>
            </div>
          </div>

          {mode === 'quran' ? (
            <>
            <div className="form-group">
              <label htmlFor="reciter">Reciter</label>
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
              <label htmlFor="surah">Surah</label>
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
                <label htmlFor="startAyah">Start Ayah</label>
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
                <label htmlFor="endAyah">End Ayah</label>
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
              Apply Ayah Range
            </button>
            </>
          ) : (
            <>
            <div className="form-group">
              <label htmlFor="hadithBook">Hadith Book</label>
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
                <label htmlFor="hadithNumber">Hadith Number</label>
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
              Load Hadith
            </button>
            </>
          )}


          <hr />

          <h2 className="section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            Background Video
          </h2>

          <div className="file-upload">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
            <span>{uploadedBgUrl ? 'Video Uploaded ✓' : 'Upload Vertical Video'}</span>
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="video/*" 
              onChange={handleFileUpload} 
              disabled={isRecording}
            />
          </div>

          <hr />

          <h2 className="section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
            Background Audio
          </h2>

          <div className="file-upload">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
            <span>{bgAudioFile ? 'Audio Uploaded ✓' : 'Upload Background Audio'}</span>
            <input 
              type="file" 
              accept="audio/*" 
              onChange={handleBgAudioUpload} 
              disabled={isRecording}
            />
          </div>

          {bgAudioFile && (
            <div className="form-row">
              <button className={`btn-sm ${bgAudioEnabled ? 'btn-active' : ''}`} onClick={toggleBgAudio}>
                {bgAudioEnabled ? 'Playing' : 'Play'}
              </button>
              <div className="form-group" style={{flex: 1}}>
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

          <button 
            className="btn-generate" 
            onClick={handleExportVideo} 
            disabled={loading || isRecording || passageAyahs.length === 0}
          >
            {isRecording ? (
              <>
                <span className="pulse-icon"></span>
                Exporting...
              </>
            ) : (
              <>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
                Generate Reel
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
                ■ Stop
              </button>
            </div>
          )}

          {error && (
            <div className="status-card" style={{borderLeftColor: 'var(--danger)', color: 'var(--danger)'}}>
              <strong>Error:</strong> {error}
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
            
            <div className="video-frame">
              {/* Actual loop canvas */}
              <canvas ref={canvasRef} className="canvas-preview"></canvas>
            </div>

            {/* Hidden Video element for uploaded background */}
            <video 
              ref={videoRef}
              src={uploadedBgUrl || undefined}
              className="hidden-video"
              loop 
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
            />
          </div>

          {/* Real-time playback controls */}
          <div className="preview-controls">
            <button 
              className={`btn-circle ${isPlaying ? 'active' : ''}`} 
              onClick={togglePlay}
            disabled={loading || isRecording || (mode === 'quran' ? passageAyahs.length === 0 : hadithData.length === 0)}
              title={isPlaying ? "Pause Preview" : "Play Preview"}
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
