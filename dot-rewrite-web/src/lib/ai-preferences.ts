import type { ResponseStyle } from "@/data/types";

export const SAMPLE_PROMPT = "Summarize my notes on the French Revolution.";

export const SAMPLE_RESPONSES: Record<ResponseStyle, string> = {
  concise:
    "Causes: fiscal crisis, inequality, Enlightenment ideas. Outcome: monarchy fell, republic declared, Napoleon rose.",
  balanced:
    "Your notes trace the Revolution to a fiscal crisis and Enlightenment-driven discontent with the Ancien Régime. Key beats: Estates-General (1789), fall of the Bastille, Reign of Terror, and Napoleon's rise closing the cycle.",
  explanatory:
    "Your notes frame the French Revolution as the collision of a bankrupt monarchy, rigid social hierarchy, and Enlightenment thought. The financial crisis forced Louis XVI to convene the Estates-General in 1789; that opening cascaded into the Tennis Court Oath, the storming of the Bastille, and the Declaration of the Rights of Man. The Revolution then radicalized through the Jacobins and the Reign of Terror before Thermidor, ending with Napoleon consolidating power — a reminder in your notes that revolutions often end by restoring order under new names.",
};

export const RESPONSE_STYLE_META: {
  id: ResponseStyle;
  label: string;
  blurb: string;
}[] = [
  { id: "concise", label: "Concise", blurb: "Short, direct answers." },
  { id: "balanced", label: "Balanced", blurb: "A measured middle ground." },
  {
    id: "explanatory",
    label: "Explanatory",
    blurb: "Longer, with context and reasoning.",
  },
];
