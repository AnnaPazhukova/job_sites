import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabaseClient";
import { setDataAdapter } from "./lib/storage";
import { SupabaseAdapter } from "./lib/supabaseStorage";
import { getInviteCodeFromUrl, getStudentLink, ensureLinked } from "./lib/studentAuth";
import { LoginScreen } from "./LoginScreen";
import { StudentSignupScreen } from "./StudentSignupScreen";
import StudentPortal from "./StudentPortal";
import App from "./App";

type Phase = "loading" | "signed-out" | "student-invite" | "tutor" | "student";

const inviteCode = getInviteCodeFromUrl();

export default function AuthGate() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<Session | null>(null);

  async function resolveRole(newSession: Session) {
    if (inviteCode) {
      try {
        await ensureLinked(inviteCode);
      } catch {
        // Invite invalid/expired — fall through to normal role detection so
        // the account can still sign in as whatever it already is.
      }
      window.history.replaceState(null, "", window.location.pathname);
    }

    setDataAdapter(new SupabaseAdapter());
    setSession(newSession);
    const link = await getStudentLink();
    setPhase(link ? "student" : "tutor");
  }

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        resolveRole(data.session);
      } else {
        setPhase(inviteCode ? "student-invite" : "signed-out");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (newSession) {
        resolveRole(newSession);
      } else {
        setSession(null);
        setPhase(inviteCode ? "student-invite" : "signed-out");
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!supabase) {
    return <App />;
  }
  const client = supabase;

  if (phase === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 bg-[#F7F8FA]">Загрузка…</div>;
  }

  if (phase === "student-invite") {
    return (
      <StudentSignupScreen
        code={inviteCode!}
        onLinked={() => {
          window.history.replaceState(null, "", window.location.pathname);
          client.auth.getSession().then(({ data }) => {
            if (data.session) resolveRole(data.session);
          });
        }}
      />
    );
  }

  if (phase === "signed-out") {
    return <LoginScreen />;
  }

  const signOut = () => client.auth.signOut();

  if (phase === "student") {
    return <StudentPortal onSignOut={signOut} />;
  }

  return <App userEmail={session?.user.email} onSignOut={signOut} />;
}
