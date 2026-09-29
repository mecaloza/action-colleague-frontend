"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileText, Film, Video, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { coursesApi } from "@/lib/api/courses";
import type { ModuleSource } from "@/lib/api/types";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { toastError } from "@/lib/notify";
import { cn } from "@/lib/utils";

const CONTENT_KINDS: { value: ModuleSource; label: string; description: string; icon: LucideIcon }[] = [
  { value: "text", label: "Lectura", description: "Texto con formato; ideal para políticas o guías.", icon: FileText },
  { value: "upload", label: "Video propio", description: "Sube un video que ya tienes.", icon: Film },
  { value: "recording", label: "Grabarme", description: "Graba tu cámara con tus diapositivas.", icon: Video },
];

export function NewModuleDialog({
  courseId,
  open,
  onOpenChange,
  onCreated,
}: {
  courseId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (moduleId: number) => void;
}) {
  const { refreshCourse } = useCourseCache();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ModuleSource>("text");

  const create = useMutation({
    mutationFn: () => coursesApi.createModule(courseId, { title: title.trim(), source: kind }),
    onSuccess: (module) => {
      refreshCourse(courseId);
      setTitle("");
      onOpenChange(false);
      onCreated(module.id);
    },
    onError: toastError,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo módulo</DialogTitle>
          <DialogDescription>Elige cómo vas a crear su contenido; puedes cambiarlo después.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div>
            <Label htmlFor="new-module-title">Título</Label>
            <Input id="new-module-title" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus required maxLength={300} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Tipo de contenido">
            {CONTENT_KINDS.map((item) => (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={kind === item.value}
                onClick={() => setKind(item.value)}
                className={cn(
                  "flex flex-col items-start gap-2 border p-4 text-left transition-colors",
                  kind === item.value ? "border-ink-800 bg-mist" : "border-border hover:border-ink-500",
                )}
              >
                <item.icon className={cn("h-5 w-5", kind === item.value ? "text-accent" : "text-muted-foreground")} />
                <span className="text-sm font-semibold">{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.description}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" loading={create.isPending} disabled={!title.trim()}>Crear módulo</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
