import { defineConfig } from "vitest/config";

// Vitest's default glob will happily crawl deployment artifacts (e.g. `.build/`)
// and compiled outputs (`dist/`), which causes duplicate tests, sourcemap noise,
// and false failures. Keep the test surface scoped to source trees only.
export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
      "**/.build/**",
      "**/dist/**",
      "**/.next/**",
      "**/tmp/**",
      "**/releases/**",
      "**/packages/**/dist/**",
    ],
  },
});

