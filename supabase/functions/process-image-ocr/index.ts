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
    const { fileId, fileUrl } = await req.json();
    
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

    console.log("Processing OCR for file:", fileId);

    // Download the image to generate hash
    const imageResponse = await fetch(fileUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    
    // Generate SHA-256 hash for blockchain verification
    const hashBuffer = await crypto.subtle.digest("SHA-256", imageBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    console.log("Generated file hash:", fileHash);

    // Perform OCR using Lovable AI's vision model
    const ocrResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all text from this image. Provide the text in a structured format, including any labels, values, and relevant information you can identify. If there's no text, say 'No text detected'."
              },
              {
                type: "image_url",
                image_url: {
                  url: fileUrl
                }
              }
            ]
          }
        ],
      }),
    });

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      console.error("OCR API error:", ocrResponse.status, errorText);
      throw new Error(`Failed to perform OCR: ${ocrResponse.status}`);
    }

    const ocrData = await ocrResponse.json();
    const extractedText = ocrData.choices[0].message.content;

    console.log("Extracted text:", extractedText);

    // Update file record with OCR results and hash
    const { error: updateError } = await supabase
      .from("files")
      .update({
        ocr_text: extractedText,
        file_hash: fileHash,
        verified_at: new Date().toISOString()
      })
      .eq("id", fileId);

    if (updateError) {
      console.error("Error updating file:", updateError);
      throw updateError;
    }

    // Get user_id from file
    const { data: fileData } = await supabase
      .from("files")
      .select("user_id")
      .eq("id", fileId)
      .single();

    // Create blockchain verification record
    const verificationHash = await crypto.subtle.digest(
      "SHA-256", 
      new TextEncoder().encode(fileHash + new Date().toISOString())
    );
    const verificationHashArray = Array.from(new Uint8Array(verificationHash));
    const verificationHashString = verificationHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const { error: verificationError } = await supabase
      .from("blockchain_verifications")
      .insert({
        file_id: fileId,
        file_hash: fileHash,
        verification_hash: verificationHashString,
        verified_by: fileData?.user_id,
        status: "verified",
        metadata: {
          ocr_length: extractedText.length,
          processed_at: new Date().toISOString()
        }
      });

    if (verificationError) {
      console.error("Error creating verification:", verificationError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        ocrText: extractedText,
        fileHash: fileHash,
        verificationHash: verificationHashString
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in process-image-ocr function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});