import { createClient } from "npm:@supabase/supabase-js@2";
import { createOpenAI } from "npm:@ai-sdk/openai@3";
import { convertToModelMessages, streamText, type UIMessage } from "npm:ai@7";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "../_shared/run-id.ts";
import { APPLICATION_GUIDE, NAMIBIA_TVET_KNOWLEDGE } from "./guide.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lovable-aig-run-id",
  "Access-Control-Expose-Headers": "X-Lovable-AIG-Run-ID",
};

const BASE_INSTRUCTIONS = `You are Skilla, the friendly AI assistant of the VTC Management System in Namibia. You help prospective trainees, trainees and staff with: the online application, the Namibian vocational education and training (TVET) landscape, Vocational Training Centres, course offerings, the Namibia Training Authority (NTA), NTF, NQF and how the system works.
For application questions, base answers on the published application instructions. For TVET questions, use the background knowledge and your general knowledge of Namibia, flagging when details may have changed and should be confirmed with NTA or the centre. Use clear, simple language, short paragraphs and numbered steps where helpful. Always say "trainee", never "student".
If the answer is not in the instructions (e.g. exact fees, dates, specific entry requirements, or the outcome of someone's application), say so honestly and advise contacting the registration office of the chosen centre. Never invent fees, dates or requirements.
Politely decline questions unrelated to vocational training, the centres or this system.

${APPLICATION_GUIDE}

${NAMIBIA_TVET_KNOWLEDGE}`;

type Viewer = { roles: string[]; menu: string[]; page: string } | null;

const PUBLIC_SCOPE = `# Who you are talking to
A visitor who is NOT signed in (prospective trainee/public). Only help with the online application, centres, courses, fees and general TVET/NTA information. Do not describe staff or trainee internal features in detail; if asked, say they must sign in and that features depend on their role.`;

const roleScope = (v: NonNullable<Viewer>) => `# Who you are talking to
A signed-in platform user. Their verified role(s): ${v.roles.join(", ") || "none assigned"}.
Menu sections available to them: ${v.menu.length ? v.menu.join("; ") : "none listed"}.
They are currently on page: ${v.page || "unknown"}.
Rules:
- You may explain how to use the VTC Management System, but ONLY features available to their role(s) and the menu sections listed above. Refer to sections by these menu names.
- If they ask about something outside their role (e.g. another role's approvals, finance, gradebook editing, admin settings), say politely that it isn't available to their role and suggest who to contact (their administrator or the relevant office).
- You cannot see or change any records. Never claim to look up personal data, marks, balances or applications; tell them where in their menu to find it.`;

const buildInstructions = (centres: string, viewer: Viewer) => `${BASE_INSTRUCTIONS}

${viewer ? roleScope(viewer) : PUBLIC_SCOPE}

# Live centre data from the VTC Management System (authoritative)
Only state courses, fees and contact details that appear here. If a centre's item says "not yet published", say so plainly and do not guess or use general knowledge for it. Only centres listed here accept online applications through this system.

${centres}`;

// Roles come only from the verified token + user_roles table; menu/page are descriptive hints.
async function resolveViewer(req: Request, ctx: { menu?: unknown; page?: unknown }): Promise<Viewer> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token || !url || !key) return null;
  const db = createClient(url, key);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: roles } = await db.from("user_roles").select("role").eq("user_id", data.user.id);
  const menu = Array.isArray(ctx.menu)
    ? ctx.menu.filter((m): m is string => typeof m === "string").slice(0, 60).map((m) => m.slice(0, 80))
    : [];
  const page = typeof ctx.page === "string" ? ctx.page.slice(0, 120) : "";
  return { roles: (roles ?? []).map((r) => String(r.role)), menu, page };
}

async function loadCentreData(): Promise<string> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return "Centre data is currently unavailable.";
  const db = createClient(url, key);
  const [orgs, trades, fees] = await Promise.all([
    db.from("organizations").select("id,name").eq("active", true).order("name"),
    db.from("trades").select("organization_id,name,code,description").eq("active", true).order("name"),
    db.from("fee_types").select("organization_id,name,default_amount,category,is_mandatory,recurring_frequency").eq("active", true),
  ]);
  if (orgs.error) return "Centre data is currently unavailable.";
  return (orgs.data ?? []).map((o) => {
    const t = (trades.data ?? []).filter((x) => x.organization_id === o.id);
    const f = (fees.data ?? []).filter((x) => x.organization_id === o.id);
    return `### ${o.name}
Courses/trades: ${t.length ? t.map((x) => x.name + (x.description ? ` (${x.description})` : "")).join("; ") : "not yet published in the system"}
Fees: ${f.length ? f.map((x) => `${x.name}: N$${Number(x.default_amount ?? 0).toFixed(2)}${x.is_mandatory ? " (mandatory)" : ""}${x.recurring_frequency ? `, ${x.recurring_frequency}` : ""}`).join("; ") : "not yet published in the system"}
Contact details: not yet published in the system – contact the centre's registration office.`;
  }).join("\n\n");
}

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
  let ctx: { menu?: unknown; page?: unknown } = {};
  try {
    const body = await req.json();
    messages = Array.isArray(body?.messages) ? body.messages.slice(-20) : [];
    ctx = body?.context ?? {};
  } catch {
    return json(400, { error: "Invalid request." });
  }
  if (messages.length === 0) return json(400, { error: "Please ask a question." });

  const viewer = await resolveViewer(req, ctx);

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
      instructions: buildInstructions(await loadCentreData(), viewer),
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
