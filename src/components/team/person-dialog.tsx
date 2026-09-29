"use client";

import { useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { ApiError } from "@/lib/api/client";
import type { Role, UserRow } from "@/lib/api/types";
import { type UserInput, userKeys, usersApi } from "@/lib/api/users";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { toastError } from "@/lib/notify";
import { cn } from "@/lib/utils";

const PASSWORD_CHARS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/l/I
const PASSWORD_LENGTH = 12;
const MIN_PASSWORD = 8;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const NAME_ERROR_ID = "person-name-error";
const EMAIL_ERROR_ID = "person-email-error";
const PASSWORD_ERROR_ID = "person-password-error";
const PASSWORD_HINT_ID = "person-password-hint";
/** Tags the save, so the dialog knows one is running without a copy of the form's state. */
const SAVE_PERSON = ["users", "save"] as const;

/** "password" ("Nueva contraseña") opens with a temporary password already generated, and focused. */
export type PersonDialogMode = "details" | "password";

/** Everything the form saves except the password, which travels apart. */
type PersonFields = Omit<UserInput, "password">;

/** What one save sends. Passed to `mutate`: the callbacks see what was saved even if the form changes meanwhile. */
interface SaveInput {
  fields: PersonFields;
  password: string;
}

/** A random, readable temporary password (the browser's secure generator). */
function temporaryPassword(): string {
  const values = new Uint32Array(PASSWORD_LENGTH);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => PASSWORD_CHARS[value % PASSWORD_CHARS.length]).join("");
}

/** Only what the admin changed: a stale copy of the person never overwrites newer data. */
function changedFields<T extends object>(saved: T, edited: T): Partial<T> {
  const changes: Partial<T> = {};
  for (const key in edited) {
    if (edited[key] !== saved[key]) changes[key] = edited[key];
  }
  return changes;
}

/**
 * A field's problem, linked to it with aria-describedby. Always rendered, empty when there is none:
 * as a live region it is read out even when the field already had focus (Enter from that field).
 */
function FieldError({ id, message }: { id: string; message: string | null }) {
  return (
    <p id={id} aria-live="polite" className={cn("text-xs text-destructive", message && "mt-1.5")}>
      {message}
    </p>
  );
}

/** Copies a password; `failureMessage` says what to do when the browser refuses (no permission, insecure page). */
async function copyPassword(password: string, failureMessage: string) {
  try {
    await navigator.clipboard.writeText(password);
    toast.success("Contraseña copiada");
  } catch {
    toast.error(failureMessage);
  }
}

interface PersonDialogProps {
  open: boolean;
  onClose: () => void;
  /** Null to add someone new. The page keeps the last one while the dialog animates closed. */
  person: UserRow | null;
  mode?: PersonDialogMode;
}

/**
 * Add a person to the team, or edit one (a new password is optional when editing).
 * The page gives it a new `key` on each opening: the form always starts from the saved data.
 */
