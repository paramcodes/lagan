import type { SuppressionReason, SuppressionRecord, SuppressionStore } from "./types";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class InMemorySuppressionStore implements SuppressionStore {
  private readonly records = new Map<string, SuppressionRecord>();

  constructor(initialEntries?: (string | SuppressionRecord)[] | undefined) {
    if (initialEntries) {
      for (const entry of initialEntries) {
        if (typeof entry === "string") {
          this.suppress(entry, "manual");
        } else {
          this.records.set(normalizeEmail(entry.email), {
            ...entry,
            email: normalizeEmail(entry.email),
          });
        }
      }
    }
  }

  isSuppressed(email: string): boolean {
    return this.records.has(normalizeEmail(email));
  }

  suppress(
    email: string,
    reason: SuppressionReason = "manual",
    metadata?: Record<string, unknown> | undefined,
  ): void {
    const normalized = normalizeEmail(email);
    const record: SuppressionRecord = {
      email: normalized,
      reason,
      suppressedAt: new Date(),
    };
    if (metadata !== undefined) {
      record.metadata = metadata;
    }
    this.records.set(normalized, record);
  }

  unsuppress(email: string): void {
    this.records.delete(normalizeEmail(email));
  }

  getRecord(email: string): SuppressionRecord | null {
    return this.records.get(normalizeEmail(email)) ?? null;
  }

  listAll(): SuppressionRecord[] {
    return Array.from(this.records.values());
  }

  clear(): void {
    this.records.clear();
  }
}

export function createSuppressionStore(
  initialEntries?: (string | SuppressionRecord)[] | undefined,
): InMemorySuppressionStore {
  return new InMemorySuppressionStore(initialEntries);
}
