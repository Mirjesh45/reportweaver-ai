import { User, Bot, File, Image as ImageIcon, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  content_type?: string;
  file_id?: string;
}

interface FileData {
  id: string;
  filename: string;
  mime_type: string;
  file_path: string;
  size: number;
  ocr_text?: string;
  file_hash?: string;
  verified_at?: string;
}

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage = ({ message }: ChatMessageProps) => {
  const isUser = message.role === "user";
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [fileUrl, setFileUrl] = useState<string>("");

  useEffect(() => {
    if (message.file_id) {
      fetchFileData();
    }
  }, [message.file_id]);

  const fetchFileData = async () => {
    if (!message.file_id) return;

    try {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("id", message.file_id)
        .single();

      if (error) throw error;
      setFileData(data);

      // Get public URL for the file
      const { data: urlData } = supabase.storage
        .from("files")
        .getPublicUrl(data.file_path);
      setFileUrl(urlData.publicUrl);
    } catch (error) {
      console.error("Error fetching file data:", error);
    }
  };

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? "bg-primary" : "bg-gradient-ai"
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-primary-foreground" />
        ) : (
          <Bot className="w-4 h-4 text-background" />
        )}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-card border border-border"
        }`}
      >
        {fileData ? (
          <div className="space-y-3">
            {fileData.mime_type.startsWith("image/") && fileUrl && (
              <img
                src={fileUrl}
                alt={fileData.filename}
                className="rounded-lg max-w-full max-h-64 object-contain"
              />
            )}
            <div className="flex items-start gap-2">
              {fileData.mime_type.startsWith("image/") ? (
                <ImageIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ) : (
                <File className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{fileData.filename}</p>
                <p className="text-xs opacity-70">
                  {(fileData.size / 1024).toFixed(2)} KB
                </p>
              </div>
              {fileData.file_hash && (
                <ShieldCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
              )}
            </div>
            {fileData.ocr_text && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs font-semibold mb-1">Extracted Text:</p>
                <p className="text-xs opacity-90 whitespace-pre-wrap">{fileData.ocr_text}</p>
              </div>
            )}
            {fileData.file_hash && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs font-semibold mb-1">Blockchain Hash:</p>
                <p className="text-xs font-mono opacity-70 break-all">{fileData.file_hash}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        )}
      </div>
    </div>
  );
};
