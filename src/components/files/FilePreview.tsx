import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, FileText, Image as ImageIcon, Video, File } from "lucide-react";
import { toast } from "sonner";

interface FilePreviewProps {
  fileId: string | null;
  onClose: () => void;
}

export const FilePreview = ({ fileId, onClose }: FilePreviewProps) => {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileData, setFileData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (fileId) {
      loadFile();
    }
  }, [fileId]);

  const loadFile = async () => {
    if (!fileId) return;
    setLoading(true);

    try {
      // Get file metadata
      const { data: file, error: metaError } = await supabase
        .from("files")
        .select("*")
        .eq("id", fileId)
        .single();

      if (metaError) throw metaError;
      setFileData(file);

      // Get signed URL
      const { data: urlData, error: urlError } = await supabase.storage
        .from("files")
        .createSignedUrl(file.file_path, 3600);

      if (urlError) throw urlError;
      setFileUrl(urlData.signedUrl);
    } catch (error: any) {
      toast.error("Failed to load file");
      console.error(error);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async () => {
    if (!fileUrl || !fileData) return;

    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileData.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("File downloaded");
    } catch (error) {
      toast.error("Failed to download file");
    }
  };

  const renderPreview = () => {
    if (loading) {
      return <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>;
    }

    if (!fileUrl || !fileData) return null;

    const mimeType = fileData.mime_type;

    if (mimeType.startsWith("image/")) {
      return (
        <div className="flex items-center justify-center p-4">
          <img 
            src={fileUrl} 
            alt={fileData.filename} 
            className="max-h-[70vh] max-w-full object-contain rounded-lg"
          />
        </div>
      );
    }

    if (mimeType.startsWith("video/")) {
      return (
        <div className="flex items-center justify-center p-4">
          <video 
            src={fileUrl} 
            controls 
            className="max-h-[70vh] max-w-full rounded-lg"
          />
        </div>
      );
    }

    if (mimeType === "application/pdf") {
      return (
        <div className="h-[70vh] w-full">
          <iframe 
            src={fileUrl} 
            className="w-full h-full rounded-lg"
            title={fileData.filename}
          />
        </div>
      );
    }

    // Default preview for other files
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center">
          <File className="w-10 h-10 text-muted-foreground" />
        </div>
        <p className="text-lg font-medium">{fileData.filename}</p>
        <p className="text-sm text-muted-foreground">
          {(fileData.size / 1024).toFixed(2)} KB
        </p>
        <Button onClick={downloadFile} className="bg-gradient-ai">
          <Download className="w-4 h-4 mr-2" />
          Download File
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={!!fileId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="truncate">{fileData?.filename}</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={downloadFile}
                disabled={!fileUrl}
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        {renderPreview()}
      </DialogContent>
    </Dialog>
  );
};
