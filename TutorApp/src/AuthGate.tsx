import { useEffect, useRef, useState } from "react";
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
  const initialHandled = useRef(false);

  async function resolveRole(newSession: Session) {
    if (inviteCode) {
      try {
        await ensureLinked(inviteCode);
      } catch {
        // Invite invalid/expired/already used — fall through to normal role
        // detection so the account can still sign in as whatever it already is.
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
    const client = supabase;

    async function handle(newSession: Session | null) {
      if (!newSession) {
        initialHandled.current = true;
        setSession(null);
        setPhase(inviteCode ? "student-invite" : "signed-out");
        return;
      }

      // A session already existed the moment this tab loaded an invite
      // link — never silently reuse it to claim the invite (that account
      // might be the tutor's own, or a different student's). Force a clean
      // sign-out so the invite can only ever be claimed through an explicit
      // sign-in/sign-up performed on the invite screen itself.
      if (!initialHandled.current && inviteCode) {
        initialHandled.current = true;
        await client.auth.signOut();
        return;
      }

      initialHandled.current = true;
      await resolveRole(newSession);
    }

    client.auth.getSession().then(({ data }) => handle(data.session));

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, newSession) => {
      handle(newSession);
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
