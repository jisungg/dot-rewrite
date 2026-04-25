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

export type SpaceSummaryCache = {
  summary?: string;
  content_hash?: string;
  updated_at?: string | null;
};

export type Space = {
  id: string;
  user_id: string;
  name: string;
  code: string;
  color: string;
  color_light: string;
  created_at: string;
  summary_cache?: SpaceSummaryCache | null;
};

export type OutlineHeading = { level: number; text: string };

export type UnderstandQuestionKind =
  | "explain"
  | "apply"
  | "connect"
  | "example";

export type UnderstandQuestion = {
  id: string;
  kind: UnderstandQuestionKind;
  prompt: string;
  hint?: string | null;
  reference: string; // private — used only for evaluation
  related_note_ids?: string[];
};

export type UnderstandPack = {
  questions: UnderstandQuestion[];
  content_hash: string;
  related_note_ids: string[];
  updated_at: string | null;
};

export type UnderstandEvaluation = {
  score: number;        // 0..1
  hits: string[];
  misses: string[];
  feedback: string;
};

export type ExamDifficulty = "medium" | "hard" | "challenge";

export type ExamQuestion = {
  id: string;
  prompt: string;
  reference: string;          // private — stripped before reaching client
  source_note_ids: string[];
  points: number;
  difficulty: ExamDifficulty;
};

export type ExamPerQuestionResult = {
  question_id: string;
  score: number;            // 0..1
  points_earned: number;
  hits: string[];
  misses: string[];
  feedback: string;
};

export type ExamEvaluation = {
  per_question: ExamPerQuestionResult[];
  total_points: number;
  earned_points: number;
  overall: string;
};

export type ExamSession = {
  id: string;
  user_id: string;
  space_id: string;
  scope_note_ids: string[];
  // Client copy: `reference` field is stripped on the wire.
  questions: Array<Omit<ExamQuestion, "reference">>;
  answers: Record<string, string>;
  evaluation: ExamEvaluation | null;
  duration_seconds: number;
  started_at: string;
  finished_at: string | null;
  status: "active" | "submitted" | "abandoned";
};

export type NoteCache = {
  summary?: string;
  outline?: OutlineHeading[];
  understand?: UnderstandPack;
  content_hash?: string;
  keywords?: string[];
  embedding?: number[];
  related_note_ids?: string[];
  agent_responses?: Record<string, string>;
  auto_tags?: string[];
  updated_at?: string | null;
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
export type SpaceSectionViewports =
  | "dot"
  | "outline"
  | "tl;dr"
  | "relationships"
  | "understand"
  | "exam";
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

// ============================================================
// Engine analysis outputs (read-only from engine-owned tables)
// ============================================================

export type SimEdge = {
  space_id: string;
  src_note_id: string;
  dst_note_id: string;
  weight: number;
  confidence: number;
  views_supporting: number;
};

export type TopicClusterRow = {
  id: string;
  space_id: string;
  stable_id: string | null;
  label: string | null;
  keywords: string[];
  note_ids: string[];
  centroid_terms: string[];
  structural_certainty: number;
};

export type TopicSubclusterRow = {
  id: string;
  space_id: string;
  parent_id: string;
  label: string | null;
  keywords: string[];
  note_ids: string[];
};

export type ConfusionPairRow = {
  space_id: string;
  topic_a: string;
  topic_b: string;
  score: number;
  closeness: number;
  separability: number;
  interpretive_confidence: number;
  shared_core_terms: string[];
  discriminators_a: string[];
  discriminators_b: string[];
};

export type ConceptHubRow = {
  space_id: string;
  term: string;
  degree: number;
  note_ids: string[];
};

export type NoteDiagnosticRow = {
  space_id: string;
  note_id: string;
  prereq_gap: number;
  integration: number;
  is_isolated: boolean;
  is_foundational: boolean;
  is_bridge: boolean;
};

export type StudyStateEdgeRow = {
  space_id: string;
  src_node_id: string;
  dst_node_id: string;
  kind: string;
  weight: number;
};

export type SemanticEdgeRow = {
  space_id: string;
  src_note_id: string;
  dst_note_id: string;
  similarity: number;
  mutual: boolean;
};

export type SemanticClusterRow = {
  id: string;
  space_id: string;
  stable_id: string | null;
  label: string | null;
  keywords: string[];
  note_ids: string[];
  cohesion: number;
  parent_topic: string | null;
  hierarchy_path: string[];
  evidence_terms: string[];
  excluded_terms: string[];
  secondary_topics: string[];
  llm_confidence: number;
  source: string;
};

export type TopicHierarchyPathRow = {
  space_id: string;
  path: string[];
};

export type UngroupedNoteRow = {
  space_id: string;
  note_id: string;
  title: string;
  reason: string;
};

export type SpaceRelationships = {
  semanticClusters: SemanticClusterRow[];
  semanticEdges: SemanticEdgeRow[];
  hierarchyPaths: TopicHierarchyPathRow[];
  ungrouped: UngroupedNoteRow[];
  topics: TopicClusterRow[];
  subclusters: TopicSubclusterRow[];
  confusion: ConfusionPairRow[];
  hubs: ConceptHubRow[];
  diagnostics: NoteDiagnosticRow[];
  prereqEdges: StudyStateEdgeRow[];
};

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
  averageTime: 8,
} as const;
