"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Award, Ban, ChevronLeft, ChevronRight, Download, MoreHorizontal, Plus, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { CERTIFICATE_KIND, CertificateStatusBadge, expiryText, servedPdfUrl } from "@/components/certificates/certificate-badges";
import { IssueCertificateDialog } from "@/components/certificates/issue-certificate-dialog";
import { RevokeCertificateDialog } from "@/components/certificates/revoke-certificate-dialog";
import { useConfirm } from "@/components/layout/confirm-dialog";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHero } from "@/components/layout/page-hero";
import { QueryError } from "@/components/layout/query-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CERTIFICATES_PAGE, type CertificateListParams, certificateKeys, certificatesApi } from "@/lib/api/certificates";
import { courseKeys, coursesApi } from "@/lib/api/courses";
import { pathKeys, pathsApi } from "@/lib/api/paths";
import type { AdminCertificate, CertificateStatus } from "@/lib/api/types";
import { formatDate, plural } from "@/lib/format";
import { useCertificateCache } from "@/lib/hooks/use-certificate-cache";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useOpening } from "@/lib/hooks/use-opening";
import { toastError } from "@/lib/notify";
import { safeHttpUrl } from "@/lib/safe-url";
import { cn } from "@/lib/utils";

type StatusFilterValue = CertificateStatus | "all";

const STATUS_FILTERS: { value: StatusFilterValue; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "valid", label: "Válidos" },
  { value: "expired", label: "Vencidos" },
  { value: "revoked", label: "Revocados" },
];

const ALL_COURSES = {};
const ALL_PATHS = {};

