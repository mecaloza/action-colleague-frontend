"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import type { Role, UserRow } from "@/lib/api/types";
import { userKeys, usersApi } from "@/lib/api/users";
import { toastError } from "@/lib/notify";

const PASSWORD_CHARS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/l/I
const PASSWORD_LENGTH = 12;
const MIN_PASSWORD = 8;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** A random, readable temporary password (the browser's secure generator). */
function temporaryPassword(): string {
  const values = new Uint32Array(PASSWORD_LENGTH);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => PASSWORD_CHARS[value % PASSWORD_CHARS.length]).join("");
}

interface PersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null to add someone new. */
  person: UserRow | null;
}

/** Add a person to the team, or edit one (a new password is optional when editing). */
export function PersonDialog({ open, onOpenChange, person }: PersonDialogProps) {
  const [saving, setSaving] = useState(false);
  return (
    // While saving, neither Escape nor the X closes it: the admin sees how it went.
    <Dialog open={open} onOpenChange={(next) => (next || !saving) && onOpenChange(next)}>
      <DialogContent className="max-w-xl">
        {/* Keyed by person: each opening starts from their saved data. */}
        {open && (
          <PersonForm
            key={person?.id ?? "new"}
            person={person}
            onSavingChange={setSaving}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface PersonFormProps {
  person: UserRow | null;
  onSavingChange: (saving: boolean) => void;
  onDone: () => void;
}

function PersonForm({ person, onSavingChange, onDone }: PersonFormProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const editing = person !== null;
  // Admins can't demote themselves (the API refuses) and change their own password in their profile.
  const isSelf = editing && person.id === user?.id;
  const [name, setName] = useState(person?.name ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [role, setRole] = useState<Role>(person?.role ?? "collaborator");
  const [position, setPosition] = useState(person?.position ?? "");
  const [department, setDepartment] = useState(person?.department ?? "");
  const [password, setPassword] = useState(() => (editing ? "" : temporaryPassword()));

  // What gets saved: the text fields trimmed. The password travels apart.
  const fields = {
    name: name.trim(),
    email: email.trim(),
    role,
    position: position.trim(),
    department: department.trim(),
  };
  // Editing may leave the password empty (it keeps the current one); a new person always needs one.
  const passwordOk = password.length >= MIN_PASSWORD || (editing && !password);
  const valid = fields.name !== "" && EMAIL_PATTERN.test(fields.email) && passwordOk;

  const save = useMutation({
    mutationFn: () =>
      editing
        ? usersApi.update(person.id, { ...fields, ...(password ? { password } : {}) })
        : usersApi.create({ ...fields, password }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
      if (editing) {
        toast.success(
          password ? "Datos guardados. La nueva contraseña cerró sus sesiones abiertas." : "Datos guardados",
        );
      } else {
        toast.success(`${fields.name} ya puede ingresar con su correo y la contraseña temporal.`);
      }
      onDone();
    },
    onError: toastError,
  });

  useEffect(() => onSavingChange(save.isPending), [save.isPending, onSavingChange]);

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Contraseña copiada");
    } catch {
      toast.error("No pudimos copiarla; selecciónala y cópiala a mano.");
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <DialogHeader>
        <DialogTitle>{editing ? `Editar a ${person.name}` : "Agregar persona"}</DialogTitle>
        <DialogDescription>
          {editing ? "Cambia sus datos o dale una contraseña nueva." : "Recibirá acceso con su correo y una contraseña temporal."}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="person-name">Nombre</Label>
            <Input id="person-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={200} required autoFocus />
          </div>
          <div>
            <Label htmlFor="person-email">Correo</Label>
            <Input id="person-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={200} required />
          </div>
          <div>
            <Label htmlFor="person-position">Cargo</Label>
            <Input id="person-position" value={position} onChange={(event) => setPosition(event.target.value)} maxLength={200} placeholder="Ej. Operario" />
          </div>
          <div>
            <Label htmlFor="person-department">Área</Label>
            <Input id="person-department" value={department} onChange={(event) => setDepartment(event.target.value)} maxLength={200} placeholder="Ej. Producción" />
          </div>
        </div>
        <div>
          <Label htmlFor="person-role">Rol</Label>
          <Select
            id="person-role"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
            disabled={isSelf}
            aria-describedby={isSelf ? "person-role-hint" : undefined}
          >
            <option value="collaborator">Colaborador: toma los cursos que le asignan</option>
            <option value="admin">Administrador: crea cursos y gestiona el equipo</option>
          </Select>
          {isSelf && (
            <p id="person-role-hint" className="mt-1.5 text-xs text-muted-foreground">
              No puedes cambiar tu propio rol.
            </p>
          )}
        </div>
        {isSelf ? (
          <p className="text-sm text-muted-foreground">Tu contraseña se cambia en «Mi perfil».</p>
        ) : (
          <div>
            <Label htmlFor="person-password">{editing ? "Contraseña nueva (opcional)" : "Contraseña temporal"}</Label>
            <div className="flex gap-2">
              <Input
                id="person-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                maxLength={128}
                autoComplete="new-password"
                placeholder={editing ? "Déjala vacía para no cambiarla" : undefined}
                className="font-mono"
              />
              <Button type="button" variant="outline" size="icon" aria-label="Generar otra contraseña" onClick={() => setPassword(temporaryPassword())}>
                <RefreshCw />
              </Button>
              <Button type="button" variant="outline" size="icon" aria-label="Copiar contraseña" onClick={copyPassword} disabled={!password}>
                <Copy />
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">Mínimo {MIN_PASSWORD} caracteres. Compártela por un canal privado; podrá cambiarla en su perfil.</p>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone} disabled={save.isPending}>
          Cancelar
        </Button>
        <Button type="submit" loading={save.isPending} disabled={!valid}>
          {editing ? "Guardar cambios" : "Agregar persona"}
        </Button>
      </DialogFooter>
    </form>
  );
}
