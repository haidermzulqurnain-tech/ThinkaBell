export type StabilityLevel = "high" | "medium" | "low" | "unknown";

export interface ProgramStabilityResult {
  level: StabilityLevel;
  score: number;
  notes: string[];
}

const HIGH_STABILITY_KEYWORDS = ["established", "fortune 500", "public", "years in business", "accredited"];
const MEDIUM_STABILITY_KEYWORDS = ["growing", "profitable", "funded", "b2b", "enterprise"];
const LOW_STABILITY_KEYWORDS = ["startup", "pre-revenue", "seed", "new", "unproven"];

export function calculateProgramStability(notes?: string | null): ProgramStabilityResult {
  const text = (notes || "").toLowerCase();

  if (!text || text.length === 0) {
    return {
      level: "unknown",
      score: 50,
      notes: ["No stability information available yet."],
    };
  }

  const notesList: string[] = [];
  let score = 50;

  const highCount = HIGH_STABILITY_KEYWORDS.filter((keyword) => text.includes(keyword)).length;
  const mediumCount = MEDIUM_STABILITY_KEYWORDS.filter((keyword) => text.includes(keyword)).length;
  const lowCount = LOW_STABILITY_KEYWORDS.filter((keyword) => text.includes(keyword)).length;

  if (highCount > 0) {
    score = Math.min(100, score + highCount * 15);
    notesList.push("Program shows strong stability indicators.");
  }

  if (mediumCount > 0) {
    score = Math.min(100, score + mediumCount * 10);
    notesList.push("Program shows moderate stability indicators.");
  }

  if (lowCount > 0) {
    score = Math.max(0, score - lowCount * 10);
    notesList.push("Program shows early-stage or unproven indicators.");
  }

  if (score >= 75) {
    return { level: "high", score, notes: notesList.length > 0 ? notesList : ["Program appears stable."] };
  }
  if (score >= 50) {
    return { level: "medium", score, notes: notesList.length > 0 ? notesList : ["Program stability is moderate."] };
  }
  return { level: "low", score, notes: notesList.length > 0 ? notesList : ["Program appears to have stability concerns."] };
}
