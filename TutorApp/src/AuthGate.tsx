import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabaseClient";
import { setDataAdapter } from "./lib/storage";
import { SupabaseAdapter } from "./lib/supabaseStorage";
import { LoginScreen } from "./LoginScreen";
import App from "./App";

type Phase = "loading" | "signed-out" | "ready";

export default function AuthGate() {
  const [phase, setPhase] = useState<Phase>(supabase ? "loading" : "ready");
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setDataAdapter(new SupabaseAdapter());
        setSession(data.session);
        setPhase("ready");
      } else {
        setPhase("signed-out");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (newSession) {
        setDataAdapter(new SupabaseAdapter());
      }
      setSession(newSession);
      setPhase(newSession ? "ready" : "signed-out");
    });

    return () => subscription.unsubscribe();
  }, []);

  if (phase === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 bg-[#F7F8FA]">Загрузка…</div>;
  }

  if (phase === "signed-out") {
    return <LoginScreen />;
  }

  const client = supabase;
  return <App userEmail={session?.user.email} onSignOut={client ? () => client.auth.signOut() : undefined} />;
}
