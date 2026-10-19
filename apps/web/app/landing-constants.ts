export const FEATURE_PILLARS = [
  {
    title: "Interactive Editor",
    description:
      "Sandboxed in-browser runtimes with real-time feedback, automated test suites, and hands-on systems verification exercises.",
    badge: "Hands-on Sandboxes",
  },
  {
    title: "Video Player",
    description:
      "Adaptive HLS video streaming featuring precise frame stepping, synchronized code transcripts, and keyboard-driven playback control.",
    badge: "Adaptive Streaming",
  },
  {
    title: "In-depth Curriculum",
    description:
      "Uncompromising course architectures diving deep into storage engines, consensus protocols, query compilers, and kernel abstractions.",
    badge: "Production Systems",
  },
  {
    title: "Author Analytics",
    description:
      "Actionable learning analytics and cohort tracking for instructors to diagnose concept drop-off and optimize curriculum pacing.",
    badge: "Cohort Telemetry",
  },
] as const;

export const TOPIC_BADGES = [
  "Postgres 18 Internals",
  "Raft & Paxos Consensus",
  "LSM-Tree Storage Engines",
  "eBPF & Kernel Tracing",
  "Zero-Allocation Networking",
  "Lock-Free Concurrency",
] as const;

export const CURRICULUM_TRACKS = [
  {
    title: "Database Internals: Storage Engines",
    tag: "Storage",
    lessons: "14 Lessons",
    level: "Advanced",
  },
  {
    title: "Distributed Systems: Consensus & Fault Tolerance",
    tag: "Distributed",
    lessons: "18 Lessons",
    level: "Mastery",
  },
  {
    title: "Systems Programming in Rust & C",
    tag: "Kernel",
    lessons: "12 Lessons",
    level: "Intermediate",
  },
  {
    title: "High-Throughput Network Architectures",
    tag: "Networking",
    lessons: "10 Lessons",
    level: "Advanced",
  },
] as const;

export const PEDAGOGY_ITEMS = [
  "Zero-magic codebases: trace from system call to storage block",
  "Deterministic failure injection for distributed state machines",
  "Flamegraph profiling and hardware cache performance analysis",
  "Author verification gates enforcing WCAG contrast and token standards",
] as const;
