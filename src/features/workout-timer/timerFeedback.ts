let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return null;
  audioContext ??= new AudioContextClass();
  return audioContext;
}

export async function unlockTimerAudio() {
  const context = getAudioContext();
  if (context?.state === "suspended") await context.resume();
}

export function playTimerTone(kind: "tick" | "phase" | "finish", silent: boolean) {
  if (silent) return;
  const context = getAudioContext();
  if (!context || context.state !== "running") return;

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  const duration = kind === "finish" ? 0.45 : 0.16;
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(kind === "tick" ? 720 : kind === "phase" ? 940 : 1180, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);

  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(kind === "finish" ? [180, 90, 180] : 80);
  }
}
