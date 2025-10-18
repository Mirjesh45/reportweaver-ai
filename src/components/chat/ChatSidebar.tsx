import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, LogOut, Sparkles, Search } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Chat {
  id: string;
  title: string;
  created_at: string;
}

interface ChatSidebarProps {
  userId: string;
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
}

export const ChatSidebar = ({ userId, selectedChatId, onSelectChat }: ChatSidebarProps) => {
  const navigate = useNavigate();
  const [chats, setChats] = useState<Chat[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChats();
  }, [userId]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredChats(chats);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredChats(
        chats.filter((chat) =>
          chat.title.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, chats]);

  const fetchChats = async () => {
    try {
      // First get all sessions for the user
      const { data: sessions, error: sessionsError } = await supabase
        .from("sessions")
        .select("id")
        .eq("user_id", userId);

      if (sessionsError) throw sessionsError;

      if (sessions && sessions.length > 0) {
        const sessionIds = sessions.map(s => s.id);
        
        // Then get all chats for those sessions
        const { data: chatsData, error: chatsError } = await supabase
          .from("chats")
          .select("*")
          .in("session_id", sessionIds)
          .order("created_at", { ascending: false });

        if (chatsError) throw chatsError;
        setChats(chatsData || []);
      }
    } catch (error: any) {
      toast.error("Failed to load chats");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const createNewChat = async () => {
    try {
      // First, ensure there's a session
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

      const { data: newChat, error } = await supabase
        .from("chats")
        .insert({ session_id: sessionId, title: "New Chat" })
        .select()
        .single();

      if (error) throw error;
      
      setChats([newChat, ...chats]);
      onSelectChat(newChat.id);
      toast.success("New chat created");
    } catch (error: any) {
      toast.error("Failed to create chat");
      console.error(error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="w-64 border-r border-border bg-sidebar flex flex-col">
      <div className="p-4 border-b border-sidebar-border space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-ai">
            <Sparkles className="w-5 h-5 text-background" />
          </div>
          <h1 className="font-bold text-lg">AI Reports</h1>
        </div>
        <Button
          onClick={createNewChat}
          className="w-full bg-gradient-ai hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 p-2">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-sidebar-accent rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="text-center text-muted-foreground p-4">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {searchQuery ? "No chats found" : "No chats yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedChatId === chat.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate text-sm">{chat.title}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t border-sidebar-border">
        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
};
