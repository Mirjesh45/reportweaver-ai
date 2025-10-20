import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Generate executive summary using AI
    const conversationText = messages.map((m: any) => 
      `${m.role}: ${m.content}`
    ).join('\n');

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
            content: "You are a professional report writer. Create a concise executive summary of this conversation.",
          },
          {
            role: "user",
            content: conversationText,
          },
        ],
      }),
    });

    const summaryData = await summaryResponse.json();
    const executiveSummary = summaryData.choices[0].message.content;

    // Create HTML content that will be converted to PDF on client side
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Chat Report</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }
    h1 { color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px; }
    h2 { color: #4F46E5; margin-top: 30px; }
    .message { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px; }
    .user { background: #e3f2fd; }
    .assistant { background: #f3e5f5; }
    .file-info { background: #fff3e0; padding: 10px; margin: 10px 0; border-left: 4px solid #ff9800; }
    .summary { background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; }
  </style>
</head>
<body>
  <h1>AI Report</h1>
  <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
  
  <div class="summary">
    <h2>Executive Summary</h2>
    <p>${executiveSummary}</p>
  </div>

  <h2>Conversation Transcript</h2>
  ${messages.map((msg: any) => `
    <div class="message ${msg.role}">
      <strong>${msg.role === 'user' ? 'User' : 'Assistant'}:</strong>
      <p>${msg.content}</p>
      <small>${new Date(msg.created_at).toLocaleString()}</small>
    </div>
  `).join('')}

  ${files && files.length > 0 ? `
    <h2>Attached Files</h2>
    ${files.map((file: any) => `
      <div class="file-info">
        <p><strong>File:</strong> ${file.filename}</p>
        <p><strong>Size:</strong> ${(file.file_size / 1024).toFixed(2)} KB</p>
        ${file.extracted_text ? `<p><strong>OCR Text:</strong> ${file.extracted_text.substring(0, 200)}...</p>` : ''}
        ${file.blockchain_hash ? `<p><strong>Blockchain Hash:</strong> ${file.blockchain_hash}</p>` : ''}
      </div>
    `).join('')}
  ` : ''}
</body>
</html>`;

    return new Response(
      JSON.stringify({ htmlContent }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating report:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
