import { CheckCircle2, Clock, Download, HelpCircle, SearchX, XCircle, type LucideIcon } from "lucide-react";
import { DiamondMotif } from "@/components/brand/motif";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CertificateKind, CertificateStatus, PublicCertificate } from "@/lib/api/types";
import { formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CertificateStatusBadge, servedPdfUrl } from "./certificate-badges";

const decimal = new Intl.NumberFormat("es", { maximumFractionDigits: 1 });

/** "45 minutos", "1 hora", "3,5 horas", as the PDF says it; null without videos (readings and documents). */
function hoursText(hours: number): string | null {
  if (hours <= 0) return null;
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60));
    return `${minutes} minuto${minutes === 1 ? "" : "s"}`;
  }
  const value = Math.round(hours * 10) / 10;
  return `${decimal.format(value)} hora${value === 1 ? "" : "s"}`;
}

/** "92 %", "86,7 %". */
const scoreText = (score: number) => `${decimal.format(score)} %`;

const KIND_TEXTS: Record<CertificateKind, { eyebrow: string; lead: string }> = {
  course: { eyebrow: "Certificado de finalización", lead: "completó el curso" },
  path: { eyebrow: "Certificado de ruta completada", lead: "completó la ruta de aprendizaje" },
};

interface Verdict {
  icon: LucideIcon;
  heading: string;
  /** The banner's edge and icon. */
  tone: string;
  /** Its details faded: what it said, for the record, never looking like one in force. */
  faded?: boolean;
}

const VERDICTS: Record<CertificateStatus, Verdict> = {
  valid: { icon: CheckCircle2, heading: "Certificado válido", tone: "border-success text-success" },
  expired: { icon: Clock, heading: "Certificado vencido", tone: "border-warning text-warning" },
  revoked: { icon: XCircle, heading: "Certificado revocado", tone: "border-destructive text-destructive", faded: true },
};

// A status this release doesn't know (a newer server's): the page fails closed, never saying it is valid.
const UNKNOWN: Verdict = {
  icon: HelpCircle,
  heading: "Estado desconocido",
  tone: "border-ink-500 text-ink-500",
  faded: true,
};

/** What a verification says, in a sentence. */
export function verdictText(certificate: Pick<PublicCertificate, "status" | "expires_at" | "details">): string {
  switch (certificate.status) {
    case "valid":
      return "Es auténtico y está vigente.";
    case "expired":
      return `Es auténtico, pero venció el ${formatLongDate(certificate.expires_at, certificate.details.timezone)}.`;
    case "revoked":
      return "Quien lo emitió lo revocó: ya no es válido.";
    default:
      return "No pudimos confirmar si está vigente. Consulta con quien lo emitió.";
  }
}

/**
 * "Hasta el 8 de octubre de 2027", "Venció el…" or "No vence"; for a revoked one, that it isn't valid; for one of an
 * unknown status, that it can't be confirmed.
 */
function validityText(certificate: Pick<PublicCertificate, "status" | "expires_at">, zone: string | null): string {
  const { status, expires_at } = certificate;
  switch (status) {
    case "valid":
      return expires_at ? `Hasta el ${formatLongDate(expires_at, zone)}` : "No vence";
    case "expired":
      return expires_at ? `Venció el ${formatLongDate(expires_at, zone)}` : "Vencido";
    case "revoked":
      return "Revocado: ya no es válido";
    default:
      return "Sin confirmar";
  }
}

interface VerdictBannerProps {
  icon: LucideIcon;
  heading: string;
  badge: React.ReactNode;
  tone: string;
  children: React.ReactNode;
}

/** The answer, first: valid, expired, revoked or not found. */
function VerdictBanner({ icon: Icon, heading, badge, tone, children }: VerdictBannerProps) {
  return (
    <div className={cn("flex items-start gap-4 border-l-4 bg-white p-5 shadow-sm sm:p-6", tone)}>
      <Icon className="mt-0.5 h-8 w-8 shrink-0" aria-hidden />
      <div className="min-w-0 text-foreground">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="font-display text-2xl font-medium leading-tight tracking-tightest sm:text-3xl">{heading}</h1>
          {badge}
        </div>
        <div className="mt-1.5 text-sm text-muted-foreground sm:text-base">{children}</div>
      </div>
    </div>
  );
}

