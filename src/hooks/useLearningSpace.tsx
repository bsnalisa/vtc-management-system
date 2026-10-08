import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface LearningClass { class_id: string; class_name: string; class_code: string; academic_year: string; can_manage: boolean }
export interface LearningItem {
  id: string; class_id: string; title: string; item_type: "page" | "link" | "document" | "recording";
  body: string | null; url: string | null; position: number; published: boolean;
}
export interface LearningAssignment {
  id: string; class_id: string; title: string; instructions: string | null; due_at: string | null; max_marks: number; published: boolean; created_at: string;
}
export interface Submission {
  id: string; assignment_id: string; trainee_id: string; answer_text: string | null; link_url: string | null;
  status: "submitted" | "graded" | "returned"; marks: number | null; feedback: string | null; late: boolean; submitted_at: string;
  trainees?: { first_name: string; last_name: string; trainee_id: string } | null;
}
export interface LearningQuiz {
  id: string; class_id: string; title: string; instructions: string | null; time_limit_minutes: number | null; pass_percent: number;
  attempts_allowed: number; show_answers: boolean; published: boolean;
}
export interface QuizQuestion {
  id: string; quiz_id: string; position: number; question_text: string; question_type: "single_choice" | "true_false";
  options: string[]; correct_answer: string; marks: number;
}
export interface QuizAttempt {
  id: string; quiz_id: string; trainee_id: string; score: number | null; total: number | null; passed: boolean | null;
  started_at: string; submitted_at: string | null;
  trainees?: { first_name: string; last_name: string; trainee_id: string } | null;
}
export interface RunnerQuestion { id: string; text: string; type: string; options: string[]; marks: number }
export interface StartedAttempt {
  attempt_id: string; started_at: string; time_limit_minutes: number | null; title: string; instructions: string | null; questions: RunnerQuestion[];
}
export interface QuizResult {
  score: number; total: number; passed: boolean; too_late: boolean;
  review: { id: string; text: string; your_answer: string | null; correct_answer: string }[] | null;
}
export interface ForumTopic { id: string; class_id: string; title: string; body: string | null; locked: boolean; author_id: string; author_name: string | null; created_at: string; forum_posts?: { count: number }[] }
export interface ForumPost { id: string; topic_id: string; body: string; author_id: string; author_name: string | null; created_at: string }

const onError = (e: Error) => { toast.error(e.message); };

/** Small factory for "write, then refresh these query keys" mutations. */
function useWrite<V>(keys: string[], fn: (v: V) => Promise<void>, success?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); if (success) toast.success(success); },
    onError,
  });
}
const check = ({ error }: { error: Error | null }) => { if (error) throw error; };

export const useAuthUserId = () =>
  useQuery({ queryKey: ["learning-auth-user"], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null });

export const useLearningClasses = () =>
  useQuery({
    queryKey: ["learning-classes"],
    queryFn: async () => {
      const { data, error } = await db.rpc("my_learning_classes");
      if (error) throw error;
      return data as LearningClass[];
    },
  });

/** The signed-in learner's trainee record (id and centre). */
export const useMyTrainee = (enabled: boolean) =>
  useQuery({
    queryKey: ["learning-my-trainee"], enabled,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await db.from("trainees").select("id, organization_id").eq("user_id", user.id).limit(1).maybeSingle();
      if (error) throw error;
      return data as { id: string; organization_id: string } | null;
    },
  });

// ---------------- Content ----------------
export const useLearningItems = (classId: string | undefined) =>
  useQuery({
    queryKey: ["learning-items", classId], enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await db.from("learning_items").select("*").eq("class_id", classId).order("position").order("created_at");
      if (error) throw error;
      return data as LearningItem[];
    },
  });

export const useSaveLearningItem = () =>
  useWrite<Partial<LearningItem>>(["learning-items"], async (v) => {
    if (v.id) { const { id, ...patch } = v; check(await db.from("learning_items").update(patch).eq("id", id)); }
    else check(await db.from("learning_items").insert([v]));
  }, "Content saved");

export const useDeleteLearningItem = () =>
  useWrite<string>(["learning-items"], async (id) => check(await db.from("learning_items").delete().eq("id", id)), "Item deleted");

/** Swap the positions of two items (positions are renumbered so ties cannot occur). */
export const useReorderLearningItems = () =>
  useWrite<LearningItem[]>(["learning-items"], async (ordered) => {
    for (let i = 0; i < ordered.length; i++) {
      if (ordered[i].position !== i) check(await db.from("learning_items").update({ position: i }).eq("id", ordered[i].id));
    }
  });

// ---------------- Assignments ----------------
export const useLearningAssignments = (classId: string | undefined) =>
  useQuery({
    queryKey: ["learning-assignments", classId], enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await db.from("learning_assignments").select("*").eq("class_id", classId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as LearningAssignment[];
    },
  });

export const useSaveAssignment = () =>
  useWrite<Partial<LearningAssignment>>(["learning-assignments"], async (v) => {
    if (v.id) { const { id, ...patch } = v; check(await db.from("learning_assignments").update(patch).eq("id", id)); }
    else check(await db.from("learning_assignments").insert([v]));
  }, "Assignment saved");

export const useDeleteAssignment = () =>
  useWrite<string>(["learning-assignments"], async (id) => check(await db.from("learning_assignments").delete().eq("id", id)), "Assignment deleted");

/** Managers get every submission of the assignment; learners only their own (row-level security). */
export const useSubmissions = (assignmentIds: string[], withTrainee: boolean) =>
  useQuery({
    queryKey: ["assignment-submissions", assignmentIds, withTrainee], enabled: assignmentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await db.from("assignment_submissions")
        .select(withTrainee ? "*, trainees(first_name,last_name,trainee_id)" : "*").in("assignment_id", assignmentIds).order("submitted_at");
      if (error) throw error;
      return data as Submission[];
    },
  });

