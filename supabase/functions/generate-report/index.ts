import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

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

    // Generate HTML report
    const htmlReport = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>AI Report</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      line-height: 1.6;
      color: #1a1a1a;
    }
    h1 {
      color: #3b82f6;
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 10px;
      margin-bottom: 30px;
    }
    h2 {
      color: #6366f1;
      margin-top: 30px;
    }
    .metadata {
      background: #f3f4f6;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .message {
      margin: 20px 0;
      padding: 15px;
      border-left: 4px solid #e5e7eb;
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
      font-weight: 600;
      margin-bottom: 5px;
      text-transform: uppercase;
      font-size: 0.875rem;
    }
    .files {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      margin-top: 30px;
    }
    .file-item {
      padding: 10px;
      margin: 5px 0;
      background: white;
      border-radius: 4px;
      border: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <h1>AI Report</h1>
  
  <div class="metadata">
    <h2>Report Information</h2>
    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Messages:</strong> ${messages.length}</p>
    <p><strong>Files:</strong> ${files?.length || 0}</p>
  </div>

  <h2>Executive Summary</h2>
  <div style="white-space: pre-wrap;">${summary}</div>

  <h2>Conversation Transcript</h2>
  ${messages
    .map(
      (m: any) => `
    <div class="message ${m.role}">
      <div class="message-role">${m.role}</div>
      <div>${m.content}</div>
    </div>
  `
    )
    .join("")}

  ${
    files && files.length > 0
      ? `
  <div class="files">
    <h2>Attached Files</h2>
    ${files
      .map(
        (f: any) => `
      <div class="file-item">
        <strong>${f.filename}</strong> (${(f.size / 1024).toFixed(2)} KB)
      </div>
    `
      )
      .join("")}
  </div>
  `
      : ""
  }

</body>
</html>
    `;

    // In a production app, you would convert this to PDF and upload to storage
    // For now, we'll return the HTML as a data URL
    const base64Html = btoa(unescape(encodeURIComponent(htmlReport)));
    const downloadUrl = `data:text/html;base64,${base64Html}`;

    return new Response(
      JSON.stringify({
        pdfPath: `reports/${chatId}/${Date.now()}.html`,
        downloadUrl,
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
