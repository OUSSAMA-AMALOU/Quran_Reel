import { useState, useRef, useEffect, useCallback } from 'react';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function AudioPlayer({
  isPlaying,
  currentTime,
  duration = 0,
  togglePlay,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  surahName = 'Surah',
  surahNameAr = '',
  ayahRange = '',
  volume = 80,
  onVolumeChange,
  playbackSpeed = 1,
  onSpeedChange,
  onSeek,
  audioRef,
  isFavorite,
  onToggleFavorite,
  onShare,
  onDownload,
}) {
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const waveformRef = useRef(null);
  const animFrameRef = useRef(null);
  const speedMenuRef = useRef(null);

  const formatTime = (s) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e) => {
    if (!onSeek || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(x * duration, duration)));
  };

  // Close speed menu on outside click
  useEffect(() => {
    if (!showSpeedMenu) return;
    const handler = (e) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(e.target)) {
        setShowSpeedMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSpeedMenu]);

  // Animated waveform bars
  useEffect(() => {
    const canvas = waveformRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const barCount = 60;
    let bars = Array.from({ length: barCount }, () => Math.random() * 0.5 + 0.1);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (isPlaying) {
        bars = bars.map(b => {
          const next = b + (Math.random() - 0.5) * 0.15;
          return Math.max(0.05, Math.min(1, next));
        });
      }

      const barW = w / barCount - 2;
      const gold = '#D4AF37';
      const emerald = '#0B3D2E';

      bars.forEach((v, i) => {
        const barH = v * h * 0.85;
        const x = i * (barW + 2) + 1;
        const y = (h - barH) / 2;
        const grad = ctx.createLinearGradient(x, y, x, y + barH);
        grad.addColorStop(0, gold);
        grad.addColorStop(0.5, '#F5D76E');
        grad.addColorStop(1, emerald);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, [barW / 2, barW / 2, barW / 2, barW / 2]);
        ctx.fill();
      });

      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying]);

  const progressPct = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

  return (
    <div className="audio-player glass-player">
      {/* Background glow orbs */}
      <div className="player-orb player-orb-1" />
      <div className="player-orb player-orb-2" />

      <div className="player-inner">
        {/* Left: Artwork + Track Info */}
        <div className="player-track">
          <div className="player-artwork">
            <svg viewBox="0 0 100 100" className="player-artwork-svg">
              <defs>
                <linearGradient id="artGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0B3D2E" />
                  <stop offset="100%" stopColor="#1a5a44" />
                </linearGradient>
              </defs>
              <rect width="100" height="100" rx="16" fill="url(#artGrad)" />
              {/* Simplified Arabic calligraphy-inspired design */}
              <text x="50" y="38" textAnchor="middle" fill="#D4AF37" fontFamily="'Amiri', serif" fontSize="22" fontWeight="700">ٱلْقُرْآن</text>
              <text x="50" y="62" textAnchor="middle" fill="#F5D76E" fontFamily="'Amiri', serif" fontSize="12" opacity="0.8">ٱلْكَرِيم</text>
              {/* Decorative lines */}
              <line x1="20" y1="72" x2="80" y2="72" stroke="#D4AF37" strokeWidth="0.5" opacity="0.5" />
              <line x1="30" y1="78" x2="70" y2="78" stroke="#D4AF37" strokeWidth="0.3" opacity="0.3" />
              {/* Diamond ornament */}
              <polygon points="50,14 54,18 50,22 46,18" fill="#D4AF37" opacity="0.6" />
            </svg>
          </div>
          <div className="player-track-info">
            <div className="player-surah-name">
              {surahNameAr && <span className="player-surah-ar">{surahNameAr}</span>}
              <span className="player-surah-en">{surahName}</span>
            </div>
            <span className="player-ayah-range">{ayahRange}</span>
          </div>
        </div>

        {/* Center: Controls + Progress */}
        <div className="player-center">
          {/* Controls */}
          <div className="player-controls">
            <button className="player-btn" onClick={onPrev} disabled={!hasPrev} title="Previous">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="19 20 9 12 19 4 19 20" />
                <rect x="5" y="4" width="2" height="16" rx="1" />
              </svg>
            </button>

            <button className="player-btn player-play-btn" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1.5" />
                  <rect x="14" y="4" width="4" height="16" rx="1.5" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="6 3 20 12 6 21 6 3" />
                </svg>
              )}
            </button>

            <button className="player-btn" onClick={onNext} disabled={!hasNext} title="Next">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 4 15 12 5 20 5 4" />
                <rect x="17" y="4" width="2" height="16" rx="1" />
              </svg>
            </button>
          </div>

          {/* Progress bar */}
          <div className="player-progress-wrap">
            <span className="player-time">{formatTime(currentTime)}</span>
            <div className="player-progress" onClick={handleProgressClick}>
              <div className="player-progress-track">
                <div className="player-progress-fill" style={{ width: `${progressPct}%` }} />
                <div className="player-progress-thumb" style={{ left: `${progressPct}%` }} />
              </div>
              {/* Waveform overlay */}
              <canvas ref={waveformRef} className="player-waveform" width={200} height={40} />
            </div>
            <span className="player-time">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: Speed, Volume, Actions */}
        <div className="player-extra">
          {/* Speed */}
          <div className="player-speed-wrap" ref={speedMenuRef}>
            <button className="player-btn player-speed-btn" onClick={() => setShowSpeedMenu(!showSpeedMenu)} title="Playback speed">
              <span>{playbackSpeed}x</span>
            </button>
            {showSpeedMenu && (
              <div className="player-speed-menu">
                {SPEEDS.map(s => (
                  <button
                    key={s}
                    className={`player-speed-opt ${s === playbackSpeed ? 'active' : ''}`}
                    onClick={() => { onSpeedChange(s); setShowSpeedMenu(false); }}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Volume */}
          <div className="player-volume-wrap"
            onMouseEnter={() => setShowVolume(true)}
            onMouseLeave={() => setShowVolume(false)}
          >
            <button className="player-btn" title="Volume">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {volume === 0 ? (
                  <>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </>
                ) : volume < 50 ? (
                  <>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </>
                ) : (
                  <>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </>
                )}
              </svg>
            </button>
            {showVolume && (
              <div className="player-volume-slider">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => onVolumeChange(Number(e.target.value))}
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="player-actions">
            <button
              className={`player-btn player-fav-btn ${isFavorite ? 'active' : ''}`}
              onClick={onToggleFavorite}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
            <button className="player-btn" onClick={onShare} title="Share">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </button>
            <button className="player-btn" onClick={onDownload} title="Download">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
