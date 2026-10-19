import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

const queryMock = vi.hoisted(() => ({
  getLessonPlayerData: vi.fn(),
}));

const redirectMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("next/server", () => ({
  connection: vi.fn(async () => {}),
}));

vi.mock("../../../../../../lib/auth", () => ({
  auth: {
    api: {
      getSession: authMock.getSession,
    },
  },
}));

vi.mock("./query", () => ({
  getLessonPlayerData: queryMock.getLessonPlayerData,
}));

vi.mock("./lesson-player-view", () => ({
  LessonPlayerView: ({ data }: { data: { lesson: { title: string } } }) => (
    <div data-testid="lesson-player-view">{data.lesson.title}</div>
  ),
}));

import LessonPage from "./page";

describe("LessonPage (Server Component)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to sign-in when unauthenticated", async () => {
    authMock.getSession.mockResolvedValue(null);

    await LessonPage({
      params: Promise.resolve({ courseId: "c_1", lessonId: "l_1" }),
    });

    expect(redirectMock).toHaveBeenCalledWith("/sign-in?callbackUrl=/courses/c_1/lessons/l_1");
  });

  it("calls notFound when lesson or course is not found", async () => {
    authMock.getSession.mockResolvedValue({ user: { id: "user_1" } });
    queryMock.getLessonPlayerData.mockResolvedValue({ status: "not_found" });

    await LessonPage({
      params: Promise.resolve({ courseId: "c_missing", lessonId: "l_missing" }),
    });

    expect(notFoundMock).toHaveBeenCalled();
  });

  it("redirects to course catalog page when learner is unauthorized", async () => {
    authMock.getSession.mockResolvedValue({ user: { id: "user_1" } });
    queryMock.getLessonPlayerData.mockResolvedValue({ status: "unauthorized" });

    await LessonPage({
      params: Promise.resolve({ courseId: "c_paid", lessonId: "l_1" }),
    });

    expect(redirectMock).toHaveBeenCalledWith("/courses/c_paid");
  });

  it("renders LessonPlayerView when learner has access", async () => {
    authMock.getSession.mockResolvedValue({ user: { id: "user_1" } });
    queryMock.getLessonPlayerData.mockResolvedValue({
      status: "success",
      course: { id: "c_1", title: "Distributed Systems", isAuthor: false },
      lesson: { id: "l_1", title: "Consensus Algorithms", type: "video" },
      modules: [],
      currentProgress: { completed: false, positionSeconds: 0 },
      prevLesson: null,
      nextLesson: null,
      totalLessons: 1,
      completedLessonsCount: 0,
    });

    const page = await LessonPage({
      params: Promise.resolve({ courseId: "c_1", lessonId: "l_1" }),
    });

    render(page);
    expect(screen.getByTestId("lesson-player-view")).toBeDefined();
    expect(screen.getByText("Consensus Algorithms")).toBeDefined();
  });
});