export function PersonDialog({ open, onClose, person, mode = "details" }: PersonDialogProps) {
  const saving = useIsMutating({ mutationKey: SAVE_PERSON }) > 0;
  const nameField = useRef<HTMLInputElement>(null);
  const passwordField = useRef<HTMLInputElement>(null);
  return (
    // While saving, neither Escape nor the X closes it: the admin sees how it went.
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent
        className="max-w-xl"
        closeDisabled={saving}
        onOpenAutoFocus={(event) => {
          event.preventDefault(); // start on a field; not autoFocus, see useReturnFocus
          (mode === "password" && passwordField.current ? passwordField : nameField).current?.focus();
        }}
      >
        <PersonForm
          open={open}
          person={person}
          mode={mode}
          nameField={nameField}
          passwordField={passwordField}
          onDone={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}

interface PersonFormProps {
  /** False while the dialog animates closed: the form is still on screen but must not save. */
  open: boolean;
  person: UserRow | null;
  mode: PersonDialogMode;
  nameField: RefObject<HTMLInputElement>;
  passwordField: RefObject<HTMLInputElement>;
  onDone: () => void;
}

function PersonForm({ open, person, mode, nameField, passwordField, onDone }: PersonFormProps) {
  const queryClient = useQueryClient();
  const { refreshPeople } = useCourseCache();
  const { user, setCurrentUser } = useAuth();
  const editing = person !== null;
  // Admins can't demote themselves (the API refuses) and change their own password in their profile.
  const isSelf = editing && person.id === user?.id;
  const [name, setName] = useState(person?.name ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [role, setRole] = useState<Role>(person?.role ?? "collaborator");
  const [position, setPosition] = useState(person?.position ?? "");
  const [department, setDepartment] = useState(person?.department ?? "");
  // A new person, and "Nueva contraseña", start with a temporary password; editing the data leaves it empty.
  const [password, setPassword] = useState(() => (!editing || (mode === "password" && !isSelf) ? temporaryPassword() : ""));
  // Problems show once the field is left or a save is attempted, not while it is first typed.
  const [emailLeft, setEmailLeft] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [emailTaken, setEmailTaken] = useState<string | null>(null);
  const emailField = useRef<HTMLInputElement>(null);

  // What gets saved: the text fields trimmed. The password travels apart.
  const fields: PersonFields = {
    name: name.trim(),
    email: email.trim(),
    role,
    position: position.trim(),
    department: department.trim(),
  };
  // An unchanged email isn't checked again: older accounts may have one the pattern rejects.
  const emailOk = (editing && fields.email === person.email) || EMAIL_PATTERN.test(fields.email);
  // Editing may leave the password empty (it keeps the current one); a new person always needs one.
  const passwordOk = password.length >= MIN_PASSWORD || (editing && !password);
  const nameError = attempted && !fields.name ? "Escribe su nombre" : null;
  const emailError = emailTaken ?? (!emailOk && (emailLeft || attempted) ? "Escribe un correo válido" : null);
  const passwordError = attempted && !passwordOk ? `Usa al menos ${MIN_PASSWORD} caracteres` : null;
  const firstProblem = !fields.name ? nameField : emailTaken || !emailOk ? emailField : !passwordOk ? passwordField : null;

  const save = useMutation({
    mutationKey: SAVE_PERSON,
    mutationFn: (input: SaveInput) =>
      editing
        ? usersApi.update(person.id, {
            ...changedFields<PersonFields>(person, input.fields),
            ...(input.password ? { password: input.password } : {}),
          })
        : usersApi.create({ ...input.fields, password: input.password }),
    onSuccess: (saved, input) => {
      // The lists show the saved row at once (reopening it finds the new data); the refetch then brings order and counts.
      queryClient.setQueriesData<UserRow[]>({ queryKey: userKeys.lists }, (rows) =>
        rows?.map((row) => (row.id === saved.id ? saved : row)),
      );
      void refreshPeople();
      if (isSelf) setCurrentUser(saved); // the header shows the new name and email
      if (!editing) {
        toast.success(`${saved.name} ya puede ingresar con su correo y la contraseña temporal.`, {
          action: {
            label: "Copiar contraseña",
            onClick: () => void copyPassword(input.password, "No pudimos copiarla. Si no la tienes, genera otra con «Nueva contraseña»."),
          },
          duration: 10_000, // time to use the action
        });
      } else if (input.password) {
        toast.success(
          "Datos guardados. Con la nueva contraseña, sus sesiones abiertas se cierran en menos de una hora; para cortarlas ya, desactiva la cuenta.",
          {
            action: {
              label: "Copiar contraseña",
              onClick: () => void copyPassword(input.password, "No pudimos copiarla. Si no la tienes, genera otra con «Nueva contraseña»."),
            },
            duration: 10_000,
          },
        );
      } else {
        toast.success("Datos guardados");
      }
      onDone();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        // Someone else has that email: say it under the field (first, so it is read out), then go there.
        flushSync(() => setEmailTaken(error.message));
        emailField.current?.focus();
      } else {
        toastError(error);
      }
    },
  });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!open) return; // closing: an Enter or a click during the exit animation doesn't save
        if (!firstProblem) {
          save.mutate({ fields, password });
          return;
        }
        // Show the problems before moving to the first one, so it is read out with its message.
        flushSync(() => setAttempted(true));
        firstProblem.current?.focus();
      }}
    >
      <DialogHeader>
        <DialogTitle>{editing ? `Editar a ${person.name}` : "Agregar persona"}</DialogTitle>
        <DialogDescription>
          {isSelf
            ? "Cambia tus datos."
            : editing
              ? "Cambia sus datos o dale una contraseña nueva."
              : "Recibirá acceso con su correo y una contraseña temporal."}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="person-name">Nombre</Label>
            <Input
              ref={nameField}
              id="person-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={200}
              required
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? NAME_ERROR_ID : undefined}
            />
            <FieldError id={NAME_ERROR_ID} message={nameError} />
          </div>
          <div>
            <Label htmlFor="person-email">Correo</Label>
            <Input
              ref={emailField}
              id="person-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailTaken(null);
              }}
              onBlur={() => email.trim() && setEmailLeft(true)} // passing through it empty is not a mistake yet
              maxLength={200}
              required
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? EMAIL_ERROR_ID : undefined}
            />
            <FieldError id={EMAIL_ERROR_ID} message={emailError} />
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
                ref={passwordField}
                id="person-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                maxLength={128}
                autoComplete="new-password"
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                placeholder={editing ? "Déjala vacía para no cambiarla" : undefined}
                aria-invalid={passwordError ? true : undefined}
                aria-describedby={passwordError ? `${PASSWORD_ERROR_ID} ${PASSWORD_HINT_ID}` : PASSWORD_HINT_ID}
                className="font-mono"
              />
              <Button type="button" variant="outline" size="icon" aria-label="Generar otra contraseña" onClick={() => setPassword(temporaryPassword())}>
                <RefreshCw />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Copiar contraseña"
                onClick={() => void copyPassword(password, "No pudimos copiarla; selecciónala y cópiala a mano.")}
                disabled={!password}
              >
                <Copy />
              </Button>
            </div>
            <FieldError id={PASSWORD_ERROR_ID} message={passwordError} />
            <p id={PASSWORD_HINT_ID} className="mt-1.5 text-xs text-muted-foreground">
              Mínimo {MIN_PASSWORD} caracteres. Compártela por un canal privado; podrá cambiarla en su perfil.
            </p>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone} disabled={save.isPending}>
          Cancelar
        </Button>
        <Button type="submit" loading={save.isPending}>
          {editing ? "Guardar cambios" : "Agregar persona"}
        </Button>
      </DialogFooter>
    </form>
  );
}
