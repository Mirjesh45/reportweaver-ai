import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";

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

      // Call report generation function to get HTML content
      const { data, error: functionError } = await supabase.functions.invoke("generate-report", {
        body: {
          chatId,
          messages,
          files,
        },
      });

      if (functionError) throw functionError;

      // Create PDF from HTML content
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      let yPos = margin;

      // Title
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.text("AI Report", margin, yPos);
      yPos += 10;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
      yPos += 15;

      // Extract text from HTML and add to PDF
      const parser = new DOMParser();
      const doc = parser.parseFromString(data.htmlContent, 'text/html');
      
      // Add summary
      const summaryText = doc.querySelector('.summary p')?.textContent || '';
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Executive Summary", margin, yPos);
      yPos += 8;
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const summaryLines = pdf.splitTextToSize(summaryText, pageWidth - 2 * margin);
      pdf.text(summaryLines, margin, yPos);
      yPos += summaryLines.length * 5 + 10;

      // Add messages
      messages?.forEach((msg: any) => {
        if (yPos > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
        }

        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text(msg.role === 'user' ? 'User:' : 'Assistant:', margin, yPos);
        yPos += 6;

        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        const contentLines = pdf.splitTextToSize(msg.content, pageWidth - 2 * margin);
        pdf.text(contentLines, margin, yPos);
        yPos += contentLines.length * 5 + 8;
      });

      // Save PDF
      const filename = `report_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(filename);

      // Also open in new tab
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');

      // Save report metadata
      await supabase.from("reports").insert({
        user_id: userId,
        chat_id: chatId,
        title: `Report - ${new Date().toLocaleDateString()}`,
        pdf_path: filename,
        metadata: {
          messageCount: messages?.length || 0,
          fileCount: files?.length || 0,
        },
      });

      toast.success("Report generated and opened!");
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
