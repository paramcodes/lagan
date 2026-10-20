#!/usr/bin/env bun
/**
 * Demo dataset for a local Lagan deployment.
 *
 * Every row this script writes carries a `demo_` id prefix, so the clean
 * command can remove exactly those rows and leave the courses the app ships
 * with, the e2e fixtures and any real user data untouched.
 */
import { createHash, scrypt } from "node:crypto";
import { Client } from "pg";

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

type DemoLessonType = "video" | "text" | "quiz";
type DemoLessonStatus = "draft" | "published";

export interface DemoLesson {
  id: string;
  moduleId: string;
  type: DemoLessonType;
  title: string;
  position: number;
  status: DemoLessonStatus;
  muxPlaybackId: string | null;
  contentJson: string | null;
}

export const DEMO_LESSONS: DemoLesson[] = [
  {
    id: "demo_lesson_db_pages",
    moduleId: "demo_module_db_storage",
    type: "text",
    title: "Pages, Buffers and the Buffer Pool",
    position: 0,
    status: "published",
    muxPlaybackId: null,
    contentJson: lessonDoc(
      {
        heading: "The page is the unit of I/O",
        paragraphs: [
          "A database does not read a row, it reads a page. Everything above the page layer — indexes, heap tuples, vacuum — is a consumer of the same fixed-size block.",
          "The buffer pool keeps those pages in memory so a second reader of the same block pays for the copy, not the disk.",
        ],
        bullets: [
          "8 kB is the default page size, and it is smaller than it looks on a spinning disk",
          "The pool is a clock replacement algorithm wearing a database costume",
          "A pin count is a promise that nobody will evict this page under us",
        ],
        code: "SELECT pg_size_pretty(pg_relation_size('course_event'));\nSELECT relfilenode, relpages FROM pg_class WHERE relname = 'course_event';",
        language: "sql",
      },
      "14 min",
    ),
  },
  {
    id: "demo_lesson_db_btree",
    moduleId: "demo_module_db_storage",
    type: "video",
    title: "B-Tree Splits, Merges and Fill Factors",
    position: 1,
    status: "published",
    muxPlaybackId: "demo_playback_db_btree",
    contentJson: null,
  },
  {
    id: "demo_lesson_db_lsm",
    moduleId: "demo_module_db_durability",
    type: "text",
    title: "LSM Trees: Memtables, SSTables and Compaction",
    position: 0,
    status: "published",
    muxPlaybackId: null,
    contentJson: lessonDoc(
      {
        heading: "Write fast, read eventually consistent",
        paragraphs: [
          "An LSM tree turns random writes into sequential ones. The write path is cheap; the read path pays for the background work that keeps the tree ordered.",
          "Compaction is the price of admission. Every key you write is compacted several times before it reaches the bottom level.",
        ],
        bullets: [
          "Memtable flush produces an immutable SSTable",
          "Tombstones are the reason a merge can never delete anything",
          "Write amplification is the ratio of bytes written to bytes stored",
        ],
        code: "level0: [sst-17, sst-18]\nlevel1: [sst-11]\ncompaction: 17 + 18 -> 22 -> level1",
        language: "text",
      },
      "18 min",
    ),
  },
  {
    id: "demo_lesson_db_wal",
    moduleId: "demo_module_db_durability",
    type: "video",
    title: "Write-Ahead Logging and Crash Recovery",
    position: 1,
    status: "published",
    muxPlaybackId: "demo_playback_db_wal",
    contentJson: null,
  },
  {
    id: "demo_lesson_db_quiz",
    moduleId: "demo_module_db_durability",
    type: "quiz",
    title: "Checkpoint: Durability Trade-offs",
    position: 2,
    status: "published",
    muxPlaybackId: null,
    contentJson: quizDoc(
      [
        "Why must the log record be flushed before the data page is written?",
        "What does a checkpoint buy you that a longer log does not?",
        "How does an LSM tree move durability guarantees into the write path?",
      ],
      "15 min",
    ),
  },
  {
    id: "demo_lesson_ds_clocks",
    moduleId: "demo_module_ds_models",
    type: "text",
    title: "Logical Clocks and Vector Timestamps",
    position: 0,
    status: "published",
    muxPlaybackId: null,
    contentJson: lessonDoc(
      {
        heading: "Time is a lie, causality is not",
        paragraphs: [
          "Wall clocks drift, skew and occasionally jump backwards. Two nodes that disagree about the order of two events cannot both be right, and a system that assumes they agree will corrupt data.",
          "A logical clock costs a counter increment and buys you a total order you can reason about.",
        ],
        bullets: [
          "Lamport clocks order events but say nothing about concurrency",
          "Vector clocks track per-process history and cost more to compare",
          "Happens-before is the relation every correct protocol is built on",
        ],
        code: "send: local = local + 1\nreceive: local = max(local, remote) + 1",
        language: "text",
      },
      "16 min",
    ),
  },
  {
    id: "demo_lesson_ds_raft",
    moduleId: "demo_module_ds_models",
    type: "video",
    title: "Raft: Leader Election and Log Replication",
    position: 1,
    status: "published",
    muxPlaybackId: "demo_playback_ds_raft",
    contentJson: null,
  },
  {
    id: "demo_lesson_ds_paxos",
    moduleId: "demo_module_ds_replication",
    type: "text",
    title: "Paxos and Multi-Paxos",
    position: 0,
    status: "published",
    muxPlaybackId: null,
    contentJson: lessonDoc(
      {
        heading: "One value, many proposers",
        paragraphs: [
          "Paxos solves a narrower problem than Raft and hides it behind a worse interface. Once you believe the value is stable, Multi-Paxos makes the steady state cheap.",
          "The hard part was never the protocol. It is convincing yourself that the protocol you implemented is the one you read about.",
        ],
        bullets: [
          "A proposal needs a majority of acceptors",
          "Chosen means accepted by a quorum, not merely proposed",
          "Multi-Paxos amortises the handshake across many commands",
        ],
        code: "phase 1: promise(n, accepted)\nphase 2: accept(n, value)\nchosen: |accepted| > N/2",
        language: "text",
      },
      "22 min",
    ),
  },
  {
    id: "demo_lesson_ds_quorum",
    moduleId: "demo_module_ds_replication",
    type: "video",
    title: "Quorums, Read Repair and Anti-Entropy",
    position: 1,
    status: "published",
    muxPlaybackId: "demo_playback_ds_quorum",
    contentJson: null,
  },
  {
    id: "demo_lesson_ds_quiz",
    moduleId: "demo_module_ds_replication",
    type: "quiz",
    title: "Checkpoint: Consensus Under Partition",
    position: 2,
    status: "published",
    muxPlaybackId: null,
    contentJson: quizDoc(
      [
        "What can a minority partition safely serve, and what must it refuse?",
        "Why does a read need a quorum when a single replica answered?",
        "How does read repair differ from anti-entropy?",
      ],
      "15 min",
    ),
  },
  {
    id: "demo_lesson_sys_layout",
    moduleId: "demo_module_sys_memory",
    type: "text",
    title: "Memory Layout, Alignment and Padding",
    position: 0,
    status: "published",
    muxPlaybackId: null,
    contentJson: lessonDoc(
      {
        heading: "The layout is the design",
        paragraphs: [
          "A struct is not a bag of fields. The compiler lays it out for you, and the layout decides how many cache lines a hot loop touches.",
          "Read the layout before you benchmark it. Most slow structs are slow because of where the fields landed.",
        ],
        bullets: [
          "Alignment is a promise the ABI makes, not a suggestion",
          "Padding between fields is invisible in the source and visible in the profile",
          "A hot field at offset zero can halve the cache misses in a loop",
        ],
        code: "struct Event {\n    id: u64,      // 8 bytes\n    kind: u8,     // 1 byte + 7 padding\n    flags: u32,\n}",
        language: "rust",
      },
      "12 min",
    ),
  },
  {
    id: "demo_lesson_sys_borrow",
    moduleId: "demo_module_sys_memory",
    type: "video",
    title: "The Borrow Checker as a Design Tool",
    position: 1,
    status: "published",
    muxPlaybackId: "demo_playback_sys_borrow",
    contentJson: null,
  },
  {
    id: "demo_lesson_sys_ffi",
    moduleId: "demo_module_sys_interop",
    type: "text",
    title: "Calling C from Rust Without Undefined Behaviour",
    position: 0,
    status: "published",
    muxPlaybackId: null,
    contentJson: lessonDoc(
      {
        heading: "The boundary is where the bugs live",
        paragraphs: [
          "Inside Rust, memory is safe. The moment you cross into C, you are back to manual lifetimes, manual ownership and manual proof that nothing was freed early.",
          "Every FFI boundary deserves the same treatment: a narrow signature, an explicit ownership convention and a test that exercises the unhappy path.",
        ],
        bullets: [
          "Never pass a Rust reference to C unless it is guaranteed to outlive the call",
          "Return an owned pointer that C must free with the matching free function",
          "Document panics: unwinding across an FFI boundary is undefined behaviour",
        ],
        code: 'unsafe extern "C" fn strlen(s: *const c_char) -> usize;',
        language: "rust",
      },
      "17 min",
    ),
  },
  {
    id: "demo_lesson_sys_zero_copy",
    moduleId: "demo_module_sys_interop",
    type: "video",
    title: "Zero-Copy Pipes with io_uring",
    position: 1,
    status: "published",
    muxPlaybackId: "demo_playback_sys_zero_copy",
    contentJson: null,
  },
  {
    id: "demo_lesson_sys_quiz",
    moduleId: "demo_module_sys_interop",
    type: "quiz",
    title: "Checkpoint: Ownership at the FFI Boundary",
    position: 2,
    status: "published",
    muxPlaybackId: null,
    contentJson: quizDoc(
      [
        "Which side of an FFI call owns the buffer, and how does the caller know?",
        "Why is unwinding across the FFI boundary undefined behaviour?",
        "What does zero-copy actually remove from the pipeline?",
      ],
      "15 min",
    ),
  },
  {
    id: "demo_lesson_ts_brands",
    moduleId: "demo_module_ts_basics",
    type: "text",
    title: "Branded Types and Nominal Safety",
    position: 0,
    status: "published",
    muxPlaybackId: null,
    contentJson: lessonDoc(
      {
        heading: "Two identifiers that mean different things",
        paragraphs: [
          "A user id and an account id are both strings. TypeScript will happily let you pass one where the other is expected, and the bug surfaces three services later.",
          "A brand turns a string into a string that only one module can mint. It costs a type-level tag and buys a compile-time error.",
        ],
        bullets: [
          "A brand is a phantom type: it exists only at compile time",
          "Brand the type at the boundary where the string enters the system",
          "Never brand with a value — two brands with the same value are still different types",
        ],
        code: "type Brand<T, B extends string> = T & { readonly __brand: B };\ntype UserId = Brand<string, 'UserId'>;",
        language: "typescript",
      },
      "11 min",
    ),
  },
  {
    id: "demo_lesson_ts_templates",
    moduleId: "demo_module_ts_basics",
    type: "video",
    title: "Template Literal Types and Parsers",
    position: 1,
    status: "published",
    muxPlaybackId: "demo_playback_ts_templates",
    contentJson: null,
  },
  {
    id: "demo_lesson_ts_dsl",
    moduleId: "demo_module_ts_architecture",
    type: "text",
    title: "Encoding a DSL in the Type System",
    position: 0,
    status: "published",
    muxPlaybackId: null,
    contentJson: lessonDoc(
      {
        heading: "A grammar the compiler can check",
        paragraphs: [
          "Template literal types turn a string into a small parser. Split a path into segments, match the segments against a known grammar, and the compiler rejects the typo.",
          "The trick is to keep the grammar shallow. A type-level parser that needs its own type-level debugger has already failed.",
        ],
        bullets: [
          "Split on a literal with a recursive conditional type",
          "Accumulate parsed segments in a tuple, not a string",
          "Fall back to `never` so bad input fails to compile",
        ],
        // biome-ignore lint/suspicious/noTemplateCurlyInString: TypeScript source shown inside a lesson sample
        code: "type Path<S extends string> = S extends `${infer Head}/${infer Tail}`\n  ? [Head, ...Path<Tail>]\n  : [S];",
        language: "typescript",
      },
      "19 min",
    ),
  },
  {
    id: "demo_lesson_ts_errors",
    moduleId: "demo_module_ts_architecture",
    type: "video",
    title: "Result Types and Exhaustive Handling",
    position: 1,
    status: "published",
    muxPlaybackId: "demo_playback_ts_errors",
    contentJson: null,
  },
  {
    id: "demo_lesson_ts_quiz",
    moduleId: "demo_module_ts_architecture",
    type: "quiz",
    title: "Checkpoint: Making Invalid States Unrepresentable",
    position: 2,
    status: "published",
    muxPlaybackId: null,
    contentJson: quizDoc(
      [
        "What state does a discriminated union remove from your API?",
        "Why does `never` in the default branch of a switch matter?",
        "When is a branded type the wrong tool?",
      ],
      "15 min",
    ),
  },
  {
    id: "demo_lesson_ebpf_verifier",
    moduleId: "demo_module_ebpf_verifier",
    type: "text",
    title: "Attaching to Tracepoints",
    position: 0,
    status: "draft",
    muxPlaybackId: null,
    contentJson: lessonDoc(
      {
        heading: "Reading the kernel without patching it",
        paragraphs: [
          "A tracepoint program is verified before it runs. The verifier walks every instruction and proves the program cannot read outside its bounds.",
          "Once the verifier is satisfied, the program can be attached to a kernel hook and run on every event.",
        ],
        bullets: [
          "Tracepoints are stable; kprobes are not",
          "The verifier rejects unbounded loops before the program ever runs",
          "A map is how a program hands data back to user space",
        ],
      },
      "10 min",
    ),
  },
  {
    id: "demo_lesson_ebpf_overhead",
    moduleId: "demo_module_ebpf_verifier",
    type: "video",
    title: "The Cost of Observability",
    position: 1,
    status: "draft",
    muxPlaybackId: "demo_playback_ebpf_overhead",
    contentJson: null,
  },
];

