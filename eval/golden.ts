import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const CATEGORIES = [
  "direct",
  "multi_source",
  "ambiguous",
  "unanswerable",
  "adversarial",
] as const;

export const BEHAVIOURS = ["answer", "refuse", "conflict"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Behaviour = (typeof BEHAVIOURS)[number];

export type Golden = {
  id: string;
  category: Category;
  question: string;
  behaviour: Behaviour;
  mustContain: string[];
  mustNotClaim: string[];
  notes?: string;
};

const goldenPath = fileURLToPath(new URL("./golden.json", import.meta.url));

export const goldens: Golden[] = JSON.parse(
  readFileSync(goldenPath, "utf8"),
) as Golden[];

export function isRefusal(golden: Golden): boolean {
  return golden.behaviour === "refuse";
}

export function contractText(golden: Golden): string {
  return [
    "This is a grading rubric, not a sample answer.",
    `Required behaviour: ${golden.behaviour}`,
    formatList("Required facts (paraphrase OK)", golden.mustContain),
    formatList("Banned assertions", golden.mustNotClaim),
    "Extra facts from retrieval context are allowed and should not lower the score.",
  ].join("\n\n");
}

function formatList(heading: string, items: string[]): string {
  const present = items.filter((item) => item.trim().length > 0);
  const body =
    present.length > 0 ? present.map((item) => `- ${item}`).join("\n") : "(none)";
  return `${heading}:\n${body}`;
}
