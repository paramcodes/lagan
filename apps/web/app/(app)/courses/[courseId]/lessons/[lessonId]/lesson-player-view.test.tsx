import type * as LaganUi from "@lagan/ui";
import type { LessonPlayerProps } from "@lagan/ui";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LessonPlayerView } from "./lesson-player-view";
import type { LessonPlayerData } from "./query";

const pushMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@lagan/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof LaganUi>();
  return {
    ...actual,
    LessonPlayer: ({ playbackId, onComplete }: LessonPlayerProps) => (
      <div data-testid="mux-player" data-playback-id={playbackId}>
        <button type="button" data-testid="trigger-mux-ended" onClick={onComplete}>
          End Video
        </button>
      </div>
    ),
  };
});

const mockData: LessonPlayerData = {
  status: "success",
  course: {
    id: "course_1",
    title: "Distributed Systems",
    isAuthor: false,
  },
  lesson: {
    id: "lesson_1",
    moduleId: "mod_1",
    type: "video",
    title: "Consensus Algorithms",
    position: 0,
    muxPlaybackId: "playback_abc123",
    contentJson: null,
    externalUrl: null,
    fileKey: null,
  },
  modules: [
    {
      id: "mod_1",
      title: "Core Protocols",
      position: 0,
      lessons: [
        {
          id: "lesson_1",
          moduleId: "mod_1",
          title: "Consensus Algorithms",
          type: "video",
          position: 0,
          completed: false,
          href: "/courses/course_1/lessons/lesson_1",
        },
        {
          id: "lesson_2",
          moduleId: "mod_1",
          title: "Raft Deep Dive",
          type: "text",
          position: 1,
          completed: false,
          href: "/courses/course_1/lessons/lesson_2",
        },
      ],
    },
  ],
  currentProgress: {
    completed: false,
    positionSeconds: 15,
  },
  prevLesson: null,
  nextLesson: {
    id: "lesson_2",
    moduleId: "mod_1",
    title: "Raft Deep Dive",
    type: "text",
    position: 1,
    completed: false,
    href: "/courses/course_1/lessons/lesson_2",
  },
  totalLessons: 2,
  completedLessonsCount: 0,
};

