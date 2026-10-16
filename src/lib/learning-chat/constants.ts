export const SESSION_LEARNING_MATERIALS_COLLECTION = "sessionLearningMaterials";

export type LearningChatHistoryTurn = {
  role: "user" | "assistant";
  content: string;
};

export type LearningChatContext = {
  uid: string;
  email?: string;
  role: string;
  cohortId: string;
  focusSessionId?: string;
  pathname?: string;
  history?: LearningChatHistoryTurn[];
};

/** A piece of course material the assistant used to answer (shown as "From: …"). */
export type LearningChatSource = {
  materialId: string;
  title: string;
  kind: string;
  sessionId: string;
  /** Session the material belongs to, e.g. "Scale — Workshop". */
  sessionTitle?: string;
  /** Link to the material (slides, video, PDF) when one exists. */
  url?: string;
};

export type LearningChatResult = {
  text?: string;
  sources?: LearningChatSource[];
  error?: string;
};

export const LEARNING_CHAT_WELCOME =
  "Hi. I can help with this lesson, explain what's on screen, find related course material, and help draft feedback or corrections.";

export const LEARNING_QUICK_PROMPTS: Array<{
  id: string;
  label: string;
  message: string;
  category: "ask" | "summarize" | "translate";
}> = [
  {
    id: "ask-concept",
    label: "Ask",
    category: "ask",
    message:
      "I am stuck on a concept from this session. Explain it clearly with an example from our programme materials.",
  },
  {
    id: "summarize",
    label: "Summarize",
    category: "summarize",
    message: "What are the key takeaways in this lesson? Summarise the main points from the materials.",
  },
  {
    id: "translate",
    label: "Translate",
    category: "translate",
    message:
      "Please explain the key ideas from this lesson in simple language. If I ask in another language later, reply in that language.",
  },
  {
    id: "kickoff",
    label: "Kickoff coverage",
    category: "ask",
    message: "What was covered in the kickoff session, and what should I prepare for week 1?",
  },
  {
    id: "mcp",
    label: "Explain MCP",
    category: "ask",
    message:
      "Explain MCP in the context of our sessions. Which session covers it and what should I practise?",
  },
  {
    id: "resources",
    label: "Find materials",
    category: "ask",
    message: "List available PDFs, transcripts, and videos for the active cohort sessions.",
  },
];
