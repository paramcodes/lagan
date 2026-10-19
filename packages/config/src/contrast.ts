import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface ColorToken {
  $type: string;
  $value: string;
}

export interface ContrastRule {
  name: string;
  foreground: string;
  background: string;
  minRatio: number;
  wcagCriterion: "SC 1.4.3 (4.5:1)" | "SC 1.4.11 (3.0:1)";
  description: string;
}

export interface VerificationResult {
  rule: ContrastRule;
  ratio: number;
  passed: boolean;
}

function channelToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Calculates relative luminance for an sRGB hex code per WCAG 2.1 / 2.2 specifications:
 * https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
 */
export function relativeLuminance(hex: string): number {
  const cleanHex = hex.replace(/^#/, "");
  if (cleanHex.length !== 6) {
    throw new Error(`Invalid hex color: "${hex}". Expected 6-character hex.`);
  }

  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

/**
 * Computes contrast ratio between two hex colors per WCAG 2.1 / 2.2:
 * (L1 + 0.05) / (L2 + 0.05) where L1 is lighter and L2 is darker.
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const lum1 = relativeLuminance(hex1);
  const lum2 = relativeLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function loadColorTokens(tokensPath?: string): Record<string, string> {
  const file = tokensPath ?? resolve(process.cwd(), "tokens/tokens.json");
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const colors: Record<string, string> = {};
  if (raw.color && typeof raw.color === "object") {
    for (const [key, val] of Object.entries(raw.color)) {
      if (val && typeof val === "object" && "$value" in val) {
        colors[key] = (val as ColorToken).$value;
      }
    }
  }
  return colors;
}

/**
 * Default contrast rules enforced across Lagan tokens per ADR-0010:
 * - Normal body text: >= 4.5:1 (WCAG 2.2 AA SC 1.4.3)
 * - Operable control boundaries: >= 3.0:1 (WCAG 2.2 AA SC 1.4.11)
 */
export function getStandardContrastRules(colors: Record<string, string>): ContrastRule[] {
  const backgrounds = [
    { name: "surface", hex: colors.surface },
    { name: "canvas", hex: colors.canvas },
  ];

  const textTokens = [
    { name: "ink", desc: "Primary text & headings" },
    { name: "ink2", desc: "Secondary text & labels" },
    { name: "brand", desc: "Primary brand actions & links" },
    { name: "due", desc: "Due date warnings & amber status" },
    { name: "alert", desc: "Error messages & destructive alerts" },
    { name: "accent", desc: "Focus rings & accent links" },
  ];

  const rules: ContrastRule[] = [];

  for (const bg of backgrounds) {
    if (!bg.hex) continue;
    for (const text of textTokens) {
      const fg = colors[text.name];
      if (fg) {
        rules.push({
          name: `${text.name} on ${bg.name}`,
          foreground: fg,
          background: bg.hex,
          minRatio: 4.5,
          wcagCriterion: "SC 1.4.3 (4.5:1)",
          description: `${text.desc} on ${bg.name}`,
        });
      }
    }

    if (colors.edge) {
      rules.push({
        name: `edge on ${bg.name}`,
        foreground: colors.edge,
        background: bg.hex,
        minRatio: 3.0,
        wcagCriterion: "SC 1.4.11 (3.0:1)",
        description: `Operable control boundary on ${bg.name}`,
      });
    }
  }

  if (colors.ink && colors.chalk) {
    rules.push({
      name: "ink on chalk",
      foreground: colors.ink,
      background: colors.chalk,
      minRatio: 4.5,
      wcagCriterion: "SC 1.4.3 (4.5:1)",
      description: "Text on highlight/chalk fill",
    });
  }
  return rules;
}

export function verifyContrastRules(rules: ContrastRule[]): {
  results: VerificationResult[];
  passed: boolean;
} {
  const results = rules.map((rule) => {
    const ratio = contrastRatio(rule.foreground, rule.background);
    return { rule, ratio, passed: ratio >= rule.minRatio };
  });

  return { results, passed: results.every((r) => r.passed) };
}
