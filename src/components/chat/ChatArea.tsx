import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Mic, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { ChatMessage } from "./ChatMessage";
import { VoiceRecorder } from "./VoiceRecorder";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  content_type?: string;
  file_id?: string;
}

interface ChatAreaProps {
  userId: string;
  chatId: string | null;
  onChatCreated: (chatId: string) => void;
}

export const ChatArea = ({ userId, chatId, onChatCreated }: ChatAreaProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatId) {
      fetchMessages();
      subscribeToMessages();
    }
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = async () => {
    if (!chatId) return;

    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages((data || []) as Message[]);
    } catch (error: any) {
      toast.error("Failed to load messages");
      console.error(error);
    }
  };

  const subscribeToMessages = () => {
    if (!chatId) return;

    const channel = supabase
      .channel(`messages:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    let currentChatId = chatId;

    // Create chat if it doesn't exist
    if (!currentChatId) {
      try {
        const { data: sessions } = await supabase
          .from("sessions")
          .select("id")
          .eq("user_id", userId)
          .limit(1);

        let sessionId = sessions?.[0]?.id;

        if (!sessionId) {
          const { data: newSession, error: sessionError } = await supabase
            .from("sessions")
            .insert({ user_id: userId, title: "New Session" })
            .select()
            .single();

          if (sessionError) throw sessionError;
          sessionId = newSession.id;
        }

        const { data: newChat, error: chatError } = await supabase
          .from("chats")
          .insert({ session_id: sessionId, title: "New Chat" })
          .select()
          .single();

        if (chatError) throw chatError;
        currentChatId = newChat.id;
        onChatCreated(currentChatId);
      } catch (error: any) {
        toast.error("Failed to create chat");
        return;
      }
    }

    const userMessage = input;
    setInput("");
    setLoading(true);

    try {
      // Save user message
      const { error: messageError } = await supabase
        .from("messages")
        .insert({
          chat_id: currentChatId,
          role: "user",
          content: userMessage,
        });

      if (messageError) throw messageError;

      // Call AI function
      const { data, error: functionError } = await supabase.functions.invoke("chat", {
        body: { message: userMessage, chatId: currentChatId },
      });

      if (functionError) throw functionError;

      // Save AI response
      await supabase.from("messages").insert({
        chat_id: currentChatId,
        role: "assistant",
        content: data.response,
      });
    } catch (error: any) {
      toast.error("Failed to send message");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {!chatId ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md space-y-4">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-ai flex items-center justify-center">
              <FileText className="w-10 h-10 text-background" />
            </div>
            <h2 className="text-2xl font-bold">AI Report Generator</h2>
            <p className="text-muted-foreground">
              Start a new chat to generate AI-powered reports with unlimited file uploads and voice recognition.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse delay-100" />
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse delay-200" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-border p-4">
            <div className="flex items-end gap-2 max-w-4xl mx-auto">
              <VoiceRecorder 
                onTranscription={(text) => setInput(text)}
                recording={recording}
                setRecording={setRecording}
              />
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="min-h-[60px] max-h-32 resize-none"
                disabled={loading || recording}
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || loading || recording}
                className="bg-gradient-ai hover:opacity-90 transition-opacity"
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
