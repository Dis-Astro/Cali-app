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

export type TimerToneKind = "tick" | "start" | "phase" | "half" | "last" | "finish";

export function playTimerTone(kind: TimerToneKind, silent: boolean) {
  if (silent) return;
  const context = getAudioContext();
  if (!context || context.state !== "running") return;

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  const duration = kind === "finish" ? 0.55 : kind === "half" || kind === "last" ? 0.32 : 0.16;
  oscillator.type = "sine";
  const frequency = {
    tick: 720,
    start: 1040,
    phase: 940,
    half: 820,
    last: 1080,
    finish: 1180,
  }[kind];
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);

  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(kind === "finish" ? [180, 90, 180] : kind === "half" || kind === "last" ? [100, 60, 100] : 80);
  }
}

export function speakTimerMessage(message: string, silent: boolean) {
  if (silent || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = "it-IT";
  utterance.rate = 0.94;
  utterance.pitch = 0.98;
  const italianVoices = window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith("it"));
  utterance.voice = italianVoices.find((voice) => /alice|elsa|isabella|google.*ital/i.test(voice.name)) ?? italianVoices[0] ?? null;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
