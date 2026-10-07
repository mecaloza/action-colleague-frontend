import type { TireLook } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const GROOVE_ROWS = [8, 20, 32, 44, 56, 68, 80, 92, 104];
const WORN = "#a3a3a3"; // smooth rubber: lighter than the tread, without grooves

/** What each look means, said in words (for screen readers and the studio). */
export const LOOK_LABELS: Record<TireLook, string> = {
  none: "Sin dibujo (no es una llanta)",
  even: "Desgaste parejo",
  center: "Centro gastado",
  shoulders: "Hombros gastados",
  one_side: "Un lado gastado",
  cupping: "Copas (desgaste en parches)",
  cuts: "Cortes",
  bulge: "Chipote en el costado",
};

/** A tire seen from above, its tread drawn the way it wore: the clue the learner reads. */
export function TireTread({ look, className }: { look: TireLook; className?: string }) {
  if (look === "none") return null;
  return (
    <svg viewBox="-10 0 80 120" className={cn("h-full w-auto", className)} role="img" aria-label={LOOK_LABELS[look]}>
      <rect x="2" y="2" width="56" height="116" rx="10" fill="#262626" stroke="#0a0a0a" strokeWidth="2" />
      {GROOVE_ROWS.map((y) => (
        <path
          key={y}
          d={`M6 ${y} L18 ${y + 4} L30 ${y} L42 ${y + 4} L54 ${y}`}
          fill="none"
          stroke="#0a0a0a"
          strokeWidth="2.5"
        />
      ))}
      <line x1="21" y1="6" x2="21" y2="114" stroke="#0a0a0a" strokeWidth="2" />
      <line x1="39" y1="6" x2="39" y2="114" stroke="#0a0a0a" strokeWidth="2" />
      {look === "center" && <rect x="17" y="4" width="26" height="112" fill={WORN} opacity="0.8" />}
      {look === "shoulders" && (
        <>
          <rect x="3" y="4" width="12" height="112" rx="6" fill={WORN} opacity="0.8" />
          <rect x="45" y="4" width="12" height="112" rx="6" fill={WORN} opacity="0.8" />
        </>
      )}
      {look === "one_side" && <rect x="3" y="4" width="22" height="112" rx="8" fill={WORN} opacity="0.8" />}
      {look === "cupping" &&
        [
          [14, 18],
          [46, 42],
          [14, 66],
          [46, 90],
          [30, 108],
        ].map(([cx, cy]) => <ellipse key={cy} cx={cx} cy={cy} rx="10" ry="7" fill={WORN} opacity="0.8" />)}
      {look === "cuts" &&
        ["M10 26 L24 34", "M36 52 L50 46", "M14 82 L26 90", "M34 100 L46 106"].map((d) => (
          <path key={d} d={d} stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
        ))}
      {look === "bulge" && (
        <ellipse cx="0" cy="60" rx="9" ry="16" fill="#3f3f3f" stroke="#f59e0b" strokeWidth="2.5" />
      )}
    </svg>
  );
}
