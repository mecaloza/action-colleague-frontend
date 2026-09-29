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
      return queryClient.invalidateQueries({ queryKey: courseKeys.detail(courseId) });
    },

    /** The server returned an updated course (created, edited, published...): keep that copy and refresh the library. */
    storeCourse: (course: CourseDetail) => {
      // Invalidate first: the copy stored afterwards stays fresh instead of being refetched when the editor mounts.
      const refreshed = queryClient.invalidateQueries({ queryKey: courseKeys.all });
      queryClient.setQueryData(courseKeys.detail(course.id), course);
      return refreshed;
    },

    /** A course was deleted: refetch every course query. */
    refreshLibrary: () => queryClient.invalidateQueries({ queryKey: courseKeys.all }),
  };
}
