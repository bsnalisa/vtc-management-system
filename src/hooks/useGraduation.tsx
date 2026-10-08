import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";

// Graduation tables are newer than the generated Supabase types, so access them untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type QuestionType = "text" | "single_choice" | "multiple_choice" | "rating" | "yes_no";

export interface Ceremony {
  id: string;
  title: string;
  graduation_year: number;
  ceremony_date: string;
  venue: string | null;
  notes: string | null;
  invitations_sent_at: string | null;
}

export interface Invitation {
  id: string;
  ceremony_id: string;
  response_code: 1 | 2 | null;
  responded_at: string | null;
  response_channel: string | null;
  alumni: { trainees: { first_name: string; last_name: string; trainee_id: string } | null } | null;
}

export interface Survey {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "open" | "closed";
  anonymous: boolean;
  target_graduation_year: number | null;
  target_trade_id: string | null;
  closes_at: string | null;
  created_at: string;
}

export interface SurveyQuestion {
  id: string;
  survey_id: string;
  position: number;
  question_text: string;
  question_type: QuestionType;
  options: string[];
  required: boolean;
}

export interface SurveyResponseRow {
  id: string;
  answers: Record<string, string | number | string[]>;
  submitted_at: string;
}

const baseUrl = () => window.location.origin;

function useOrgMutation<T, R = unknown>(
  fn: (v: T, orgId: string) => Promise<R>,
  keys: string[],
  success: string | ((r: R) => string),
) {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async (v: T) => {
      if (!organizationId) throw new Error("No organization ID");
      return fn(v, organizationId);
    },
    onSuccess: (r) => {
      keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast.success(typeof success === "function" ? success(r) : success);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useCeremonies = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["ceremonies", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("graduation_ceremonies").select("*")
        .eq("organization_id", organizationId).order("ceremony_date", { ascending: false });
      if (error) throw error;
      return data as Ceremony[];
    },
  });
};

export const useCreateCeremony = () =>
  useOrgMutation(async (c: Partial<Ceremony>, orgId) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await db.from("graduation_ceremonies").insert([{ ...c, organization_id: orgId, created_by: user?.id }]);
    if (error) throw error;
  }, ["ceremonies"], "Ceremony created");

export const useInvitations = (ceremonyId: string | undefined) =>
  useQuery({
    queryKey: ["graduation-invitations", ceremonyId],
    enabled: !!ceremonyId,
    queryFn: async () => {
      const { data, error } = await db.from("graduation_invitations")
        .select("*, alumni(trainees(first_name,last_name,trainee_id))")
        .eq("ceremony_id", ceremonyId).order("created_at");
      if (error) throw error;
      return data as Invitation[];
    },
  });

export const useSendInvitations = () =>
  useOrgMutation(async (ceremonyId: string) => {
    const { data, error } = await db.rpc("send_graduation_invitations", { _ceremony: ceremonyId, _base_url: baseUrl() });
    if (error) throw error;
    return data as number;
  }, ["ceremonies", "graduation-invitations"], (n) => `Invitations sent to ${n} graduate(s)`);

/** Staff can record a reply on a graduate's behalf (e.g. a phone call). */
export const useRecordRsvp = () =>
  useOrgMutation(async ({ id, code }: { id: string; code: 1 | 2 }) => {
    const { error } = await db.from("graduation_invitations")
      .update({ response_code: code, responded_at: new Date().toISOString(), response_channel: "staff" }).eq("id", id);
    if (error) throw error;
  }, ["graduation-invitations"], "Response recorded");

export const useSurveys = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["graduate-surveys", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("graduate_surveys").select("*")
        .eq("organization_id", organizationId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Survey[];
    },
  });
};

export const useCreateSurvey = () =>
  useOrgMutation(
    async ({ survey, questions }: { survey: Partial<Survey>; questions: Omit<SurveyQuestion, "id" | "survey_id" | "position">[] }, orgId) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await db.from("graduate_surveys")
        .insert([{ ...survey, organization_id: orgId, created_by: user?.id }]).select().single();
      if (error) throw error;
      const rows = questions.map((q, i) => ({ ...q, survey_id: data.id, position: i }));
      if (rows.length) {
        const { error: qErr } = await db.from("survey_questions").insert(rows);
        if (qErr) {
          await db.from("graduate_surveys").delete().eq("id", data.id); // don't leave an empty survey behind
          throw qErr;
        }
      }
    },
    ["graduate-surveys"],
    "Survey created",
  );

export const useSurveyStatus = () =>
  useOrgMutation(async ({ id, status }: { id: string; status: Survey["status"] }) => {
    const { error } = await db.from("graduate_surveys").update({ status }).eq("id", id);
    if (error) throw error;
  }, ["graduate-surveys"], "Survey updated");

export const useSendSurvey = () =>
  useOrgMutation(async (surveyId: string) => {
    const { data, error } = await db.rpc("send_graduate_survey", { _survey: surveyId, _base_url: baseUrl() });
    if (error) throw error;
    return data as number;
  }, ["graduate-surveys", "survey-results"], (n) => `Survey sent to ${n} new graduate(s)`);

export const useSurveyResults = (surveyId: string | undefined) =>
  useQuery({
    queryKey: ["survey-results", surveyId],
    enabled: !!surveyId,
    queryFn: async () => {
      const [q, r, rec] = await Promise.all([
        db.from("survey_questions").select("*").eq("survey_id", surveyId).order("position"),
        db.from("survey_responses").select("id, answers, submitted_at").eq("survey_id", surveyId),
        db.from("survey_recipients").select("id, completed_at").eq("survey_id", surveyId),
      ]);
      for (const res of [q, r, rec]) if (res.error) throw res.error;
      return {
        questions: q.data as SurveyQuestion[],
        responses: r.data as SurveyResponseRow[],
        recipients: rec.data as { id: string; completed_at: string | null }[],
      };
    },
  });

// ---- Public (token) access: no login required ----
export interface PublicSurvey {
  title: string;
  description: string | null;
  anonymous: boolean;
  status: "open" | "closed";
  completed: boolean;
  questions: { id: string; text: string; type: QuestionType; options: string[]; required: boolean }[];
}

export const fetchSurveyByToken = async (token: string) => {
  const { data, error } = await db.rpc("get_survey_by_token", { _token: token });
  if (error) throw error;
  return data as PublicSurvey | null;
};

export const submitSurveyByToken = async (token: string, answers: Record<string, unknown>) => {
  const { error } = await db.rpc("submit_survey_response", { _token: token, _answers: answers });
  if (error) throw error;
};

export interface PublicInvitation {
  title: string;
  ceremony_date: string;
  venue: string | null;
  graduate_name: string;
  response_code: 1 | 2 | null;
}

export const fetchInvitationByToken = async (token: string) => {
  const { data, error } = await db.rpc("get_graduation_invitation", { _token: token });
  if (error) throw error;
  return data as PublicInvitation | null;
};

export const respondToInvitation = async (token: string, code: 1 | 2) => {
  const { error } = await db.rpc("respond_graduation_invitation", { _token: token, _code: code, _channel: "link" });
  if (error) throw error;
};
