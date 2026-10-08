import { useQueryClient } from "@tanstack/react-query";
import { courseKeys } from "@/lib/api/courses";
import { dashboardKeys } from "@/lib/api/dashboard";
import { pathKeys } from "@/lib/api/paths";
import { profileKeys } from "@/lib/api/profiles";
import { rankingKeys } from "@/lib/api/ranking";
import { userKeys } from "@/lib/api/users";
import type { PathDetail } from "@/lib/api/types";

/**
 * The cache updates that follow a path mutation. A path reaches beyond itself: publishing it, or changing its
 * courses, profiles or people, enrolls people in courses (each course's participants, each person's courses, the
 * panel) and changes the profiles' counts.
 */
export function usePathCache() {
  const queryClient = useQueryClient();

  /**
   * What is around the paths: the team and each person's courses, the panel, the profiles, the courses and the
   * rankings (a path's ranks its people, and counts its courses).
   */
  const refreshAround = () =>
    Promise.all(
      [userKeys.all, dashboardKeys.all, profileKeys.all, courseKeys.all, rankingKeys.all].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );

  /** Who has a path changed (assigned or taken away): every path query, and what is around them. */
  const refreshPaths = () => Promise.all([queryClient.invalidateQueries({ queryKey: pathKeys.all }), refreshAround()]);

  return {
    /** The server returned the updated path: keep that copy, refetch its people, the lists and what is around. */
    storePath: (path: PathDetail) => {
      queryClient.setQueryData(pathKeys.detail(path.id), path);
      void refreshAround();
      // The detail just stored does not need a refetch.
      return queryClient.invalidateQueries({
        queryKey: pathKeys.all,
        predicate: (query) => query.queryKey.length !== 2 || query.queryKey[1] !== path.id,
      });
    },

    refreshPaths,

    /** A path was deleted: it leaves the cache, the lists refetch. */
    forgetPath: (id: number) => {
      queryClient.removeQueries({ queryKey: pathKeys.detail(id) });
      return refreshPaths();
    },
  };
}
