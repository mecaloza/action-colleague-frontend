import { useQueryClient } from "@tanstack/react-query";
import { courseKeys } from "@/lib/api/courses";
import { dashboardKeys } from "@/lib/api/dashboard";
import { pathKeys } from "@/lib/api/paths";
import { profileKeys } from "@/lib/api/profiles";
import { userKeys } from "@/lib/api/users";
import type { CourseDetail, Participant } from "@/lib/api/types";

/**
 * The cache updates that follow each kind of course or team mutation, so components don't repeat query keys.
 * React Query matches keys by prefix: refreshing `["courses", id]` also refreshes that course's
 * participants, results and preview.
 */
export function useCourseCache() {
  const queryClient = useQueryClient();

  /** The team (lists, each person's courses), the panel's counts, and the paths and profiles. */
  const refreshTeam = () =>
    Promise.all(
      [userKeys.all, dashboardKeys.all, pathKeys.all, profileKeys.all].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );

  /**
   * People or their enrollments changed: refetch the team and the courses. A person's profile, role or active state
   * decides the paths they get by profile, and those paths enroll them in their courses (participants and counts).
   */
  const refreshPeople = () => Promise.all([refreshTeam(), queryClient.invalidateQueries({ queryKey: courseKeys.all })]);

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
      void refreshTeam(); // each person's courses and completions
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

    refreshPeople,
  };
}
