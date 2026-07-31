import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/otimizador-imagens/",
  plugins: [react()],
  build: {
    target: "es2020",
    sourcemap: false,
  },
});
