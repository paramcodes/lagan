export const LEARN_VIEWS = ["cards", "ledger"] as const;
export type LearnView = (typeof LEARN_VIEWS)[number];

export const DEFAULT_LEARN_VIEW: LearnView = "cards";

export type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseLearnView(value: string | string[] | undefined): LearnView {
  const str = Array.isArray(value) ? value[0] : value;
  return str === "ledger" ? "ledger" : "cards";
}
