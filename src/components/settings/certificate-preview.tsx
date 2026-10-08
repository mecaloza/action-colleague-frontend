import { LogoMark } from "@/components/brand/logo";
import { formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const SAMPLE_CODE = "RC-7K4M-2QXD";
export const DEFAULT_ISSUER = "Rubinstein Colleague";

/** The same day `months` later, or the month's last one (31 Jan + 1 = 28/29 Feb), as the server counts validity. */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

interface CertificatePreviewProps {
  companyName: string;
  signerName: string;
  signerTitle: string;
  /** Null: they never expire (or the value typed isn't valid yet). */
  validityMonths: number | null;
  /** Where the dates are written (null: the browser's, while the zone typed isn't valid). */
  timezone: string | null;
  /** Issued by themselves: shown dimmed when off. */
  enabled: boolean;
}

/**
 * A miniature of the PDF (A4 landscape) as the parameters typed would print it, with a sample person and course. Its
 * sizes are the PDF's (app/services/certificate_pdf.py, a 3508 px wide page) as fractions of the width (`cqw`), so it
 * keeps its proportions at any width.
 */
export function CertificatePreview({ companyName, signerName, signerTitle, validityMonths, timezone, enabled }: CertificatePreviewProps) {
  const today = new Date();
  const verifyUrl = `${typeof window === "undefined" ? "" : window.location.origin}/verify/${SAMPLE_CODE}`;
  const signer = signerName.trim();
  return (
    <figure>
      <div
        aria-hidden
        className={cn(
          "relative aspect-[297/210] w-full overflow-hidden border border-border bg-white text-ink-800 shadow-sm transition-opacity [container-type:inline-size]",
          !enabled && "opacity-50",
        )}
      >
        {/* The black band with the brand's mark: outlined, over a small orange one. */}
        <div className="absolute inset-y-0 left-0 w-[16%] bg-ink-950">
          <LogoMark className="absolute left-1/2 top-[16.5cqw] h-[17cqw] w-[17cqw] -translate-x-1/2 text-[#404040]" strokeWidth={2} />
          <LogoMark className="absolute left-1/2 top-[34cqw] h-[5cqw] w-[5cqw] -translate-x-1/2 text-accent" strokeWidth={7} />
        </div>
        <div className="absolute bottom-[7.4cqw] left-[24.5%] right-[8.5%] top-[9.4cqw] flex flex-col">
          <span className="block h-[0.46cqw] w-[6.8cqw] shrink-0 bg-accent" />
          <p className="mt-[1.65cqw] text-[1.6cqw] font-bold uppercase leading-none tracking-[0.1em] text-accent">
            Certificado de finalización
          </p>
          <p className="mt-[1.1cqw] truncate text-[2.05cqw] font-semibold leading-tight text-[#686868]">
            {companyName.trim() || DEFAULT_ISSUER}
          </p>
          <p className="mt-[4.6cqw] font-display text-[6.27cqw] font-semibold leading-none tracking-tight">Ana María Pérez</p>
          <p className="mt-[1.14cqw] text-[2.17cqw] leading-tight text-[#686868]">completó el curso</p>
          <p className="mt-[0.68cqw] line-clamp-3 font-display text-[3.7cqw] font-semibold leading-[1.05] tracking-tight">
            Seguridad en planta y equipo de protección
          </p>
          <span className="mt-[2cqw] block h-[0.12cqw] shrink-0 bg-[#d6d6d6]" />
          <p className="mt-[1.6cqw] text-[1.6cqw] leading-snug">
            Emitido el {formatLongDate(today, timezone)} · 2 horas · 4 módulos · Calificación promedio: 92 %
          </p>
          {validityMonths !== null && (
            <p className="mt-[0.57cqw] text-[1.6cqw] font-semibold leading-snug">
              Vigente hasta el {formatLongDate(addMonths(today, validityMonths), timezone)}
            </p>
          )}
          <div className="mt-auto flex items-end justify-between gap-[3cqw]">
            <div className="min-w-0 max-w-[27cqw]">
              {signer && (
                <>
                  <p className="truncate font-display text-[2.17cqw] font-semibold leading-tight">{signer}</p>
                  <span className="mt-[0.7cqw] block h-[0.12cqw] w-[27cqw] max-w-full bg-ink-800" />
                  {signerTitle.trim() && (
                    <p className="mt-[0.8cqw] truncate text-[1.43cqw] leading-tight text-[#686868]">{signerTitle.trim()}</p>
                  )}
                </>
              )}
            </div>
            <div className="min-w-0 max-w-[37cqw] text-right">
              <p className="text-[1.08cqw] font-bold uppercase leading-none tracking-[0.1em] text-accent">Código de verificación</p>
              <p className="mt-[0.6cqw] font-display text-[2.5cqw] font-bold leading-none">{SAMPLE_CODE}</p>
              <p className="mt-[0.9cqw] break-all text-[1.14cqw] leading-tight text-[#686868]">Verifícalo en {verifyUrl}</p>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        {enabled
          ? "Vista previa con datos de ejemplo: cada certificado lleva los de la persona y su curso o ruta."
          : "Vista previa con datos de ejemplo. Con la emisión automática apagada, solo se emiten a mano o en los cursos que la piden."}
      </figcaption>
    </figure>
  );
}
