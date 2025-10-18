import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ReportGeneratorProps {
  chatId: string;
  userId: string;
}

export const ReportGenerator = ({ chatId, userId }: ReportGeneratorProps) => {
  const [generating, setGenerating] = useState(false);

  const generateReport = async () => {
    setGenerating(true);

    try {
      // Fetch all messages from the chat
      const { data: messages, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;

      // Fetch all files related to this chat
      const { data: files, error: filesError } = await supabase
        .from("files")
        .select("*")
        .eq("chat_id", chatId);

      if (filesError) throw filesError;

      // Call report generation function
      const { data, error: functionError } = await supabase.functions.invoke("generate-report", {
        body: {
          chatId,
          messages,
          files,
        },
      });

      if (functionError) throw functionError;

      // Save report metadata
      await supabase.from("reports").insert({
        user_id: userId,
        chat_id: chatId,
        title: `Report - ${new Date().toLocaleDateString()}`,
        pdf_path: data.pdfPath,
        metadata: {
          messageCount: messages?.length || 0,
          fileCount: files?.length || 0,
        },
      });

      toast.success("Report generated successfully!");
      
      // Download the report
      window.open(data.downloadUrl, "_blank");
    } catch (error: any) {
      toast.error("Failed to generate report");
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed top-4 right-4 z-10">
      <Button
        onClick={generateReport}
        disabled={generating}
        className="bg-gradient-ai hover:opacity-90 transition-opacity"
      >
        {generating ? (
          <>
            <div className="w-4 h-4 mr-2 border-2 border-background border-t-transparent rounded-full animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <FileText className="w-4 h-4 mr-2" />
            Generate Report
          </>
        )}
      </Button>
    </div>
  );
};
