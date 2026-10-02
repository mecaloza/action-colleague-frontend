"use client";

import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { QueryError } from "@/components/layout/query-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { studioApi, studioKeys } from "@/lib/api/studio";
import type { Avatar } from "@/lib/api/types";
import { safeHttpUrl } from "@/lib/safe-url";
import { cn } from "@/lib/utils";

interface AvatarCardProps {
  avatar: Avatar;
  selected: boolean;
  onSelect: () => void;
  /** Not available in the chosen quality. */
  unavailable: boolean;
}

function AvatarCard({ avatar, selected, onSelect, unavailable }: AvatarCardProps) {
  const image = safeHttpUrl(avatar.preview_image_url); // only http(s) images load
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        disabled={unavailable}
        title={unavailable ? "No disponible en esta calidad" : undefined}
        className={cn(
          "group w-full border bg-white p-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40",
          selected ? "border-accent" : "border-border hover:border-ink-800",
        )}
      >
        <span className="relative block aspect-square overflow-hidden rounded-full bg-mist">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            <UserRound className="absolute inset-0 m-auto h-10 w-10 text-muted-foreground" />
          )}
          {selected && <span className="absolute inset-0 rounded-full ring-4 ring-inset ring-accent" />}
        </span>
        <span className="mt-2 line-clamp-2 break-words px-1 text-center text-sm font-semibold" title={avatar.name}>
          {avatar.name}
        </span>
      </button>
    </li>
  );
}

interface PresenterPickerProps {
  /** The server has the presenter service configured. */
  available: boolean;
  presenter: boolean;
  /** Without it there is no on/off switch (e.g. the second presenter, switched on elsewhere). */
  onPresenterChange?: (presenter: boolean) => void;
  selectedId: string | undefined;
  onSelect: (avatar: Avatar) => void;
  /** An avatar already presenting (the first presenter): not offered again. */
  excludeId?: string;
  /** The HeyGen engine chosen ("" = the server's): avatars that don't render on it can't be picked. */
  engine: string;
}

/** Whether an avatar renders on the engine (an unknown list or the server's default engine: assume yes). */
export const rendersOn = (avatar: Avatar, engine: string) =>
  !engine || !avatar.engines?.length || avatar.engines.includes(engine);

function AvatarGroup({
  title,
  avatars,
  selectedId,
  onSelect,
  engine,
}: {
  title: string;
  avatars: Avatar[];
  selectedId?: string;
  onSelect: (avatar: Avatar) => void;
  engine: string;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <p id={id} className="mb-3 text-[11px] font-bold uppercase tracking-label text-ink-700">
        {title}
      </p>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {avatars.map((avatar) => (
          <AvatarCard
            key={avatar.id}
            avatar={avatar}
            selected={avatar.id === selectedId}
            onSelect={() => onSelect(avatar)}
            unavailable={!rendersOn(avatar, engine)}
          />
        ))}
      </ul>
    </div>
  );
}

/** Whether the videos show a virtual presenter, and which one. */
export function PresenterPicker({
  available,
  presenter,
  onPresenterChange,
  selectedId,
  onSelect,
  excludeId,
  engine,
}: PresenterPickerProps) {
  const avatars = useQuery({ queryKey: studioKeys.avatars, queryFn: studioApi.avatars, enabled: available });
  const offered = (avatars.data ?? []).filter((avatar) => avatar.id !== excludeId);
  const groups = [
    { title: "De tu empresa", list: offered.filter((avatar) => avatar.own) },
    { title: "Catálogo", list: offered.filter((avatar) => !avatar.own) },
  ].filter(({ list }) => list.length);

  if (!available) {
    return (
      <p className="text-sm text-muted-foreground">
        El presentador no está configurado en el servidor: los videos salen con tus diapositivas y la voz.
      </p>
    );
  }
  return (
    <>
      {onPresenterChange && (
        <label className="mb-5 flex items-center gap-3 text-sm font-semibold">
          <Switch checked={presenter} onCheckedChange={onPresenterChange} aria-label="Mostrar presentador" />
          Mostrar presentador en los videos
        </label>
      )}
      {presenter &&
        (avatars.isPending ? (
          <Skeleton className="h-40" />
        ) : avatars.error ? (
          <QueryError query={avatars} />
        ) : !offered.length ? (
          <p className="text-sm text-muted-foreground">
            {excludeId
              ? "No hay otro presentador disponible. Desactiva el segundo presentador para producir los videos."
              : "No hay presentadores disponibles en el servicio. Desactiva el presentador para producir los videos con tus diapositivas y la voz."}
          </p>
        ) : (
          <div className="space-y-6">
            {groups.map(({ title, list }) => (
              <AvatarGroup
                key={title}
                title={title}
                avatars={list}
                selectedId={selectedId}
                onSelect={onSelect}
                engine={engine}
              />
            ))}
          </div>
        ))}
    </>
  );
}
