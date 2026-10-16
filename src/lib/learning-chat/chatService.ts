import "server-only";

import { generateText, stepCountIs } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  formatLearningGeminiError,
  getLearningGeminiApiKey,
  getLearningGeminiModelId,
} from "@/lib/learning-chat/geminiConfig";
import type {
  LearningChatContext,
  LearningChatResult,
  LearningChatSource,
} from "@/lib/learning-chat/constants";
import { buildLearningChatTools } from "@/lib/learning-chat/tools";
import {
  buildLearningChatSystemPrompt,
  isLikelyOutOfScopeLearningQuery,
  LEARNING_CHAT_REFUSE_MESSAGE,
} from "@/lib/learning-chat/scope";

const MAX_TOOL_STEPS = 8;
const MAX_HISTORY_TURNS = 8;

let providerSingleton: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function getProvider() {
  if (!providerSingleton) {
    providerSingleton = createGoogleGenerativeAI({
      apiKey: getLearningGeminiApiKey(),
    });
  }
  return providerSingleton;
}

function extractToolNames(result: {
  steps?: Array<{ toolCalls?: Array<{ toolName?: string }> }>;
}): string[] {
  const names = new Set<string>();
  for (const step of result.steps ?? []) {
    for (const call of step.toolCalls ?? []) {
      if (call.toolName) names.add(call.toolName);
    }
  }
  return [...names];
}

/** Show at most this many sources under an answer, so the chat stays tidy. */
const MAX_SOURCES = 3;

/**
 * Works out which course materials the assistant used for its answer.
 *
 * While answering, Gemini calls the `search_session_materials` tool to look up
 * notes. Each search returns matching materials with a relevance `score`.
 * We collect those matches from every step, remove duplicates, keep the most
 * relevant few, and return them so the chat can show "From: …" under the reply.
 */
function extractSources(result: {
  steps?: Array<{ toolResults?: Array<{ toolName?: string; output?: unknown }> }>;
}): LearningChatSource[] {
  const byId = new Map<string, LearningChatSource & { score: number }>();

  for (const step of result.steps ?? []) {
    for (const toolResult of step.toolResults ?? []) {
      if (toolResult.toolName !== "search_session_materials") continue;

      const output = toolResult.output as {
        results?: Array<{
          materialId?: string;
          title?: string;
          kind?: string;
          sessionId?: string;
          sessionTitle?: string;
          url?: string;
          score?: number;
        }>;
      } | null;

      for (const hit of output?.results ?? []) {
        if (!hit.materialId || !hit.title) continue;
        const score = typeof hit.score === "number" ? hit.score : 0;
        const existing = byId.get(hit.materialId);
        // Keep each material once, with its best score across all searches.
        if (!existing || score > existing.score) {
          byId.set(hit.materialId, {
            materialId: hit.materialId,
            title: hit.title,
            kind: hit.kind ?? "material",
            sessionId: hit.sessionId ?? "",
            sessionTitle: hit.sessionTitle,
            url: hit.url,
            score,
          });
        }
      }
    }
  }

  return [...byId.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SOURCES)
    .map((source) => ({
      materialId: source.materialId,
      title: source.title,
      kind: source.kind,
      sessionId: source.sessionId,
      sessionTitle: source.sessionTitle,
      url: source.url,
    }));
}

export type ProcessLearningChatOutcome = LearningChatResult & {
  refusedOutOfScope?: boolean;
  toolsUsed?: string[];
};

export async function processLearningChat(
  message: string,
  context: LearningChatContext
): Promise<ProcessLearningChatOutcome> {
  if (isLikelyOutOfScopeLearningQuery(message)) {
    return {
      text: LEARNING_CHAT_REFUSE_MESSAGE,
      refusedOutOfScope: true,
      toolsUsed: [],
    };
  }

  try {
    const provider = getProvider();
    const history = (context.history ?? [])
      .filter((m) => m.content.trim().length > 0)
      .slice(-MAX_HISTORY_TURNS);

    const result = await generateText({
      model: provider(getLearningGeminiModelId()),
      system: buildLearningChatSystemPrompt({
        cohortId: context.cohortId,
        focusSessionId: context.focusSessionId,
      }),
      messages: [
        ...history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        {
          role: "user" as const,
          content: message,
        },
      ],
      tools: buildLearningChatTools(context),
      stopWhen: stepCountIs(MAX_TOOL_STEPS),
    });

    return {
      text:
        result.text ||
        "I looked at the materials but have nothing further to add. Try a more specific session or concept.",
      toolsUsed: extractToolNames(result),
      sources: extractSources(result),
    };
  } catch (err: unknown) {
    console.error("processLearningChat error:", err);
    return { error: formatLearningGeminiError(err), toolsUsed: [] };
  }
}
