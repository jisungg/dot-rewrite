export function truncate(str: string, { length }: { length: number }): string {
  if (!str) return "";
  return str.length <= length ? str : str.substring(0, length) + "...";
}

export function getInitials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function capitalizeWords(str: string): string {
  return str
    .split(" ")
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

export function generateCopyTitle(
  originalTitle: string,
  existingTitles: string[],
): string {
  const base = originalTitle.replace(/\s+\(copy(?:\s*\d*)?\)$/i, "").trim();
  const lowerExisting = existingTitles.map((t) => t.toLowerCase());

  let copyNumber = 0;
  while (true) {
    const suffix = copyNumber === 0 ? " (copy)" : ` (copy ${copyNumber + 1})`;
    const candidate = (base + suffix).toLowerCase();

    if (!lowerExisting.includes(candidate)) {
      return base + suffix;
    }
    copyNumber++;
  }
}

export const getDisplayTextFromHistory = (
  parsedItem: Record<string, unknown>,
): string => {
  for (const value of Object.values(parsedItem)) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return "Empty input";
};

export const formatDisplayText = (text: string): string =>
  text.length > 50 ? `${text.slice(0, 50)}...` : text;

export const loadingMessages = [
  "Analyzing content...",
  "Processing thoughts...",
  "Summarizing ideas...",
  "Reviewing entries...",
  "Scanning for context...",
  "Looking through details...",
  "Preparing response...",
  "Organizing notes...",
  "Checking content...",
] as const;

export function getRandomLoadingMessage(): string {
  return loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
}

export function formatAgentType(agentType: string): string {
  if (agentType === "textarea") return "Text Input";
  return agentType.charAt(0).toUpperCase() + agentType.slice(1);
}
