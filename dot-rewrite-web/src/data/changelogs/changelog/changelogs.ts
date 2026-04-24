export type ChangelogEntry = {
  version: string;
  date: string;
  title: string;
  description: string;
  changes: string[];
  tag: "Feature" | "Improvement" | "Fix";
};

export const entries: ChangelogEntry[] = [
  {
    version: "v1.0.0",
    date: "March 28, 2025",
    title: ".note Beta Launch",
    description: "Introducing the beta version of .note.",
    changes: [
      "Collaborative note-taking",
      "Real-time syncing across devices",
      "Markdown support for formatting",
      "Basic analytics for study tracking",
      "Cross-platform compatibility",
    ],
    tag: "Feature",
  },
];