export interface DemoEnrollment {
  id: string;
  userKey: string;
  courseId: string;
  stripePaymentId: string;
  enrolledDaysAgo: number;
}

export const DEMO_ENROLLMENTS: DemoEnrollment[] = [
  {
    id: "demo_enrollment_ada_db",
    userKey: "ada",
    courseId: "demo_course_database_internals",
    stripePaymentId: "demo_pi_ada_db",
    enrolledDaysAgo: 20,
  },
  {
    id: "demo_enrollment_bo_db",
    userKey: "bo",
    courseId: "demo_course_database_internals",
    stripePaymentId: "demo_pi_bo_db",
    enrolledDaysAgo: 19,
  },
  {
    id: "demo_enrollment_cleo_db",
    userKey: "cleo",
    courseId: "demo_course_database_internals",
    stripePaymentId: "demo_pi_cleo_db",
    enrolledDaysAgo: 16,
  },
  {
    id: "demo_enrollment_ada_ds",
    userKey: "ada",
    courseId: "demo_course_distributed_consensus",
    stripePaymentId: "demo_pi_ada_ds",
    enrolledDaysAgo: 13,
  },
  {
    id: "demo_enrollment_bo_ds",
    userKey: "bo",
    courseId: "demo_course_distributed_consensus",
    stripePaymentId: "demo_pi_bo_ds",
    enrolledDaysAgo: 11,
  },
  {
    id: "demo_enrollment_cleo_ds",
    userKey: "cleo",
    courseId: "demo_course_distributed_consensus",
    stripePaymentId: "demo_pi_cleo_ds",
    enrolledDaysAgo: 8,
  },
  {
    id: "demo_enrollment_ada_sys",
    userKey: "ada",
    courseId: "demo_course_systems_programming",
    stripePaymentId: "demo_pi_ada_sys",
    enrolledDaysAgo: 4,
  },
  {
    id: "demo_enrollment_bo_sys",
    userKey: "bo",
    courseId: "demo_course_systems_programming",
    stripePaymentId: "demo_pi_bo_sys",
    enrolledDaysAgo: 6,
  },
  {
    id: "demo_enrollment_cleo_sys",
    userKey: "cleo",
    courseId: "demo_course_systems_programming",
    stripePaymentId: "demo_pi_cleo_sys",
    enrolledDaysAgo: 5,
  },
  {
    id: "demo_enrollment_ada_ts",
    userKey: "ada",
    courseId: "demo_course_type_design",
    stripePaymentId: "demo_pi_ada_ts",
    enrolledDaysAgo: 1,
  },
  {
    id: "demo_enrollment_cleo_ts",
    userKey: "cleo",
    courseId: "demo_course_type_design",
    stripePaymentId: "demo_pi_cleo_ts",
    enrolledDaysAgo: 2,
  },
];

