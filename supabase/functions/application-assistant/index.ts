import { createOpenAI } from "npm:@ai-sdk/openai@3";
import { convertToModelMessages, streamText, type UIMessage } from "npm:ai@7";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "../_shared/run-id.ts";
import { APPLICATION_GUIDE } from "./guide.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lovable-aig-run-id",
  "Access-Control-Expose-Headers": "X-Lovable-AIG-Run-ID",
};

const INSTRUCTIONS = `You are the VTC Application Guide, a friendly helper for prospective trainees applying online to a Vocational Training Centre in Namibia.
Answer ONLY using the published instructions below. Use clear, simple language, short paragraphs and numbered steps where helpful. Always say "trainee", never "student".
If the answer is not in the instructions (e.g. exact fees, dates, specific entry requirements, or the outcome of someone's application), say so honestly and advise contacting the registration office of the chosen centre. Never invent fees, dates or requirements.
Politely decline questions unrelated to applying to a training centre.

${APPLICATION_GUIDE}`;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json(500, { error: "The assistant is not configured yet." });

  let messages: UIMessage[];
  try {
    const body = await req.json();
    messages = Array.isArray(body?.messages) ? body.messages.slice(-20) : [];
  } catch {
    return json(400, { error: "Invalid request." });
  }
  if (messages.length === 0) return json(400, { error: "Please ask a question." });

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(req));
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  try {
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      instructions: INSTRUCTIONS,
      messages: await convertToModelMessages(messages),
      abortSignal: req.signal,
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const response = result.toUIMessageStreamResponse({
      originalMessages: messages,
      sendReasoning: false,
      onError: (error: any) => {
        const status = error?.statusCode ?? error?.status;
        if (status === 429) return "The assistant is busy right now. Please try again in a moment.";
        if (status === 402) return "The assistant is temporarily unavailable. Please try again later.";
        console.error("application-assistant stream error", error);
        return "Sorry, something went wrong. Please try again.";
      },
    });
    return await withLovableAiGatewayRunIdHeader(response, runIdFetch, corsHeaders);
  } catch (error) {
    console.error("application-assistant error", error);
    return json(500, { error: "Sorry, something went wrong. Please try again." });
  }
});
