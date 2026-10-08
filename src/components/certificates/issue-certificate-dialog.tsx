"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { QueryError } from "@/components/layout/query-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  keepKeyboardDown,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { type CertificateIssue, certificatesApi } from "@/lib/api/certificates";
import { ApiError } from "@/lib/api/client";
import { pathKeys, pathsApi } from "@/lib/api/paths";
import type { CertificateKind } from "@/lib/api/types";
import { type UserListParams, userKeys, usersApi } from "@/lib/api/users";
import { useCertificateCache } from "@/lib/hooks/use-certificate-cache";
import { toastError } from "@/lib/notify";
import { cn } from "@/lib/utils";

// Anyone who completed something, even if they left since (a certificate for a former employee).
const EVERYONE: UserListParams = { include_inactive: true };
const ALL_PATHS = {};

const IDS = {
  person: "issue-person",
  personError: "issue-person-error",
  course: "issue-course",
  path: "issue-path",
  targetError: "issue-target-error",
  refusal: "issue-refusal",
};

const KINDS: { value: CertificateKind; label: string }[] = [
  { value: "course", label: "Un curso" },
  { value: "path", label: "Una ruta" },
];

/**
 * Issue a certificate by hand: to a person, for a course or a path they completed (the automatic rules don't apply).
 * The page gives it a new `key` on each opening: it starts empty.
 */
