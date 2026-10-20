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
