import { useRef, useState, useEffect, useCallback } from "react";

const THEME = {
  primary: "#3949AB",
  primaryLight: "#7986CB",
  primaryDark: "#1A237E",
  bg: "rgba(57,73,171,0.08)",
  surface: "rgba(57,73,171,0.12)",
  muted: "#6b7280",
};

export default function BeatVisualizer() {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animFrameRef = useRef(null);
  const fileUrlRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [fileName, setFileName] = useState("");
  const [visualMode, setVisualMode] = useState("bars");
  const [hasFile, setHasFile] = useState(false);
  const [error, setError] = useState("");

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const context = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);
      context.clearRect(0, 0, W, H);
      context.fillStyle = "#0d0d1f";
      context.fillRect(0, 0, W, H);

      if (visualMode === "bars") {
        analyser.getByteFrequencyData(dataArray);
        const barCount = Math.min(bufferLength, 120);
        const barW = (W / barCount) * 0.75;
        const gap = (W / barCount) * 0.25;

        for (let i = 0; i < barCount; i++) {
          const value = dataArray[i] / 255;
          const barH = value * H * 0.9;
          const x = i * (barW + gap);
          const y = H - barH;

          const grad = context.createLinearGradient(x, H, x, y);
          grad.addColorStop(0, "#3949AB");
          grad.addColorStop(0.5, "#7C4DFF");
          grad.addColorStop(1, "#E040FB");

          context.fillStyle = grad;
          context.fillRect(x, y, barW, barH);

          context.globalAlpha = 0.15;
          context.fillRect(x, H, barW, barH * 0.3);
          context.globalAlpha = 1;
        }

      } else if (visualMode === "wave") {
        analyser.getByteTimeDomainData(dataArray);
        context.lineWidth = 2.5;
        const grad = context.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, "#3949AB");
        grad.addColorStop(0.5, "#E040FB");
        grad.addColorStop(1, "#3949AB");
        context.strokeStyle = grad;
        context.shadowBlur = 10;
        context.shadowColor = "#7C4DFF";
        context.beginPath();
        const slice = W / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * H) / 2;
          i === 0 ? context.moveTo(x, y) : context.lineTo(x, y);
          x += slice;
        }
        context.lineTo(W, H / 2);
        context.stroke();
        context.shadowBlur = 0;

      } else if (visualMode === "circle") {
        analyser.getByteFrequencyData(dataArray);
        const cx = W / 2;
        const cy = H / 2;
        const radius = Math.min(W, H) * 0.22;
        const barCount = Math.min(bufferLength, 90);

        for (let i = 0; i < barCount; i++) {
          const value = dataArray[i] / 255;
          const barH = value * radius * 1.4;
          const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
          const x1 = cx + Math.cos(angle) * radius;
          const y1 = cy + Math.sin(angle) * radius;
          const x2 = cx + Math.cos(angle) * (radius + barH);
          const y2 = cy + Math.sin(angle) * (radius + barH);
          const hue = (i / barCount) * 280 + 220;
          context.strokeStyle = `hsl(${hue}, 80%, 65%)`;
          context.lineWidth = 2.5;
          context.shadowBlur = 6;
          context.shadowColor = `hsl(${hue}, 80%, 65%)`;
          context.beginPath();
          context.moveTo(x1, y1);
          context.lineTo(x2, y2);
          context.stroke();
        }
        context.shadowBlur = 0;

        const avgVal = dataArray.slice(0, barCount).reduce((a, b) => a + b, 0) / barCount;
        const pulse = (avgVal / 255) * 20;
        const grad = context.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, "rgba(124,77,255,0.6)");
        grad.addColorStop(1, "rgba(57,73,171,0)");
        context.fillStyle = grad;
        context.beginPath();
        context.arc(cx, cy, radius + pulse, 0, Math.PI * 2);
        context.fill();
      }
    };
    render();
  }, [visualMode]);

  const stopAnimation = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  };

  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (!sourceRef.current) {
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      const source = audioCtxRef.current.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(audioCtxRef.current.destination);
      sourceRef.current = source;
    }
  }, []);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setError("Please upload an audio file (mp3, wav, ogg...)");
      return;
    }
    setError("");
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    const url = URL.createObjectURL(file);
    fileUrlRef.current = url;
    setFileName(file.name);
    setHasFile(true);
    setIsPlaying(false);
    stopAnimation();
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.load();
    }
  };

  const togglePlay = async () => {
    if (!audioRef.current || !hasFile) return;
    try {
      initAudio();
      if (audioCtxRef.current.state === "suspended") {
        await audioCtxRef.current.resume();
      }
      if (isPlaying) {
        audioRef.current.pause();
        stopAnimation();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        draw();
        setIsPlaying(true);
      }
    } catch (err) {
      setError("Playback error: " + err.message);
    }
  };

  const handleSeek = (e) => {
    if (!audioRef.current) return;
    const t = parseFloat(e.target.value);
    audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const handleVolume = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };
  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };
  const handleEnded = () => {
    setIsPlaying(false);
    stopAnimation();
  };

  useEffect(() => {
    if (isPlaying && analyserRef.current) {
      stopAnimation();
      draw();
    }
  }, [visualMode, draw, isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isPlaying) return;
    const context = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    context.clearRect(0, 0, W, H);
    context.fillStyle = "#0d0d1f";
    context.fillRect(0, 0, W, H);
    context.fillStyle = "rgba(121,134,203,0.5)";
    context.font = "16px sans-serif";
    context.textAlign = "center";
    context.fillText(
      hasFile ? "Press Play to start visualizer" : "Upload an audio file to begin",
      W / 2,
      H / 2
    );
  }, [isPlaying, hasFile]);

  useEffect(() => {
    return () => {
      stopAnimation();
      if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    };
  }, []);

  const fmt = (s) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 820, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, background: THEME.bg, borderRadius: 16, padding: "18px 24px", border: "1px solid rgba(57,73,171,0.2)" }}>
        <span style={{ fontSize: 40 }}>🥁</span>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, color: THEME.primaryDark }}>Beat Visualizer</h2>
          <p style={{ margin: "4px 0 0", color: THEME.muted, fontSize: 14 }}>See your tabla / mridangam beats come alive</p>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(57,73,171,0.25)", boxShadow: "0 4px 24px rgba(57,73,171,0.15)" }}>
        <canvas ref={canvasRef} width={780} height={280} style={{ display: "block", width: "100%", background: "#0d0d1f" }} />
      </div>

      {/* Mode buttons */}
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        {["bars", "wave", "circle"].map((m) => (
          <button key={m} onClick={() => setVisualMode(m)} style={{
            padding: "8px 20px", borderRadius: 20,
            border: `1.5px solid ${THEME.primaryLight}`,
            background: visualMode === m ? THEME.primary : "transparent",
            color: visualMode === m ? "#fff" : THEME.primary,
            fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}>
            {m === "bars" ? "📊 Bars" : m === "wave" ? "〜 Wave" : "⭕ Circle"}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div style={{ background: THEME.bg, borderRadius: 16, padding: 24, border: "1px solid rgba(57,73,171,0.2)", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>

        <label style={{ cursor: "pointer" }}>
          <input type="file" accept="audio/*" onChange={handleFile} style={{ display: "none" }} />
          <span style={{ display: "inline-block", padding: "10px 28px", borderRadius: 24, background: THEME.surface, border: `1.5px dashed ${THEME.primaryLight}`, color: THEME.primary, fontWeight: 600, fontSize: 15 }}>
            🎵 Upload Audio
          </span>
        </label>

        {fileName && <p style={{ margin: 0, color: THEME.primary, fontSize: 13 }}>🎶 {fileName.length > 40 ? fileName.slice(0, 40) + "…" : fileName}</p>}
        {error && <p style={{ color: "#e53935", fontSize: 13, margin: 0 }}>{error}</p>}

        <button onClick={togglePlay} disabled={!hasFile} style={{
          padding: "12px 48px", fontSize: 18, fontWeight: 700, borderRadius: 32, border: "none",
          background: "linear-gradient(135deg, #3949AB, #7C4DFF)", color: "#fff",
          boxShadow: "0 4px 18px rgba(57,73,171,0.4)",
          cursor: hasFile ? "pointer" : "not-allowed",
          opacity: hasFile ? 1 : 0.45,
        }}>
          {isPlaying ? "⏸ Pause" : "▶ Play"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", maxWidth: 520 }}>
          <span style={{ fontSize: 12, color: THEME.muted, minWidth: 36, textAlign: "center" }}>{fmt(currentTime)}</span>
          <input type="range" min={0} max={duration || 0} step={0.1} value={currentTime} onChange={handleSeek} style={{ flex: 1, accentColor: THEME.primary, cursor: "pointer" }} />
          <span style={{ fontSize: 12, color: THEME.muted, minWidth: 36, textAlign: "center" }}>{fmt(duration)}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>🔈</span>
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={handleVolume} style={{ width: 160, accentColor: THEME.primary, cursor: "pointer" }} />
          <span>🔊</span>
        </div>
      </div>

      <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onEnded={handleEnded} style={{ display: "none" }} />
    </div>
  );
}