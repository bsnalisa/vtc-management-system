import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface UseAIChatOptions {
  model?: string;
  systemPrompt?: string;
}

export const useAIChat = (options?: UseAIChatOptions) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (userMessage: string) => {
    if (!userMessage.trim()) return;

    // Add user message to chat
    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userMessage },
    ];

    // Include system prompt if provided
    const messagesToSend = options?.systemPrompt
      ? [{ role: "system" as const, content: options.systemPrompt }, ...newMessages]
      : newMessages;

    setMessages(newMessages);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          messages: messagesToSend,
          model: options?.model || "google/gemini-2.5-flash",
          stream: false,
        },
      });

      if (error) {
        console.error("AI chat error:", error);
        throw error;
      }

      if (data?.error) {
        if (data.code === "RATE_LIMIT_EXCEEDED") {
          toast.error("Rate limit exceeded. Please try again in a moment.");
        } else if (data.code === "PAYMENT_REQUIRED") {
          toast.error("AI credits exhausted. Please add credits to continue.");
        } else {
          toast.error(data.error);
        }
        throw new Error(data.error);
      }

      const assistantMessage = data.choices?.[0]?.message?.content;
      if (!assistantMessage) {
        throw new Error("No response from AI");
      }

      // Add assistant response to chat
      setMessages([
        ...newMessages,
        { role: "assistant", content: assistantMessage },
      ]);

      return assistantMessage;
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error(error.message || "Failed to get AI response");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return {
    messages,
    sendMessage,
    clearChat,
    isLoading,
  };
};