export const useGradeSubmission = () =>
  useWrite<{ id: string; status: "graded" | "returned"; marks: number | null; feedback: string | null }>(
    ["assignment-submissions"],
    async ({ id, ...patch }) => check(await db.from("assignment_submissions").update(patch).eq("id", id)),
    "Submission updated");

export const useSubmitWork = () =>
  useWrite<{ existingId?: string; assignment_id: string; trainee_id: string; organization_id: string; answer_text: string | null; link_url: string | null }>(
    ["assignment-submissions"],
    async ({ existingId, ...v }) => {
      if (existingId) check(await db.from("assignment_submissions").update({ answer_text: v.answer_text, link_url: v.link_url, status: "submitted" }).eq("id", existingId));
      else check(await db.from("assignment_submissions").insert([{ ...v, status: "submitted" }]));
    }, "Work submitted");

// ---------------- Quizzes ----------------
export const useLearningQuizzes = (classId: string | undefined) =>
  useQuery({
    queryKey: ["learning-quizzes", classId], enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await db.from("learning_quizzes").select("*").eq("class_id", classId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as LearningQuiz[];
    },
  });

export const useSaveQuiz = () =>
  useWrite<Partial<LearningQuiz>>(["learning-quizzes"], async (v) => {
    if (v.id) { const { id, ...patch } = v; check(await db.from("learning_quizzes").update(patch).eq("id", id)); }
    else check(await db.from("learning_quizzes").insert([v]));
  }, "Quiz saved");

export const useDeleteQuiz = () =>
  useWrite<string>(["learning-quizzes"], async (id) => check(await db.from("learning_quizzes").delete().eq("id", id)), "Quiz deleted");

/** Managers only: this table holds the correct answers. */
export const useQuizQuestions = (quizId: string | undefined) =>
  useQuery({
    queryKey: ["quiz-questions", quizId], enabled: !!quizId,
    queryFn: async () => {
      const { data, error } = await db.from("quiz_questions").select("*").eq("quiz_id", quizId).order("position");
      if (error) throw error;
      return data as QuizQuestion[];
    },
  });

export const useSaveQuestion = () =>
  useWrite<Partial<QuizQuestion>>(["quiz-questions"], async (v) => {
    if (v.id) { const { id, ...patch } = v; check(await db.from("quiz_questions").update(patch).eq("id", id)); }
    else check(await db.from("quiz_questions").insert([v]));
  }, "Question saved");

export const useDeleteQuestion = () =>
  useWrite<string>(["quiz-questions"], async (id) => check(await db.from("quiz_questions").delete().eq("id", id)), "Question deleted");

/** All attempts for managers, the learner's own attempts otherwise (row-level security). */
export const useQuizAttempts = (quizIds: string[], withTrainee: boolean) =>
  useQuery({
    queryKey: ["quiz-attempts", quizIds, withTrainee], enabled: quizIds.length > 0,
    queryFn: async () => {
      const { data, error } = await db.from("quiz_attempts")
        .select(withTrainee ? "id, quiz_id, trainee_id, score, total, passed, started_at, submitted_at, trainees(first_name,last_name,trainee_id)"
                            : "id, quiz_id, trainee_id, score, total, passed, started_at, submitted_at")
        .in("quiz_id", quizIds).order("started_at", { ascending: false });
      if (error) throw error;
      return data as QuizAttempt[];
    },
  });

export const useStartQuizAttempt = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (quizId: string) => {
      const { data, error } = await db.rpc("start_quiz_attempt", { _quiz: quizId });
      if (error) throw error;
      return data as StartedAttempt;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quiz-attempts"] }),
    onError,
  });
};

export const useSubmitQuizAttempt = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ attemptId, answers }: { attemptId: string; answers: Record<string, string> }) => {
      const { data, error } = await db.rpc("submit_quiz_attempt", { _attempt: attemptId, _answers: answers });
      if (error) throw error;
      return data as QuizResult;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quiz-attempts"] }),
    onError,
  });
};

// ---------------- Forum ----------------
export const useForumTopics = (classId: string | undefined) =>
  useQuery({
    queryKey: ["forum-topics", classId], enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await db.from("forum_topics").select("*, forum_posts(count)").eq("class_id", classId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as ForumTopic[];
    },
  });

export const useForumPosts = (topicId: string | undefined) =>
  useQuery({
    queryKey: ["forum-posts", topicId], enabled: !!topicId,
    queryFn: async () => {
      const { data, error } = await db.from("forum_posts").select("*").eq("topic_id", topicId).order("created_at");
      if (error) throw error;
      return data as ForumPost[];
    },
  });

export const useStartTopic = () =>
  useWrite<{ class_id: string; title: string; body: string | null }>(["forum-topics"],
    async (v) => check(await db.from("forum_topics").insert([v])), "Topic started");

export const useSetTopicLocked = () =>
  useWrite<{ id: string; locked: boolean }>(["forum-topics"],
    async ({ id, locked }) => check(await db.from("forum_topics").update({ locked }).eq("id", id)));

export const useDeleteTopic = () =>
  useWrite<string>(["forum-topics", "forum-posts"], async (id) => check(await db.from("forum_topics").delete().eq("id", id)), "Topic deleted");

export const useReply = () =>
  useWrite<{ topic_id: string; body: string }>(["forum-posts", "forum-topics"],
    async (v) => check(await db.from("forum_posts").insert([v])));

export const useDeletePost = () =>
  useWrite<string>(["forum-posts", "forum-topics"], async (id) => check(await db.from("forum_posts").delete().eq("id", id)), "Post deleted");
