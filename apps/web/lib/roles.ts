export type Role = "student" | "instructor" | "ta" | "admin";

export const ROLES: Role[] = ["student", "instructor", "ta", "admin"];

export function isInstructor(role: Role): boolean {
  return role === "instructor" || role === "admin" || role === "ta";
}
