"use client";

import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { IdCard, Pencil, Plus, Route, Trash2, Users } from "lucide-react";
import { useConfirm } from "@/components/layout/confirm-dialog";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHero } from "@/components/layout/page-hero";
import { QueryError } from "@/components/layout/query-state";
import { ProfileDialog } from "@/components/team/profile-dialog";
import { TeamTabs } from "@/components/team/team-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { profileKeys, profilesApi } from "@/lib/api/profiles";
import type { ProfileItem } from "@/lib/api/types";
import { plural } from "@/lib/format";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { useOpening } from "@/lib/hooks/use-opening";
import { toastError } from "@/lib/notify";

interface ProfileRowProps {
  profile: ProfileItem;
  onEdit: () => void;
  onRemove: () => void;
}

function ProfileRow({ profile, onEdit, onRemove }: ProfileRowProps) {
  return (
    <li className="flex flex-col gap-4 border border-border bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="break-words font-display text-xl font-medium tracking-tightest">{profile.name}</h2>
        {profile.description && <p className="mt-1 break-words text-sm text-muted-foreground">{profile.description}</p>}
        <p className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          {/* Its people: the team, filtered by the profile. */}
          <Link
            href={`/admin/team?profile=${profile.id}`}
            className="-my-2.5 inline-flex min-h-10 items-center gap-1.5 font-semibold hover:text-accent"
          >
            <Users className="h-4 w-4" aria-hidden /> {plural(profile.user_count, "persona")}
          </Link>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Route className="h-4 w-4" aria-hidden /> {plural(profile.path_count, "ruta")}
          </span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm" onClick={onEdit} aria-label={`Editar el perfil ${profile.name}`}>
          <Pencil /> Editar
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:bg-red-50"
          onClick={onRemove}
          aria-label={`Eliminar el perfil ${profile.name}`}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

export default function ProfilesPage() {
  const confirm = useConfirm();
  const { refreshPeople } = useCourseCache();
  const dialog = useOpening<ProfileItem | null>(null);
  const profiles = useQuery({ queryKey: profileKeys.list, queryFn: profilesApi.list });

  const remove = useMutation({
    mutationFn: (profile: ProfileItem) => profilesApi.remove(profile.id),
    onSuccess: (_, profile) => {
      void refreshPeople(); // its people have no profile now, and its paths lose it
      toast.success(`Perfil «${profile.name}» eliminado`);
    },
    onError: toastError,
  });

  const confirmRemove = async (profile: ProfileItem) => {
    const people =
      profile.user_count === 0
        ? "Nadie tiene este perfil."
        : profile.user_count === 1
          ? "1 persona queda sin perfil: conserva sus cursos y su avance, y pierde las rutas que el perfil le daba y no había completado."
          : `${profile.user_count} personas quedan sin perfil: conservan sus cursos y su avance, y pierden las rutas que el perfil les daba y no habían completado.`;
    const confirmed = await confirm({
      title: `¿Eliminar el perfil «${profile.name}»?`,
      description: `${people} No se puede deshacer.`,
      confirmLabel: "Eliminar perfil",
      destructive: true,
    });
    if (confirmed) remove.mutate(profile);
  };

  const addButton = (
    <Button variant="accent" size="lg" onClick={() => dialog.show(null)}>
      <Plus /> Nuevo perfil
    </Button>
  );

  return (
    <>
      <PageHero
        eyebrow="Equipo"
        title="Perfiles"
        description="Agrupa a las personas por lo que hacen en la empresa. Cada perfil recibe las rutas de aprendizaje vinculadas a él."
        actions={addButton}
      />

      <section className="container py-10">
        <TeamTabs />
        {profiles.isPending ? (
          <Skeleton className="h-48" />
        ) : !profiles.data ? (
          <QueryError query={profiles} />
        ) : profiles.data.length ? (
          <ul className="space-y-3" aria-label="Perfiles">
            {profiles.data.map((profile) => (
              <ProfileRow
                key={profile.id}
                profile={profile}
                onEdit={() => dialog.show(profile)}
                onRemove={() => void confirmRemove(profile)}
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<IdCard />}
            title="Aún no hay perfiles"
            description="Crea un perfil por cada puesto (por ejemplo «Asesor de flotas»), asígnalo a sus personas y vincúlalo a una ruta."
            action={addButton}
          />
        )}
      </section>

      <ProfileDialog key={dialog.key} open={dialog.open} onClose={dialog.hide} profile={dialog.value} />
    </>
  );
}
