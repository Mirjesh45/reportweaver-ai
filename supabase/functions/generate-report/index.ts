import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { chatId, messages, files } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Create a summary of the conversation using AI
    const conversationText = messages
      .map((m: any) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const summaryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are an expert report writer. Create a comprehensive executive summary of the following conversation. Include key points, insights, and recommendations.",
          },
          {
            role: "user",
            content: `Please create an executive summary of this conversation:\n\n${conversationText}`,
          },
        ],
      }),
    });

    if (!summaryResponse.ok) {
      throw new Error("Failed to generate summary");
    }

    const summaryData = await summaryResponse.json();
    const summary = summaryData.choices[0].message.content;

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesRomanBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);
    
    let page = pdfDoc.addPage([595, 842]); // A4 size
    let yPosition = 800;
    const margin = 50;
    const pageWidth = 595 - 2 * margin;
    
    // Helper function to add new page if needed
    const checkAndAddPage = (requiredSpace: number) => {
      if (yPosition - requiredSpace < 50) {
        page = pdfDoc.addPage([595, 842]);
        yPosition = 800;
        return true;
      }
      return false;
    };
    
    // Helper function to draw wrapped text
    const drawWrappedText = (text: string, fontSize: number, font: any, maxWidth: number) => {
      const words = text.split(' ');
      let line = '';
      const lines: string[] = [];
      
      words.forEach(word => {
        const testLine = line + (line ? ' ' : '') + word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        if (testWidth > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = testLine;
        }
      });
      if (line) lines.push(line);
      
      lines.forEach((line) => {
        checkAndAddPage(fontSize + 5);
        page.drawText(line, {
          x: margin,
          y: yPosition,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0),
        });
        yPosition -= fontSize + 5;
      });
    };
    
    // Title
    page.drawText('AI REPORT', {
      x: margin,
      y: yPosition,
      size: 24,
      font: timesRomanBoldFont,
      color: rgb(0.23, 0.51, 0.96),
    });
    yPosition -= 40;
    
    // Metadata section
    page.drawText('Report Information', {
      x: margin,
      y: yPosition,
      size: 16,
      font: timesRomanBoldFont,
      color: rgb(0.39, 0.40, 0.95),
    });
    yPosition -= 25;
    
    page.drawText(`Generated: ${new Date().toLocaleString()}`, {
      x: margin,
      y: yPosition,
      size: 12,
      font: timesRomanFont,
    });
    yPosition -= 20;
    
    page.drawText(`Messages: ${messages.length}`, {
      x: margin,
      y: yPosition,
      size: 12,
      font: timesRomanFont,
    });
    yPosition -= 20;
    
    page.drawText(`Files: ${files?.length || 0}`, {
      x: margin,
      y: yPosition,
      size: 12,
      font: timesRomanFont,
    });
    yPosition -= 40;
    
    // Executive Summary
    checkAndAddPage(50);
    page.drawText('Executive Summary', {
      x: margin,
      y: yPosition,
      size: 16,
      font: timesRomanBoldFont,
      color: rgb(0.39, 0.40, 0.95),
    });
    yPosition -= 25;
    
    drawWrappedText(summary, 11, timesRomanFont, pageWidth);
    yPosition -= 30;
    
    // Conversation Transcript
    checkAndAddPage(50);
    page.drawText('Conversation Transcript', {
      x: margin,
      y: yPosition,
      size: 16,
      font: timesRomanBoldFont,
      color: rgb(0.39, 0.40, 0.95),
    });
    yPosition -= 25;
    
    messages.forEach((m: any) => {
      checkAndAddPage(60);
      
      page.drawText(m.role.toUpperCase(), {
        x: margin,
        y: yPosition,
        size: 10,
        font: timesRomanBoldFont,
        color: m.role === 'user' ? rgb(0.23, 0.51, 0.96) : rgb(0.39, 0.40, 0.95),
      });
      yPosition -= 15;
      
      drawWrappedText(m.content, 10, timesRomanFont, pageWidth);
      yPosition -= 15;
    });
    
    // Files section
    if (files && files.length > 0) {
      checkAndAddPage(50);
      page.drawText('Attached Files', {
        x: margin,
        y: yPosition,
        size: 16,
        font: timesRomanBoldFont,
        color: rgb(0.39, 0.40, 0.95),
      });
      yPosition -= 25;
      
      files.forEach((f: any) => {
        checkAndAddPage(80);
        
        page.drawText(`${f.filename} (${(f.size / 1024).toFixed(2)} KB)`, {
          x: margin,
          y: yPosition,
          size: 11,
          font: timesRomanBoldFont,
        });
        yPosition -= 18;
        
        if (f.file_hash) {
          page.drawText('Blockchain Verified', {
            x: margin + 10,
            y: yPosition,
            size: 9,
            font: timesRomanBoldFont,
            color: rgb(0.12, 0.25, 0.69),
          });
          yPosition -= 15;
          
          const hashText = `Hash: ${f.file_hash}`;
          const hashWords = hashText.match(/.{1,80}/g) || [hashText];
          hashWords.forEach(part => {
            checkAndAddPage(15);
            page.drawText(part, {
              x: margin + 10,
              y: yPosition,
              size: 8,
              font: courierFont,
              color: rgb(0.28, 0.33, 0.41),
            });
            yPosition -= 12;
          });
          
          if (f.verified_at) {
            page.drawText(`Verified: ${new Date(f.verified_at).toLocaleString()}`, {
              x: margin + 10,
              y: yPosition,
              size: 8,
              font: timesRomanFont,
              color: rgb(0.02, 0.59, 0.41),
            });
            yPosition -= 15;
          }
        }
        
        if (f.ocr_text) {
          checkAndAddPage(20);
          page.drawText('Extracted Text (OCR):', {
            x: margin + 10,
            y: yPosition,
            size: 9,
            font: timesRomanBoldFont,
            color: rgb(0.57, 0.25, 0.05),
          });
          yPosition -= 15;
          
          drawWrappedText(f.ocr_text, 8, timesRomanFont, pageWidth - 20);
        }
        
        yPosition -= 20;
      });
    }
    
    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const fileName = `${chatId}/${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("reports")
      .upload(fileName, new Blob([pdfBytes], { type: "application/pdf" }), {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("reports")
      .getPublicUrl(fileName);

    return new Response(
      JSON.stringify({
        pdfPath: fileName,
        downloadUrl: urlData.publicUrl,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-report function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
