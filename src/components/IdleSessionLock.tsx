import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2 } from "lucide-react";

// Spec 6.6: lock or log out unattended sessions.
// State lives in localStorage because ProtectedRoute remounts on navigation and tabs must stay in sync.
const IDLE_MS = (Number(import.meta.env.VITE_IDLE_LOCK_MINUTES) || 15) * 60_000;
const SIGN_OUT_MS = (Number(import.meta.env.VITE_IDLE_SIGNOUT_MINUTES) || 30) * 60_000;
const ACTIVITY_KEY = "vtc.lastActivity";
const LOCKED_KEY = "vtc.lockedAt";
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"] as const;

const read = (key: string): number | null => {
  try {
    const v = localStorage.getItem(key);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
};
const write = (key: string, value: number | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(value));
  } catch {
    // storage unavailable (private mode): lock still works for this tab's lifetime via state
  }
};

// Any sign-out (manual, expired, other tab) must not leave a stale lock for the next person to log in.
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    write(LOCKED_KEY, null);
    write(ACTIVITY_KEY, null);
  }
});

export function IdleSessionLock({ email }: { email: string | undefined }) {
  const [locked, setLocked] = useState(() => read(LOCKED_KEY) !== null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  const signOut = useCallback(async () => {
    write(LOCKED_KEY, null);
    write(ACTIVITY_KEY, null);
    await supabase.auth.signOut();
  }, []);

  useEffect(() => {
    // A fresh page load after the idle window has already passed must not unlock the session
    const last = read(ACTIVITY_KEY);
    if (last !== null && Date.now() - last > IDLE_MS && read(LOCKED_KEY) === null) {
      write(LOCKED_KEY, Date.now());
      setLocked(true);
    } else if (last === null) {
      write(ACTIVITY_KEY, Date.now());
    }

    let lastWrite = 0;
    const onActivity = () => {
      if (lockedRef.current) return;
      const now = Date.now();
      if (now - lastWrite > 5_000) {
        lastWrite = now;
        write(ACTIVITY_KEY, now);
      }
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const tick = window.setInterval(() => {
      const now = Date.now();
      const lockedAt = read(LOCKED_KEY);
      if (lockedAt !== null) {
        setLocked(true);
        if (now - lockedAt > SIGN_OUT_MS) void signOut();
        return;
      }
      setLocked(false);
      const lastSeen = read(ACTIVITY_KEY) ?? now;
      if (now - lastSeen > IDLE_MS) {
        write(LOCKED_KEY, now);
        setLocked(true);
      }
    }, 10_000);

    // Another tab locked or unlocked
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCKED_KEY) setLocked(e.newValue !== null);
    };
    window.addEventListener("storage", onStorage);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      window.removeEventListener("storage", onStorage);
      window.clearInterval(tick);
    };
  }, [signOut]);

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (authError) {
      setError("Incorrect password.");
      return;
    }
    setPassword("");
    write(LOCKED_KEY, null);
    write(ACTIVITY_KEY, Date.now());
    setLocked(false);
  };

  if (!locked) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="lock-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-4">
      <form onSubmit={unlock} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-lg">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5" aria-hidden="true" />
          <h2 id="lock-title" className="text-lg font-semibold">Session locked</h2>
        </div>
        <p className="text-sm text-muted-foreground">You were inactive for a while. Enter your password to continue{email ? ` as ${email}` : ""}.</p>
        <div className="space-y-1">
          <Label htmlFor="unlock-password">Password</Label>
          <Input id="unlock-password" type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={busy || !password}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Unlock</Button>
          <Button type="button" variant="outline" onClick={() => void signOut()}>Sign out</Button>
        </div>
      </form>
    </div>
  );
}
