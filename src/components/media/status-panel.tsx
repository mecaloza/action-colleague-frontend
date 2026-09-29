/** Box for work in progress (uploading, processing), announced politely to screen readers. */
export function StatusPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-2 border border-border bg-white p-4" role="status" aria-live="polite">
      {children}
    </div>
  );
}
