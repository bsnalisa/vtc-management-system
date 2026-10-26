import type { Database } from "@/integrations/supabase/types";

type TraineeInsert = Database["public"]["Tables"]["trainees"]["Insert"];

/**
 * A trainee registration payload as the application writes it.
 *
 * `identity_id` and `trainee_id` are issued by the `trainees_enforce_identity`
 * trigger (it resolves or allocates the person's global identity), so callers
 * must not supply them even though the generated Insert type lists them.
 */
export type TraineeInsertPayload = Omit<TraineeInsert, "identity_id" | "trainee_id"> &
  Partial<Pick<TraineeInsert, "identity_id" | "trainee_id">>;

/**
 * Prepares a payload for `supabase.from("trainees").insert(...)`. The identity
 * columns are filled in by the database trigger, never by the caller.
 */
export const asTraineeInsert = (payload: TraineeInsertPayload): TraineeInsert =>
  payload as unknown as TraineeInsert;
