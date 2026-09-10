import { useEffect, useRef, useState } from "react";
import { explain } from "../api";
import FactorChip from "./FactorChip";
import { LogoMark } from "./brand";

const SUGGESTIONS = [
  "Why was this borrower flagged?",
  "What is the strongest factor in their favour?",
  "What is dragging the score down?",
];

// The hero panel. Sits on the dark card; every answer is grounded in the
// selected borrower's recorded factors and names the ones it cited.
export default function ChatWindow({ borrower, onAnswered, inputRef }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [borrower?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, loading]);

  async function ask(question) {
    const q = question.trim();
    if (!q || loading || !borrower) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await explain(borrower.id, q);
      setMessages((m) => [
        ...m,
        { role: "assistant", text: res.answer, cited: res.cited_factors },
      ]);
      onAnswered?.();
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: `Request failed: ${e.message}`, cited: [], error: true },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col text-white">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
        <LogoMark size={26} />
        <div>
          <h2 className="text-[15px] font-extrabold tracking-tight text-white">Ask Kaleido</h2>
          <p className="text-[11px] text-white/55">
            Grounded only in {borrower?.name ?? "the selected case"}&rsquo;s recorded factors
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col justify-center text-[13px] text-white/70">
            <p>
              Ask a plain-language question about this case. Each answer names the factors it draws
              on and is written to the audit trail.
            </p>
            <div className="mt-3 flex flex-col items-start gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  disabled={!borrower}
                  className="rounded-full border border-white/20 px-3 py-1.5 text-left text-[12px] text-white/85 hover:bg-white/10 disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="border-l-2 border-white/25 pl-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
                Question
              </div>
              <p className="mt-0.5 text-[13px] text-white">{m.text}</p>
            </div>
          ) : (
            <div
              key={i}
              className="border-l-2 pl-3"
              style={{ borderColor: m.error ? "#E88A82" : "#3FB6B9" }}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
                {m.error ? "Error" : "Response"}
              </div>
              <p
                className="mt-0.5 text-[13px]"
                style={{ color: m.error ? "#F0B4AE" : "rgba(255,255,255,0.92)" }}
              >
                {m.text}
              </p>
              {!m.error && m.cited?.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-white/45">Cited</span>
                  {m.cited.map((c) => (
                    <FactorChip key={c} name={c} dark />
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {loading && <p className="text-[13px] text-white/50">Preparing response…</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex items-center gap-2 border-t border-white/10 p-3"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Why was this borrower flagged?"
          disabled={!borrower}
          className="flex-1 rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-[13px] text-white placeholder:text-white/40 focus:border-brand-100 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim() || !borrower}
          className="rounded-lg bg-white px-4 py-2.5 text-[13px] font-bold text-ink disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
