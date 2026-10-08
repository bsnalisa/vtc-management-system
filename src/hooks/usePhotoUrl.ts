import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve a stored photo_path to a displayable URL.
 * A path that already is an image URL (http/data/blob) is used as is; otherwise it is a path in the
 * private "documents" bucket and a short-lived signed URL is created.
 */
export const resolvePhotoUrl = async (path: string): Promise<string> => {
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
};

/** Signed/displayable URL for a stored photo path (null when there is no path). */
export const usePhotoUrl = (path?: string | null) =>
  useQuery({
    queryKey: ["photo-url", path],
    enabled: !!path,
    staleTime: 30 * 60 * 1000, // signed URLs last 1 hour
    queryFn: () => resolvePhotoUrl(path as string),
  });