describe("LessonPlayerView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  it("renders course and lesson title and breadcrumbs", () => {
    render(<LessonPlayerView data={mockData} />);

    expect(screen.getAllByText("Distributed Systems").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 1, name: "Consensus Algorithms" })).toBeDefined();
    expect(screen.getByTestId("mux-player")).toBeDefined();
  });

  it("renders video lesson with Mux player and triggers completion onEnded", async () => {
    render(<LessonPlayerView data={mockData} />);

    expect(screen.getByTestId("mux-player").getAttribute("data-playback-id")).toBe(
      "playback_abc123",
    );

    // Trigger video ended event
    const endButton = screen.getByTestId("trigger-mux-ended");
    await act(async () => {
      fireEvent.click(endButton);
    });

    // Auto-advance banner should become visible
    expect(screen.getByLabelText("Auto-advance countdown")).toBeDefined();
    expect(screen.getByText(/Auto-advancing in 5s/)).toBeDefined();
    expect(screen.getAllByText("Raft Deep Dive").length).toBeGreaterThan(0);
  });

  it("allows cancelling auto-advance countdown", async () => {
    render(<LessonPlayerView data={mockData} />);

    // Trigger completion
    const endButton = screen.getByTestId("trigger-mux-ended");
    await act(async () => {
      fireEvent.click(endButton);
    });

    const cancelButton = screen.getByRole("button", { name: /Cancel auto-advance/i });
    await act(async () => {
      fireEvent.click(cancelButton);
    });

    // Auto advance banner should be removed
    expect(screen.queryByLabelText("Auto-advance countdown")).toBeNull();
    const liveAnnouncement = screen.getByTestId("live-announcement");
    expect(liveAnnouncement.textContent).toContain("Auto-advance cancelled.");
  });

  it("advances immediately when clicking Play Next", async () => {
    render(<LessonPlayerView data={mockData} />);

    // Trigger completion
    const endButton = screen.getByTestId("trigger-mux-ended");
    await act(async () => {
      fireEvent.click(endButton);
    });

    const playNextButton = screen.getByRole("button", { name: /Play Next/i });
    await act(async () => {
      fireEvent.click(playNextButton);
    });

    expect(pushMock).toHaveBeenCalledWith("/courses/course_1/lessons/lesson_2");
  });

  it("renders text lesson and handles reading completion", async () => {
    const textData: LessonPlayerData = {
      ...mockData,
      lesson: {
        id: "lesson_2",
        moduleId: "mod_1",
        type: "text",
        title: "Raft Deep Dive",
        position: 1,
        muxPlaybackId: null,
        contentJson: "Detailed notes on Raft election and log replication.",
        externalUrl: null,
        fileKey: null,
      },
      prevLesson: {
        id: "lesson_1",
        moduleId: "mod_1",
        title: "Consensus Algorithms",
        type: "video",
        position: 0,
        completed: false,
        href: "/courses/course_1/lessons/lesson_1",
      },
      nextLesson: null,
    };

    render(<LessonPlayerView data={textData} />);

    expect(screen.getByText("Detailed notes on Raft election and log replication.")).toBeDefined();

    const finishButton = screen.getByRole("button", {
      name: /Finished Reading & Continue/i,
    });
    await act(async () => {
      fireEvent.click(finishButton);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/courses/course_1/lessons/lesson_2/progress",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("renders quiz lesson type properly", async () => {
    const quizData: LessonPlayerData = {
      ...mockData,
      lesson: {
        id: "lesson_3",
        moduleId: "mod_1",
        type: "quiz",
        title: "Consensus Knowledge Check",
        position: 2,
        muxPlaybackId: null,
        contentJson: null,
        externalUrl: null,
        fileKey: null,
      },
    };

    render(<LessonPlayerView data={quizData} />);

    expect(screen.getByText("Knowledge Assessment")).toBeDefined();
    const quizButton = screen.getByRole("button", { name: /Complete Quiz/i });
    expect(quizButton).toBeDefined();

    await act(async () => {
      fireEvent.click(quizButton);
    });

    expect(global.fetch).toHaveBeenCalled();
  });

  it("renders file lesson type properly", () => {
    const fileData: LessonPlayerData = {
      ...mockData,
      lesson: {
        id: "lesson_4",
        moduleId: "mod_1",
        type: "file",
        title: "Architecture Diagrams PDF",
        position: 3,
        muxPlaybackId: null,
        contentJson: null,
        externalUrl: null,
        fileKey: "architecture-v1.pdf",
      },
    };

    render(<LessonPlayerView data={fileData} />);

    expect(screen.getByText("Downloadable Resource")).toBeDefined();
    expect(screen.getByText(/architecture-v1\.pdf/)).toBeDefined();
  });

  it("renders external lesson type properly", () => {
    const externalData: LessonPlayerData = {
      ...mockData,
      lesson: {
        id: "lesson_5",
        moduleId: "mod_1",
        type: "external",
        title: "Interactive Raft Simulator",
        position: 4,
        muxPlaybackId: null,
        contentJson: null,
        externalUrl: "https://raft.github.io",
        fileKey: null,
      },
    };

    render(<LessonPlayerView data={externalData} />);

    expect(screen.getByText("External Link Resource")).toBeDefined();
    const link = screen.getByRole("link", { name: /Open Resource/i });
    expect(link.getAttribute("href")).toBe("https://raft.github.io");
  });

  it("renders navigation sidebar with modules and checkmarks", () => {
    render(<LessonPlayerView data={mockData} />);

    const syllabusNav = screen.getByRole("navigation", {
      name: "Course modules and lessons",
    });
    expect(syllabusNav).toBeDefined();
    expect(screen.getByText(/Module 1: Core Protocols/)).toBeDefined();
  });
});
