"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, Eye, EyeOff } from "lucide-react";
import { DiamondMotif } from "@/components/brand/motif";
import { Logo } from "@/components/brand/logo";
import { SplashScreen } from "@/components/layout/splash-screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { homeFor, useAuth } from "@/contexts/auth-context";
import { errorMessage } from "@/lib/api/client";
import { safeNext } from "@/lib/safe-next";

const HIGHLIGHTS = [
  "Convierte tus documentos en cursos con video, voz y evaluación.",
  "Sube tu propio material o grábate con tus diapositivas.",
  "Sigue el avance de cada persona de tu equipo.",
];

const ERROR_ID = "login-error";

function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const invalid = Boolean(error) || undefined;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Read the fields from the form: browser autofill may not have fired onChange yet.
    const data = new FormData(event.currentTarget);
    const formEmail = String(data.get("email") ?? "").trim();
    const formPassword = String(data.get("password") ?? "");
    if (!formEmail || !formPassword) {
      setError("Escribe tu correo y tu contraseña.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await login(formEmail, formPassword);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div>
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="nombre@empresa.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={invalid}
          aria-describedby={error ? ERROR_ID : undefined}
          required
          autoFocus
        />
      </div>
      <div>
        <Label htmlFor="password">Contraseña</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={invalid}
            aria-describedby={error ? ERROR_ID : undefined}
            className="pr-11"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-ink-800"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && (
        <p id={ERROR_ID} role="alert" className="flex items-start gap-2 border-l-2 border-destructive bg-red-50 px-3 py-2.5 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" loading={submitting}>
        Ingresar <ArrowRight />
      </Button>
    </form>
  );
}

function LoginScreen() {
  const { status, user } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));

  useEffect(() => {
    if (status === "authenticated") router.replace(next ?? homeFor(user));
  }, [status, user, next, router]);

  // Signed-in users (or a session still being checked) never see the form.
  if (status !== "anonymous") return <SplashScreen />;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="band-dark hidden flex-col justify-between p-12 lg:flex xl:p-16">
        <Logo inverse />
        <DiamondMotif className="absolute right-12 top-10 h-[210px] w-[140px] xl:right-16" />
        <div className="relative z-10 max-w-xl">
          <p className="eyebrow mb-6 text-white/60">Estudio de cursos</p>
          <p className="display-xl text-white">
            Formación que tu equipo <span className="text-accent">sí termina.</span>
          </p>
          <ul className="mt-10 space-y-4">
            {HIGHLIGHTS.map((item, index) => (
              <motion.li
                key={item}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + index * 0.08 }}
                className="flex items-start gap-3 text-white/80"
              >
                <span className="mt-2 h-2 w-2 shrink-0 rotate-45 bg-accent" />
                {item}
              </motion.li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-xs text-white/40">© {new Date().getFullYear()} Action Colleague</p>
      </section>

      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-12 lg:hidden">
            <Logo />
          </div>
          <p className="eyebrow mb-3">Bienvenido</p>
          <h1 className="display-md mb-2">Inicia sesión</h1>
          <p className="mb-10 text-sm text-muted-foreground">Usa el correo con el que te registró tu empresa.</p>
          <LoginForm />
        </div>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<SplashScreen />}>
      <LoginScreen />
    </Suspense>
  );
}
