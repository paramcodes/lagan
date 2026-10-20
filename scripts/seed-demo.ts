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

type DemoCourseStatus = "draft" | "published";

export interface DemoCourse {
  id: string;
  authorKey: string;
  title: string;
  description: string;
  priceCents: number;
  discountPercent: number;
  isFree: boolean;
  status: DemoCourseStatus;
  publishedDaysAgo: number | null;
  createdDaysAgo: number;
}

export const DEMO_COURSES: DemoCourse[] = [
  {
    id: "demo_course_database_internals",
    authorKey: "mira",
    title: "Database Internals: B-Trees, LSM Trees and Write-Ahead Logging",
    description:
      "Read a storage engine end to end: page layout, buffer management, B-tree splits, LSM compaction and the log that makes all of it durable.",
    priceCents: 0,
    discountPercent: 0,
    isFree: true,
    status: "published",
    publishedDaysAgo: 26,
    createdDaysAgo: 40,
  },
  {
    id: "demo_course_distributed_consensus",
    authorKey: "omar",
    title: "Distributed Systems: Consensus, Replication and Failure",
    description:
      "Build intuition for the protocols that keep machines honest: logical clocks, Raft, multi-Paxos, quorums and anti-entropy under partition.",
    priceCents: 4999,
    discountPercent: 25,
    isFree: false,
    status: "published",
    publishedDaysAgo: 20,
    createdDaysAgo: 34,
  },
  {
    id: "demo_course_systems_programming",
    authorKey: "ines",
    title: "Systems Programming in Rust: Ownership, FFI and Zero-Copy",
    description:
      "Treat the compiler as a design partner: memory layout, the borrow checker, calling C without undefined behaviour and moving bytes without copying them.",
    priceCents: 3900,
    discountPercent: 0,
    isFree: false,
    status: "published",
    publishedDaysAgo: 12,
    createdDaysAgo: 18,
  },
  {
    id: "demo_course_type_design",
    authorKey: "mira",
    title: "Type-Level Design with TypeScript",
    description:
      "Move invariants into the type system: branded identifiers, template literal parsers, a small DSL and result types that make invalid states unrepresentable.",
    priceCents: 2900,
    discountPercent: 0,
    isFree: false,
    status: "published",
    publishedDaysAgo: 6,
    createdDaysAgo: 12,
  },
  {
    id: "demo_course_ebpf_tracing",
    authorKey: "ines",
    title: "eBPF and Kernel Tracing",
    description:
      "Read the kernel with probes: the verifier, program types, tracepoints and the overhead of observability. Still in outline.",
    priceCents: 4500,
    discountPercent: 0,
    isFree: false,
    status: "draft",
    publishedDaysAgo: null,
    createdDaysAgo: 9,
  },
];

export interface DemoModule {
  id: string;
  courseId: string;
  title: string;
  position: number;
}

export const DEMO_MODULES: DemoModule[] = [
  {
    id: "demo_module_db_storage",
    courseId: "demo_course_database_internals",
    title: "Storage Engine Fundamentals",
    position: 0,
  },
  {
    id: "demo_module_db_durability",
    courseId: "demo_course_database_internals",
    title: "Durability and Recovery",
    position: 1,
  },
  {
    id: "demo_module_ds_models",
    courseId: "demo_course_distributed_consensus",
    title: "System Models and Failure",
    position: 0,
  },
  {
    id: "demo_module_ds_replication",
    courseId: "demo_course_distributed_consensus",
    title: "Replication and Consensus",
    position: 1,
  },
  {
    id: "demo_module_sys_memory",
    courseId: "demo_course_systems_programming",
    title: "Memory and Ownership",
    position: 0,
  },
  {
    id: "demo_module_sys_interop",
    courseId: "demo_course_systems_programming",
    title: "Interoperability and Performance",
    position: 1,
  },
  {
    id: "demo_module_ts_basics",
    courseId: "demo_course_type_design",
    title: "Types as Documentation",
    position: 0,
  },
  {
    id: "demo_module_ts_architecture",
    courseId: "demo_course_type_design",
    title: "Type-Driven Architecture",
    position: 1,
  },
  {
    id: "demo_module_ebpf_verifier",
    courseId: "demo_course_ebpf_tracing",
    title: "Verifier and Program Types",
    position: 0,
  },
];
