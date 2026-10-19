import { describe, expect, it } from "vitest";
import type { db } from "../../../../lib/db";
import {
  getAuthorProfile,
  getAuthorPublishedCourses,
  getAuthorStats,
  parseSocialLinks,
} from "./query";

type MockDatabase = typeof db;

describe("parseSocialLinks", () => {
  it("returns an empty array for null, undefined, or empty string", () => {
    expect(parseSocialLinks(null)).toEqual([]);
    expect(parseSocialLinks("")).toEqual([]);
  });

  it("returns an empty array for malformed JSON", () => {
    expect(parseSocialLinks("{bad json")).toEqual([]);
    expect(parseSocialLinks("not json at all")).toEqual([]);
  });

  it("returns an empty array when JSON is not an array", () => {
    expect(parseSocialLinks('{"label":"X"}')).toEqual([]);
    expect(parseSocialLinks("123")).toEqual([]);
    expect(parseSocialLinks("true")).toEqual([]);
  });

  it("parses valid social links array", () => {
    const raw = JSON.stringify([
      { label: "Twitter", url: "https://twitter.com/author" },
      { label: "GitHub", url: "https://github.com/author" },
    ]);
    expect(parseSocialLinks(raw)).toEqual([
      { label: "Twitter", url: "https://twitter.com/author" },
      { label: "GitHub", url: "https://github.com/author" },
    ]);
  });

  it("filters out invalid items without label or url", () => {
    const raw = JSON.stringify([
      { label: "Valid", url: "https://example.com" },
      { label: "", url: "https://example.com" },
      { label: "No URL" },
      { url: "https://example.com" },
      null,
      123,
      { label: "Bad Types", url: 456 },
    ]);
    expect(parseSocialLinks(raw)).toEqual([{ label: "Valid", url: "https://example.com" }]);
  });
});

describe("getAuthorProfile with mock database", () => {
  it("returns complete profile when user and profile records exist", async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: async () => [
                {
                  id: "user_42",
                  name: "Dr. Jane Doe",
                  userImage: null,
                  avatarUrl: "https://example.com/avatar.png",
                  bio: "Distributed systems researcher.",
                  websiteUrl: "https://janedoe.com",
                  socialLinksJson: JSON.stringify([
                    { label: "GitHub", url: "https://github.com/janedoe" },
                  ]),
                },
              ],
            }),
          }),
        }),
      }),
    };

    const profile = await getAuthorProfile("user_42", mockDb as unknown as MockDatabase);
    expect(profile).toEqual({
      id: "user_42",
      name: "Dr. Jane Doe",
      avatarUrl: "https://example.com/avatar.png",
      bio: "Distributed systems researcher.",
      headline: "Instructor",
      websiteUrl: "https://janedoe.com",
      socialLinks: [{ label: "GitHub", url: "https://github.com/janedoe" }],
    });
  });

  it("falls back to user image when profile avatarUrl is null", async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: async () => [
                {
                  id: "user_43",
                  name: "John Smith",
                  userImage: "https://example.com/auth-image.png",
                  avatarUrl: null,
                  bio: null,
                  websiteUrl: null,
                  socialLinksJson: null,
                },
              ],
            }),
          }),
        }),
      }),
    };

    const profile = await getAuthorProfile("user_43", mockDb as unknown as MockDatabase);
    expect(profile?.avatarUrl).toBe("https://example.com/auth-image.png");
    expect(profile?.bio).toBeNull();
    expect(profile?.socialLinks).toEqual([]);
  });

  it("resolves from profiles table if user join produces no row", async () => {
    let callCount = 0;
    const mockDb = {
      select: () => ({
        from: () => {
          callCount++;
          if (callCount === 1) {
            // First call (user leftJoin profiles) returns empty
            return {
              leftJoin: () => ({
                where: () => ({
                  limit: async () => [],
                }),
              }),
            };
          }
          // Second call (direct profiles select) returns profile row
          return {
            where: () => ({
              limit: async () => [
                {
                  id: "prof_1",
                  userId: "user_standalone",
                  avatarUrl: "https://example.com/p.png",
                  bio: "Solo instructor",
                  websiteUrl: "https://solo.org",
                  socialLinksJson: null,
                },
              ],
            }),
          };
        },
      }),
    };

    const profile = await getAuthorProfile("user_standalone", mockDb as unknown as MockDatabase);
    expect(profile).toEqual({
      id: "user_standalone",
      name: "Instructor",
      avatarUrl: "https://example.com/p.png",
      bio: "Solo instructor",
      headline: "Instructor",
      websiteUrl: "https://solo.org",
      socialLinks: [],
    });
  });

  it("returns null if neither user nor profile row exists", async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: async () => [],
            }),
          }),
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    };

    const profile = await getAuthorProfile("nonexistent", mockDb as unknown as MockDatabase);
    expect(profile).toBeNull();
  });
});

describe("getAuthorStats with mock database", () => {
  it("returns course count and distinct enrolled learner count", async () => {
    let selectIndex = 0;
    const mockDb = {
      select: () => {
        selectIndex++;
        const current = selectIndex;
        return {
          from: () => {
            if (current === 1) {
              return {
                where: async () => [{ count: 4 }],
              };
            }
            return {
              innerJoin: () => ({
                where: async () => [{ count: 128 }],
              }),
            };
          },
        };
      },
    };

    const stats = await getAuthorStats("author_1", mockDb as unknown as MockDatabase);
    expect(stats).toEqual({
      publishedCoursesCount: 4,
      enrolledLearnersCount: 128,
    });
  });

  it("handles zero counts gracefully", async () => {
    let selectIndex = 0;
    const mockDb = {
      select: () => {
        selectIndex++;
        const current = selectIndex;
        return {
          from: () => {
            if (current === 1) {
              return {
                where: async () => [{}],
              };
            }
            return {
              innerJoin: () => ({
                where: async () => [{}],
              }),
            };
          },
        };
      },
    };

    const stats = await getAuthorStats("author_new", mockDb as unknown as MockDatabase);
    expect(stats).toEqual({
      publishedCoursesCount: 0,
      enrolledLearnersCount: 0,
    });
  });
});

describe("getAuthorPublishedCourses with mock database", () => {
  it("returns published courses ordered by publishedAt", async () => {
    const sampleCourses = [
      {
        id: "c_1",
        title: "Distributed Systems",
        priceCents: 4999,
        discountPercent: 10,
        isFree: false,
        status: "published",
        authorName: "Jane Doe",
      },
      {
        id: "c_2",
        title: "Rust Fundamentals",
        priceCents: 0,
        discountPercent: 0,
        isFree: true,
        status: "published",
        authorName: "Jane Doe",
      },
    ];

    const mockDb = {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              orderBy: async () => sampleCourses,
            }),
          }),
        }),
      }),
    };

    const result = await getAuthorPublishedCourses("author_1", mockDb as unknown as MockDatabase);
    expect(result).toHaveLength(2);
    expect(result[0]?.title).toBe("Distributed Systems");
    expect(result[1]?.isFree).toBe(true);
  });
});
