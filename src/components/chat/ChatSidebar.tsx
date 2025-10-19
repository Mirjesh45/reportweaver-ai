import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, LogOut, Sparkles, Search, Trash2, Edit2, Check, X } from "lucide-react";
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
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

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

  const deleteChat = async (chatId: string) => {
    try {
      const { error } = await supabase
        .from("chats")
        .delete()
        .eq("id", chatId);

      if (error) throw error;

      setChats(chats.filter((chat) => chat.id !== chatId));
      if (selectedChatId === chatId) {
        onSelectChat(chats[0]?.id || "");
      }
      toast.success("Chat deleted");
    } catch (error: any) {
      toast.error("Failed to delete chat");
      console.error(error);
    }
  };

  const startRenaming = (chat: Chat) => {
    setEditingChatId(chat.id);
    setEditingTitle(chat.title);
  };

  const cancelRenaming = () => {
    setEditingChatId(null);
    setEditingTitle("");
  };

  const saveRename = async (chatId: string) => {
    if (!editingTitle.trim()) {
      toast.error("Chat title cannot be empty");
      return;
    }

    try {
      const { error } = await supabase
        .from("chats")
        .update({ title: editingTitle.trim() })
        .eq("id", chatId);

      if (error) throw error;

      setChats(
        chats.map((chat) =>
          chat.id === chatId ? { ...chat, title: editingTitle.trim() } : chat
        )
      );
      setEditingChatId(null);
      setEditingTitle("");
      toast.success("Chat renamed");
    } catch (error: any) {
      toast.error("Failed to rename chat");
      console.error(error);
    }
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
              <div
                key={chat.id}
                className={`group relative p-3 rounded-lg transition-colors ${
                  selectedChatId === chat.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/50"
                }`}
              >
                {editingChatId === chat.id ? (
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 flex-shrink-0" />
                    <Input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      className="h-7 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename(chat.id);
                        if (e.key === "Escape") cancelRenaming();
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => saveRename(chat.id)}
                    >
                      <Check className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={cancelRenaming}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectChat(chat.id)}
                      className="flex items-center gap-2 flex-1 min-w-0"
                    >
                      <MessageSquare className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate text-sm">{chat.title}</span>
                    </button>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          startRenaming(chat);
                        }}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChat(chat.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
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