export interface DemoProgress {
  id: string;
  userKey: string;
  courseId: string;
  lessonId: string;
  completed: boolean;
  positionSeconds: number;
  daysAgo: number;
}

export const DEMO_PROGRESS: DemoProgress[] = [
  {
    id: "demo_progress_ada_db_0",
    userKey: "ada",
    courseId: "demo_course_database_internals",
    lessonId: "demo_lesson_db_pages",
    completed: true,
    positionSeconds: 540,
    daysAgo: 24,
  },
  {
    id: "demo_progress_ada_db_1",
    userKey: "ada",
    courseId: "demo_course_database_internals",
    lessonId: "demo_lesson_db_btree",
    completed: true,
    positionSeconds: 720,
    daysAgo: 21,
  },
  {
    id: "demo_progress_ada_db_2",
    userKey: "ada",
    courseId: "demo_course_database_internals",
    lessonId: "demo_lesson_db_lsm",
    completed: true,
    positionSeconds: 600,
    daysAgo: 17,
  },
  {
    id: "demo_progress_ada_db_3",
    userKey: "ada",
    courseId: "demo_course_database_internals",
    lessonId: "demo_lesson_db_wal",
    completed: true,
    positionSeconds: 660,
    daysAgo: 12,
  },
  {
    id: "demo_progress_ada_db_4",
    userKey: "ada",
    courseId: "demo_course_database_internals",
    lessonId: "demo_lesson_db_quiz",
    completed: false,
    positionSeconds: 420,
    daysAgo: 1,
  },
  {
    id: "demo_progress_bo_db_0",
    userKey: "bo",
    courseId: "demo_course_database_internals",
    lessonId: "demo_lesson_db_pages",
    completed: true,
    positionSeconds: 600,
    daysAgo: 20,
  },
  {
    id: "demo_progress_bo_db_1",
    userKey: "bo",
    courseId: "demo_course_database_internals",
    lessonId: "demo_lesson_db_btree",
    completed: true,
    positionSeconds: 780,
    daysAgo: 18,
  },
  {
    id: "demo_progress_bo_db_2",
    userKey: "bo",
    courseId: "demo_course_database_internals",
    lessonId: "demo_lesson_db_lsm",
    completed: true,
    positionSeconds: 660,
    daysAgo: 14,
  },
  {
    id: "demo_progress_bo_db_3",
    userKey: "bo",
    courseId: "demo_course_database_internals",
    lessonId: "demo_lesson_db_wal",
    completed: true,
    positionSeconds: 720,
    daysAgo: 9,
  },
  {
    id: "demo_progress_bo_db_4",
    userKey: "bo",
    courseId: "demo_course_database_internals",
    lessonId: "demo_lesson_db_quiz",
    completed: true,
    positionSeconds: 300,
    daysAgo: 4,
  },
  {
    id: "demo_progress_cleo_db_0",
    userKey: "cleo",
    courseId: "demo_course_database_internals",
    lessonId: "demo_lesson_db_pages",
    completed: true,
    positionSeconds: 480,
    daysAgo: 16,
  },
  {
    id: "demo_progress_cleo_db_1",
    userKey: "cleo",
    courseId: "demo_course_database_internals",
    lessonId: "demo_lesson_db_btree",
    completed: false,
    positionSeconds: 180,
    daysAgo: 6,
  },
  {
    id: "demo_progress_ada_ds_0",
    userKey: "ada",
    courseId: "demo_course_distributed_consensus",
    lessonId: "demo_lesson_ds_clocks",
    completed: true,
    positionSeconds: 540,
    daysAgo: 13,
  },
  {
    id: "demo_progress_ada_ds_1",
    userKey: "ada",
    courseId: "demo_course_distributed_consensus",
    lessonId: "demo_lesson_ds_raft",
    completed: true,
    positionSeconds: 660,
    daysAgo: 8,
  },
  {
    id: "demo_progress_ada_ds_2",
    userKey: "ada",
    courseId: "demo_course_distributed_consensus",
    lessonId: "demo_lesson_ds_paxos",
    completed: false,
    positionSeconds: 615,
    daysAgo: 2,
  },
  {
    id: "demo_progress_bo_ds_0",
    userKey: "bo",
    courseId: "demo_course_distributed_consensus",
    lessonId: "demo_lesson_ds_clocks",
    completed: true,
    positionSeconds: 420,
    daysAgo: 11,
  },
  {
    id: "demo_progress_cleo_ds_0",
    userKey: "cleo",
    courseId: "demo_course_distributed_consensus",
    lessonId: "demo_lesson_ds_clocks",
    completed: true,
    positionSeconds: 480,
    daysAgo: 8,
  },
  {
    id: "demo_progress_cleo_ds_1",
    userKey: "cleo",
    courseId: "demo_course_distributed_consensus",
    lessonId: "demo_lesson_ds_raft",
    completed: true,
    positionSeconds: 720,
    daysAgo: 7,
  },
  {
    id: "demo_progress_cleo_ds_2",
    userKey: "cleo",
    courseId: "demo_course_distributed_consensus",
    lessonId: "demo_lesson_ds_paxos",
    completed: true,
    positionSeconds: 660,
    daysAgo: 6,
  },
  {
    id: "demo_progress_cleo_ds_3",
    userKey: "cleo",
    courseId: "demo_course_distributed_consensus",
    lessonId: "demo_lesson_ds_quorum",
    completed: true,
    positionSeconds: 600,
    daysAgo: 5,
  },
  {
    id: "demo_progress_cleo_ds_4",
    userKey: "cleo",
    courseId: "demo_course_distributed_consensus",
    lessonId: "demo_lesson_ds_quiz",
    completed: true,
    positionSeconds: 240,
    daysAgo: 4,
  },
  {
    id: "demo_progress_ada_sys_0",
    userKey: "ada",
    courseId: "demo_course_systems_programming",
    lessonId: "demo_lesson_sys_layout",
    completed: true,
    positionSeconds: 540,
    daysAgo: 4,
  },
  {
    id: "demo_progress_ada_sys_1",
    userKey: "ada",
    courseId: "demo_course_systems_programming",
    lessonId: "demo_lesson_sys_borrow",
    completed: false,
    positionSeconds: 180,
    daysAgo: 1,
  },
  {
    id: "demo_progress_cleo_sys_0",
    userKey: "cleo",
    courseId: "demo_course_systems_programming",
    lessonId: "demo_lesson_sys_layout",
    completed: true,
    positionSeconds: 480,
    daysAgo: 5,
  },
  {
    id: "demo_progress_cleo_sys_1",
    userKey: "cleo",
    courseId: "demo_course_systems_programming",
    lessonId: "demo_lesson_sys_borrow",
    completed: true,
    positionSeconds: 720,
    daysAgo: 3,
  },
  {
    id: "demo_progress_cleo_sys_2",
    userKey: "cleo",
    courseId: "demo_course_systems_programming",
    lessonId: "demo_lesson_sys_ffi",
    completed: true,
    positionSeconds: 540,
    daysAgo: 2,
  },
  {
    id: "demo_progress_ada_ts_0",
    userKey: "ada",
    courseId: "demo_course_type_design",
    lessonId: "demo_lesson_ts_brands",
    completed: true,
    positionSeconds: 480,
    daysAgo: 1,
  },
];

