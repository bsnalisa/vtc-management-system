import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Props { traineeNumber?: string | null; firstName?: string | null; lastName?: string | null; className?: string }

/**
 * Passport photo from the trainee's application (trainee_applications.photo_path, matched on trainee_number).
 * photo_path is used as an image URL when it is one; otherwise it is treated as a path in the "documents" bucket.
 */
export const TraineePhoto = ({ traineeNumber, firstName, lastName, className = "h-24 w-20 rounded-md" }: Props) => {
  const { data: src } = useQuery({
    queryKey: ["trainee-photo", traineeNumber], enabled: !!traineeNumber,
    queryFn: async () => {
      const { data, error } = await db.from("trainee_applications").select("photo_path")
        .eq("trainee_number", traineeNumber).not("photo_path", "is", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      const path: string | null = data?.photo_path ?? null;
      if (!path) return null;
      if (/^(https?:|data:|blob:)/.test(path)) return path;
      const { data: signed, error: signError } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
      if (signError) throw signError;
      return signed.signedUrl;
    },
  });
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
  return (
    <Avatar className={className}>
      {src && <AvatarImage src={src} alt={`${firstName ?? ""} ${lastName ?? ""}`.trim() || "Trainee photo"} className="object-cover" />}
      <AvatarFallback className="rounded-md text-lg">{initials}</AvatarFallback>
    </Avatar>
  );
};
