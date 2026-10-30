import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { useAuth } from "../auth";

export default function AuthModal({ open, initialMode = "login", onClose }: { open: boolean; initialMode?: "login" | "register"; onClose: () => void }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setMode(initialMode); setError(""); } }, [open, initialMode]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "register") await register(email, password, name);
      else await login(email, password);
      setPassword("");
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Попробуйте ещё раз");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Закрыть"><X size={20} /></button>
        <span className="modal-symbol">Н</span>
        <p className="overline">ЛИЧНЫЙ КАБИНЕТ</p>
        <h2 id="auth-title">{mode === "register" ? "Начните обучение" : "С возвращением"}</h2>
        <p className="muted">Прогресс и результаты тестов сохранятся в вашем аккаунте.</p>
        <form onSubmit={submit} className="form-stack">
          {mode === "register" && <label>Как к вам обращаться?<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" autoComplete="name" /></label>}
          <label>Электронная почта<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.ru" autoComplete="email" autoFocus /></label>
          <label>Пароль<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 8 символов" autoComplete={mode === "register" ? "new-password" : "current-password"} /></label>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <button className="button button-primary button-full" disabled={busy}>{busy ? "Пожалуйста, подождите…" : mode === "register" ? "Создать аккаунт" : "Войти"}</button>
        </form>
        <button className="text-button auth-switch" onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); }}>
          {mode === "register" ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
        </button>
      </section>
    </div>
  );
}
