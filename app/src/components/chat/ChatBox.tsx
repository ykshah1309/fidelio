"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Extraction, Report } from "@/lib/types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatBoxProps {
  extraction: Extraction;
  report: Report;
}

/** Generate 3 contextual suggested questions seeded with actual fund names */
function buildSuggestions(report: Report): string[] {
  const suggestions: string[] = [];

  // Expensive fund → specific comparison question
  const expensive = report.holdings_review.find((h) => h.verdict === "expensive");
  const cheap = report.holdings_review.find((h) => h.verdict === "good");
  if (expensive) {
    const erRatio =
      cheap?.expense_ratio_pct && expensive.expense_ratio_pct
        ? Math.round(expensive.expense_ratio_pct / cheap.expense_ratio_pct)
        : null;
    const erLabel = expensive.ticker ?? expensive.name;
    const cheapLabel = cheap ? (cheap.ticker ?? cheap.name) : "a low-cost index fund";
    suggestions.push(
      erRatio && erRatio > 2
        ? `Why is ${erLabel} ${erRatio}× more expensive than ${cheapLabel}, and should I switch?`
        : `Why is ${erLabel} flagged as expensive, and what's a better alternative?`,
    );
  }

  // Match gap → specific dollar amount
  const gap = report.match_analysis?.money_left_on_table_annual_usd;
  if (gap && gap > 0) {
    suggestions.push(
      `I'm leaving $${Math.round(gap).toLocaleString()}/year in employer match on the table — what exactly do I need to change?`,
    );
  }

  // 30-year fee drag → specific dollar figure
  if (report.fee_impact?.thirty_year_cost_usd) {
    const thirtyYr = report.fee_impact.thirty_year_cost_usd;
    suggestions.push(
      `How much would I save over 30 years by switching to low-cost index funds instead of paying $${Math.round(thirtyYr).toLocaleString()} in fees?`,
    );
  }

  // Diversification fallback
  if (suggestions.length < 3) {
    suggestions.push("Am I diversified enough, or am I overexposed to any one sector?");
  }
  if (suggestions.length < 3) {
    const tdf = report.holdings_review.find((h) =>
      h.name?.toLowerCase().includes("target") || h.name?.toLowerCase().includes("retirement"),
    );
    suggestions.push(
      tdf
        ? `What does ${tdf.name} actually own, and is it right for my timeline?`
        : "What does my target-date fund actually own, and is it right for my timeline?",
    );
  }
  if (suggestions.length < 3) {
    suggestions.push(`Can you explain the first action item in more detail?`);
  }

  return suggestions.slice(0, 3);
}

export function ChatBox({ extraction, report }: ChatBoxProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestionsUsed, setSuggestionsUsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = buildSuggestions(report);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || isLoading) return;

      setInput("");
      setSuggestionsUsed(true);
      const userMessage: ChatMessage = { role: "user", content: q };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      // Streaming: read plain text stream from /api/chat
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            extraction,
            report,
            messages,
            question: q,
          }),
        });

        if (!res.ok || !res.body) {
          const errData = await res.json().catch(() => ({ error: "Unknown error" }));
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: errData.error ?? "Something went wrong. Please try again." },
          ]);
          return;
        }

        // Try streaming first
        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("text/plain") || contentType.includes("text/event-stream")) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let accumulated = "";

          // Append a placeholder message
          setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            accumulated += decoder.decode(value, { stream: true });
            setMessages((prev) => {
              const copy = [...prev];
              copy[copy.length - 1] = { role: "assistant", content: accumulated };
              return copy;
            });
          }
        } else {
          // JSON fallback (current API)
          const data = await res.json();
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.reply ?? data.error ?? "Sorry, I couldn't process that." },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Something went wrong. Please try again." },
        ]);
      } finally {
        setIsLoading(false);
        textareaRef.current?.focus();
      }
    },
    [extraction, report, messages, isLoading],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(input);
    }
  }

  return (
    <div id="chat" className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border/50">
        <h2 className="text-lg font-semibold text-foreground">Ask Fidelio</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Ask follow-up questions about your document. Your data stays in context.
        </p>
      </div>

      {messages.length > 0 && (
        <ScrollArea className="h-64 border-b border-border/30">
          <div ref={scrollRef} className="px-6 py-4 space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={
                  msg.role === "user"
                    ? "flex justify-end"
                    : "flex justify-start"
                }
              >
                <div
                  className={
                    msg.role === "user"
                      ? "max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                      : "max-w-[80%] rounded-2xl rounded-bl-md bg-muted/50 px-4 py-2.5 text-sm text-foreground"
                  }
                >
                  {msg.content ? (
                    msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none leading-relaxed
                        [&>p]:mb-2 [&>p:last-child]:mb-0
                        [&>ul]:mb-2 [&>ul]:pl-4 [&>ul>li]:mb-0.5
                        [&>ol]:mb-2 [&>ol]:pl-4 [&>ol>li]:mb-0.5
                        [&>h1]:text-sm [&>h2]:text-sm [&>h3]:text-xs [&>h1]:font-semibold [&>h2]:font-semibold [&>h3]:font-medium
                        [&>h1]:mb-1 [&>h2]:mb-1 [&>h3]:mb-1
                        [&>hr]:border-white/10 [&>hr]:my-2
                        [&>strong]:font-semibold [&>code]:bg-white/10 [&>code]:px-1 [&>code]:rounded [&>code]:text-xs
                        [&>blockquote]:border-l-2 [&>blockquote]:border-white/20 [&>blockquote]:pl-3 [&>blockquote]:italic [&>blockquote]:text-white/70">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    )
                  ) : (
                    <div className="flex gap-1.5 py-1">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-muted/50 px-4 py-2.5">
                  <div className="flex gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Suggested questions */}
      {!suggestionsUsed && messages.length === 0 && (
        <div className="px-6 pt-4 pb-2 flex flex-wrap gap-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSubmit(s)}
              className="text-xs rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-muted-foreground hover:border-border hover:text-foreground transition-colors text-left"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(input);
        }}
        className="px-6 py-4 flex gap-3"
      >
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Why is my Target 2060 fund worse than VTSAX?"
          className="min-h-[44px] max-h-32 resize-none bg-background/50"
          rows={1}
          disabled={isLoading}
        />
        <Button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="shrink-0 self-end"
        >
          Ask
        </Button>
      </form>
    </div>
  );
}
