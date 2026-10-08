"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, MoreHorizontal, Rocket, Trash2, Undo2 } from "lucide-react";
import { DiamondMotif } from "@/components/brand/motif";
import { BackLink } from "@/components/layout/back-link";
import { useConfirm } from "@/components/layout/confirm-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { pathsApi } from "@/lib/api/paths";
import type { PathDetail, PathStatus } from "@/lib/api/types";
import { formatPercent, plural } from "@/lib/format";
import { usePathCache } from "@/lib/hooks/use-path-cache";
import { toastError } from "@/lib/notify";
import { PathStatusBadge } from "./path-badges";

/** What each status change says once saved. */
const STATUS_SAVED: Record<PathStatus, (path: PathDetail) => string> = {
  published: (path) => `Ruta publicada: ${plural(path.people_count, "persona la tiene", "personas la tienen")}`,
  draft: () => "La ruta volvió a borrador: las personas ya no la ven",
  archived: () => "Ruta archivada: las personas ya no la ven",
};

/** Black band at the top of a path: status, title, figures and the publish, draft, archive and delete actions. */
export function PathHeader({ path }: { path: PathDetail }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { storePath, forgetPath } = usePathCache();
  const published = path.status === "published";
  const completion = path.people_count ? (100 * path.completed_count) / path.people_count : 0;

  const setStatus = useMutation({
    mutationFn: (status: PathStatus) => pathsApi.update(path.id, { status }),
    onSuccess: (saved) => {
      void storePath(saved);
      toast.success(STATUS_SAVED[saved.status](saved));
    },
    onError: toastError,
  });

  const remove = useMutation({
    mutationFn: () => pathsApi.remove(path.id),
    onSuccess: () => {
      toast.success("Ruta eliminada");
      router.replace("/admin/paths");
      void forgetPath(path.id);
    },
    onError: toastError,
  });

  /** Back to draft or archived. Published, it asks first: learners stop seeing it (and its courses being locked by it). */
  const hide = async (status: "draft" | "archived") => {
    if (!published) return setStatus.mutate(status);
    const confirmed = await confirm({
      title: status === "draft" ? "¿Pasar la ruta a borrador?" : "¿Archivar la ruta?",
      description:
        "Las personas dejan de verla y sus cursos dejan de bloquearse por ella. Se conserva quién la tiene y su avance.",
      confirmLabel: status === "draft" ? "Pasar a borrador" : "Archivar",
    });
    if (confirmed) setStatus.mutate(status);
  };

  const askRemove = async () => {
    const confirmed = await confirm({
      title: "¿Eliminar esta ruta?",
      description: `${
        path.people_count === 0
          ? ""
          : path.people_count === 1
            ? "Se le quita a la persona que la tiene, que conserva sus cursos y su avance. "
            : `Se les quita a sus ${path.people_count} personas, que conservan sus cursos y su avance. `
      }No se puede deshacer${path.status === "archived" ? "." : "; si solo quieres ocultarla, archívala."}`,
      confirmLabel: "Eliminar ruta",
      destructive: true,
    });
    if (confirmed) remove.mutate();
  };

  return (
    <section className="band-dark">
      <DiamondMotif className="absolute -right-6 -top-10 hidden h-[220px] w-[150px] opacity-80 md:block lg:right-10" />
      <div className="container relative z-10 py-10">
        <BackLink href="/admin/paths">Rutas</BackLink>
        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
              <PathStatusBadge status={path.status} />
              <span className="text-xs text-white/50">
                {plural(path.courses.length, "curso")} · {plural(path.people_count, "persona")}
                {path.people_count > 0 && ` · ${formatPercent(completion)} la completó`}
              </span>
            </div>
            <h1 className="display-lg text-balance break-words text-white">{path.title}</h1>
            {path.description && <p className="mt-3 max-w-2xl break-words text-white/70">{path.description}</p>}
          </div>
          {/* The main action stays in sight; the rest go to the menu. */}
          <div className="flex items-center gap-3">
            {published ? (
              <Button
                variant="outline-inverse"
                className="flex-1 sm:flex-none"
                onClick={() => void hide("draft")}
                loading={setStatus.isPending && setStatus.variables === "draft"}
              >
                <Undo2 /> Pasar a borrador
              </Button>
            ) : (
              <Button
                variant="accent"
                className="flex-1 sm:flex-none"
                onClick={() => setStatus.mutate("published")}
                loading={setStatus.isPending && setStatus.variables === "published"}
              >
                <Rocket /> Publicar
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline-inverse" size="icon" aria-label="Más acciones">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {path.status === "archived" && (
                  <DropdownMenuItem onSelect={() => void hide("draft")} disabled={setStatus.isPending}>
                    <Undo2 /> Pasar a borrador
                  </DropdownMenuItem>
                )}
                {path.status !== "archived" && (
                  <DropdownMenuItem onSelect={() => void hide("archived")} disabled={setStatus.isPending}>
                    <Archive /> Archivar ruta
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem destructive onSelect={() => void askRemove()}>
                  <Trash2 /> Eliminar ruta
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </section>
  );
}
