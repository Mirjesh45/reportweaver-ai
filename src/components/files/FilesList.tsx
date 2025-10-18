import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { File, Image, Video, FileText, Eye } from "lucide-react";
import { toast } from "sonner";
import { FilePreview } from "./FilePreview";

interface FilesListProps {
  chatId: string | null;
  userId: string;
}

export const FilesList = ({ chatId, userId }: FilesListProps) => {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  useEffect(() => {
    if (chatId) {
      fetchFiles();
    }
  }, [chatId]);

  const fetchFiles = async () => {
    if (!chatId) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("chat_id", chatId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error: any) {
      toast.error("Failed to load files");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return <Image className="w-4 h-4" />;
    if (mimeType.startsWith("video/")) return <Video className="w-4 h-4" />;
    if (mimeType === "application/pdf") return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  if (!chatId) return null;

  return (
    <>
      <div className="border-l border-border w-64 bg-sidebar flex flex-col">
        <div className="p-4 border-b border-sidebar-border">
          <h3 className="font-semibold text-sm">Uploaded Files</h3>
        </div>

        <ScrollArea className="flex-1 p-2">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-sidebar-accent rounded-lg animate-pulse" />
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="text-center text-muted-foreground p-4">
              <File className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No files uploaded</p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="p-3 rounded-lg bg-sidebar-accent hover:bg-sidebar-accent/70 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-1">
                      {getFileIcon(file.mime_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0"
                      onClick={() => setSelectedFileId(file.id)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <FilePreview
        fileId={selectedFileId}
        onClose={() => setSelectedFileId(null)}
      />
    </>
  );
};
