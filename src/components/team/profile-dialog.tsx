"use client";

import { useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { type ProfileInput, profilesApi } from "@/lib/api/profiles";
import type { ProfileItem } from "@/lib/api/types";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { toastError } from "@/lib/notify";

const NAME_ERROR_ID = "profile-name-error";

interface ProfileDialogProps {
  open: boolean;
  onClose: () => void;
  /** Null to create one. The page keeps the last one while the dialog animates closed. */
  profile: ProfileItem | null;
}

/** Create a profile, or rename and describe one. The page gives it a new `key` on each opening. */
export function ProfileDialog({ open, onClose, profile }: ProfileDialogProps) {
  const nameField = useRef<HTMLInputElement>(null);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault(); // start on the name; not autoFocus, see useReturnFocus
          nameField.current?.focus();
        }}
      >
        <ProfileForm open={open} profile={profile} nameField={nameField} onDone={onClose} />
      </DialogContent>
    </Dialog>
  );
}

interface ProfileFormProps {
  /** False while the dialog animates closed: the form is still on screen but must not save. */
  open: boolean;
  profile: ProfileItem | null;
  nameField: RefObject<HTMLInputElement>;
  onDone: () => void;
}

function ProfileForm({ open, profile, nameField, onDone }: ProfileFormProps) {
  const { refreshPeople } = useCourseCache();
  const editing = profile !== null;
  const [name, setName] = useState(profile?.name ?? "");
  const [description, setDescription] = useState(profile?.description ?? "");
  const [attempted, setAttempted] = useState(false);
  const [nameTaken, setNameTaken] = useState<string | null>(null);
  const input: ProfileInput = { name: name.trim(), description: description.trim() };
  const nameError = nameTaken ?? (attempted && !input.name ? "Escribe el nombre del perfil" : null);

  const save = useMutation({
    mutationFn: (sent: ProfileInput) => {
      if (!editing) return profilesApi.create(sent);
      // Only what changed: a stale copy never overwrites a newer name.
      const changes: Partial<ProfileInput> = {};
      if (sent.name !== profile.name) changes.name = sent.name;
      if (sent.description !== profile.description) changes.description = sent.description;
      return profilesApi.update(profile.id, changes);
    },
    onSuccess: (saved) => {
      // The profiles, and where their names show: each person's row, each path's profiles.
      void refreshPeople();
      toast.success(editing ? "Perfil guardado" : `Perfil «${saved.name}» creado`);
      onDone();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        // Another profile has that name: say it under the field (first, so it is read out), then go there.
        flushSync(() => setNameTaken(error.message));
        nameField.current?.focus();
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
        if (!open) return; // closing: an Enter during the exit animation doesn't save
        if (input.name) {
          save.mutate(input);
          return;
        }
        flushSync(() => setAttempted(true));
        nameField.current?.focus();
      }}
    >
      <DialogHeader>
        <DialogTitle>{editing ? `Editar el perfil ${profile.name}` : "Nuevo perfil"}</DialogTitle>
        <DialogDescription>
          Agrupa a las personas por lo que hacen en la empresa. Cada perfil recibe las rutas de aprendizaje vinculadas a
          él.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-5">
        <div>
          <Label htmlFor="profile-name">Nombre</Label>
          <Input
            ref={nameField}
            id="profile-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setNameTaken(null);
            }}
            maxLength={120}
            placeholder="Ej. Asesor de flotas"
            required
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? NAME_ERROR_ID : undefined}
          />
          <FieldError id={NAME_ERROR_ID} message={nameError} />
        </div>
        <div>
          <Label htmlFor="profile-description">Descripción (opcional)</Label>
          <Textarea
            id="profile-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            placeholder="Quiénes son y qué necesitan saber."
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone} disabled={save.isPending}>
          Cancelar
        </Button>
        <Button type="submit" loading={save.isPending}>
          {editing ? "Guardar cambios" : "Crear perfil"}
        </Button>
      </DialogFooter>
    </form>
  );
}
