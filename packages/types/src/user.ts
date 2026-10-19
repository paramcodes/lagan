export type UserRole = "student" | "instructor" | "ta" | "admin";
export type Role = UserRole;

export const USER_ROLES = ["student", "instructor", "ta", "admin"] as const;
export const ROLES = USER_ROLES;

export type ProfileStatus = "incomplete" | "complete" | "active" | "suspended" | "pending";
export const PROFILE_STATUSES = [
  "incomplete",
  "complete",
  "active",
  "suspended",
  "pending",
] as const;

export interface SocialLink {
  label: string;
  url: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  bio: string | null;
  websiteUrl: string | null;
  socialLinksJson: string | null;
  socialLinks?: SocialLink[];
  avatarUrl: string | null;
  status?: ProfileStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  image?: string | null;
  role?: UserRole;
}

export interface SessionData {
  id: string;
  userId: string;
  expiresAt: Date;
  token: string;
  createdAt: Date;
  updatedAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuthSession {
  session: SessionData;
  user: AuthUser;
}

export type Session = AuthSession;
