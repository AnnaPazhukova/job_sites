import { lazy, Suspense, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabaseClient";
import { setDataAdapter } from "./lib/storage";
import { SupabaseAdapter } from "./lib/supabaseStorage";
import { clearStoredPortalCode, getInviteCodeFromUrl, getStoredPortalCode, storePortalCode } from "./lib/studentAuth";
import { LoginScreen } from "./LoginScreen";

// A tutor never needs the student portal bundle and a student never needs
// the tutor app bundle, so each is only fetched once we know which one this
// visitor actually is, instead of every visitor downloading both.
const StudentPortal = lazy(() => import("./StudentPortal"));
const App = lazy(() => import("./App"));

const LOADING = <div className="min-h-screen flex items-center justify-center text-gray-400 bg-[#F7F8FA]">Загрузка…</div>;

type Phase = "loading" | "signed-out" | "tutor";

// A student's "login" is just having the access-link code — from the URL
// on first visit (then remembered in localStorage), or from localStorage on
// every visit after. This never touches Supabase Auth, so it's resolved
// entirely separately from the tutor's session below.
function resolvePortalCode(): string | null {
  const urlCode = getInviteCodeFromUrl();
  if (urlCode) {
    storePortalCode(urlCode);
    window.history.replaceState(null, "", window.location.pathname);
    return urlCode;
  }
  return getStoredPortalCode();
}

export default function AuthGate() {
  const [portalCode, setPortalCode] = useState<string | null>(() => (supabase ? resolvePortalCode() : null));
  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabase || portalCode) return;
    const client = supabase;

    client.auth.getSession().then(({ data }) => {
      setDataAdapter(new SupabaseAdapter());
      setSession(data.session);
      setPhase(data.session ? "tutor" : "signed-out");
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, newSession) => {
      setDataAdapter(new SupabaseAdapter());
      setSession(newSession);
      setPhase(newSession ? "tutor" : "signed-out");
    });

    return () => subscription.unsubscribe();
  }, [portalCode]);

  if (!supabase) {
    return (
      <Suspense fallback={LOADING}>
        <App />
      </Suspense>
    );
  }

  if (portalCode) {
    return (
      <Suspense fallback={LOADING}>
        <StudentPortal
          code={portalCode}
          onExit={() => {
            clearStoredPortalCode();
            setPortalCode(null);
          }}
        />
      </Suspense>
    );
  }

  if (phase === "loading") {
    return LOADING;
  }

  if (phase === "signed-out") {
    return <LoginScreen />;
  }

  const client = supabase;
  return (
    <Suspense fallback={LOADING}>
      <App userEmail={session?.user.email} onSignOut={() => client.auth.signOut()} />
    </Suspense>
  );
}
