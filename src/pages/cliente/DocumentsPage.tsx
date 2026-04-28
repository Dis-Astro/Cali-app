import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Download,
  ExternalLink,
  Loader2,
  Calendar,
  HardDrive
} from "lucide-react";
import ClientLayout from "@/components/coaching/ClientLayout";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";

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

  useEffect(() => {
    if (profile?.user_id) {
      fetchDocuments();
    }
  }, [profile?.user_id]);

  const fetchDocuments = async () => {
    setLoading(true);
    
    const { data } = await supabase
      .from("client_documents")
      .select("*")
      .eq("user_id", profile?.user_id)
      .order("created_at", { ascending: false });

    setDocuments(data || []);
    setLoading(false);
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
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="font-display tracking-wider flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              I Miei Documenti
            </CardTitle>
            <CardDescription>Documenti caricati dal tuo coach</CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nessun documento disponibile</p>
                <p className="text-sm mt-1">I tuoi documenti appariranno qui</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map(doc => (
                  <div 
                    key={doc.id} 
                    className="flex items-center justify-between p-4 rounded-lg border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{getFileIcon(doc.file_type)}</span>
                      <div>
                        <h4 className="font-medium">{doc.name}</h4>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(parseISO(doc.created_at), "dd MMM yyyy", { locale: it })}
                          </span>
                          {doc.file_size && (
                            <span className="flex items-center gap-1">
                              <HardDrive className="w-3 h-3" />
                              {formatFileSize(doc.file_size)}
                            </span>
                          )}
                          {doc.file_type && (
                            <Badge variant="outline" className="text-xs uppercase">
                              {doc.file_type.split("/").pop()}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <Button variant="outline" size="sm" asChild>
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="gap-2">
                        <ExternalLink className="w-4 h-4" />
                        Apri
                      </a>
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
