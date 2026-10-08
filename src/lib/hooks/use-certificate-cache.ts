import { useQueryClient } from "@tanstack/react-query";
import { certificateKeys } from "@/lib/api/certificates";
import { userKeys } from "@/lib/api/users";

/** The cache updates that follow issuing, revoking or reissuing a certificate. */
export function useCertificateCache() {
  const queryClient = useQueryClient();
  return {
    /** The registry (every page and filter), and each person's courses, which link the certificate they earned. */
    refreshCertificates: () =>
      Promise.all([certificateKeys.all, userKeys.all].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  };
}
