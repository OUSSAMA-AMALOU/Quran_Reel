import { useState, useEffect, useRef, useCallback } from 'react';
import { surahs } from './data/surahData';
import { drawFrame } from './utils/videoRenderer';

const RECITERS = [
  { id: 'ar.alafasy', name: 'Mishary Rashid Alafasy', style: 'Murattal' },
  { id: 'ar.sudais', name: 'Abdul Rahman Al-Sudais', style: 'Murattal' },
  { id: 'ar.mahermuaiqly', name: 'Maher Al-Muaiqly', style: 'Murattal' },
  { id: 'ar.abdulbasitmurattal', name: 'Abdul Basit (Murattal)', style: 'Murattal' },
  { id: 'ar.abdulbasitmujawwad', name: 'Abdul Basit (Mujawwad)', style: 'Mujawwad' },
  { id: 'ar.minshawi', name: 'Muhammad Al-Minshawi', style: 'Murattal' },
  { id: 'ar.shaatree', name: 'Abu Bakr Al-Shatri', style: 'Murattal' },
  { id: 'ar.saadalgamidi', name: 'Saad Al-Ghamdi', style: 'Murattal' },
  { id: 'ar.hanirifai', name: 'Hani Ar-Rifai', style: 'Murattal' }
];

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
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  
  // Web Audio API References
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const audioSourceNodeRef = useRef(null);
  const recorderRef = useRef(null);

  const selectedSurahDetails = surahs.find(s => s.number === parseInt(surahNum));

  // Handle Fetching Surah Data (Arabic text, translation, audio)
  const fetchPassage = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    try {
      // Fetch Arabic Uthmani text, English translation, and audio in parallel
      const [arRes, enRes, audioRes] = await Promise.all([
        fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/quran-uthmani`),
        fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/en.sahih`),
        fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/${reciterId}`)
      ]);

      if (!arRes.ok || !enRes.ok || !audioRes.ok) {
        throw new Error('Failed to fetch Quran data from API. Please try again.');
      }

      const arData = await arRes.json();
      const enData = await enRes.json();
      const audioData = await audioRes.json();

      // Combine Ayahs — skip any without audio
      const combined = arData.data.ayahs
        .map((ayah, idx) => ({
          numberInSurah: ayah.numberInSurah,
          number: ayah.number,
          text: ayah.text,
          translation: enData.data.ayahs[idx]?.text || '',
          audio: getAudioPath(audioData.data.ayahs[idx]?.audio)
        }))
        .filter(a => a.audio);

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
    if (audioRef.current) {
      audioRef.current.pause();
    }

    try {
      const [arRes, enRes, audioRes] = await Promise.all([
        fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/quran-uthmani`),
        fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/en.sahih`),
        fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/${reciterId}`)
      ]);

      const arData = await arRes.json();
      const enData = await enRes.json();
      const audioData = await audioRes.json();

      const combined = arData.data.ayahs
        .map((ayah, idx) => ({
          numberInSurah: ayah.numberInSurah,
          number: ayah.number,
          text: ayah.text,
          translation: enData.data.ayahs[idx]?.text || '',
          audio: getAudioPath(audioData.data.ayahs[idx]?.audio)
        }))
        .filter(a => a.audio);

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

  // Setup Web Audio API on first play
  const initWebAudio = () => {
    if (audioCtxRef.current) return;
    
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      
      const source = audioCtx.createMediaElementSource(audioRef.current);
      
      // Send audio to speakers directly and feed analyser without routing through it
      source.connect(audioCtx.destination);
      source.connect(analyser);
      
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      audioSourceNodeRef.current = source;
    } catch (e) {
      console.warn("Web Audio API not fully initialized (user interaction required or already running)", e);
    }
  };

  // Playback Control
  const togglePlay = async () => {
    if (passageAyahs.length === 0 || !audioRef.current) return;
    
    initWebAudio();
    
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const ayah = passageAyahs[currentAyahIndex];
      if (!ayah || !ayah.audio) return;
      if (!audioRef.current.src || audioRef.current.src === location.href) {
        audioRef.current.src = ayah.audio;
        audioRef.current.load();
      }
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error("Audio playback error:", err);
      });
    }
  };

  // Handle Audio events
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleAudioEnded = () => {
    if (currentAyahIndex < passageAyahs.length - 1) {
      const nextIdx = currentAyahIndex + 1;
      setCurrentAyahIndex(nextIdx);
      if (audioRef.current) {
        audioRef.current.src = passageAyahs[nextIdx].audio;
        audioRef.current.load();
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(err => {
          console.error("Audio playback error:", err);
        });
      }
    } else {
      setIsPlaying(false);
      setCurrentAyahIndex(0);
      if (audioRef.current && passageAyahs[0]) {
        audioRef.current.src = passageAyahs[0].audio;
        audioRef.current.load();
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

  // Canvas Drawing animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Explicitly set HD vertical resolution (508x850)
    canvas.width = 508;
    canvas.height = 850;

    let animId;
    const renderLoop = () => {
      drawFrame({
        ctx,
        canvas,
        videoElement: videoRef.current,
        audioAnalyser: analyserRef.current,
        currentAyah: passageAyahs[currentAyahIndex],
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
    passageAyahs, 
    currentAyahIndex, 
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
    if (passageAyahs.length === 0) return;
    
    // Stop any current playback
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }

    setIsRecording(true);
    setRecordingProgress(5);
    setRecordingStatus('Initializing media recorder...');

    try {
      // 1. Load the first audio source into the element
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

      // Reuse existing MediaElementSource or create one
      let source;
      if (!audioSourceNodeRef.current) {
        source = audioCtx.createMediaElementSource(audioRef.current);
        audioSourceNodeRef.current = source;
      } else {
        source = audioSourceNodeRef.current;
        source.disconnect();
      }

      // Disconnect analyser from destination (from initWebAudio) to prevent doubled audio
      if (analyserRef.current) analyserRef.current.disconnect();

      // Create destination node for capturing audio
      const destNode = audioCtx.createMediaStreamDestination();

      // Setup analyser for visualizer
      if (!analyserRef.current) {
        analyserRef.current = audioCtx.createAnalyser();
        analyserRef.current.fftSize = 256;
      }

      // Route: source -> destNode (recording), source -> speakers, source -> analyser (visualizer)
      source.connect(destNode);
      source.connect(audioCtx.destination);
      source.connect(analyserRef.current);

      // 3. Capture canvas video + audio from destination node
      const canvasStream = canvasRef.current.captureStream(30);
      const videoTrack = canvasStream.getVideoTracks()[0];
      const audioTrack = destNode.stream.getAudioTracks()[0];

      if (!videoTrack) throw new Error('Failed to capture canvas video track.');
      if (!audioTrack) throw new Error('Failed to capture audio track.');

      const combinedTracks = [videoTrack, audioTrack];
      const recorderStream = new MediaStream(combinedTracks);

      // 4. Set up MediaRecorder options (force webm with opus for reliable audio)
      let options;
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
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
      await audioRef.current.play();
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

  // Stop recording early and finalize the video with captured chunks
  const stopRecording = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
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

            {/* Hidden Audio element loaded from selections */}
            <audio 
              ref={audioRef}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleAudioEnded}
              preload="auto"
            />
          </div>

          {/* Real-time playback controls */}
          <div className="preview-controls">
            <button 
              className={`btn-circle ${isPlaying ? 'active' : ''}`} 
              onClick={togglePlay}
              disabled={loading || isRecording || passageAyahs.length === 0}
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
