import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { MessageCircleQuestion, RotateCcw } from "lucide-react";
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

const STORAGE_KEY = "vtc-application-assistant-messages";
const CHAT_ID = "application-assistant";

const SUGGESTIONS = [
  "What can I do on this platform?",
  "What documents do I need to apply?",
  "What does the NTA do?",
  "Which VTCs are in Namibia?",
  "How do I track my application?",
  "What happens after I submit?",
];

const loadMessages = (): UIMessage[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function ApplicationAssistant() {
  const [open, setOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialMessages = useMemo(loadMessages, []);
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

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    id: CHAT_ID,
    messages: initialMessages,
    transport,
    onError: (err) => {
      const msg = err?.message || "";
      if (msg.includes("429")) toast.error("The assistant is busy. Please try again in a moment.");
      else if (msg.includes("402")) toast.error("The assistant is temporarily unavailable.");
      else toast.error("Couldn't reach the assistant. Check your connection and try again.");
    },
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (status === "submitted" || status === "streaming") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* storage full or unavailable */
    }
  }, [messages, status]);

  useEffect(() => {
    if (open && !busy) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [open, busy]);

  const ask = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
  };

  const reset = () => {
    stop();
    setMessages([]);
    window.localStorage.removeItem(STORAGE_KEY);
    textareaRef.current?.focus();
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="lg"
        className="fixed bottom-5 right-5 z-40 h-12 rounded-full px-5 shadow-lg shadow-primary/30"
        aria-label="Chat with Skilla, the VTC assistant"
      >
        <MessageCircleQuestion className="mr-2 h-5 w-5" />
        Ask Skilla
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-5 py-4 text-left">
            <div className="flex items-center gap-3 pr-8">
              <img src={guideIcon} alt="" className="h-10 w-10 shrink-0" />
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-base">Skilla · VTC Assistant</SheetTitle>
                <SheetDescription className="text-xs">
                  AI-powered help with the platform, applying, courses and the NTA.
                </SheetDescription>
              </div>
              {messages.length > 0 && (
                <Button variant="ghost" size="icon" onClick={reset} aria-label="Start over" title="Start over">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </SheetHeader>

          <Conversation className="flex-1">
            <ConversationContent>
              {messages.length === 0 ? (
                <ConversationEmptyState
                  icon={<img src={guideIcon} alt="" className="h-16 w-16" />}
                  title="Hi, I'm Skilla!"
                  description="Ask me anything about the platform. I answer for what your role can access."
                >
                  <div className="flex flex-col items-center gap-3">
                    <img src={guideIcon} alt="" className="h-16 w-16" />
                    <div className="space-y-1 text-center">
                      <h3 className="font-semibold">Hi, I'm Skilla!</h3>
                      <p className="text-sm text-muted-foreground">
                        Ask me about applying, courses, VTCs in Namibia or the NTA.
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
        </SheetContent>
      </Sheet>
    </>
  );
}

export default ApplicationAssistant;
