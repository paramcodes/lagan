#!/usr/bin/env bun
/**
 * Demo dataset for a local Lagan deployment.
 *
 * Every row this script writes carries a `demo_` id prefix, so the clean
 * command can remove exactly those rows and leave the courses the app ships
 * with, the e2e fixtures and any real user data untouched.
 */

export const DEMO_ID_PREFIX = "demo_";
export const DEMO_TENANT_ID = "default";
export const DEMO_PASSWORD = "lagan-demo-2026";
export const DEMO_LEARNER_EMAIL = "ada@demo.lagan.dev";

type TipTapNode = Record<string, unknown>;

function paragraph(text: string): TipTapNode {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

function heading(text: string): TipTapNode {
  return { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] };
}

function bulletList(items: string[]): TipTapNode {
  return {
    type: "bulletList",
    content: items.map((item) => ({ type: "listItem", content: [paragraph(item)] })),
  };
}

function codeBlock(code: string, language: string): TipTapNode {
  return { type: "codeBlock", attrs: { language }, content: [{ type: "text", text: code }] };
}

interface LessonSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  code?: string;
  language?: string;
}

/**
 * A TiPTap document for a text lesson. `duration` sits next to the document
 * node because the syllabus reads it from the same jsonb column.
 */
export function lessonDoc(section: LessonSection, duration: string): string {
  const content: TipTapNode[] = [heading(section.heading)];
  for (const text of section.paragraphs) content.push(paragraph(text));
  if (section.bullets) content.push(bulletList(section.bullets));
  if (section.code) content.push(codeBlock(section.code, section.language ?? "text"));
  return JSON.stringify({ type: "doc", duration, content });
}

export function quizDoc(questions: string[], duration: string): string {
  return JSON.stringify({
    type: "doc",
    duration,
    content: [
      heading("Checkpoint questions"),
      ...questions.map((question, index) => paragraph(`${index + 1}. ${question}`)),
    ],
  });
}

export interface DemoUser {
  key: string;
  name: string;
  email: string;
  bio: string;
  websiteUrl: string;
  socialLinks: Array<{ label: string; url: string }>;
  isAuthor: boolean;
  hasLogin: boolean;
  createdDaysAgo: number;
}

export const DEMO_USERS: DemoUser[] = [
  {
    key: "mira",
    name: "Mira Halvorsen",
    email: "mira@demo.lagan.dev",
    bio: "Storage engine researcher. Spent nine years on write amplification, compaction schedulers and the unglamorous parts of B-trees.",
    websiteUrl: "https://example.dev/mira",
    socialLinks: [{ label: "GitHub", url: "https://github.com/example-mira" }],
    isAuthor: true,
    hasLogin: true,
    createdDaysAgo: 120,
  },
  {
    key: "omar",
    name: "Omar Haddad",
    email: "omar@demo.lagan.dev",
    bio: "Distributed systems engineer. Runs a quorum-based scheduler across three regions and writes about failure injection.",
    websiteUrl: "https://example.dev/omar",
    socialLinks: [{ label: "Blog", url: "https://example.dev/omar/blog" }],
    isAuthor: true,
    hasLogin: true,
    createdDaysAgo: 96,
  },
  {
    key: "ines",
    name: "Inés Duarte",
    email: "ines@demo.lagan.dev",
    bio: "Systems programmer in Rust and C. Traces kernels with eBPF and argues that a flamegraph is a design document.",
    websiteUrl: "https://example.dev/ines",
    socialLinks: [{ label: "GitHub", url: "https://github.com/example-ines" }],
    isAuthor: true,
    hasLogin: true,
    createdDaysAgo: 74,
  },
  {
    key: "ada",
    name: "Ada Okonkwo",
    email: DEMO_LEARNER_EMAIL,
    bio: "Backend engineer working through the storage and distributed systems tracks.",
    websiteUrl: "https://example.dev/ada",
    socialLinks: [],
    isAuthor: false,
    hasLogin: true,
    createdDaysAgo: 30,
  },
  {
    key: "bo",
    name: "Bo Nakamura",
    email: "bo@demo.lagan.dev",
    bio: "Platform engineer, currently reading through the consensus track.",
    websiteUrl: "https://example.dev/bo",
    socialLinks: [],
    isAuthor: false,
    hasLogin: false,
    createdDaysAgo: 26,
  },
  {
    key: "cleo",
    name: "Cleo Mbeki",
    email: "cleo@demo.lagan.dev",
    bio: "Data engineer comparing LSM engines with B-tree storage.",
    websiteUrl: "https://example.dev/cleo",
    socialLinks: [],
    isAuthor: false,
    hasLogin: false,
    createdDaysAgo: 22,
  },
];
