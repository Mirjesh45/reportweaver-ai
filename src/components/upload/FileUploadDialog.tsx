import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, File, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface FileUploadDialogProps {
  userId: string;
  chatId: string | null;
}

export const FileUploadDialog = ({ userId, chatId }: FileUploadDialogProps) => {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);

    try {
      for (const file of selectedFiles) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("files")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Save file metadata to database
        await supabase.from("files").insert({
          user_id: userId,
          chat_id: chatId,
          filename: file.name,
          mime_type: file.type,
          file_path: fileName,
          size: file.size,
        });
      }

      toast.success(`${selectedFiles.length} file(s) uploaded successfully`);
      setSelectedFiles([]);
      setOpen(false);
    } catch (error: any) {
      toast.error("Failed to upload files");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg bg-gradient-ai hover:opacity-90 transition-opacity border-0"
        >
          <Upload className="w-6 h-6 text-background" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            Upload images, documents, or videos to include in your report.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
              accept="image/*,video/*,.pdf,.doc,.docx"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Click to select files or drag and drop
              </p>
            </label>
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-secondary rounded-lg"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <File className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm truncate">{file.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(index)}
                    className="flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={uploadFiles}
            disabled={selectedFiles.length === 0 || uploading}
            className="w-full bg-gradient-ai hover:opacity-90 transition-opacity"
          >
            {uploading ? "Uploading..." : `Upload ${selectedFiles.length} file(s)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
