import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, Send, Loader2, GripVertical, Bot, User, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFloatingPanel, ResizeHandles } from "@/hooks/useFloatingPanel";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const STORAGE_KEY = "ai-tutor-history";

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(msgs: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-100)));
  } catch { /* quota */ }
}

export default function AiTutorChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // FAB position
  const [fabPos, setFabPos] = useState({ x: typeof window !== "undefined" ? window.innerWidth - 80 : 300, y: typeof window !== "undefined" ? window.innerHeight - 80 : 400 });
  const [isFabDragging, setIsFabDragging] = useState(false);
  const fabDragOffset = useRef({ x: 0, y: 0 });

  const { geo, onDragStart: onPanelDragStart, onResizeStart } = useFloatingPanel("ai-tutor", {
    x: typeof window !== "undefined" ? window.innerWidth - 420 : 200,
    y: typeof window !== "undefined" ? window.innerHeight - 520 : 100,
    width: 380,
    height: 500,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => { saveHistory(messages); }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: text, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // Get current page context from the DOM
      const activeTab = document.querySelector("[data-active-tab]")?.getAttribute("data-active-tab") || "";
      const pageTitle = document.querySelector("h1")?.textContent || "";

      const { data, error } = await supabase.functions.invoke("ai-tutor", {
        body: {
          question: text,
          context: { activeTab, pageTitle },
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        },
      });

      if (error) throw error;

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data?.answer || "מצטער, לא הצלחתי לעבד את השאלה.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `שגיאה: ${err.message || "לא ניתן להתחבר לשרת"}. נסה שוב מאוחר יותר.`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  // FAB drag 
  const handleFabMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsFabDragging(true);
    fabDragOffset.current = { x: e.clientX - fabPos.x, y: e.clientY - fabPos.y };
  }, [fabPos]);

  useEffect(() => {
    if (!isFabDragging) return;
    const onMove = (e: MouseEvent) => setFabPos({ x: e.clientX - fabDragOffset.current.x, y: e.clientY - fabDragOffset.current.y });
    const onUp = () => setIsFabDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [isFabDragging]);

  return (
    <>
      {/* FAB */}
      <Button
        className="fixed z-[9997] h-12 w-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg hover:shadow-xl select-none"
        style={{ left: fabPos.x, top: fabPos.y, cursor: isFabDragging ? "grabbing" : "grab" }}
        onMouseDown={handleFabMouseDown}
        onClick={() => { if (!isFabDragging) setIsOpen((v) => !v); }}
        title="מורה AI"
      >
        <MessageCircle className="h-5 w-5" />
      </Button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="fixed z-[9996] flex flex-col rounded-lg border border-blue-500/50 bg-background shadow-2xl select-none"
          style={{ left: geo.x, top: geo.y, width: geo.width, height: geo.height }}
        >
          <ResizeHandles onResizeStart={onResizeStart} />

          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2 border-b bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-t-lg cursor-grab shrink-0"
            onMouseDown={onPanelDragStart}
          >
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <Bot className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-bold">מורה AI</span>
              <Badge variant="secondary" className="text-[10px]">בטא</Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearChat} title="נקה שיחה">
                <Trash2 className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3" dir="rtl">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">שלום! אני המורה AI</p>
                <p className="text-xs mt-1">שאל אותי שאלות על הגמרא, ההלכה, או כל נושא תורני</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center ${
                  msg.role === "user" ? "bg-primary/10" : "bg-blue-500/10"
                }`}>
                  {msg.role === "user" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3 text-blue-500" />}
                </div>
                <div className={`max-w-[85%] rounded-lg p-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2">
                <div className="h-6 w-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Bot className="h-3 w-3 text-blue-500" />
                </div>
                <div className="bg-muted rounded-lg p-2.5">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t p-2 shrink-0" dir="rtl">
            <div className="flex gap-2">
              <Input
                placeholder="שאל שאלה..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="flex-1 text-sm"
              />
              <Button size="icon" onClick={sendMessage} disabled={isLoading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
