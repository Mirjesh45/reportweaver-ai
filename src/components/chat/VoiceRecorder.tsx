import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  recording: boolean;
  setRecording: (recording: boolean) => void;
}

export const VoiceRecorder = ({ onTranscription, recording, setRecording }: VoiceRecorderProps) => {
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      toast.success("Recording started");
    } catch (error) {
      toast.error("Failed to access microphone");
      console.error(error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop();
      setRecording(false);
      toast.success("Recording stopped");
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result?.toString().split(",")[1];
        
        const { data, error } = await supabase.functions.invoke("transcribe-audio", {
          body: { audio: base64Audio },
        });

        if (error) throw error;
        onTranscription(data.text);
        toast.success("Audio transcribed");
      };
    } catch (error: any) {
      toast.error("Failed to transcribe audio");
      console.error(error);
    }
  };

  return (
    <Button
      onClick={recording ? stopRecording : startRecording}
      variant={recording ? "destructive" : "outline"}
      size="icon"
      type="button"
    >
      {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </Button>
  );
};
