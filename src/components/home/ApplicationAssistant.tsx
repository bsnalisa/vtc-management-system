import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { History, Plus, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import guideIcon from "@/assets/application-guide.png";

const SUGGESTIONS = [
  "What can I do on this platform?",
  "What documents do I need to apply?",
  "What does the NTA do?",
  "Which VTCs are in Namibia?",
  "How do I track my application?",
  "What happens after I submit?",
];

type Thread = { id: string; title: string; updated_at: string; messages: UIMessage[] };

// Remove old shared browser history from earlier versions.
if (typeof window !== "undefined") window.localStorage.removeItem("vtc-application-assistant-messages");

export function ApplicationAssistant() {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      const id = session?.user.id ?? null;
      setUserId((prev) => {
        if (prev !== id) {
          // Different user (or signed out): clear everything on screen.
          setThreads([]);
          setActiveId(null);
          setShowHistory(false);
          setSessionKey((k) => k + 1);
        }
        return id;
      });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const loadThreads = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("skilla_threads")
      .select("id,title,updated_at,messages")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) return console.error("Load Skilla chats failed", error);
    const list = (data ?? []) as unknown as Thread[];
    setThreads(list);
    setActiveId((cur) => cur ?? list[0]?.id ?? null);
  }, [userId]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const saveThread = useCallback(
    async (threadId: string | null, messages: UIMessage[]): Promise<string | null> => {
      if (!userId || messages.length === 0) return threadId;
      const firstUser = messages.find((m) => m.role === "user");
      const firstText = firstUser?.parts.find((p) => p.type === "text") as { text?: string } | undefined;
      const title = (firstText?.text ?? "New chat").slice(0, 60);
      const payload = { messages: messages as unknown as never, title, updated_at: new Date().toISOString() };
      if (threadId) {
        const { error } = await supabase.from("skilla_threads").update(payload).eq("id", threadId);
        if (error) console.error("Save Skilla chat failed", error);
        setThreads((ts) =>
          [{ id: threadId, title, updated_at: payload.updated_at, messages }, ...ts.filter((t) => t.id !== threadId)],
        );
        return threadId;
      }
      const { data, error } = await supabase
        .from("skilla_threads")
        .insert({ ...payload, user_id: userId })
        .select("id")
        .single();
      if (error || !data) {
        console.error("Save Skilla chat failed", error);
        return null;
      }
      setThreads((ts) => [{ id: data.id, title, updated_at: payload.updated_at, messages }, ...ts]);
      setActiveId(data.id);
      return data.id;
    },
    [userId],
  );

  const newChat = () => {
    setActiveId(null);
    setShowHistory(false);
    setSessionKey((k) => k + 1);
  };

  const deleteThread = async (id: string) => {
    const { error } = await supabase.from("skilla_threads").delete().eq("id", id);
    if (error) return toast.error("Couldn't delete that chat.");
    setThreads((ts) => ts.filter((t) => t.id !== id));
    if (activeId === id) newChat();
  };

  const active = threads.find((t) => t.id === activeId);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="skilla-fab fixed bottom-5 right-5 z-40 flex h-14 items-center gap-2 rounded-full bg-primary pl-1.5 pr-5 font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Chat with Skilla, the VTC assistant"
      >
        <span className="skilla-fab-avatar flex h-11 w-11 items-center justify-center rounded-full bg-background">
          <img src={guideIcon} alt="" className="h-9 w-9" />
        </span>
        Ask Skilla
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-5 py-4 text-left">
            <div className="flex items-center gap-2 pr-8">
              <img src={guideIcon} alt="" className="h-10 w-10 shrink-0" />
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-base">Skilla · VTC Assistant</SheetTitle>
                <SheetDescription className="text-xs">
                  {userId ? "Your chats are saved to your account." : "Sign in to keep your chat history."}
                </SheetDescription>
              </div>
              {userId && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowHistory((s) => !s)}
                  aria-label={showHistory ? "Back to chat" : "Previous chats"}
                  title={showHistory ? "Back to chat" : "Previous chats"}
                >
                  {showHistory ? <ArrowLeft className="h-4 w-4" /> : <History className="h-4 w-4" />}
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={newChat} aria-label="New chat" title="New chat">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          {showHistory && userId ? (
            <div className="flex-1 overflow-y-auto p-3">
              {threads.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">No previous chats yet.</p>
              ) : (
                <ul className="space-y-1">
                  {threads.map((t) => (
                    <li
                      key={t.id}
                      className={`flex items-center gap-1 rounded-lg border ${t.id === activeId ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"}`}
                    >
                      <button
                        className="min-w-0 flex-1 px-3 py-2 text-left"
                        onClick={() => {
                          setActiveId(t.id);
                          setShowHistory(false);
                          setSessionKey((k) => k + 1);
                        }}
                      >
                        <span className="block truncate text-sm font-medium">{t.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(t.updated_at).toLocaleString()}
                        </span>
                      </button>
                      <Button variant="ghost" size="icon" onClick={() => deleteThread(t.id)} aria-label={`Delete chat ${t.title}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <ChatWindow
              key={`${userId ?? "guest"}-${sessionKey}`}
              threadId={activeId}
              initialMessages={active?.messages ?? []}
              open={open}
              onSave={saveThread}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function ChatWindow({
  threadId,
  initialMessages,
  open,
  onSave,
}: {
  threadId: string | null;
  initialMessages: UIMessage[];
  open: boolean;
  onSave: (id: string | null, messages: UIMessage[]) => Promise<string | null>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef(threadId);
  const location = useLocation();
  const { navItems } = useRoleNavigation();
  const ctxRef = useRef({ page: "", menu: [] as string[] });
  ctxRef.current = {
    page: location.pathname,
    menu: navItems.flatMap((n) => [n.title, ...(n.children?.map((c) => `${n.title} > ${c.title}`) ?? [])]),
  };

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/application-assistant`,
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          return {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${data.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          };
        },
        body: () => ({ context: ctxRef.current }),
      }),
    [],
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: threadId ?? undefined,
    messages: initialMessages,
    transport,
    onFinish: async ({ messages: all }) => {
      threadRef.current = await onSave(threadRef.current, all);
    },
    onError: (err) => {
      const msg = err?.message || "";
      if (msg.includes("429")) toast.error("Skilla is busy. Please try again in a moment.");
      else if (msg.includes("402")) toast.error("Skilla is temporarily unavailable.");
      else toast.error("Couldn't reach Skilla. Check your connection and try again.");
    },
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (open && !busy) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [open, busy]);

  const ask = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
  };

  return (
    <>
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState>
              <div className="flex flex-col items-center gap-3">
                <img src={guideIcon} alt="" className="h-16 w-16" />
                <div className="space-y-1 text-center">
                  <h3 className="font-semibold">Hi, I'm Skilla!</h3>
                  <p className="text-sm text-muted-foreground">
                    Ask me about the platform, applying, courses, VTCs in Namibia or the NTA.
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <Button key={s} variant="outline" size="sm" className="h-auto whitespace-normal py-1.5 text-xs" onClick={() => ask(s)}>
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((m) => (
              <Message key={m.id} from={m.role}>
                <MessageContent>
                  {m.parts.map((part, i) =>
                    part.type === "text" ? (
                      m.role === "assistant" ? (
                        <MessageResponse key={i}>{part.text}</MessageResponse>
                      ) : (
                        <p key={i} className="whitespace-pre-wrap">{part.text}</p>
                      )
                    ) : null,
                  )}
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer>Skilla is thinking...</Shimmer>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t p-3">
        <PromptInput onSubmit={(msg) => ask(msg.text ?? "")}>
          <PromptInputTextarea ref={textareaRef} placeholder="Ask Skilla anything about VTCs..." />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          For fees, dates or your application outcome, contact your centre's registration office.
        </p>
      </div>
    </>
  );
}

export default ApplicationAssistant;
