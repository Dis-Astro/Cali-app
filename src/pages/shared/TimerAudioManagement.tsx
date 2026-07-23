import { useEffect, useRef, useState } from "react";
import {
  CircleStop,
  Loader2,
  Mic,
  PauseCircle,
  PlayCircle,
  Radio,
  Trash2,
  Upload,
  Volume2,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import CoachLayout from "@/components/coach/CoachLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  TIMER_AUDIO_EVENTS,
  TIMER_AUDIO_EVENT_LABELS,
  type TimerAudioCue,
  type TimerAudioEvent,
} from "@/features/workout-timer/timerAudioCues";
import { toast } from "sonner";

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const MAX_RECORDING_SECONDS = 30;
const AUDIO_TYPES = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg", "audio/x-m4a"];

function extensionForMime(mimeType: string) {
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

function preferredRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function formatSeconds(value: number) {
  return `${Math.floor(value / 60).toString().padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
}

async function readAudioDuration(file: File): Promise<number | null> {
  const url = URL.createObjectURL(file);
  try {
    const audio = new Audio(url);
    return await new Promise<number | null>((resolve) => {
      const timeout = window.setTimeout(() => resolve(null), 4000);
      audio.addEventListener("loadedmetadata", () => {
        window.clearTimeout(timeout);
        resolve(Number.isFinite(audio.duration) ? Math.ceil(audio.duration) : null);
      }, { once: true });
      audio.addEventListener("error", () => {
        window.clearTimeout(timeout);
        resolve(null);
      }, { once: true });
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function TimerAudioManagement() {
  const { profile, isAdmin } = useAuth();
  const [cues, setCues] = useState<TimerAudioCue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<TimerAudioEvent>("start");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);
  const recordingSecondsRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const previewUrlRef = useRef<string | null>(null);
  const previewUrlsRef = useRef<Record<string, string>>({});

  const clearRecordingTimer = () => {
    if (recordingIntervalRef.current !== null) window.clearInterval(recordingIntervalRef.current);
    recordingIntervalRef.current = null;
  };

  const releaseMicrophone = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const setAudioFile = (file: File | null, duration: number | null = null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl = file ? URL.createObjectURL(file) : null;
    previewUrlRef.current = nextPreviewUrl;
    setSelectedFile(file);
    setSelectedDuration(duration);
    setPreviewUrl(nextPreviewUrl);
    if (file && !title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
  };

  const fetchCues = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("timer_audio_cues")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Libreria audio non disponibile", { description: "Applica prima la nuova migrazione Supabase." });
    } else {
      setCues((data ?? []) as TimerAudioCue[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    mountedRef.current = true;
    void fetchCues();
    return () => {
      mountedRef.current = false;
      clearRecordingTimer();
      releaseMicrophone();
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      Object.values(previewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (recording && recordingSeconds >= MAX_RECORDING_SECONDS) mediaRecorderRef.current?.stop();
  }, [recording, recordingSeconds]);

  const validateFile = (file: File) => {
    const baseMime = file.type.split(";")[0];
    if (!AUDIO_TYPES.includes(baseMime)) {
      toast.error("Formato non supportato", { description: "Usa MP3, M4A, MP4 audio, WAV, OGG o WebM." });
      return false;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      toast.error("Audio troppo grande", { description: "Il limite è 8 MB per registrazione." });
      return false;
    }
    return true;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !validateFile(file)) return;
    const duration = await readAudioDuration(file);
    if (duration !== null && duration > MAX_RECORDING_SECONDS) {
      toast.error("Audio troppo lungo", { description: `La durata massima è ${MAX_RECORDING_SECONDS} secondi.` });
      event.target.value = "";
      return;
    }
    setAudioFile(file, duration);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Registrazione non supportata", { description: "Puoi comunque caricare un file audio." });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = preferredRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];
      recordingSecondsRef.current = 0;
      setRecordingSeconds(0);

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        const finalMime = recorder.mimeType.split(";")[0] || "audio/webm";
        const blob = new Blob(recordingChunksRef.current, { type: finalMime });
        const file = new File([blob], `voce-coach-${Date.now()}.${extensionForMime(finalMime)}`, { type: finalMime });
        clearRecordingTimer();
        releaseMicrophone();
        if (!mountedRef.current) return;
        setRecording(false);
        if (validateFile(file)) setAudioFile(file, Math.max(1, recordingSecondsRef.current));
      }, { once: true });

      recorder.start(250);
      setRecording(true);
      recordingIntervalRef.current = window.setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
      }, 1000);
    } catch {
      releaseMicrophone();
      toast.error("Microfono non disponibile", { description: "Controlla il permesso del browser o dell'iPhone." });
    }
  };

  const resetForm = () => {
    setTitle("");
    setEventType("start");
    setAudioFile(null);
    recordingSecondsRef.current = 0;
    setRecordingSeconds(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadCue = async () => {
    if (!profile?.user_id || !selectedFile || !title.trim()) {
      toast.error("Completa titolo e registrazione");
      return;
    }

    setSaving(true);
    const baseMime = selectedFile.type.split(";")[0] || "audio/webm";
    const storagePath = `${profile.user_id}/${crypto.randomUUID()}.${extensionForMime(baseMime)}`;

    try {
      const { error: storageError } = await supabase.storage
        .from("timer-audio")
        .upload(storagePath, selectedFile, { contentType: baseMime, cacheControl: "31536000", upsert: false });
      if (storageError) throw storageError;

      const { error: databaseError } = await supabase.from("timer_audio_cues").insert({
        title: title.trim(),
        event_type: eventType,
        storage_path: storagePath,
        mime_type: baseMime,
        duration_seconds: selectedDuration === null ? null : Math.min(selectedDuration, MAX_RECORDING_SECONDS),
        created_by: profile.user_id,
      });
      if (databaseError) {
        await supabase.storage.from("timer-audio").remove([storagePath]);
        throw databaseError;
      }

      toast.success("Audio salvato", { description: "Da ora può essere scelto casualmente dal Timer." });
      resetForm();
      await fetchCues();
    } catch (error) {
      toast.error("Caricamento non riuscito", { description: error instanceof Error ? error.message : "Riprova più tardi." });
    } finally {
      setSaving(false);
    }
  };

  const toggleCue = async (cue: TimerAudioCue) => {
    const { error } = await supabase.from("timer_audio_cues").update({ is_active: !cue.is_active }).eq("id", cue.id);
    if (error) toast.error("Impossibile aggiornare l'audio");
    else setCues((current) => current.map((item) => item.id === cue.id ? { ...item, is_active: !item.is_active } : item));
  };

  const deleteCue = async (cue: TimerAudioCue) => {
    if (!window.confirm(`Eliminare l'audio “${cue.title}”?`)) return;
    const { error: databaseError } = await supabase.from("timer_audio_cues").delete().eq("id", cue.id);
    if (databaseError) {
      toast.error("Impossibile eliminare l'audio");
      return;
    }
    await supabase.storage.from("timer-audio").remove([cue.storage_path]);
    setCues((current) => current.filter((item) => item.id !== cue.id));
    toast.success("Audio eliminato");
  };

  const previewCue = async (cue: TimerAudioCue) => {
    if (previewUrls[cue.id]) {
      setPreviewUrls((current) => {
        const next = { ...current };
        URL.revokeObjectURL(next[cue.id]);
        delete next[cue.id];
        previewUrlsRef.current = next;
        return next;
      });
      return;
    }
    const { data, error } = await supabase.storage.from("timer-audio").download(cue.storage_path);
    if (error) {
      toast.error("Impossibile riprodurre l'audio");
      return;
    }
    setPreviewUrls((current) => {
      const next = { ...current, [cue.id]: URL.createObjectURL(data) };
      previewUrlsRef.current = next;
      return next;
    });
  };

  const content = (
    <div className="mx-auto max-w-5xl space-y-6">
      <Card className="overflow-hidden rounded-3xl border-primary/20">
        <CardHeader className="bg-primary/5">
          <CardTitle className="flex items-center gap-2"><Mic className="h-5 w-5 text-primary" /> Nuovo audio</CardTitle>
          <CardDescription>Registra la voce del coach o carica una frase già pronta. Durata massima 30 secondi.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="timer-audio-title">Titolo</Label>
              <Input id="timer-audio-title" value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} placeholder="Es. Dai che ci siamo!" />
            </div>
            <div className="space-y-2">
              <Label>Quando riprodurlo</Label>
              <Select value={eventType} onValueChange={(value) => setEventType(value as TimerAudioEvent)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMER_AUDIO_EVENTS.map((event) => <SelectItem key={event} value={event}>{TIMER_AUDIO_EVENT_LABELS[event].title}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{TIMER_AUDIO_EVENT_LABELS[eventType].description}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button type="button" variant={recording ? "destructive" : "outline"} className="h-14 rounded-2xl" onClick={recording ? stopRecording : () => void startRecording()}>
              {recording ? <CircleStop className="mr-2 h-5 w-5" /> : <Mic className="mr-2 h-5 w-5" />}
              {recording ? `Ferma · ${formatSeconds(recordingSeconds)}` : "Registra dal microfono"}
            </Button>
            <label className="flex h-14 cursor-pointer items-center justify-center rounded-2xl border border-input bg-background px-4 font-medium hover:bg-accent">
              <Upload className="mr-2 h-5 w-5" /> Carica file audio
              <Input ref={fileInputRef} type="file" accept="audio/*" className="sr-only" onChange={(event) => void handleFileChange(event)} />
            </label>
          </div>

          {recording && (
            <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
              <span className="h-3 w-3 animate-pulse rounded-full bg-destructive" />
              <span className="font-semibold">Registrazione in corso · massimo {MAX_RECORDING_SECONDS} secondi</span>
            </div>
          )}

          {previewUrl && selectedFile && (
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="mb-2 truncate text-sm font-medium">{selectedFile.name}{selectedDuration ? ` · ${selectedDuration}s` : ""}</p>
              <audio controls src={previewUrl} className="w-full" />
            </div>
          )}

          <Button className="h-12 w-full rounded-2xl font-bold" disabled={!selectedFile || !title.trim() || saving || recording} onClick={() => void uploadCue()}>
            {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Volume2 className="mr-2 h-5 w-5" />}
            Salva nella libreria Timer
          </Button>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-2xl tracking-wider">LIBRERIA AUDIO</h2>
          <p className="text-sm text-muted-foreground">Il Timer sceglie casualmente un audio attivo per ogni momento.</p>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        ) : cues.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-10 text-center text-muted-foreground">
            <Radio className="mx-auto mb-3 h-10 w-10 opacity-50" /> Nessun audio personalizzato.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {cues.map((cue) => {
              const canManage = isAdmin || cue.created_by === profile?.user_id;
              return (
                <Card key={cue.id} className="rounded-2xl">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Volume2 className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{cue.title}</p>
                        <p className="text-xs text-muted-foreground">{TIMER_AUDIO_EVENT_LABELS[cue.event_type].title}{cue.duration_seconds ? ` · ${cue.duration_seconds}s` : ""}</p>
                      </div>
                      <Switch checked={cue.is_active} disabled={!canManage} onCheckedChange={() => void toggleCue(cue)} aria-label={`Attiva ${cue.title}`} />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => void previewCue(cue)}>
                        {previewUrls[cue.id] ? <PauseCircle className="mr-2 h-4 w-4" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                        {previewUrls[cue.id] ? "Chiudi" : "Ascolta"}
                      </Button>
                      {canManage && <Button variant="ghost" size="icon" onClick={() => void deleteCue(cue)} aria-label={`Elimina ${cue.title}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                    {previewUrls[cue.id] && <audio controls autoPlay src={previewUrls[cue.id]} className="mt-3 w-full" />}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );

  return isAdmin
    ? <AdminLayout title="AUDIO TIMER" icon={<Mic className="h-6 w-6" />}>{content}</AdminLayout>
    : <CoachLayout title="AUDIO TIMER" icon={<Mic className="h-6 w-6" />}>{content}</CoachLayout>;
}