export interface DemoNotification {
  id: string;
  userKey: string;
  type: string;
  title: string;
  courseId: string;
  courseTitle: string;
  lessonId: string | null;
  summary: string;
  read: boolean;
  createdDaysAgo: number;
}

export const DEMO_NOTIFICATIONS: DemoNotification[] = [
  {
    id: "demo_notif_ada_course_db",
    userKey: "ada",
    type: "course_published",
    title: "Database Internals is now open",
    courseId: "demo_course_database_internals",
    courseTitle: "Database Internals: B-Trees, LSM Trees and Write-Ahead Logging",
    lessonId: null,
    summary: "The free storage engine course is live, with fourteen lessons across two modules.",
    read: false,
    createdDaysAgo: 4,
  },
  {
    id: "demo_notif_ada_lesson_ds",
    userKey: "ada",
    type: "lesson_published",
    title: "New lesson: Paxos and Multi-Paxos",
    courseId: "demo_course_distributed_consensus",
    courseTitle: "Distributed Systems: Consensus, Replication and Failure",
    lessonId: "demo_lesson_ds_paxos",
    summary: "Omar Haddad published a new lesson in the replication module.",
    read: false,
    createdDaysAgo: 2,
  },
  {
    id: "demo_notif_ada_enrollment_sys",
    userKey: "ada",
    type: "enrollment_confirmed",
    title: "Enrollment confirmed",
    courseId: "demo_course_systems_programming",
    courseTitle: "Systems Programming in Rust: Ownership, FFI and Zero-Copy",
    lessonId: null,
    summary: "You are enrolled in Systems Programming in Rust. Start with Memory and Ownership.",
    read: false,
    createdDaysAgo: 4,
  },
  {
    id: "demo_notif_ada_announcement_ts",
    userKey: "ada",
    type: "announcement_posted",
    title: "Office hours for the type-level track",
    courseId: "demo_course_type_design",
    courseTitle: "Type-Level Design with TypeScript",
    lessonId: null,
    summary: "Mira answers questions about template literal types every Thursday.",
    read: true,
    createdDaysAgo: 6,
  },
  {
    id: "demo_notif_ada_course_ts",
    userKey: "ada",
    type: "course_published",
    title: "Type-Level Design with TypeScript is live",
    courseId: "demo_course_type_design",
    courseTitle: "Type-Level Design with TypeScript",
    lessonId: null,
    summary: "A new course on making invalid states unrepresentable.",
    read: false,
    createdDaysAgo: 1,
  },
  {
    id: "demo_notif_mira_course_db",
    userKey: "mira",
    type: "course_published",
    title: "Your course is published",
    courseId: "demo_course_database_internals",
    courseTitle: "Database Internals: B-Trees, LSM Trees and Write-Ahead Logging",
    lessonId: null,
    summary: "The catalogue now lists your free course.",
    read: true,
    createdDaysAgo: 26,
  },
  {
    id: "demo_notif_mira_course_ts",
    userKey: "mira",
    type: "course_published",
    title: "Your course is published",
    courseId: "demo_course_type_design",
    courseTitle: "Type-Level Design with TypeScript",
    lessonId: null,
    summary: "The catalogue now lists your course.",
    read: false,
    createdDaysAgo: 6,
  },
];

