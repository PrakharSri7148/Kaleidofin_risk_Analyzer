// fetch wrappers for the FastAPI backend.
// The deployed build serves frontend + API from one origin, so the base URL is
// empty ("") and requests are same-origin relative (/borrowers, /explain, …).
// For local dev the API is a separate origin, so frontend/.env sets
// VITE_API_BASE=http://localhost:8000. Vite inlines this at build time.
const BASE =
  import.meta.env.VITE_API_BASE ??
  (import.meta.env.DEV ? "http://localhost:8000" : "");

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
