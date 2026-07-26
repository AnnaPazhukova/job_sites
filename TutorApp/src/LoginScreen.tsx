import { useState } from "react";
import { Mail, Send } from "lucide-react";
import { Card, Field, PrimaryButton, TextInput } from "./components/ui";
import { supabase } from "./lib/supabaseClient";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + window.location.pathname },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить ссылку");
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
        <p className="text-sm text-gray-500 text-center mb-6">Вход в личный кабинет репетитора</p>

        {sent ? (
          <div className="text-sm text-emerald-600 bg-emerald-50 px-3.5 py-3 rounded-xl text-center">
            Письмо со ссылкой для входа отправлено на {email}. Откройте его и перейдите по ссылке — вы сразу окажетесь внутри.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field label="E-mail">
              <TextInput icon={Mail} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mail.ru" />
            </Field>
            {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</div>}
            <PrimaryButton type="submit" full icon={Send} disabled={loading}>
              {loading ? "Отправляем…" : "Отправить ссылку для входа"}
            </PrimaryButton>
            <p className="text-xs text-gray-400 text-center">Без пароля — на почту придёт ссылка для входа. Если аккаунта ещё нет, он создастся автоматически.</p>
          </form>
        )}
      </Card>
    </div>
  );
}
