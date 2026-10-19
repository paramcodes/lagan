import { courses } from "@lagan/db";
import { and, eq, ilike, or, type SQL } from "drizzle-orm";

/**
 * WHERE clause for the public catalogue.
 *
 * Only `status = 'published'` and the search term filter rows. There is no
 * category predicate: `courses` has no category (or tag) column, so the shell's
 * category select can only be carried through the URL, not applied. Adding one
 * needs a schema change and a migration, which P3.1 does not own.
 *
 * The search term is always a bound parameter — never interpolated into SQL text.
 */
export function buildPublishedCourseWhere(search: string): SQL {
  const published = eq(courses.status, "published");
  const term = search.trim();
  if (!term) return published;

  const pattern = `%${term}%`;
  const matches = or(ilike(courses.title, pattern), ilike(courses.description, pattern));

  return and(published, matches) ?? published;
}
