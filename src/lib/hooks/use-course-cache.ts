import { useQueryClient } from "@tanstack/react-query";
import { courseKeys } from "@/lib/api/courses";
import type { CourseDetail, Participant } from "@/lib/api/types";

/**
 * The cache updates that follow each kind of course mutation, so components don't repeat query keys.
 * React Query matches keys by prefix: refreshing `["courses", id]` also refreshes that course's
 * participants, results and preview.
 */
export function useCourseCache() {
  const queryClient = useQueryClient();

  return {
    /** Something under a course changed (modules, participants): refetch it and everything below it. */
    refreshCourse: (courseId: number) => queryClient.invalidateQueries({ queryKey: courseKeys.detail(courseId) }),

    /** A module's evaluation changed: refetch it and the course, whose modules carry the question count. */
    refreshEvaluation: (courseId: number, moduleId: number) => {
      queryClient.invalidateQueries({ queryKey: courseKeys.evaluation(moduleId) });
      queryClient.invalidateQueries({ queryKey: courseKeys.detail(courseId) });
    },

    /** People were assigned: show the returned list at once, then refetch the course counts. */
    storeParticipants: (courseId: number, participants: Participant[]) => {
      queryClient.setQueryData(courseKeys.participants(courseId), participants);
      // Only the course itself (its counts): the list just stored is already fresh.
      return queryClient.invalidateQueries({ queryKey: courseKeys.detail(courseId), exact: true });
    },

    /** The server returned an updated course (created, edited, published...): keep that copy and refresh the library. */
    storeCourse: (course: CourseDetail) => {
      queryClient.setQueryData(courseKeys.detail(course.id), course);
      // The lists and the preview change too; the detail just stored does not need a refetch.
      return queryClient.invalidateQueries({
        queryKey: courseKeys.all,
        predicate: (query) => query.queryKey.length !== 2 || query.queryKey[1] !== course.id,
      });
    },

    /** A course was deleted: refetch every course query. */
    refreshLibrary: () => queryClient.invalidateQueries({ queryKey: courseKeys.all }),
  };
}
