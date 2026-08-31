import { useState } from "react";
import { Camera, CameraErrorCode } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { Loader2, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ExerciseVideoRecorderProps {
  exerciseName: string | null;
}

const ExerciseVideoRecorder = ({ exerciseName }: ExerciseVideoRecorderProps) => {
  const [opening, setOpening] = useState(false);

  if (!Capacitor.isNativePlatform()) return null;

  const recordVideo = async () => {
    setOpening(true);
    try {
      const permissions = await Camera.requestPermissions({ permissions: ["camera", "photos"] });
      if (permissions.camera === "denied" || permissions.photos === "denied") {
        toast.error("Consenti Fotocamera e Foto dalle Impostazioni dell’iPhone per registrare l’esercizio.");
        return;
      }

      const result = await Camera.recordVideo({
        saveToGallery: true,
        isPersistent: false,
        includeMetadata: false,
      });

      if (result.saved === false) {
        toast.warning("Video registrato, ma non salvato in Foto. Controlla i permessi dell’app.");
        return;
      }

      toast.success(`Video${exerciseName ? ` di ${exerciseName}` : ""} salvato in Foto`);
    } catch (error) {
      const cameraError = error as { code?: string; message?: string };
      if (cameraError.code !== CameraErrorCode.RecordVideoCancelled) {
        toast.error(cameraError.message || "Registrazione video non riuscita");
      }
    } finally {
      setOpening(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2 rounded-xl"
      onClick={() => void recordVideo()}
      disabled={opening}
      aria-label={`Registra video${exerciseName ? ` per ${exerciseName}` : ""}`}
    >
      {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
      {opening ? "Apertura…" : "Registra video"}
    </Button>
  );
};

export default ExerciseVideoRecorder;
