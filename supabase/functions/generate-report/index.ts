import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

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

    // Generate print-friendly HTML report
    const htmlReport = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>AI Report - ${new Date().toLocaleDateString()}</title>
  <style>
    @media print {
      body { margin: 0; padding: 20px; }
      .no-print { display: none; }
      .page-break { page-break-before: always; }
    }
    @media screen {
      body {
        max-width: 210mm;
        margin: 0 auto;
        padding: 20mm;
        background: #f5f5f5;
      }
      .page {
        background: white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        margin-bottom: 20px;
        padding: 20mm;
      }
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      line-height: 1.6;
      color: #1a1a1a;
      font-size: 12pt;
    }
    h1 {
      color: #3b82f6;
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 10px;
      margin-bottom: 30px;
      font-size: 24pt;
    }
    h2 {
      color: #6366f1;
      margin-top: 30px;
      font-size: 18pt;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 5px;
    }
    .metadata {
      background: #f3f4f6;
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 30px;
    }
    .metadata p {
      margin: 5px 0;
    }
    .message {
      margin: 15px 0;
      padding: 12px;
      border-left: 4px solid #e5e7eb;
      break-inside: avoid;
    }
    .message.user {
      border-left-color: #3b82f6;
      background: #eff6ff;
    }
    .message.assistant {
      border-left-color: #6366f1;
      background: #eef2ff;
    }
    .message-role {
      font-weight: 700;
      margin-bottom: 5px;
      text-transform: uppercase;
      font-size: 10pt;
      color: #4b5563;
    }
    .file-section {
      background: #f9fafb;
      padding: 15px;
      border-radius: 6px;
      margin-top: 30px;
      break-inside: avoid;
    }
    .file-item {
      padding: 10px;
      margin: 8px 0;
      background: white;
      border-radius: 4px;
      border: 1px solid #e5e7eb;
      break-inside: avoid;
    }
    .blockchain-badge {
      display: inline-block;
      background: #dbeafe;
      color: #1e40af;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 9pt;
      font-weight: 600;
      margin-top: 8px;
    }
    .hash-text {
      font-family: 'Courier New', monospace;
      font-size: 8pt;
      color: #6b7280;
      word-break: break-all;
      margin-top: 5px;
    }
    .ocr-section {
      background: #fef3c7;
      padding: 10px;
      border-radius: 4px;
      margin-top: 8px;
      border-left: 3px solid #f59e0b;
    }
    .ocr-label {
      font-weight: 600;
      font-size: 10pt;
      color: #92400e;
      margin-bottom: 5px;
    }
    .print-button {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #3b82f6;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14pt;
      font-weight: 600;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 1000;
    }
    .print-button:hover {
      background: #2563eb;
    }
    @media print {
      .print-button { display: none; }
    }
  </style>
</head>
<body>
  <button class="print-button no-print" onclick="window.print()">💾 Save as PDF</button>
  
  <div class="page">
    <h1>AI Report</h1>
    
    <div class="metadata">
      <h2 style="margin-top: 0; font-size: 14pt;">Report Information</h2>
      <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
      <p><strong>Messages:</strong> ${messages.length}</p>
      <p><strong>Files:</strong> ${files?.length || 0}</p>
    </div>

    <h2>Executive Summary</h2>
    <div style="white-space: pre-wrap; text-align: justify;">${summary}</div>

    <h2>Conversation Transcript</h2>
    ${messages
      .map(
        (m: any) => `
    <div class="message ${m.role}">
      <div class="message-role">${m.role}</div>
      <div style="white-space: pre-wrap;">${m.content}</div>
    </div>
  `
      )
      .join("")}

    ${
      files && files.length > 0
        ? `
    <div class="file-section">
      <h2 style="margin-top: 0;">Attached Files</h2>
      ${files
        .map(
          (f: any) => `
        <div class="file-item">
          <strong style="font-size: 11pt;">${f.filename}</strong>
          <span style="color: #6b7280; margin-left: 10px;">(${(f.size / 1024).toFixed(2)} KB)</span>
          
          ${f.file_hash ? `
          <div class="blockchain-badge">🔒 Blockchain Verified</div>
          <div class="hash-text">Hash: ${f.file_hash}</div>
          ${f.verified_at ? `<div style="color: #059669; font-size: 9pt; margin-top: 3px;">✓ Verified: ${new Date(f.verified_at).toLocaleString()}</div>` : ''}
          ` : ''}
          
          ${f.ocr_text ? `
          <div class="ocr-section">
            <div class="ocr-label">📝 Extracted Text (OCR):</div>
            <div style="white-space: pre-wrap; font-size: 10pt; color: #451a03;">${f.ocr_text}</div>
          </div>
          ` : ''}
        </div>
      `
        )
        .join("")}
    </div>
    `
        : ""
    }
  </div>

  <script>
    // Auto-focus for easy keyboard shortcut (Ctrl+P)
    window.onload = function() {
      console.log('Report ready. Press Ctrl+P or click "Save as PDF" button to download.');
    };
  </script>
</body>
</html>
    `;

    // Save HTML report to storage
    const fileName = `${chatId}/${Date.now()}.html`;
    const { error: uploadError } = await supabase.storage
      .from("reports")
      .upload(fileName, new Blob([htmlReport], { type: "text/html" }), {
        contentType: "text/html",
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
