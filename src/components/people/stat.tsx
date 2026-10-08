/** A figure on a light background: big value, label under it. One of the `<dl>` of a section. */
export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="mt-1 text-[10.5px] font-bold uppercase tracking-label text-muted-foreground">{label}</dt>
      <dd className="font-display text-4xl font-medium tracking-tightest">{value}</dd>
    </div>
  );
}
