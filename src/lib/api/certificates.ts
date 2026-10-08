import { apiRequest, http } from "./client";
import type { AdminCertificate, AdminCertificatePage, CertificateStatus, PublicCertificate } from "./types";

export interface CertificateListParams {
  /** Looks in the person (name and email), the title and the code. */
  q?: string;
  user_id?: number;
  course_id?: number;
  path_id?: number;
  status?: CertificateStatus;
  limit?: number;
  offset?: number;
}

/** By hand, for a course or a path (one of them) the person completed: the automatic rules don't apply. */
export interface CertificateIssue {
  user_id: number;
  course_id?: number;
  path_id?: number;
}

/** What issuing by hand did: a new certificate, or the person's valid one given back (`created` false). */
export interface IssuedCertificate {
  certificate: AdminCertificate;
  created: boolean;
}

/** Certificates per page in the registry (the API's default `limit`). */
export const CERTIFICATES_PAGE = 50;

export const certificatesApi = {
  /** Every certificate issued, newest first, a page at a time. */
  list: (params: CertificateListParams = {}) => http.get<AdminCertificatePage>("/certificates", { ...params }),
  /** 201 with a new one; 200 with the valid one the person already has (an expired one is renewed: 201). */
  issue: async (input: CertificateIssue): Promise<IssuedCertificate> => {
    const { data, status } = await apiRequest<{ data: AdminCertificate; status: number }>("/certificates", {
      method: "POST",
      body: input,
      as: "jsonWithStatus",
    });
    return { certificate: data, created: status === 201 };
  },
  /** Out of force from now on: its verification says so and its PDF is no longer served. */
  revoke: (id: number, reason?: string) =>
    http.post<AdminCertificate>(`/certificates/${id}/revoke`, reason ? { reason } : {}),
  /** A new certificate in its place (new code, today's details): this one is revoked. */
  reissue: (id: number) => http.post<AdminCertificate>(`/certificates/${id}/reissue`),
  /** Without a session: anyone with the code (any case, dashes optional) checks it. */
  verify: (code: string) =>
    apiRequest<PublicCertificate>(`/public/certificates/${encodeURIComponent(code)}`, { auth: false }),
};

export const certificateKeys = {
  all: ["certificates"] as const,
  lists: ["certificates", "list"] as const,
  list: (params: CertificateListParams) => ["certificates", "list", params] as const,
  public: (code: string) => ["certificates", "public", code] as const,
};
