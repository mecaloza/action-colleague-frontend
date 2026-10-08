"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { pathKeys, pathsApi } from "@/lib/api/paths";
import { toastError } from "@/lib/notify";

const TITLE_ERROR_ID = "new-path-title-error";

/**
 * A new path (a draft with its title and description): then its page, to add courses and people. The page gives it a
 * new `key` on each opening: the form always starts empty.
 */
export function NewPathDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const titleField = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attempted, setAttempted] = useState(false);
  const titleError = attempted && !title.trim() ? "Escribe el título de la ruta" : null;

  const create = useMutation({
    mutationFn: () => pathsApi.create({ title: title.trim(), description: description.trim() }),
    onSuccess: (path) => {
      queryClient.setQueryData(pathKeys.detail(path.id), path);
      void queryClient.invalidateQueries({ queryKey: pathKeys.lists });
      toast.success("Ruta creada: agrega sus cursos");
      router.push(`/admin/paths/${path.id}`);
    },
    onError: toastError,
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !create.isPending && onClose()}>
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault(); // start on the title; not autoFocus, see useReturnFocus
          titleField.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Nueva ruta</DialogTitle>
          <DialogDescription>Empieza como borrador: agrega sus cursos y sus perfiles, y publícala cuando esté lista.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (title.trim()) {
              create.mutate();
              return;
            }
            flushSync(() => setAttempted(true));
            titleField.current?.focus();
          }}
        >
          <div>
            <Label htmlFor="new-path-title">Título</Label>
            <Input
              ref={titleField}
              id="new-path-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              placeholder="Ej. Asesor de flotas: primeros 30 días"
              required
              aria-invalid={titleError ? true : undefined}
              aria-describedby={titleError ? TITLE_ERROR_ID : undefined}
            />
            <FieldError id={TITLE_ERROR_ID} message={titleError} />
          </div>
          <div>
            <Label htmlFor="new-path-description">Descripción (opcional)</Label>
            <Textarea
              id="new-path-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={5000}
              placeholder="Qué logra quien la completa."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={create.isPending}>
              Cancelar
            </Button>
            <Button type="submit" loading={create.isPending}>
              Crear ruta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
