// Shared presentation helpers. Kept tiny and dependency-free.

// snake_case factor keys -> readable label ("repayment_history" -> "Repayment history").
export const titleize = (s) =>
  String(s)
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());

// The only three places functional color is allowed, each with the words a
// reviewer would actually write next to the decision.
export const DECISION = {
  rejected: {
    word: "Rejected",
    color: "#C23B32",
    line: "Score falls below the 40-point approval floor.",
  },
  review: {
    word: "Manual review",
    color: "#B07414",
    line: "Score sits within the 40–70 referral band and needs an underwriter.",
  },
  approved: {
    word: "Approved",
    color: "#3C7A4B",
    line: "Score clears the 70-point approval threshold.",
  },
};

export const decisionOf = (d) =>
  DECISION[d] || { word: String(d ?? "—"), color: "#6B7680", line: "" };

// Signed delta as text, colored only by direction of credit impact.
export const deltaColor = (n) => (n > 0 ? "#3C7A4B" : n < 0 ? "#C23B32" : "#6B7680");
