import { useState } from "react";
import { Lock, LogIn, Mail, UserPlus } from "lucide-react";
import { Card, Field, PrimaryButton, TextInput } from "./components/ui";
import { supabase } from "./lib/supabaseClient";

export function LoginScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo("Проверьте почту: нужно подтвердить регистрацию по ссылке в письме, затем войти.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось выполнить вход");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }} className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="text-2xl font-extrabold tracking-tight mb-1 text-center">
          <span className="text-[#2563EB]">Tutor</span>
          <span className="text-[#111827]">Space</span>
        </div>
        <p className="text-sm text-gray-500 text-center mb-6">
          {mode === "signin" ? "Вход в личный кабинет" : "Создание аккаунта"}
        </p>
        <form onSubmit={submit} className="space-y-4">
          <Field label="E-mail">
            <TextInput icon={Mail} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mail.ru" />
          </Field>
          <Field label="Пароль">
            <TextInput
              icon={Lock}
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 6 символов"
            />
          </Field>
          {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</div>}
          {info && <div className="text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl">{info}</div>}
          <PrimaryButton type="submit" full icon={mode === "signin" ? LogIn : UserPlus} disabled={loading}>
            {loading ? "Подождите…" : mode === "signin" ? "Войти" : "Зарегистрироваться"}
          </PrimaryButton>
        </form>
        <button
          onClick={() => {
            setMode((m) => (m === "signin" ? "signup" : "signin"));
            setError(null);
            setInfo(null);
          }}
          className="w-full text-center text-sm text-[#2563EB] hover:underline mt-4"
        >
          {mode === "signin" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
        </button>
      </Card>
    </div>
  );
}
