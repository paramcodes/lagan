vi.mock("@mux/mux-player-react", () => ({ default: () => null }));
vi.mock("next/server", () => ({
  connection: vi.fn(async () => {}),
}));

const notFoundMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  notFound: () => {
    notFoundMock();
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const queryMocks = vi.hoisted(() => ({
  getAuthorProfile: vi.fn(),
  getAuthorStats: vi.fn(),
  getAuthorPublishedCourses: vi.fn(),
}));

vi.mock("./query", () => ({
  getAuthorProfile: queryMocks.getAuthorProfile,
  getAuthorStats: queryMocks.getAuthorStats,
  getAuthorPublishedCourses: queryMocks.getAuthorPublishedCourses,
}));

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthorProfilePage, { generateMetadata } from "./page";

describe("AuthorProfilePage", () => {
  const mockAuthor = {
    id: "author_evelyn",
    name: "Dr. Evelyn Reed",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
    bio: "Principal researcher in distributed consensus and database storage engines.",
    headline: "Instructor",
    websiteUrl: "https://evelynreed.dev",
    socialLinks: [
      { label: "GitHub", url: "https://github.com/evelynreed" },
      { label: "LinkedIn", url: "https://linkedin.com/in/evelynreed" },
    ],
  };

  const mockStats = {
    publishedCoursesCount: 3,
    enrolledLearnersCount: 450,
  };

  const mockCourses = [
    {
      id: "course_distributed",
      title: "Distributed Systems in Practice",
      authorName: "Dr. Evelyn Reed",
      priceCents: 4999,
      discountPercent: 10,
      isFree: false,
      status: "published",
    },
    {
      id: "course_typescript",
      title: "Type-Driven Architecture with TypeScript",
      authorName: "Dr. Evelyn Reed",
      priceCents: 2999,
      discountPercent: 0,
      isFree: false,
      status: "published",
    },
    {
      id: "course_database",
      title: "Database Internals: Storage & Retrieval",
      authorName: "Dr. Evelyn Reed",
      priceCents: 0,
      discountPercent: 0,
      isFree: true,
      status: "published",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryMocks.getAuthorProfile.mockResolvedValue(mockAuthor);
    queryMocks.getAuthorStats.mockResolvedValue(mockStats);
    queryMocks.getAuthorPublishedCourses.mockResolvedValue(mockCourses);
  });

  it("renders author profile header with name, headline, bio, avatar, and links", async () => {
    const page = await AuthorProfilePage({
      params: Promise.resolve({ id: "author_evelyn" }),
    });
    render(page);

    expect(screen.getByRole("heading", { name: "Dr. Evelyn Reed", level: 1 })).toBeTruthy();
    expect(screen.getByText("Instructor")).toBeTruthy();
    expect(
      screen.getByText(
        "Principal researcher in distributed consensus and database storage engines.",
      ),
    ).toBeTruthy();

    const avatar = screen.getByAltText("Dr. Evelyn Reed") as HTMLImageElement;
    expect(avatar.src).toBe(mockAuthor.avatarUrl);

    const websiteLink = screen.getByRole("link", { name: /evelynreed\.dev/i });
    expect(websiteLink.getAttribute("href")).toBe("https://evelynreed.dev");

    const githubLink = screen.getByRole("link", { name: /GitHub/i });
    expect(githubLink.getAttribute("href")).toBe("https://github.com/evelynreed");

    const linkedinLink = screen.getByRole("link", { name: /LinkedIn/i });
    expect(linkedinLink.getAttribute("href")).toBe("https://linkedin.com/in/evelynreed");
  });

  it("renders avatar fallback initials when avatarUrl is missing", async () => {
    queryMocks.getAuthorProfile.mockResolvedValue({
      ...mockAuthor,
      avatarUrl: null,
    });

    const page = await AuthorProfilePage({
      params: Promise.resolve({ id: "author_evelyn" }),
    });
    render(page);

    const fallback = screen.getByTestId("author-avatar-fallback");
    expect(fallback).toBeTruthy();
    expect(fallback.textContent).toBe("DE");
  });

  it("renders stats for total published courses and enrolled learners count", async () => {
    const page = await AuthorProfilePage({
      params: Promise.resolve({ id: "author_evelyn" }),
    });
    render(page);

    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("Published courses")).toBeTruthy();
    expect(screen.getByText("450")).toBeTruthy();
    expect(screen.getByText("Enrolled learners")).toBeTruthy();
  });

  it("renders course grid with CourseCard components for author published courses", async () => {
    const page = await AuthorProfilePage({
      params: Promise.resolve({ id: "author_evelyn" }),
    });
    render(page);

    expect(
      screen.getByRole("heading", { name: "Courses by Dr. Evelyn Reed", level: 2 }),
    ).toBeTruthy();
    expect(screen.getByText("Distributed Systems in Practice")).toBeTruthy();
    expect(screen.getByText("Type-Driven Architecture with TypeScript")).toBeTruthy();
    expect(screen.getByText("Database Internals: Storage & Retrieval")).toBeTruthy();
  });

  it("renders empty state when author has zero published courses", async () => {
    queryMocks.getAuthorPublishedCourses.mockResolvedValue([]);
    queryMocks.getAuthorStats.mockResolvedValue({
      publishedCoursesCount: 0,
      enrolledLearnersCount: 0,
    });

    const page = await AuthorProfilePage({
      params: Promise.resolve({ id: "author_evelyn" }),
    });
    render(page);

    expect(screen.getByText("No published courses yet")).toBeTruthy();
  });

  it("calls notFound when author profile does not exist", async () => {
    queryMocks.getAuthorProfile.mockResolvedValue(null);

    await expect(
      AuthorProfilePage({
        params: Promise.resolve({ id: "nonexistent" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalled();
  });

  describe("generateMetadata", () => {
    it("generates dynamic page title and OpenGraph metadata from author name and bio", async () => {
      const metadata = await generateMetadata({
        params: Promise.resolve({ id: "author_evelyn" }),
      });

      expect(metadata.title).toBe("Dr. Evelyn Reed — Author Profile | Lagan");
      expect(metadata.description).toBe(mockAuthor.bio);
      expect(metadata.openGraph).toMatchObject({
        title: "Dr. Evelyn Reed — Author Profile | Lagan",
        description: mockAuthor.bio,
        type: "profile",
      });
    });
    it("generates fallback metadata when author is not found", async () => {
      queryMocks.getAuthorProfile.mockResolvedValue(null);

      const metadata = await generateMetadata({
        params: Promise.resolve({ id: "nonexistent" }),
      });

      expect(metadata.title).toBe("Author Not Found | Lagan");
    });
  });
});
