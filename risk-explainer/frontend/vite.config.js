import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server runs on 5173; the FastAPI backend is expected on 8000
// (configurable in the frontend via VITE_API_BASE).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
