import { toast } from "sonner";
import { errorMessage } from "@/lib/api/client";

/** Standard `onError` for mutations: shows the API's readable message in a toast. */
export function toastError(error: unknown): void {
  toast.error(errorMessage(error));
}
