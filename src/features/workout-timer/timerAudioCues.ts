import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TimerAudioEvent = "start" | "halfway" | "round_end" | "last_round" | "finish" | "motivation";

export const TIMER_AUDIO_EVENT_LABELS: Record<TimerAudioEvent, { title: string; description: string }> = {
  start: { title: "Partenza", description: "Dopo il countdown iniziale" },
  halfway: { title: "Metà tempo", description: "A metà delle sessioni con durata definita" },
  round_end: { title: "Fine serie", description: "Al passaggio alla serie successiva" },
  last_round: { title: "Ultima serie", description: "All'inizio dell'ultima serie" },
  finish: { title: "Fine timer", description: "Quando il tempo termina" },
  motivation: { title: "Frase motivazionale", description: "Dopo la conclusione della sessione" },
};

export const TIMER_AUDIO_EVENTS = Object.keys(TIMER_AUDIO_EVENT_LABELS) as TimerAudioEvent[];

export interface TimerAudioCue {
  id: string;
  title: string;
  event_type: TimerAudioEvent;
  storage_path: string;
  mime_type: string;
  duration_seconds: number | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface PreparedCue {
  cue: TimerAudioCue;
  audio: HTMLAudioElement;
  objectUrl: string;
}

const METADATA_CACHE_KEY = "spg:timer-audio:metadata:v1";
const FILE_CACHE_NAME = "spg-timer-audio-v1";

function readCachedMetadata(): TimerAudioCue[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const value = localStorage.getItem(METADATA_CACHE_KEY);
    return value ? JSON.parse(value) as TimerAudioCue[] : [];
  } catch {
    return [];
  }
}

function writeCachedMetadata(cues: TimerAudioCue[]) {
  try {
    localStorage.setItem(METADATA_CACHE_KEY, JSON.stringify(cues));
  } catch {
    // Il timer continua con i segnali standard se lo spazio locale non è disponibile.
  }
}

async function loadMetadata(): Promise<TimerAudioCue[]> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return readCachedMetadata();

  try {
    const { data, error } = await supabase
      .from("timer_audio_cues")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    const cues = (data ?? []) as TimerAudioCue[];
    writeCachedMetadata(cues);
    return cues;
  } catch {
    return readCachedMetadata();
  }
}

function cacheRequest(cue: TimerAudioCue) {
  return new Request(`https://timer-audio.superpowergym.local/${cue.id}/${encodeURIComponent(cue.updated_at)}`);
}

async function readCachedBlob(cue: TimerAudioCue): Promise<Blob | null> {
  if (!("caches" in window)) return null;
  try {
    const cache = await caches.open(FILE_CACHE_NAME);
    const response = await cache.match(cacheRequest(cue));
    return response ? await response.blob() : null;
  } catch {
    return null;
  }
}

async function cacheBlob(cue: TimerAudioCue, blob: Blob) {
  if (!("caches" in window)) return;
  try {
    const cache = await caches.open(FILE_CACHE_NAME);
    await cache.put(cacheRequest(cue), new Response(blob, { headers: { "Content-Type": cue.mime_type } }));
  } catch {
    // La cache persistente è un miglioramento, non un requisito per avviare il timer.
  }
}

async function loadCueBlob(cue: TimerAudioCue): Promise<Blob | null> {
  const cached = await readCachedBlob(cue);
  if (cached) return cached;
  if (typeof navigator !== "undefined" && !navigator.onLine) return null;

  try {
    const { data, error } = await supabase.storage.from("timer-audio").download(cue.storage_path);
    if (error) throw error;
    await cacheBlob(cue, data);
    return data;
  } catch {
    return null;
  }
}

export function selectRandomTimerAudioCue(
  cues: TimerAudioCue[],
  eventType: TimerAudioEvent,
  random: () => number = Math.random,
): TimerAudioCue | null {
  const candidates = cues.filter((cue) => cue.event_type === eventType && cue.is_active);
  if (!candidates.length) return null;
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
}

async function prepareRandomCues(eventTypes: TimerAudioEvent[]): Promise<Partial<Record<TimerAudioEvent, PreparedCue>>> {
  const metadata = await loadMetadata();
  const selected = eventTypes.map((eventType) => selectRandomTimerAudioCue(metadata, eventType)).filter((cue): cue is TimerAudioCue => cue !== null);

  const preparedEntries = await Promise.all(selected.map(async (cue) => {
    const blob = await loadCueBlob(cue);
    if (!blob) return null;
    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);
    audio.preload = "auto";
    return [cue.event_type, { cue, audio, objectUrl }] as const;
  }));

  return Object.fromEntries(preparedEntries.filter((entry): entry is NonNullable<typeof entry> => entry !== null));
}

export function useTimerAudioCues(eventTypes: TimerAudioEvent[]) {
  const preparedRef = useRef<Partial<Record<TimerAudioEvent, PreparedCue>>>({});
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const [ready, setReady] = useState(false);
  const eventTypesKey = eventTypes.join("|");

  useEffect(() => {
    let mounted = true;
    void prepareRandomCues(eventTypesKey.split("|").filter(Boolean) as TimerAudioEvent[]).then((prepared) => {
      if (!mounted) {
        Object.values(prepared).forEach((item) => URL.revokeObjectURL(item.objectUrl));
        return;
      }
      preparedRef.current = prepared;
      setReady(true);
    });

    return () => {
      mounted = false;
      activeAudioRef.current?.pause();
      Object.values(preparedRef.current).forEach((item) => URL.revokeObjectURL(item.objectUrl));
      preparedRef.current = {};
    };
  }, [eventTypesKey]);

  const prime = useCallback(async () => {
    await Promise.all(Object.values(preparedRef.current).map(async ({ audio }) => {
      try {
        audio.muted = true;
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      } catch {
        audio.muted = false;
      }
    }));
  }, []);

  const play = useCallback(async (eventType: TimerAudioEvent): Promise<boolean> => {
    const prepared = preparedRef.current[eventType];
    if (!prepared) return false;

    try {
      if (activeAudioRef.current && activeAudioRef.current !== prepared.audio) {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      }
      activeAudioRef.current = prepared.audio;
      prepared.audio.currentTime = 0;
      return await new Promise<boolean>((resolve) => {
        const finish = (played: boolean) => {
          prepared.audio.removeEventListener("ended", handleEnded);
          prepared.audio.removeEventListener("error", handleError);
          resolve(played);
        };
        const handleEnded = () => finish(true);
        const handleError = () => finish(false);
        prepared.audio.addEventListener("ended", handleEnded, { once: true });
        prepared.audio.addEventListener("error", handleError, { once: true });
        void prepared.audio.play().catch(() => finish(false));
      });
    } catch {
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    activeAudioRef.current?.pause();
    if (activeAudioRef.current) activeAudioRef.current.currentTime = 0;
    activeAudioRef.current = null;
  }, []);

  return { ready, play, prime, stop };
}
