import { auth } from "@/lib/firebase";
import type { LearningChatSource } from "@/lib/learning-chat/constants";

/** What the Learning Assistant sends back: the answer and the materials it used. */
export type LearningChatReply = {
  text: string;
  sources: LearningChatSource[];
};

export async function postLearningChat(opts: {
  message: string;
  focusSessionId?: string;
  pathname?: string;
  cohortId?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<LearningChatReply> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sign in to use the learning assistant");

  const res = await fetch("/api/learning-chat", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(opts),
  });

  const json = (await res.json()) as {
    ok?: boolean;
    data?: { text?: string; sources?: LearningChatSource[] };
    error?: string;
  };

  if (!res.ok || !json.ok) {
    throw new Error(json.error || "Learning chat request failed");
  }

  return {
    text: json.data?.text || "Done.",
    sources: Array.isArray(json.data?.sources) ? json.data.sources : [],
  };
}
