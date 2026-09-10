// fetch wrappers for the FastAPI backend.
// Override the base URL with VITE_API_BASE if the backend isn't on :8000.
// NOTE: Vite inlines this at BUILD time — on Vercel/Netlify set VITE_API_BASE
// as a project env var, not just in a local .env.
const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

if (import.meta.env.PROD && !import.meta.env.VITE_API_BASE) {
  // eslint-disable-next-line no-console
  console.error(
    "[risk-explainer] VITE_API_BASE was not set for this production build — " +
      "API calls will go to http://localhost:8000 and fail. Set VITE_API_BASE " +
      "to your backend URL in the host's environment variables and redeploy."
  );
}

async function request(path, options) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail;
    try {
      detail = (await res.json()).detail;
    } catch {
      detail = res.statusText;
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return res.json();
}

export const getBorrowers = () => request("/borrowers");

export const getBorrower = (id) => request(`/borrowers/${id}`);

export const explain = (borrowerId, question) =>
  request("/explain", {
    method: "POST",
    body: JSON.stringify({ borrower_id: borrowerId, question }),
  });

export const whatif = (borrowerId, factorOverrides) =>
  request("/whatif", {
    method: "POST",
    body: JSON.stringify({ borrower_id: borrowerId, factor_overrides: factorOverrides }),
  });

export const getAudit = (borrowerId) => request(`/audit/${borrowerId}`);
