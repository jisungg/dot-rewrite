export type ResponseStyle = "concise" | "balanced" | "explanatory";
export type ThemePreference = "system" | "light" | "dark";

export type UserPreferences = {
  theme: ThemePreference;
  response_style: ResponseStyle;
  auto_summaries: boolean;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
  response_style: "balanced",
  auto_summaries: true,
};

export type Profile = {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
  preferences: UserPreferences;
};

export type Space = {
  id: string;
  user_id: string;
  name: string;
  code: string;
  color: string;
  color_light: string;
  created_at: string;
};

export type NoteCache = {
  summary: string;
  keywords: string[];
  embedding: number[];
  related_note_ids: string[];
  agent_responses: Record<string, string>;
  auto_tags: string[];
  updated_at: string | null;
};

export type Note = {
  id: string;
  user_id: string;
  space_id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  processed: boolean;
  created_at: string;
  last_modified_at: string;
  archived: boolean;
  cache?: NoteCache;
};

export type Message = {
  id: string;
  space_id: string;
  user_id: string;
  role: "user" | "dot";
  content: string;
  timestamp: string;
};

export type Views = "home" | "space";
export type HomeSectionViewports = "editor" | "editEditor" | "notes" | "nexus";
export type SpaceSectionViewports = "dot" | "outline" | "tl;dr";
export type BottomSectionViewports = "settings" | "logOut" | "backToHome";
export type AllViewports =
  | HomeSectionViewports
  | SpaceSectionViewports
  | BottomSectionViewports;

export type RenderOptions = {
  handleEdit?: {
    toEdit: Note;
    toSpace: Space;
  };
};

// Back-compat aliases (source used lowercase type names)
export type views = Views;
export type allViewports = AllViewports;
export type renderOptions = RenderOptions;

export const AgentInformation = {
  name: "Dot",
  id: "dot",
  description: "Dot helps you understand and review your notes.",
  input: "Questions, reflections, requests based on your notes / space.",
  output: "Answers, summaries, insights based on your notes.",
  parameter:
    "tone (default: neutral, options: reflective, casual, motivational)",
  context:
    "Dot isn't just chatty — it's built for the big stuff. When your notes start getting complex, Dot helps you sort through the tangle, spot hidden links, and push your ideas into new territory.",
  inputFields: [
    {
      name: "prompt",
      type: "textarea" as const,
      label: "Questions, reflections, requests based on your notes.",
      description:
        "i.e.) “Find common themes across my notes for my essay on the Industrial Revolution.”",
      placeholder: `Ask Dot anything about your notes or thoughts :

Examples:
- "What exactly did Prof. Smith go over in Chapter 2 of Discrete Mathematics?"
- "Can you help me summarize my all my thoughts on startup ideas?"
- "What patterns do you notice in my recent entries?"
- "Procure an essay using all the notes in this space that explores the depth of individualism in history."`,
    },
    {
      name: "prompt",
      type: "select" as const,
      label: "Focus on a specific note or all the notes in your space.",
      description:
        "Use the dropdown to specify a specific note for Dot to focus on.",
      placeholder: "Select a note",
    },
  ],
  resultTabs: ["chat", "summary", "insights"],
  steps: ["Retrieve", "Reflect", "Respond"],
  capabilities: [
    "Natural language conversation over personal notes",
    "Smart summarization of themes and ideas",
    "Pattern and trend recognition",
    "Context-aware responses with minimal input",
    "Supports reflective and emotional tone",
    "Search-free memory (works even without explicit keywords)",
    "Responsive to vague or fuzzy prompts",
  ],
  averageTime: 34,
} as const;
