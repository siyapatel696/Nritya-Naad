import { useEffect, useRef, useState } from "react";

const SWARAS = [
  { label: "Sa", frequency: 261.63, hue: "#ff6b00" },
  { label: "Re", frequency: 293.66, hue: "#ff8f3d" },
  { label: "Ga", frequency: 329.63, hue: "#c2185b" },
  { label: "Ma", frequency: 349.23, hue: "#d64b86" },
  { label: "Pa", frequency: 392.0, hue: "#00897b" },
  { label: "Dha", frequency: 440.0, hue: "#1aa596" },
  { label: "Ni", frequency: 493.88, hue: "#3949ab" },
];

export default function LearnSwarasTool() {
  const audioContextRef = useRef(null);
  const activeTimeoutRef = useRef(null);
  const [activeSwar, setActiveSwar] = useState(null);

  useEffect(() => {
    return () => {
      if (activeTimeoutRef.current) {
        window.clearTimeout(activeTimeoutRef.current);
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playSwar = async ({ label, frequency }) => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    const context = audioContextRef.current;

    if (context.state === "suspended") {
      await context.resume();
    }

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.72);

    setActiveSwar(label);
    if (activeTimeoutRef.current) {
      window.clearTimeout(activeTimeoutRef.current);
    }
    activeTimeoutRef.current = window.setTimeout(() => {
      setActiveSwar(null);
    }, 420);
  };

  return (
    <section className="swaras-tool">
      <div className="swaras-tool__header">
        <p className="swaras-tool__eyebrow">Interactive Riyaz</p>
        <h2>Tap a swara to hear its note</h2>
        <p className="swaras-tool__description">
          Practice the seven basic swaras with a simple playable scale.
        </p>
      </div>

      <div className="swaras-tool__grid">
        {SWARAS.map((swar) => (
          <button
            key={swar.label}
            type="button"
            className={`swaras-tool__button${activeSwar === swar.label ? " is-active" : ""}`}
            style={{ "--swar-color": swar.hue }}
            onClick={() => playSwar(swar)}
          >
            <span className="swaras-tool__button-label">{swar.label}</span>
            <span className="swaras-tool__button-note">{Math.round(swar.frequency)} Hz</span>
          </button>
        ))}
      </div>

      <p className="swaras-tool__hint">
        Current note: <strong>{activeSwar || "Select a swara"}</strong>
      </p>
    </section>
  );
}
