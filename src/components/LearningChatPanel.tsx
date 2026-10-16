"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, Copy, Loader2, Send, Trash2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  LEARNING_CHAT_WELCOME,
  LEARNING_QUICK_PROMPTS,
  type LearningChatSource,
} from "@/lib/learning-chat/constants";
import { postLearningChat } from "@/lib/learning-chat/clientApi";
import { getActiveCohortId } from "@/lib/cohorts";
import toast from "react-hot-toast";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Course materials an assistant answer was based on (shown under the reply). */
  sources?: LearningChatSource[];
};

type LearningChatPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  focusSessionId?: string;
};

function welcomeMessages(): ChatMessage[] {
  return [{ id: "welcome", role: "assistant", content: LEARNING_CHAT_WELCOME }];
}

export function LearningChatPanel({
  isOpen,
  onClose,
  focusSessionId,
}: LearningChatPanelProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [messages, setMessages] = useState<ChatMessage[]>(welcomeMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const clearChat = useCallback(() => {
    setMessages(welcomeMessages());
    setInput("");
  }, []);

  const copyTranscript = useCallback(async () => {
    const text = messages
      .map((m) => `${m.role === "user" ? "You" : "Assistant"}: ${m.content}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Conversation copied");
    } catch {
      toast.error("Could not copy");
    }
  }, [messages]);

  const runPrompt = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy || !user) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      setMessages((m) => [...m, userMsg]);
      setInput("");
      setBusy(true);

      try {
        const history = messagesRef.current
          .filter((m) => m.id !== "welcome")
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.content }));

        const reply = await postLearningChat({
          message: trimmed,
          focusSessionId,
          pathname: pathname || undefined,
          cohortId: getActiveCohortId(),
          history,
        });

        setMessages((m) => [
          ...m,
                    {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: reply.text,
            sources: reply.sources,
          },
        ]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong";
        setMessages((m) => [
          ...m,
          { id: `e-${Date.now()}`, role: "assistant", content: msg },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, user, focusSessionId, pathname]
  );

  if (!isOpen) return null;

  const primaryPrompts = LEARNING_QUICK_PROMPTS.filter((p) =>
    ["ask", "summarize", "translate"].includes(p.category) &&
    ["ask-concept", "summarize", "translate"].includes(p.id)
  );

  return (
    <>
      <button
        type="button"
        aria-label="Close learning chat"
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l border-white/10 bg-[#1a1d21] shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#14171a] px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e11d48] text-white shadow-md shadow-rose-900/40">
              <Bot size={20} strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-white leading-tight">
                Learning Assistant
              </p>
              <p className="text-[11px] text-gray-400 truncate">
                Ask · Summarize · Translate
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => void copyTranscript()}
              className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white"
              aria-label="Copy conversation"
              title="Copy"
            >
              <Copy size={16} />
            </button>
            <button
              type="button"
              onClick={clearChat}
              className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white"
              aria-label="Clear conversation"
              title="Clear"
            >
              <Trash2 size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white"
              aria-label="Close"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="mb-4 text-xs text-gray-500 leading-relaxed">
            Built on programme materials — summarise a lesson, unblock yourself, or get a
            clarification in the language you prefer.
          </p>
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-[#3b82f6] text-white rounded-br-md"
                      : "bg-[#2a2f36] text-gray-100 rounded-bl-md"
                  }`}
                >
                  {msg.content}
                                    {/* "From: …" — the course materials this answer was based on. */}
                  {msg.role === "assistant" && msg.sources && msg.sources.length > 0 ? (
                    <div className="mt-2 border-t border-white/10 pt-2 text-[11px] text-gray-400">
                      <span className="font-medium text-gray-300">From: </span>
                      {msg.sources.map((source, i) => {
                        const label = source.sessionTitle
                          ? `${source.title} (${source.sessionTitle})`
                          : source.title;
                        return (
                          <span key={source.materialId}>
                            {i > 0 ? " · " : null}
                            {source.url ? (
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline decoration-white/30 hover:text-white"
                              >
                                {label}
                              </a>
                            ) : (
                              label
                            )}
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {busy ? (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-[#2a2f36] px-4 py-2.5 text-[13px] text-gray-400">
                  <Loader2 size={14} className="animate-spin" /> Thinking…
                </div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>
        </div>

        <footer className="border-t border-white/10 bg-[#14171a] p-3 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {primaryPrompts.map((prompt) => (
              <button
                key={prompt.id}
                type="button"
                disabled={busy}
                onClick={() => void runPrompt(prompt.message)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-gray-200 hover:bg-white/10 disabled:opacity-50"
              >
                {prompt.label}
              </button>
            ))}
            {LEARNING_QUICK_PROMPTS.filter((p) => !["ask-concept", "summarize", "translate"].includes(p.id)).map(
              (prompt) => (
                <button
                  key={prompt.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void runPrompt(prompt.message)}
                  className="rounded-full border border-white/5 bg-transparent px-2.5 py-1 text-[10px] text-gray-500 hover:text-gray-300 hover:bg-white/5 disabled:opacity-50"
                >
                  {prompt.label}
                </button>
              )
            )}
          </div>

          <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-[#1a1d21] px-3 py-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void runPrompt(input);
                }
              }}
              placeholder="Ask about this lesson..."
              rows={2}
              className="flex-1 resize-none bg-transparent text-sm text-gray-100 outline-none placeholder:text-gray-500"
            />
            <button
              type="button"
              onClick={() => void runPrompt(input)}
              disabled={busy || !input.trim()}
              className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-gray-950 disabled:opacity-30"
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}

/** Floating Learning Assistant — signed-in attendees and admins only. */
export function FloatingLearningChat() {
  const { user, userProfile, loading } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading || !user || !userProfile) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e11d48] text-white shadow-[0_12px_40px_-8px_rgba(225,29,72,0.55)] transition hover:scale-105 hover:bg-[#f43f5e]"
        aria-label="Open Learning Assistant"
      >
        <Bot size={26} strokeWidth={2.25} />
      </button>
      <LearningChatPanel isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
