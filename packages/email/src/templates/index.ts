import type { EmailTemplateResult, NotificationPayloadMap, NotificationType } from "../types";
import { renderCourseEnrollmentEmail } from "./course-enrollment";
import { renderLessonCompleteEmail } from "./lesson-complete";
import { renderNewContentPublishedEmail } from "./new-content-published";
import { renderWelcomeEmail } from "./welcome";

export {
  escapeHtml,
  layoutHtml,
  layoutText,
} from "./layout";
export type { LayoutHtmlOptions, LayoutTextOptions } from "./layout";
export { renderWelcomeEmail } from "./welcome";
export { renderCourseEnrollmentEmail } from "./course-enrollment";
export { renderNewContentPublishedEmail } from "./new-content-published";
export { renderLessonCompleteEmail } from "./lesson-complete";

export function renderNotificationTemplate<T extends NotificationType>(
  type: T,
  props: NotificationPayloadMap[T],
): EmailTemplateResult {
  switch (type) {
    case "welcome":
      return renderWelcomeEmail(props as NotificationPayloadMap["welcome"]);
    case "course_enrollment":
      return renderCourseEnrollmentEmail(props as NotificationPayloadMap["course_enrollment"]);
    case "new_content_published":
      return renderNewContentPublishedEmail(
        props as NotificationPayloadMap["new_content_published"],
      );
    case "lesson_complete":
      return renderLessonCompleteEmail(props as NotificationPayloadMap["lesson_complete"]);
    default: {
      const _exhaustiveCheck: never = type;
      throw new Error(`Unknown notification template type: ${_exhaustiveCheck}`);
    }
  }
}