export interface DemoCourseActivity {
  courseId: string;
  learnerKey: string;
  views: number;
  completes: number;
  finishCourse: boolean;
  dropLesson: number | null;
  startDayAgo: number;
}

export const DEMO_ACTIVITY: DemoCourseActivity[] = [
  {
    courseId: "demo_course_database_internals",
    learnerKey: "ada",
    views: 5,
    completes: 4,
    finishCourse: false,
    dropLesson: null,
    startDayAgo: 26,
  },
  {
    courseId: "demo_course_database_internals",
    learnerKey: "bo",
    views: 5,
    completes: 5,
    finishCourse: true,
    dropLesson: null,
    startDayAgo: 22,
  },
  {
    courseId: "demo_course_database_internals",
    learnerKey: "cleo",
    views: 3,
    completes: 1,
    finishCourse: false,
    dropLesson: 2,
    startDayAgo: 18,
  },
  {
    courseId: "demo_course_distributed_consensus",
    learnerKey: "ada",
    views: 3,
    completes: 2,
    finishCourse: false,
    dropLesson: null,
    startDayAgo: 14,
  },
  {
    courseId: "demo_course_distributed_consensus",
    learnerKey: "bo",
    views: 2,
    completes: 1,
    finishCourse: false,
    dropLesson: 1,
    startDayAgo: 12,
  },
  {
    courseId: "demo_course_distributed_consensus",
    learnerKey: "cleo",
    views: 5,
    completes: 5,
    finishCourse: true,
    dropLesson: null,
    startDayAgo: 9,
  },
  {
    courseId: "demo_course_systems_programming",
    learnerKey: "ada",
    views: 2,
    completes: 1,
    finishCourse: false,
    dropLesson: null,
    startDayAgo: 5,
  },
  {
    courseId: "demo_course_systems_programming",
    learnerKey: "bo",
    views: 1,
    completes: 0,
    finishCourse: false,
    dropLesson: 0,
    startDayAgo: 7,
  },
  {
    courseId: "demo_course_systems_programming",
    learnerKey: "cleo",
    views: 3,
    completes: 3,
    finishCourse: false,
    dropLesson: null,
    startDayAgo: 6,
  },
  {
    courseId: "demo_course_type_design",
    learnerKey: "ada",
    views: 1,
    completes: 1,
    finishCourse: false,
    dropLesson: null,
    startDayAgo: 2,
  },
  {
    courseId: "demo_course_type_design",
    learnerKey: "cleo",
    views: 1,
    completes: 0,
    finishCourse: false,
    dropLesson: 0,
    startDayAgo: 3,
  },
];