export function NotFoundBanner({ code }: { code: string }) {
  return (
    <VerdictBanner
      icon={SearchX}
      heading="Certificado no encontrado"
      badge={<Badge variant="secondary">No encontrado</Badge>}
      tone="border-ink-500 text-ink-500"
    >
      <p className="break-words">
        No hay ningún certificado con el código «{code}». Revisa que esté bien escrito: tiene la forma RC-XXXX-XXXX.
      </p>
    </VerdictBanner>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-label text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words">{children}</dd>
    </div>
  );
}

/** A verified certificate: the verdict, then what it says (as its PDF does), and its PDF unless revoked. */
export function PublicCertificateView({ certificate }: { certificate: PublicCertificate }) {
  const { details, status } = certificate;
  const verdict = VERDICTS[status] ?? UNKNOWN;
  const texts = KIND_TEXTS[certificate.kind] ?? KIND_TEXTS.course;
  // Its dates in the time zone it was issued in (the PDF's), or the reader's for an older one without it.
  const zone = details.timezone;
  const hours = hoursText(details.hours);
  const signer = [details.signer_name, details.signer_title].filter(Boolean).join(", ");
  const pdf = servedPdfUrl(certificate);
  const courses = certificate.kind === "path" ? details.courses : [];

  return (
    <>
      <VerdictBanner
        icon={verdict.icon}
        heading={verdict.heading}
        badge={<CertificateStatusBadge status={status} />}
        tone={verdict.tone}
      >
        <p>{verdictText(certificate)}</p>
      </VerdictBanner>

      <article
        aria-label="Datos del certificado"
        className={cn(
          "mt-6 grid overflow-hidden border border-border bg-white sm:grid-cols-[88px_minmax(0,1fr)]",
          verdict.faded && "opacity-60 grayscale",
        )}
      >
        {/* The PDF's black band with the brand's mark. */}
        <div className="band-dark hidden sm:flex sm:justify-center sm:pt-12" aria-hidden>
          <DiamondMotif className="relative z-10 h-28 w-16" />
        </div>
        <div className="min-w-0 p-6 sm:p-10">
          <span className="block h-1 w-14 bg-accent" aria-hidden />
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.2em] text-accent-strong">{texts.eyebrow}</p>
          <p className="mt-1.5 break-words font-semibold text-muted-foreground">{certificate.issuer_name}</p>
          <p className="mt-8 break-words font-display text-4xl font-semibold leading-none tracking-tightest sm:text-5xl">
            {certificate.recipient_name}
          </p>
          <p className="mt-3 text-muted-foreground">{texts.lead}</p>
          <h2 className="mt-1 break-words font-display text-2xl font-semibold leading-tight tracking-tightest sm:text-3xl">
            {certificate.title}
          </h2>

          <dl className="mt-8 grid gap-x-8 gap-y-5 border-t border-border pt-6 sm:grid-cols-2">
            <Fact label="Emitido el">{formatLongDate(certificate.issued_at, zone)}</Fact>
            <Fact label="Vigencia">{validityText(certificate, zone)}</Fact>
            <Fact label="Emitido por">{certificate.issuer_name}</Fact>
            {signer && <Fact label="Firma">{signer}</Fact>}
            {hours && <Fact label="Duración">{hours}</Fact>}
            {details.modules > 0 && <Fact label="Módulos">{details.modules}</Fact>}
            {details.average_score !== null && <Fact label="Calificación promedio">{scoreText(details.average_score)}</Fact>}
            <Fact label="Código">
              <span className="font-semibold">{certificate.code}</span>
            </Fact>
          </dl>

          {courses.length > 0 && (
            <div className="mt-8">
              <h3 className="text-[11px] font-bold uppercase tracking-label text-muted-foreground">Cursos de la ruta</h3>
              <ol className="mt-3 divide-y divide-border border-y border-border">
                {courses.map((course, index) => (
                  <li key={`${index}-${course.title}`} className="flex gap-3 py-3">
                    <span className="w-6 shrink-0 font-display font-medium text-accent-strong">{index + 1}</span>
                    <span className="min-w-0">
                      <span className="block break-words font-semibold">{course.title}</span>
                      {course.completed_at && (
                        <span className="block text-sm text-muted-foreground">
                          Completado el {formatLongDate(course.completed_at, zone)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {pdf && (
            <Button variant="accent" size="lg" className="mt-8 w-full sm:w-auto" asChild>
              <a href={pdf} target="_blank" rel="noopener">
                <Download aria-hidden /> Descargar certificado
              </a>
            </Button>
          )}
        </div>
      </article>
    </>
  );
}
