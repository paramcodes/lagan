import { describe, expect, it } from "vitest";
import { createSuppressionStore, InMemorySuppressionStore, normalizeEmail } from "./suppression";

describe("Suppression Store", () => {
  describe("normalizeEmail", () => {
    it("lowercases and trims email addresses", () => {
      expect(normalizeEmail("  User@Example.COM  ")).toBe("user@example.com");
    });
  });

  describe("InMemorySuppressionStore", () => {
    it("handles initial entries", () => {
      const store = new InMemorySuppressionStore([
        "alice@example.com",
        {
          email: "BOB@example.com",
          reason: "bounce",
          suppressedAt: new Date("2026-01-01"),
        },
      ]);

      expect(store.isSuppressed("alice@example.com")).toBe(true);
      expect(store.isSuppressed("ALICE@EXAMPLE.COM")).toBe(true);
      expect(store.isSuppressed("bob@example.com")).toBe(true);
      expect(store.isSuppressed("charlie@example.com")).toBe(false);
    });

    it("suppresses and unsuppresses addresses", () => {
      const store = createSuppressionStore();

      expect(store.isSuppressed("learner@example.com")).toBe(false);

      store.suppress("learner@example.com", "unsubscribe", {
        source: "settings_toggle",
      });

      expect(store.isSuppressed("LEARNER@EXAMPLE.COM")).toBe(true);

      const record = store.getRecord("learner@example.com");
      expect(record).not.toBeNull();
      expect(record?.reason).toBe("unsubscribe");
      expect(record?.metadata).toEqual({ source: "settings_toggle" });

      store.unsuppress("learner@example.com");
      expect(store.isSuppressed("learner@example.com")).toBe(false);
      expect(store.getRecord("learner@example.com")).toBeNull();
    });

    it("lists all records and clears the store", () => {
      const store = createSuppressionStore(["one@example.com", "two@example.com"]);

      expect(store.listAll()).toHaveLength(2);

      store.clear();
      expect(store.listAll()).toHaveLength(0);
      expect(store.isSuppressed("one@example.com")).toBe(false);
    });
  });
});
