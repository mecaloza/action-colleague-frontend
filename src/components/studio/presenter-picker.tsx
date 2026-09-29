"use client";

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
}

function AvatarCard({ avatar, selected, onSelect }: AvatarCardProps) {
  const image = safeHttpUrl(avatar.preview_image_url); // only http(s) images load
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "group w-full border bg-white p-2 text-left transition-colors",
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
  onPresenterChange: (presenter: boolean) => void;
  selectedId: string | undefined;
  onSelect: (avatar: Avatar) => void;
}

/** Whether the videos show a virtual presenter, and which one. */
export function PresenterPicker({
  available,
  presenter,
  onPresenterChange,
  selectedId,
  onSelect,
}: PresenterPickerProps) {
  const avatars = useQuery({ queryKey: studioKeys.avatars, queryFn: studioApi.avatars, enabled: available });

  if (!available) {
    return (
      <p className="text-sm text-muted-foreground">
        El presentador no está configurado en el servidor: los videos salen con tus diapositivas y la voz.
      </p>
    );
  }
  return (
    <>
      <label className="mb-5 flex items-center gap-3 text-sm font-semibold">
        <Switch checked={presenter} onCheckedChange={onPresenterChange} aria-label="Mostrar presentador" />
        Mostrar presentador en los videos
      </label>
      {presenter &&
        (avatars.isPending ? (
          <Skeleton className="h-40" />
        ) : avatars.error ? (
          <QueryError query={avatars} />
        ) : !avatars.data.length ? (
          <p className="text-sm text-muted-foreground">
            No hay presentadores disponibles en el servicio. Desactiva el presentador para producir los videos con tus
            diapositivas y la voz.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {avatars.data.map((avatar) => (
              <AvatarCard
                key={avatar.id}
                avatar={avatar}
                selected={avatar.id === selectedId}
                onSelect={() => onSelect(avatar)}
              />
            ))}
          </ul>
        ))}
    </>
  );
}