type DemoEventType = "view" | "progress" | "complete" | "drop";

export interface DemoEvent {
  id: string;
  courseId: string;
  userKey: string;
  lessonId: string | null;
  type: DemoEventType;
  positionSeconds: number;
  createdAt: Date;
}

function lessonsOfCourse(courseId: string): DemoLesson[] {
  const moduleIds = new Set(
    DEMO_MODULES.filter((module) => module.courseId === courseId).map((module) => module.id),
  );
  return DEMO_LESSONS.filter(
    (lesson) => moduleIds.has(lesson.moduleId) && lesson.status === "published",
  ).sort((a, b) => a.position - b.position);
}

/**
 * Builds the course_event rows for the last 30 days.
 *
 * Events are spread between the learner's first day and yesterday so the
 * analytics dashboard has a trend to draw, and every row gets a stable id so a
 * second run updates the same rows instead of appending new ones.
 */
export function buildCourseEvents(now: Date): DemoEvent[] {
  const events: DemoEvent[] = [];
  let counter = 0;

  for (const activity of DEMO_ACTIVITY) {
    const lessons = lessonsOfCourse(activity.courseId);
    const types: Array<{ type: DemoEventType; lessonId: string | null; positionSeconds: number }> =
      [];

    for (let index = 0; index < activity.views; index += 1) {
      const lesson = lessons[index];
      if (lesson) types.push({ type: "view", lessonId: lesson.id, positionSeconds: 0 });
    }

    const lastViewed = lessons[activity.views - 1];
    if (lastViewed) {
      types.push({
        type: "progress",
        lessonId: lastViewed.id,
        positionSeconds: 90 + activity.views * 47,
      });
    }

    for (let index = 0; index < activity.completes; index += 1) {
      const lesson = lessons[index];
      if (lesson) types.push({ type: "complete", lessonId: lesson.id, positionSeconds: 0 });
    }

    if (activity.dropLesson !== null) {
      const lesson = lessons[activity.dropLesson];
      if (lesson) types.push({ type: "drop", lessonId: lesson.id, positionSeconds: 0 });
      types.push({ type: "drop", lessonId: null, positionSeconds: 0 });
    }

    if (activity.finishCourse) {
      types.push({ type: "complete", lessonId: null, positionSeconds: 0 });
    }

    const span = Math.max(0, activity.startDayAgo - 1);

    types.forEach((entry, index) => {
      const daysAgo = Math.max(
        1,
        Math.round(activity.startDayAgo - (span * index) / Math.max(1, types.length - 1)),
      );
      counter += 1;
      events.push({
        id: `demo_event_${counter}`,
        courseId: activity.courseId,
        userKey: activity.learnerKey,
        lessonId: entry.lessonId,
        type: entry.type,
        positionSeconds: entry.positionSeconds,
        createdAt: atHour(now, daysAgo, 8 + (index % 9)),
      });
    });
  }

  return events;
}

/** A timestamp `daysAgo` days back, at a fixed hour of the day and never in the future. */
export function atHour(now: Date, daysAgo: number, hour: number): Date {
  const date = new Date(now.getTime());
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCHours(hour, (daysAgo * 17) % 60, 0, 0);
  if (date.getTime() > now.getTime()) {
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return date;
}

/** Deterministic salt so the seeded credential hashes are reproducible. */
export function demoPasswordSalt(userId: string): string {
  return createHash("sha256").update(`${userId}:${DEMO_PASSWORD}`).digest("hex").slice(0, 32);
}

export interface WriteCounts {
  created: number;
  updated: number;
}

export type SeedReport = Record<string, WriteCounts>;

export type CleanReport = Record<string, number>;

interface UpsertSpec {
  table: string;
  columns: string[];
  rows: unknown[][];
  updateColumns: string[];
  casts?: Record<string, string>;
}

/**
 * Writes rows by primary key.
 *
 * `xmax = 0` distinguishes a freshly inserted row from a row the conflict
 * clause updated, so the summary can report what the run actually changed.
 */
async function upsert(client: Client, spec: UpsertSpec): Promise<WriteCounts> {
  if (spec.rows.length === 0) {
    return { created: 0, updated: 0 };
  }

  const values: string[] = [];
  const params: unknown[] = [];

  for (const row of spec.rows) {
    const placeholders = row.map((value, index) => {
      params.push(value);
      const column = spec.columns[index] ?? "";
      const cast = spec.casts?.[column];
      return cast ? `$${params.length}::${cast}` : `$${params.length}`;
    });
    values.push(`(${placeholders.join(", ")})`);
  }

  const updates = spec.updateColumns
    .map((column) => `"${column}" = EXCLUDED."${column}"`)
    .join(", ");
  const columns = spec.columns.map((column) => `"${column}"`).join(", ");

  const result = await client.query<{ inserted: boolean }>(
    `INSERT INTO "${spec.table}" (${columns})
     VALUES ${values.join(", ")}
     ON CONFLICT (id) DO UPDATE SET ${updates}
     RETURNING (xmax = 0) AS inserted`,
    params,
  );

  let created = 0;
  let updated = 0;
  for (const row of result.rows) {
    if (row.inserted) created += 1;
    else updated += 1;
  }
  return { created, updated };
}

function scryptKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      64,
      { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });
}

/**
 * Hashes a demo password the way Better Auth stores credential passwords, so
 * the seeded personas can sign in through the regular email/password form.
 */
