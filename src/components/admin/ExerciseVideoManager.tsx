import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Upload, Video, Trash2, Play, X } from "lucide-react";

interface ExerciseVideo {
  id: string;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  created_at: string;
}

interface ExerciseVideoManagerProps {
  exerciseId: string;
  exerciseName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ExerciseVideoManager = ({
  exerciseId,
  exerciseName,
  open,
  onOpenChange
}: ExerciseVideoManagerProps) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [videos, setVideos] = useState<ExerciseVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newVideoTitle, setNewVideoTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (open && exerciseId) {
      fetchVideos();
      setNewVideoTitle("");
      setSelectedFile(null);
    }
  }, [open, exerciseId]);

  const fetchVideos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("exercise_videos")
      .select("*")
      .eq("exercise_id", exerciseId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching videos:", error);
    } else {
      setVideos(data || []);
    }
    setLoading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
      if (!file.type.startsWith("video/")) {
        toast({
          title: "Errore",
          description: "Seleziona un file video valido",
          variant: "destructive"
        });
        return;
      }
      // Check file size (max 100MB)
      if (file.size > 100 * 1024 * 1024) {
        toast({
          title: "Errore",
          description: "Il file è troppo grande (max 100MB)",
          variant: "destructive"
        });
        return;
      }
      setSelectedFile(file);
      if (!newVideoTitle) {
        setNewVideoTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const uploadVideo = async () => {
    if (!selectedFile || !newVideoTitle) {
      toast({
        title: "Errore",
        description: "Seleziona un file e inserisci un titolo",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    setUploadProgress(10);

    try {
      // Generate unique filename
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${exerciseId}/${Date.now()}.${fileExt}`;

      setUploadProgress(30);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("exercise-videos")
        .upload(fileName, selectedFile, {
          cacheControl: "3600",
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      setUploadProgress(70);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("exercise-videos")
        .getPublicUrl(fileName);

      setUploadProgress(85);

      // Save to database
      const { error: dbError } = await supabase
        .from("exercise_videos")
        .insert({
          exercise_id: exerciseId,
          coach_id: profile?.user_id,
          title: newVideoTitle,
          video_url: urlData.publicUrl,
          duration_seconds: null
        });

      if (dbError) {
        throw dbError;
      }

      setUploadProgress(100);

      toast({
        title: "Video caricato",
        description: "Il video è stato aggiunto all'esercizio"
      });

      setNewVideoTitle("");
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      fetchVideos();

    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile caricare il video",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const deleteVideo = async (video: ExerciseVideo) => {
    if (!confirm(`Eliminare il video "${video.title}"?`)) return;

    // Extract file path from URL
    const url = new URL(video.video_url);
    const pathParts = url.pathname.split("/");
    const filePath = pathParts.slice(-2).join("/"); // exerciseId/filename.ext

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("exercise-videos")
      .remove([filePath]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from("exercise_videos")
      .delete()
      .eq("id", video.id);

    if (dbError) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare il video",
        variant: "destructive"
      });
    } else {
      toast({ title: "Video eliminato" });
      fetchVideos();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider flex items-center gap-2">
            <Video className="w-5 h-5" />
            Video Dimostrativi
          </DialogTitle>
          <DialogDescription>
            Gestisci i video per l'esercizio: <strong>{exerciseName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Upload section */}
          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium mb-3">Carica nuovo video</h4>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Titolo video *</Label>
                  <Input
                    value={newVideoTitle}
                    onChange={(e) => setNewVideoTitle(e.target.value)}
                    placeholder="Es. Esecuzione corretta squat"
                    disabled={uploading}
                  />
                </div>

                <div className="space-y-2">
                  <Label>File video *</Label>
                  <div className="flex gap-2">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*"
                      onChange={handleFileSelect}
                      disabled={uploading}
                      className="flex-1"
                    />
                  </div>
                  {selectedFile && (
                    <p className="text-sm text-muted-foreground">
                      Selezionato: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
                    </p>
                  )}
                </div>

                {uploading && (
                  <div className="space-y-2">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      Caricamento in corso... {uploadProgress}%
                    </p>
                  </div>
                )}

                <Button 
                  onClick={uploadVideo} 
                  disabled={!selectedFile || !newVideoTitle || uploading}
                  className="w-full gap-2"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {uploading ? "Caricamento..." : "Carica Video"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Videos list */}
          <div className="space-y-3">
            <h4 className="font-medium">Video esistenti</h4>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : videos.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground">
                <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nessun video caricato per questo esercizio</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {videos.map((video) => (
                  <Card key={video.id}>
                    <CardContent className="p-3 flex items-center gap-4">
                      <div className="w-24 h-16 bg-muted rounded flex items-center justify-center flex-shrink-0">
                        <Play className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium truncate">{video.title}</h5>
                        <a 
                          href={video.video_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          Apri video ↗
                        </a>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteVideo(video)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExerciseVideoManager;
