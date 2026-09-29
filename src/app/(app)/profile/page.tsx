"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, UserRound } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { authApi, type CurrentUser } from "@/lib/api/auth";
import { toastError } from "@/lib/notify";

const MIN_PASSWORD = 8;

function Section({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-border py-10 md:grid-cols-[280px_1fr]">
      <div>
        <p className="flex items-center gap-2 font-display text-xl font-medium tracking-tightest">
          {icon} {title}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
      </div>
      <div className="max-w-md">{children}</div>
    </section>
  );
}

function NameForm({ user }: { user: CurrentUser }) {
  const { setCurrentUser } = useAuth();
  const [name, setName] = useState(user.name);
  const trimmed = name.trim();
  const save = useMutation({
    mutationFn: () => authApi.updateMe({ name: trimmed }),
    onSuccess: (updated) => {
      setCurrentUser(updated);
      toast.success("Nombre actualizado");
    },
    onError: toastError,
  });
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div>
        <Label htmlFor="profile-name">Nombre</Label>
        <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={200} autoComplete="name" />
      </div>
      <Button type="submit" loading={save.isPending} disabled={!trimmed || trimmed === user.name}>
        Guardar nombre
      </Button>
    </form>
  );
}

function PasswordForm({ user }: { user: CurrentUser }) {
  const { login } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const mismatch = confirmation.length > 0 && confirmation !== next;
  const tooShort = next.length > 0 && next.length < MIN_PASSWORD;

  const change = useMutation({
    mutationFn: async () => {
      await authApi.updateMe({ current_password: current, new_password: next });
      // Changing it ends every session (a stolen one too): sign this one back in with the new password.
      await login(user.email, next);
    },
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirmation("");
      toast.success("Contraseña actualizada. Se cerró la sesión en tus otros dispositivos.");
    },
    onError: toastError,
  });

  const type = visible ? "text" : "password";
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        change.mutate();
      }}
    >
      <div>
        <Label htmlFor="current-password">Contraseña actual</Label>
        <Input id="current-password" type={type} value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" />
      </div>
      <div>
        <Label htmlFor="new-password">Contraseña nueva</Label>
        <Input
          id="new-password"
          type={type}
          value={next}
          onChange={(event) => setNext(event.target.value)}
          autoComplete="new-password"
          maxLength={128}
          aria-invalid={tooShort || undefined}
          aria-describedby="new-password-hint"
        />
        <p id="new-password-hint" className={tooShort ? "mt-1.5 text-xs text-destructive" : "mt-1.5 text-xs text-muted-foreground"}>
          Al menos {MIN_PASSWORD} caracteres.
        </p>
      </div>
      <div>
        <Label htmlFor="confirm-password">Repite la contraseña nueva</Label>
        <Input
          id="confirm-password"
          type={type}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="new-password"
          aria-invalid={mismatch || undefined}
        />
        {mismatch && <p className="mt-1.5 text-xs text-destructive">Las contraseñas no coinciden.</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={change.isPending} disabled={!current || next.length < MIN_PASSWORD || next !== confirmation}>
          Cambiar contraseña
        </Button>
        <Button type="button" variant="ghost" onClick={() => setVisible((value) => !value)} aria-pressed={visible}>
          {visible ? <EyeOff /> : <Eye />} {visible ? "Ocultar" : "Mostrar"}
        </Button>
      </div>
    </form>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null; // the app shell only renders pages for a signed-in user
  return (
    <>
      <PageHero eyebrow="Mi perfil" title={user.name} description={user.email} />
      <div className="container py-4">
        <Section icon={<UserRound className="h-5 w-5 text-accent" />} title="Tus datos" hint="Así te ven los administradores en los reportes.">
          <NameForm key={user.name} user={user} />
        </Section>
        <Section
          icon={<KeyRound className="h-5 w-5 text-accent" />}
          title="Contraseña"
          hint="Cambiarla cierra tu sesión en los demás dispositivos."
        >
          <PasswordForm user={user} />
        </Section>
      </div>
    </>
  );
}