function StatusFilter({ value, onChange }: { value: StatusFilterValue; onChange: (value: StatusFilterValue) => void }) {
  return (
    <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
      {STATUS_FILTERS.map((filter) => (
        <button
          key={filter.value}
          type="button"
          aria-pressed={value === filter.value}
          onClick={() => onChange(filter.value)}
          className={cn(
            "h-10 border px-3.5 text-[12px] font-semibold transition-colors",
            value === filter.value ? "border-ink-800 bg-ink-800 text-white" : "border-input bg-white hover:border-ink-800",
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

/** One course or path ("course:12", "path:3"), or all ("" ). Archived courses aren't listed. */
function ScopeFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const courses = useQuery({ queryKey: courseKeys.list(ALL_COURSES), queryFn: () => coursesApi.list(ALL_COURSES) });
  const paths = useQuery({ queryKey: pathKeys.list(ALL_PATHS), queryFn: () => pathsApi.list(ALL_PATHS) });
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)} aria-label="Filtrar por curso o ruta" className="sm:w-72">
      <option value="">Todos los cursos y rutas</option>
      {Boolean(courses.data?.length) && (
        <optgroup label="Cursos">
          {courses.data?.map((course) => (
            <option key={course.id} value={`course:${course.id}`}>
              {course.title}
            </option>
          ))}
        </optgroup>
      )}
      {Boolean(paths.data?.length) && (
        <optgroup label="Rutas">
          {paths.data?.map((path) => (
            <option key={path.id} value={`path:${path.id}`}>
              {path.title}
            </option>
          ))}
        </optgroup>
      )}
    </Select>
  );
}

/** "Vence el 8 oct 2027", "Venció el…", "No vence", or when and why it was revoked. */
function validityOf(certificate: AdminCertificate): string {
  return certificate.status === "revoked" ? `Revocado el ${formatDate(certificate.revoked_at)}` : expiryText(certificate);
}

interface RowActionsProps {
  certificate: AdminCertificate;
  onReissue: (certificate: AdminCertificate) => void;
  onRevoke: (certificate: AdminCertificate) => void;
}

/** Download, verify, reissue and revoke, in the row's menu. */
function CertificateActions({ certificate, onReissue, onRevoke }: RowActionsProps) {
  const pdf = servedPdfUrl(certificate);
  const verify = safeHttpUrl(certificate.verify_url);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Acciones del certificado ${certificate.code} de ${certificate.recipient_name}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {pdf && (
          <DropdownMenuItem asChild>
            <a href={pdf} target="_blank" rel="noopener">
              <Download /> Descargar PDF
            </a>
          </DropdownMenuItem>
        )}
        {verify && (
          <DropdownMenuItem asChild>
            <a href={verify} target="_blank" rel="noopener">
              <ShieldCheck /> Ver verificación
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onReissue(certificate)}>
          <RefreshCw /> Reemitir
        </DropdownMenuItem>
        {certificate.status !== "revoked" && (
          <DropdownMenuItem destructive onSelect={() => onRevoke(certificate)}>
            <Ban /> Revocar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Why it was revoked, when the admin said. */
function RevokedReason({ certificate }: { certificate: AdminCertificate }) {
  if (certificate.status !== "revoked" || !certificate.revoked_reason) return null;
  return <p className="mt-1 break-words text-xs text-muted-foreground">Motivo: {certificate.revoked_reason}</p>;
}

/** On a phone each certificate is a card (a table there would hide its menu past the edge). */
function CertificateCard(props: RowActionsProps) {
  const { certificate } = props;
  return (
    <li className="space-y-3 border border-border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-semibold">{certificate.recipient_name}</p>
          <p className="break-all text-xs text-muted-foreground">
            {CERTIFICATE_KIND[certificate.kind]} · {certificate.code}
          </p>
        </div>
        <CertificateActions {...props} />
      </div>
      <p className="break-words font-display text-lg font-semibold leading-tight tracking-tightest">{certificate.title}</p>
      <div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <CertificateStatusBadge status={certificate.status} />
          <span className="text-xs text-muted-foreground">
            Emitido el {formatDate(certificate.issued_at)} · {validityOf(certificate)}
          </span>
        </div>
        <RevokedReason certificate={certificate} />
      </div>
    </li>
  );
}

function CertificateRow(props: RowActionsProps) {
  const { certificate } = props;
  return (
    <TableRow>
      <TableCell className="font-semibold">{certificate.recipient_name}</TableCell>
      <TableCell>
        <p className="max-w-[360px] break-words font-semibold">{certificate.title}</p>
        <p className="text-xs text-muted-foreground">
          {CERTIFICATE_KIND[certificate.kind]} · {certificate.code}
        </p>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <p className="text-sm">{formatDate(certificate.issued_at)}</p>
        <p className="text-xs text-muted-foreground">{validityOf(certificate)}</p>
      </TableCell>
      <TableCell>
        <CertificateStatusBadge status={certificate.status} />
        <RevokedReason certificate={certificate} />
      </TableCell>
      <TableCell>
        <CertificateActions {...props} />
      </TableCell>
    </TableRow>
  );
}

/** "1–50 de 134" and the way to the other pages. */
function Pager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const first = page * CERTIFICATES_PAGE + 1;
  const last = Math.min(total, (page + 1) * CERTIFICATES_PAGE);
  const pages = Math.ceil(total / CERTIFICATES_PAGE);
  if (pages <= 1) return null;
  return (
    <nav aria-label="Páginas de certificados" className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        {first}–{last} de {total}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>
          <ChevronLeft /> Anteriores
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
          Siguientes <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}

/** The certificates issued: who, what, when and whether they are in force; issue, revoke and reissue them. */
export default function CertificatesPage() {
  const confirm = useConfirm();
  const { refreshCertificates } = useCertificateCache();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilterValue>("all");
  const [scope, setScope] = useState("");
  const [page, setPage] = useState(0);
  const issuing = useOpening(null);
  const revoking = useOpening<AdminCertificate | null>(null);
  const term = useDebouncedValue(search.trim());

  // Another search or filter starts on its first page.
  const filters = JSON.stringify([term, status, scope]);
  const [shownFilters, setShownFilters] = useState(filters);
  if (shownFilters !== filters) {
    setShownFilters(filters);
    setPage(0);
  }

  const [scopeKind, scopeId] = scope.split(":");
  const params: CertificateListParams = {
    q: term || undefined,
    status: status === "all" ? undefined : status,
    course_id: scopeKind === "course" ? Number(scopeId) : undefined,
    path_id: scopeKind === "path" ? Number(scopeId) : undefined,
    limit: CERTIFICATES_PAGE,
    offset: page * CERTIFICATES_PAGE,
  };
  const certificates = useQuery({
    queryKey: certificateKeys.list(params),
    queryFn: () => certificatesApi.list(params),
    placeholderData: keepPreviousData,
  });
  const data = certificates.data;
  const filtered = Boolean(term) || status !== "all" || Boolean(scope);

  // The last page emptied (its certificates revoked away from a filter, say): the one before it.
  const emptiedPage = Boolean(data && !certificates.isPlaceholderData && !data.items.length && page > 0);
  useEffect(() => {
    if (emptiedPage && data) setPage(Math.max(0, Math.ceil(data.total / CERTIFICATES_PAGE) - 1));
  }, [emptiedPage, data]);

  const reissue = useMutation({
    mutationFn: (certificate: AdminCertificate) => certificatesApi.reissue(certificate.id),
    onSuccess: (fresh, old) => {
      void refreshCertificates();
      toast.success(
        old.status === "revoked"
          ? `Certificado reemitido: ${fresh.code}`
          : `Certificado reemitido: ${fresh.code}. El ${old.code} quedó revocado.`,
      );
    },
    // E.g. the person no longer has the course completed: the server says why.
    onError: toastError,
  });

  const askReissue = async (certificate: AdminCertificate) => {
    const replaced = certificate.status === "revoked" ? "" : ` El actual (${certificate.code}) queda revocado.`;
    const confirmed = await confirm({
      title: `¿Reemitir el certificado de ${certificate.recipient_name}?`,
      description: `Sale uno nuevo de «${certificate.title}», con código nuevo y los datos de hoy: nombre, firmante y vigencia.${replaced}`,
      confirmLabel: "Reemitir",
    });
    if (confirmed) reissue.mutate(certificate);
  };

  const actions = { onReissue: (certificate: AdminCertificate) => void askReissue(certificate), onRevoke: revoking.show };
  const issueButton = (size?: "lg") => (
    <Button variant="accent" size={size} onClick={() => issuing.show(null)}>
      <Plus /> Emitir certificado
    </Button>
  );

  return (
    <>
      <PageHero
        eyebrow="Certificados"
        title="Certificados"
        description="Los que la plataforma entregó al completar cursos y rutas. Cualquiera puede comprobar uno con su código en la página de verificación."
        actions={
          <>
            {issueButton("lg")}
            <Button variant="outline-inverse" size="lg" asChild>
              <Link href="/admin/settings">Parámetros</Link>
            </Button>
          </>
        }
      />

      <section className="container py-10">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            <StatusFilter value={status} onChange={setStatus} />
            <ScopeFilter value={scope} onChange={setScope} />
          </div>
          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Persona, correo, título o código"
              aria-label="Buscar certificados"
              maxLength={200}
              className="pl-10"
            />
          </div>
        </div>

        {certificates.isPending ? (
          <Skeleton className="h-72" />
        ) : !data ? (
          <QueryError query={certificates} />
        ) : data.items.length ? (
          <div aria-busy={certificates.isPlaceholderData || undefined}>
            <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
              {plural(data.total, "certificado")}
            </p>
            <ul className="space-y-2 md:hidden" aria-label="Certificados">
              {data.items.map((certificate) => (
                <CertificateCard key={certificate.id} certificate={certificate} {...actions} />
              ))}
            </ul>
            <div className="hidden border border-border bg-white md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Persona</TableHead>
                    <TableHead>Certificado</TableHead>
                    <TableHead>Emisión</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((certificate) => (
                    <CertificateRow key={certificate.id} certificate={certificate} {...actions} />
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pager page={page} total={data.total} onPage={setPage} />
          </div>
        ) : (
          <EmptyState
            icon={<Award />}
            title={filtered ? "Ningún certificado coincide" : "Aún no hay certificados"}
            description={
              filtered
                ? "Prueba con otra búsqueda o filtro."
                : "Se emiten solos cuando alguien completa un curso o una ruta. También puedes emitir uno a mano."
            }
            action={filtered ? undefined : issueButton()}
          />
        )}
      </section>

      <IssueCertificateDialog key={issuing.key} open={issuing.open} onClose={issuing.hide} />
      <RevokeCertificateDialog key={revoking.key} open={revoking.open} certificate={revoking.value} onClose={revoking.hide} />
    </>
  );
}
