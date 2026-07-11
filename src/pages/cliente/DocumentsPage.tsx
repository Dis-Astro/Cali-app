import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar, ExternalLink, FileText, HardDrive, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getOfflineCache, setOfflineCache } from "@/lib/offlineSync";
import ClientLayout from "@/components/coaching/ClientLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Document {
  id: string;
  name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

const DocumentsPage = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    if (profile?.user_id) void fetchDocuments();
  }, [profile?.user_id]);

  const fetchDocuments = async () => {
    if (!profile?.user_id) return;
    setLoading(true);
    const cacheKey = `documents:${profile.user_id}`;
    const cached = await getOfflineCache<Document[]>(cacheKey);

    if (cached) {
      setDocuments(cached.value);
      setFromCache(true);
    }

    if (!navigator.onLine) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("client_documents")
        .select("*")
        .eq("user_id", profile.user_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const normalized = (data || []) as Document[];
      setDocuments(normalized);
      setFromCache(false);
      await setOfflineCache(cacheKey, normalized);
    } catch {
      if (!cached) setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string | null) => {
    if (!type) return "📄";
    if (type.includes("pdf")) return "📕";
    if (type.includes("image")) return "🖼️";
    if (type.includes("word") || type.includes("document")) return "📘";
    if (type.includes("sheet") || type.includes("excel")) return "📊";
    return "📄";
  };

  return (
    <ClientLayout title="DOCUMENTI">
      {loading && !documents.length ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <Card className="rounded-3xl">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="flex items-center gap-2 font-display tracking-wider"><FileText className="h-5 w-5 text-primary" />I miei documenti</CardTitle>
              {fromCache && <Badge variant="outline">Elenco disponibile offline</Badge>}
            </div>
            <CardDescription>I file già aperti possono dipendere dalla cache del dispositivo; l’elenco resta sempre consultabile.</CardDescription>
          </CardHeader>
          <CardContent>
            {!documents.length ? (
              <div className="py-12 text-center text-muted-foreground"><FileText className="mx-auto mb-4 h-12 w-12 opacity-50" /><p>Nessun documento disponibile</p></div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between gap-3 rounded-2xl border p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="text-2xl">{getFileIcon(doc.file_type)}</span>
                      <div className="min-w-0">
                        <h4 className="break-words font-medium">{doc.name}</h4>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(parseISO(doc.created_at), "dd MMM yyyy", { locale: it })}</span>
                          {doc.file_size && <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" />{formatFileSize(doc.file_size)}</span>}
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild disabled={!navigator.onLine}>
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="gap-2"><ExternalLink className="h-4 w-4" /><span className="hidden sm:inline">Apri</span></a>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </ClientLayout>
  );
};

export default DocumentsPage;
