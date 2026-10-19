import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimit } from "../../../lib/rate-limit";

const authMock = vi.hoisted(() => ({
  state: { session: { user: { id: "user_1" } } as unknown },
  getSession: vi.fn(async () => authMock.state.session),
}));

const dbMock = vi.hoisted(() => {
  const onConflictDoUpdate = vi.fn(async () => [{ id: "profile_1" }]);
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));
  return { insert, values, onConflictDoUpdate };
});

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("../../../lib/auth", () => ({
  auth: { api: { getSession: authMock.getSession } },
}));

vi.mock("../../../lib/db", () => ({
  db: { insert: dbMock.insert },
}));

import { updateProfile } from "./actions";

describe("updateProfile server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimit();
    authMock.state.session = { user: { id: "user_1" } };
  });

  it("rejects unauthorized users", async () => {
    authMock.state.session = null;
    await expect(
      updateProfile({
        bio: "Hello",
        websiteUrl: "",
        avatarUrl: "",
        socialLinks: [],
      }),
    ).rejects.toThrow("Unauthorized");
  });

  it("rejects unknown fields in payload via strict schema", async () => {
    await expect(
      updateProfile({
        bio: "Hello",
        websiteUrl: "",
        avatarUrl: "",
        socialLinks: [],
        // @ts-expect-error Testing unknown field rejection
        unknownKey: "value",
      }),
    ).rejects.toThrow();
  });

  it("updates profile successfully when valid", async () => {
    await updateProfile({
      bio: "Software Engineer",
      websiteUrl: "https://example.com",
      avatarUrl: "https://example.com/avatar.png",
      socialLinks: [{ label: "GitHub", url: "https://github.com/paramcodes" }],
    });

    expect(dbMock.insert).toHaveBeenCalled();
  });

  it("rate limits rapid profile updates to 30 req/min per user", async () => {
    for (let i = 0; i < 30; i++) {
      await updateProfile({
        bio: `Bio ${i}`,
        websiteUrl: "",
        avatarUrl: "",
        socialLinks: [],
      });
    }

    await expect(
      updateProfile({
        bio: "Exceeded",
        websiteUrl: "",
        avatarUrl: "",
        socialLinks: [],
      }),
    ).rejects.toThrow("Too many requests");
  });
});