export function IssueCertificateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { refreshCertificates } = useCertificateCache();
  const searchField = useRef<HTMLInputElement>(null);
  const targetField = useRef<HTMLSelectElement>(null);
  const [search, setSearch] = useState("");
  const [personId, setPersonId] = useState<number | null>(null);
  const [kind, setKind] = useState<CertificateKind>("course");
  const [courseId, setCourseId] = useState("");
  const [pathId, setPathId] = useState("");
  const [attempted, setAttempted] = useState(false);
  // The server's "not completed yet" (or similar): said above the buttons.
  const [refusal, setRefusal] = useState<string | null>(null);

  const people = useQuery({ queryKey: userKeys.list(EVERYONE), queryFn: () => usersApi.list(EVERYONE), enabled: open });
  // The courses the person completed: those a certificate can be issued for.
  const courses = useQuery({
    queryKey: userKeys.courses(personId ?? 0),
    queryFn: () => usersApi.courses(personId ?? 0),
    enabled: open && personId !== null,
  });
  const paths = useQuery({
    queryKey: pathKeys.list(ALL_PATHS),
    queryFn: () => pathsApi.list(ALL_PATHS),
    enabled: open && kind === "path",
  });

  const term = search.trim().toLowerCase();
  const candidates = (people.data ?? []).filter(
    (user) => user.id === personId || !term || [user.name, user.email].some((value) => value.toLowerCase().includes(term)),
  );
  const person = people.data?.find((user) => user.id === personId) ?? null;
  const completed = (courses.data ?? []).filter((course) => course.status === "completed");
  const target = kind === "course" ? courseId : pathId;
  const personError = attempted && personId === null ? "Elige a la persona." : null;
  const targetError = attempted && personId !== null && !target ? (kind === "course" ? "Elige el curso." : "Elige la ruta.") : null;

  const issue = useMutation({
    mutationFn: (input: CertificateIssue) => certificatesApi.issue(input),
    onSuccess: ({ certificate, created }) => {
      void refreshCertificates();
      if (created) toast.success(`Certificado emitido: ${certificate.code}`);
      else toast(`${certificate.recipient_name} ya tenía un certificado válido: ${certificate.code}`);
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422) setRefusal(error.message);
      else toastError(error);
    },
  });

  const change = (apply: () => void) => {
    setRefusal(null);
    apply();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !issue.isPending && onClose()}>
      <DialogContent className="max-w-xl" onOpenAutoFocus={keepKeyboardDown}>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!open) return; // closing: an Enter during the exit animation doesn't issue
            if (personId !== null && target) {
              const input: CertificateIssue = { user_id: personId };
              if (kind === "course") input.course_id = Number(courseId);
              else input.path_id = Number(pathId);
              issue.mutate(input);
              return;
            }
            // Show the problems before moving to the first one, so it is read out with its message.
            flushSync(() => setAttempted(true));
            (personId === null ? searchField : targetField).current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>Emitir certificado</DialogTitle>
            <DialogDescription>
              Para quien completó un curso o una ruta, aunque las reglas automáticas no se lo dieran (nota mínima, curso sin
              certificado). Si ya tiene uno válido, lo conserva.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* min-w-0: a fieldset is as wide as its widest line by default, and the names are truncated. */}
            <fieldset className="min-w-0" aria-describedby={personError ? IDS.personError : undefined}>
              <legend className="mb-1.5 text-[11px] font-bold uppercase tracking-label text-ink-700">Persona</legend>
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchField}
                  id={IDS.person}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nombre o correo"
                  aria-label="Buscar persona"
                  maxLength={200}
                  className="pl-10"
                  aria-invalid={personError ? true : undefined}
                  aria-describedby={personError ? IDS.personError : undefined}
                />
              </div>
              {people.error ? (
                <QueryError query={people} />
              ) : (
                <ul className="max-h-56 overflow-y-auto border border-border" aria-label="Personas">
                  {people.isPending && (
                    <li className="p-4">
                      <Skeleton className="h-10" />
                    </li>
                  )}
                  {candidates.map((user) => (
                    <li key={user.id} className="border-b border-border last:border-0">
                      <label
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center gap-3 px-4 py-2 hover:bg-mist",
                          user.id === personId && "bg-accent-soft",
                        )}
                      >
                        <input
                          type="radio"
                          name="issue-person"
                          className="h-5 w-5 shrink-0 cursor-pointer accent-accent"
                          checked={user.id === personId}
                          onChange={() =>
                            change(() => {
                              setPersonId(user.id);
                              setCourseId("");
                            })
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{user.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {user.email}
                            {!user.is_active && " · inactiva"}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                  {!people.isPending && candidates.length === 0 && (
                    <li className="p-6 text-center text-sm text-muted-foreground">Nadie coincide con la búsqueda.</li>
                  )}
                </ul>
              )}
              <FieldError id={IDS.personError} message={personError} />
            </fieldset>

            <fieldset className="min-w-0">
              <legend className="mb-1.5 text-[11px] font-bold uppercase tracking-label text-ink-700">Certificado de</legend>
              <div className="grid grid-cols-2 gap-2">
                {KINDS.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-2.5 border px-3 text-sm font-semibold transition-colors",
                      kind === option.value ? "border-ink-800 bg-white" : "border-input bg-white hover:border-ink-500",
                    )}
                  >
                    <input
                      type="radio"
                      name="issue-kind"
                      className="h-5 w-5 shrink-0 cursor-pointer accent-accent"
                      checked={kind === option.value}
                      onChange={() => change(() => setKind(option.value))}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {kind === "course" ? (
              <div>
                <Label htmlFor={IDS.course}>Curso</Label>
                {personId !== null && courses.isPending ? (
                  <Skeleton className="h-11" />
                ) : courses.error ? (
                  <QueryError query={courses} />
                ) : (
                  <Select
                    ref={targetField}
                    id={IDS.course}
                    value={courseId}
                    onChange={(event) => change(() => setCourseId(event.target.value))}
                    disabled={personId === null || completed.length === 0}
                    aria-invalid={targetError ? true : undefined}
                    aria-describedby={`${IDS.course}-hint${targetError ? ` ${IDS.targetError}` : ""}`}
                  >
                    <option value="">Elige un curso</option>
                    {completed.map((course) => (
                      <option key={course.course_id} value={course.course_id}>
                        {course.title}
                        {course.certificate ? " (ya tiene certificado)" : ""}
                      </option>
                    ))}
                  </Select>
                )}
                <p id={`${IDS.course}-hint`} className="mt-1.5 text-xs text-muted-foreground">
                  {personId === null
                    ? "Elige primero a la persona: aquí aparecen los cursos que completó."
                    : completed.length || courses.isPending
                      ? "Los cursos que completó."
                      : `${person?.name ?? "Esta persona"} aún no completa ningún curso.`}
                </p>
              </div>
            ) : (
              <div>
                <Label htmlFor={IDS.path}>Ruta</Label>
                {paths.isPending ? (
                  <Skeleton className="h-11" />
                ) : paths.error ? (
                  <QueryError query={paths} />
                ) : (
                  <Select
                    ref={targetField}
                    id={IDS.path}
                    value={pathId}
                    onChange={(event) => change(() => setPathId(event.target.value))}
                    aria-invalid={targetError ? true : undefined}
                    aria-describedby={`${IDS.path}-hint${targetError ? ` ${IDS.targetError}` : ""}`}
                  >
                    <option value="">Elige una ruta</option>
                    {(paths.data ?? []).map((path) => (
                      <option key={path.id} value={path.id}>
                        {path.title}
                      </option>
                    ))}
                  </Select>
                )}
                <p id={`${IDS.path}-hint`} className="mt-1.5 text-xs text-muted-foreground">
                  Solo si la persona completó todos sus cursos publicados.
                </p>
              </div>
            )}
            <FieldError id={IDS.targetError} message={targetError} />
          </div>

          {refusal && (
            <p id={IDS.refusal} role="alert" className="mt-6 border-l-2 border-destructive bg-red-50 px-3 py-2.5 text-sm">
              {refusal}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={issue.isPending}>
              Cancelar
            </Button>
            <Button type="submit" loading={issue.isPending}>
              Emitir certificado
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
