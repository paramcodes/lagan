import Link from "next/link";
import { Terminal } from "lucide-react";

export function CodeSandboxPreview() {
  return (
    <div className="mt-16 mx-auto max-w-4xl">
      <div className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-2 shadow-xs sm:p-4">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-3 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[var(--color-line)]" />
            <span className="h-3 w-3 rounded-full bg-[var(--color-line)]" />
            <span className="h-3 w-3 rounded-full bg-[var(--color-line)]" />
            <span className="ml-2 font-mono text-xs text-[var(--color-edge)]">
              storage/engine/btree.rs — Write-Ahead Log & B-Tree Node Split
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-chip)] bg-[var(--color-canvas)] px-2.5 py-0.5 font-mono text-[11px] text-[var(--color-edge)]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Active Sandbox
          </span>
        </div>

        <div className="overflow-x-auto p-4 font-mono text-xs sm:text-sm leading-relaxed text-[var(--color-ink)]">
          <pre className="text-[var(--color-ink)]">
            <code>
              <span className="text-[var(--color-edge)]">
                {"// Concurrent write-ahead logging with monotonic LSN sequence"}
              </span>
              {"\n"}
              <span className="font-semibold text-[var(--color-accent)]">pub fn</span>{" "}
              <span className="font-semibold">split_child</span>
              {"(&mut self, idx: usize, child: &mut BTreeNode) -> Result<LogSeqNum> {"}
              {"\n"}
              {"    "}
              <span className="text-[var(--color-edge)]">
                {"// Enforce WAL record before dirty page modification"}
              </span>
              {"\n"}
              {"    "}
              <span className="font-semibold text-[var(--color-accent)]">let</span> lsn =
              self.wal.append_record(WalRecord::SplitChild {"{"} idx, page_id: child.id{" "}
              {"}"})?;
              {"\n"}
              {"    "}
              <span className="font-semibold text-[var(--color-accent)]">let mut</span>{" "}
              right_sibling = BTreeNode::allocate(self.degree, child.is_leaf)?;
              {"\n"}
              {"    "}right_sibling.keys = child.keys.split_off(self.degree - 1);
              {"\n"}
              {"    "}child.set_page_lsn(lsn);
              {"\n"}
              {"    "}
              <span className="font-semibold text-[var(--color-accent)]">Ok</span>(lsn)
              {"\n"}
              {"}"}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-[var(--color-line)] bg-[var(--color-surface)] py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-brand)] text-[var(--color-surface)]">
              <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
            <span className="font-bold tracking-tight text-[var(--color-ink)]">Lagan</span>
            <span className="text-xs text-[var(--color-edge)]">— Systems Engineering LMS</span>
          </div>

          <nav
            className="flex items-center gap-6 text-sm text-[var(--color-edge)]"
            aria-label="Footer Navigation"
          >
            <Link href="/courses" className="transition-colors hover:text-[var(--color-ink)]">
              Courses
            </Link>
            <Link href="/sign-in" className="transition-colors hover:text-[var(--color-ink)]">
              Sign In
            </Link>
          </nav>

          <p className="text-xs text-[var(--color-edge)]">
            &copy; 2026 Lagan LMS. Built for systems engineering.
          </p>
        </div>
      </div>
    </footer>
  );
}
