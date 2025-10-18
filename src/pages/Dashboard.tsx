import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { FileUploadDialog } from "@/components/upload/FileUploadDialog";
import { ReportGenerator } from "@/components/reports/ReportGenerator";

const Dashboard = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-ai" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <ChatSidebar 
        userId={session.user.id} 
        selectedChatId={selectedChatId}
        onSelectChat={setSelectedChatId}
      />
      <ChatArea 
        userId={session.user.id} 
        chatId={selectedChatId}
        onChatCreated={setSelectedChatId}
      />
      {selectedChatId && (
        <ReportGenerator chatId={selectedChatId} userId={session.user.id} />
      )}
      <FileUploadDialog userId={session.user.id} chatId={selectedChatId} />
    </div>
  );
};

export default Dashboard;
