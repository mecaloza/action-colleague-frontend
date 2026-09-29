import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/client";
import { ErrorState } from "./empty-state";

/** The part of a React Query result needed to report a failure and retry. */
interface FailedQuery {
  error: unknown;
  refetch: () => unknown;
}

/** Inline error for a failed query: the API's message and a retry that refetches it. */
export function QueryError({ query }: { query: FailedQuery }) {
  return <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
}

/** Whole-page loading placeholder: a title bar and one block for the body. */
export function PageLoading({ bodyClassName = "h-64" }: { bodyClassName?: string }) {
  return (
    <div className="container space-y-6 py-12">
      <Skeleton className="h-10 w-1/2" />
      <Skeleton className={bodyClassName} />
    </div>
  );
}

/** Whole-page version of QueryError. */
export function PageError({ query }: { query: FailedQuery }) {
  return (
    <div className="container py-12">
      <QueryError query={query} />
    </div>
  );
}