export async function hashDemoPassword(password: string, salt: string): Promise<string> {
  const key = await scryptKey(password, salt);
  return `${salt}:${key.toString("hex")}`;
}

export interface SeedOptions {
  now?: Date;
}

/**
 * Writes the whole demo dataset.
 *
 * Every statement upserts by primary key, so running the seed twice converges
 * on the same rows instead of duplicating them.
 */
export async function seedDemoData(client: Client, options: SeedOptions = {}): Promise<SeedReport> {
  const now = options.now ?? new Date();
  const report: SeedReport = {};

  const userRows: unknown[][] = [];
  const accountRows: unknown[][] = [];
  const profileRows: unknown[][] = [];

  for (const user of DEMO_USERS) {
    const userId = `${DEMO_ID_PREFIX}user_${user.key}`;
    const createdAt = atHour(now, user.createdDaysAgo, 10);
    userRows.push([userId, user.name, user.email, true, null, createdAt, createdAt]);
    profileRows.push([
      `${DEMO_ID_PREFIX}profile_${user.key}`,
      userId,
      user.bio,
      user.websiteUrl,
      JSON.stringify(user.socialLinks),
      null,
      createdAt,
      createdAt,
    ]);
    if (user.hasLogin) {
      const password = await hashDemoPassword(DEMO_PASSWORD, demoPasswordSalt(userId));
      accountRows.push([
        `${DEMO_ID_PREFIX}account_${user.key}`,
        userId,
        "credential",
        userId,
        password,
        createdAt,
        createdAt,
      ]);
    }
  }

  const courseById = new Map(DEMO_COURSES.map((course) => [course.id, course]));
  const courseRows = DEMO_COURSES.map((course) => {
    const createdAt = atHour(now, course.createdDaysAgo, 9);
    const publishedAt =
      course.publishedDaysAgo === null ? null : atHour(now, course.publishedDaysAgo, 9);
    return [
      course.id,
      DEMO_TENANT_ID,
      `${DEMO_ID_PREFIX}user_${course.authorKey}`,
      course.title,
      course.description,
      course.priceCents,
      course.discountPercent,
      course.isFree,
      course.status,
      1,
      publishedAt,
      createdAt,
      createdAt,
    ];
  });

  const moduleRows = DEMO_MODULES.map((module) => [
    module.id,
    module.courseId,
    module.title,
    module.position,
  ]);

  const courseByModule = new Map(
    DEMO_MODULES.map((module) => [module.id, courseById.get(module.courseId)]),
  );

  const lessonRows = DEMO_LESSONS.map((lesson) => {
    const course = courseByModule.get(lesson.moduleId);
    const updatedAt =
      course?.publishedDaysAgo === null || course?.publishedDaysAgo === undefined
        ? atHour(now, course?.createdDaysAgo ?? 7, 12)
        : atHour(now, course.publishedDaysAgo, 12);
    return [
      lesson.id,
      lesson.moduleId,
      lesson.type,
      lesson.title,
      lesson.position,
      lesson.status,
      lesson.muxPlaybackId,
      lesson.contentJson,
      null,
      null,
      updatedAt,
    ];
  });

  const enrollmentRows = DEMO_ENROLLMENTS.map((enrollment) => [
    enrollment.id,
    `${DEMO_ID_PREFIX}user_${enrollment.userKey}`,
    enrollment.courseId,
    enrollment.stripePaymentId,
    atHour(now, enrollment.enrolledDaysAgo, 12),
    1,
  ]);

  const progressRows = DEMO_PROGRESS.map((progress) => {
    const lastSeenAt = atHour(now, progress.daysAgo, 19);
    return [
      progress.id,
      DEMO_TENANT_ID,
      `${DEMO_ID_PREFIX}user_${progress.userKey}`,
      progress.lessonId,
      progress.courseId,
      progress.completed,
      progress.completed ? lastSeenAt : null,
      progress.positionSeconds,
      lastSeenAt,
    ];
  });

  const notificationRows = DEMO_NOTIFICATIONS.map((notification) => {
    const createdAt = atHour(now, notification.createdDaysAgo, 12);
    const payload = {
      title: notification.title,
      courseId: notification.courseId,
      courseTitle: notification.courseTitle,
      lessonId: notification.lessonId,
      summary: notification.summary,
      message: notification.summary,
      url: notification.lessonId
        ? `/courses/${notification.courseId}/lessons/${notification.lessonId}`
        : `/courses/${notification.courseId}`,
    };
    return [
      notification.id,
      DEMO_TENANT_ID,
      `${DEMO_ID_PREFIX}user_${notification.userKey}`,
      notification.type,
      JSON.stringify(payload),
      notification.read ? atHour(now, Math.max(0, notification.createdDaysAgo - 1), 12) : null,
      createdAt,
    ];
  });

  const eventRows = buildCourseEvents(now).map((event) => [
    event.id,
    DEMO_TENANT_ID,
    `${DEMO_ID_PREFIX}user_${event.userKey}`,
    event.courseId,
    event.lessonId,
    event.type,
    event.positionSeconds,
    event.createdAt,
  ]);

  await client.query("BEGIN");

  try {
    report.user = await upsert(client, {
      table: "user",
      columns: ["id", "name", "email", "email_verified", "image", "created_at", "updated_at"],
      rows: userRows,
      updateColumns: ["name", "email", "email_verified", "image", "updated_at"],
    });

    report.account = await upsert(client, {
      table: "account",
      columns: [
        "id",
        "account_id",
        "provider_id",
        "user_id",
        "password",
        "created_at",
        "updated_at",
      ],
      rows: accountRows,
      updateColumns: ["account_id", "provider_id", "user_id", "password", "updated_at"],
    });

    report.profiles = await upsert(client, {
      table: "profiles",
      columns: [
        "id",
        "user_id",
        "bio",
        "website_url",
        "social_links_json",
        "avatar_url",
        "created_at",
        "updated_at",
      ],
      rows: profileRows,
      updateColumns: [
        "user_id",
        "bio",
        "website_url",
        "social_links_json",
        "avatar_url",
        "updated_at",
      ],
    });

    report.courses = await upsert(client, {
      table: "courses",
      columns: [
        "id",
        "tenant_id",
        "author_id",
        "title",
        "description",
        "price_cents",
        "discount_percent",
        "is_free",
        "status",
        "version",
        "published_at",
        "created_at",
        "updated_at",
      ],
      rows: courseRows,
      updateColumns: [
        "tenant_id",
        "author_id",
        "title",
        "description",
        "price_cents",
        "discount_percent",
        "is_free",
        "status",
        "published_at",
        "updated_at",
      ],
    });

    report.modules = await upsert(client, {
      table: "modules",
      columns: ["id", "course_id", "title", "position"],
      rows: moduleRows,
      updateColumns: ["course_id", "title", "position"],
    });

    report.lessons = await upsert(client, {
      table: "lessons",
      columns: [
        "id",
        "module_id",
        "type",
        "title",
        "position",
        "status",
        "mux_playback_id",
        "content_json",
        "external_url",
        "file_key",
        "updated_at",
      ],
      rows: lessonRows,
      updateColumns: [
        "module_id",
        "type",
        "title",
        "position",
        "status",
        "mux_playback_id",
        "content_json",
        "external_url",
        "file_key",
        "updated_at",
      ],
      casts: { content_json: "jsonb" },
    });

    report.enrollments = await upsert(client, {
      table: "enrollments",
      columns: [
        "id",
        "user_id",
        "course_id",
        "stripe_payment_id",
        "enrolled_at",
        "course_version_seen",
      ],
      rows: enrollmentRows,
      updateColumns: ["user_id", "course_id", "stripe_payment_id", "enrolled_at"],
    });

    report.lesson_progress = await upsert(client, {
      table: "lesson_progress",
      columns: [
        "id",
        "tenant_id",
        "user_id",
        "lesson_id",
        "course_id",
        "completed",
        "completed_at",
        "position_seconds",
        "last_seen_at",
      ],
      rows: progressRows,
      updateColumns: [
        "tenant_id",
        "user_id",
        "lesson_id",
        "course_id",
        "completed",
        "completed_at",
        "position_seconds",
        "last_seen_at",
      ],
    });

    report.notifications = await upsert(client, {
      table: "notifications",
      columns: ["id", "tenant_id", "user_id", "type", "payload", "read_at", "created_at"],
      rows: notificationRows,
      updateColumns: ["tenant_id", "user_id", "type", "payload", "read_at"],
      casts: { payload: "jsonb" },
    });

    report.course_event = await upsert(client, {
      table: "course_event",
      columns: [
        "id",
        "tenant_id",
        "user_id",
        "course_id",
        "lesson_id",
        "type",
        "position_seconds",
        "created_at",
      ],
      rows: eventRows,
      updateColumns: [
        "tenant_id",
        "user_id",
        "course_id",
        "lesson_id",
        "type",
        "position_seconds",
        "created_at",
      ],
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  return report;
}

const CLEAN_ORDER = [
  "course_event",
  "lesson_progress",
  "notifications",
  "enrollments",
  "lessons",
  "modules",
  "courses",
  "profiles",
  "account",
  "user",
];

/**
 * Removes the rows the seed created.
 *
 * The prefix check is the only selector, so rows without a `demo_` id are
 * never touched, and the order respects the foreign keys.
 */
export async function cleanDemoData(client: Client): Promise<CleanReport> {
  const report: CleanReport = {};

  await client.query("BEGIN");

  try {
    for (const table of CLEAN_ORDER) {
      const result = await client.query(`DELETE FROM "${table}" WHERE starts_with(id, $1)`, [
        DEMO_ID_PREFIX,
      ]);
      report[table] = result.rowCount ?? 0;
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  return report;
}

export function requireDatabaseUrl(env: Record<string, string | undefined> = process.env): string {
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env in the repository root, or export DATABASE_URL, then run the seed again.",
    );
  }
  return url;
}

function redactDatabaseUrl(url: string): string {
  return url.replace(/\/\/([^:@/]+):([^@/]*)@/, "//$1:***@");
}

function printSeedReport(report: SeedReport, databaseUrl: string): void {
  console.log(`Seeded the demo dataset into ${redactDatabaseUrl(databaseUrl)}\n`);
  let created = 0;
  let updated = 0;
  for (const [table, counts] of Object.entries(report)) {
    created += counts.created;
    updated += counts.updated;
    console.log(`  ${table.padEnd(16)} ${counts.created} created, ${counts.updated} updated`);
  }
  console.log(`  ${"total".padEnd(16)} ${created} created, ${updated} updated`);
  console.log(
    `\nSign in as ${DEMO_LEARNER_EMAIL} (password ${DEMO_PASSWORD}) to see My Learning, the notification centre and the course player.`,
  );
}

function printCleanReport(report: CleanReport, databaseUrl: string): void {
  console.log(`Removed the demo dataset from ${redactDatabaseUrl(databaseUrl)}\n`);
  let removed = 0;
  for (const [table, count] of Object.entries(report)) {
    removed += count;
    console.log(`  ${table.padEnd(16)} ${count} removed`);
  }
  console.log(`  ${"total".padEnd(16)} ${removed} removed`);
}

async function run(argv: string[]): Promise<void> {
  const clean = argv.includes("--clean");
  const databaseUrl = requireDatabaseUrl();
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();
  try {
    if (clean) {
      printCleanReport(await cleanDemoData(client), databaseUrl);
    } else {
      printSeedReport(await seedDemoData(client), databaseUrl);
    }
  } finally {
    await client.end();
  }
}

const isEntryPoint = (import.meta as ImportMeta & { main?: boolean }).main === true;

if (isEntryPoint) {
  run(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
