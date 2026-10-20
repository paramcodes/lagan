import { createInterface } from "node:readline/promises";

export interface Choice {
  id: string;
  label: string;
}

export interface Prompter {
  ask(question: string, fallback: string): Promise<string>;
  confirm(question: string, fallback: boolean): Promise<boolean>;
  choose(question: string, choices: Choice[], fallback: string[]): Promise<string[]>;
  close(): void;
}

/**
 * The prompter that takes the default for every question.
 *
 * It is what a script run without a terminal uses, and it is what the tests use, so the
 * bootstrap has one path and not two.
 */
export class StaticPrompter implements Prompter {
  async ask(_question: string, fallback: string): Promise<string> {
    return fallback;
  }

  async confirm(_question: string, fallback: boolean): Promise<boolean> {
    return fallback;
  }

  async choose(_question: string, _choices: Choice[], fallback: string[]): Promise<string[]> {
    return fallback;
  }

  close(): void {}
}

export class TerminalPrompter implements Prompter {
  private readonly rl = createInterface({ input: process.stdin, output: process.stdout });

  async ask(question: string, fallback: string): Promise<string> {
    const answer = (await this.rl.question(`${question} [${fallback}] `)).trim();
    return answer.length > 0 ? answer : fallback;
  }

  async confirm(question: string, fallback: boolean): Promise<boolean> {
    const hint = fallback ? "Y/n" : "y/N";
    const answer = (await this.rl.question(`${question} [${hint}] `)).trim().toLowerCase();
    if (answer.length === 0) return fallback;
    return answer === "y" || answer === "yes";
  }

  async choose(question: string, choices: Choice[], fallback: string[]): Promise<string[]> {
    console.log(question);
    choices.forEach((choice, index) => {
      console.log(`  ${index + 1}. ${choice.label}`);
    });
    const answer = (await this.rl.question(`Which ones? [${fallback.join(", ")}] `)).trim();
    if (answer.length === 0) return fallback;
    if (answer.toLowerCase() === "all") return choices.map((choice) => choice.id);
    if (answer.toLowerCase() === "none") return [];

    const picked: string[] = [];
    for (const part of answer.split(",")) {
      const trimmed = part.trim();
      if (trimmed.length === 0) continue;
      const byIndex = Number.parseInt(trimmed, 10);
      const choice = Number.isNaN(byIndex)
        ? choices.find((item) => item.id === trimmed)
        : choices[byIndex - 1];
      if (!choice) continue;
      if (!picked.includes(choice.id)) picked.push(choice.id);
    }
    return picked;
  }

  close(): void {
    this.rl.close();
  }
}
