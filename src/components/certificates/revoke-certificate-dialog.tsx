"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { certificatesApi } from "@/lib/api/certificates";
import type { AdminCertificate } from "@/lib/api/types";
import { useCertificateCache } from "@/lib/hooks/use-certificate-cache";
import { toastError } from "@/lib/notify";

const MAX_REASON = 500; // CertificateRevoke.reason max_length

interface RevokeCertificateDialogProps {
  open: boolean;
  /** Kept by the page while the dialog animates closed. */
  certificate: AdminCertificate | null;
  onClose: () => void;
  /** Once it is revoked (before closing). */
  onRevoked?: (certificate: AdminCertificate) => void;
  /** Where the focus goes as it closes (by default, back to whatever opened it). */
  onCloseAutoFocus?: (event: Event) => void;
}

/** Revoke a certificate, with an optional reason. The page gives it a new `key` on each opening: it starts empty. */
export function RevokeCertificateDialog({ open, certificate, onClose, onRevoked, onCloseAutoFocus }: RevokeCertificateDialogProps) {
  const { refreshCertificates } = useCertificateCache();
  const [reason, setReason] = useState("");
  const revoke = useMutation({
    mutationFn: (target: AdminCertificate) => certificatesApi.revoke(target.id, reason.trim() || undefined),
    onSuccess: (revoked) => {
      void refreshCertificates();
      toast.success(`Certificado ${revoked.code} revocado`);
      onRevoked?.(revoked);
      onClose();
    },
    onError: toastError,
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !revoke.isPending && onClose()}>
      {/* On a computer it starts on the reason; on a phone, on the dialog (no keyboard over the question). */}
      <DialogContent onOpenAutoFocus={keepKeyboardDown} onCloseAutoFocus={onCloseAutoFocus}>
        {certificate && (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (open) revoke.mutate(certificate); // closing: an Enter during the exit animation doesn't revoke
            }}
          >
            <DialogHeader>
              <DialogTitle>¿Revocar el certificado de {certificate.recipient_name}?</DialogTitle>
              <DialogDescription>
                «{certificate.title}» · {certificate.code}. Su verificación dirá que fue revocado y su PDF dejará de
                descargarse. Puedes reemitirlo después.
              </DialogDescription>
            </DialogHeader>
            <Label htmlFor="revoke-reason">Motivo (opcional)</Label>
            <Textarea
              id="revoke-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={MAX_REASON}
              placeholder="Ej. Se emitió a la persona equivocada."
              aria-describedby="revoke-reason-hint"
            />
            <p id="revoke-reason-hint" className="mt-1.5 text-xs text-muted-foreground">
              Queda en el registro de certificados; la página de verificación no lo muestra.
            </p>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose} disabled={revoke.isPending}>
                Cancelar
              </Button>
              <Button type="submit" variant="destructive" loading={revoke.isPending}>
                Revocar certificado
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
