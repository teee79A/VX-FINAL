# VYRDON Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `packages/vyrdx-app` room explorer shell with a localhost-ready VYRDON landing page that keeps a fixed 3D center lockup and animated background while seven landscape plates scroll in `3 / 2 / 2` chapters using real GSAP `ScrollSmoother` and real `SplitText`.

**Architecture:** Keep the Three.js stage fixed to the viewport and move only the DOM plate layer inside the `ScrollSmoother` wrapper/content shell. Store the seven plates in a small content module, render them through focused React components, and isolate the GSAP Club-plugin dependency behind a local browser-global bridge so the build fails fast with a clear error when the licensed files are missing.

**Tech Stack:** React 19, Vite 6, TypeScript 5, `three`, `@react-three/fiber`, `@react-three/drei`, GSAP 3, Club GSAP `ScrollSmoother`, Club GSAP `SplitText`, Vitest, Testing Library, jsdom

---

## File Structure

### Modify

- `packages/vyrdx-app/package.json`
  - Add package-local test scripts and frontend testing dependencies.
- `packages/vyrdx-app/package-lock.json`
  - Capture the package-local test dependency installation.
- `packages/vyrdx-app/vite.config.ts`
  - Add `test` configuration for Vitest + jsdom.
- `packages/vyrdx-app/index.html`
  - Stop forcing `overflow: hidden` on the whole page and load the licensed Club GSAP files from `public/vendor/gsap/`.
- `packages/vyrdx-app/src/App.tsx`
  - Replace the room-selector shell with the landing composition.

### Create

- `packages/vyrdx-app/public/vendor/gsap/README.md`
  - Exact instructions for placing the licensed `ScrollSmoother` and `SplitText` assets locally.
- `packages/vyrdx-app/src/test/setup.ts`
  - Vitest + Testing Library setup.
- `packages/vyrdx-app/src/types/gsap-club.d.ts`
  - Browser-global types for `window.ScrollSmoother` and `window.SplitText`.
- `packages/vyrdx-app/src/lib/landing/content.ts`
  - Seven-plate content source and chapter constants.
- `packages/vyrdx-app/src/lib/landing/content.test.ts`
  - Validates chapter counts and aspect ratio.
- `packages/vyrdx-app/src/lib/landing/clubPlugins.ts`
  - Safe browser-global access and idempotent GSAP registration.
- `packages/vyrdx-app/src/lib/landing/clubPlugins.test.ts`
  - Validates plugin lookup, error message, and idempotent registration.
- `packages/vyrdx-app/src/lib/landing/waveGrid.ts`
  - Pure helper that creates the reference-inspired wave field geometry positions.
- `packages/vyrdx-app/src/lib/landing/waveGrid.test.ts`
  - Validates generated grid size and centered layout.
- `packages/vyrdx-app/src/landing/LandingPlate.tsx`
  - Single plate markup and `SplitText` targets.
- `packages/vyrdx-app/src/landing/LandingChapters.tsx`
  - Renders the `3 / 2 / 2` chapter structure.
- `packages/vyrdx-app/src/landing/LandingChapters.test.tsx`
  - Verifies chapter structure and plate count in the DOM.
- `packages/vyrdx-app/src/landing/LandingScene.tsx`
  - Fixed WebGL background, wave field, and center `VYRDON` lockup.
- `packages/vyrdx-app/src/landing/SmoothScrollShell.tsx`
  - `ScrollSmoother` wrapper/content shell and GSAP cleanup lifecycle.
- `packages/vyrdx-app/src/landing/SmoothScrollShell.test.tsx`
  - Verifies the required smoother wrapper/content DOM nodes.
- `packages/vyrdx-app/src/landing/landing.css`
  - Page-wide landing styles, plate layout, chapter spacing, and responsive rules.
- `packages/vyrdx-app/src/App.test.tsx`
  - Final app smoke test for the combined shell.

## Task 1: Add Package-Local Test Harness And Static Landing Content

**Files:**
- Create: `packages/vyrdx-app/src/test/setup.ts`
- Create: `packages/vyrdx-app/src/lib/landing/content.ts`
- Test: `packages/vyrdx-app/src/lib/landing/content.test.ts`
- Modify: `packages/vyrdx-app/package.json`
- Modify: `packages/vyrdx-app/package-lock.json`
- Modify: `packages/vyrdx-app/vite.config.ts`

- [ ] **Step 1: Write the failing content test**

```ts
import { describe, expect, it } from "vitest";
import {
  CHAPTER_SEQUENCE,
  LANDING_PLATES,
  PLATE_ASPECT_RATIO,
  groupPlatesByChapter,
} from "./content";

describe("landing content", () => {
  it("keeps the approved 3 / 2 / 2 chapter structure", () => {
    expect(CHAPTER_SEQUENCE).toEqual([3, 2, 2]);
    expect(LANDING_PLATES).toHaveLength(7);

    const groups = groupPlatesByChapter(LANDING_PLATES);
    expect(groups.map((group) => group.length)).toEqual([3, 2, 2]);
  });

  it("uses the approved 10in by 6.5in visual ratio", () => {
    expect(PLATE_ASPECT_RATIO).toBeCloseTo(20 / 13);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd /opt/kitty/packages/vyrdx-app
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm run test -- src/lib/landing/content.test.ts
```

Expected: FAIL with a module resolution error because `src/lib/landing/content.ts` does not exist yet.

- [ ] **Step 3: Add package-local test support and the landing content module**

`packages/vyrdx-app/package.json`

```json
{
  "name": "@vyrdon/vyrdx-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@react-three/drei": "^10.0.0",
    "@react-three/fiber": "^9.0.0",
    "gsap": "^3.12.7",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "three": "^0.175.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@types/three": "^0.175.0",
    "@vitejs/plugin-react": "^4.5.0",
    "jsdom": "^26.1.0",
    "typescript": "^5.9.3",
    "vite": "^6.3.0",
    "vitest": "^4.1.4"
  }
}
```

`packages/vyrdx-app/vite.config.ts`

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  server: {
    port: 3100,
    proxy: {
      "/api": "http://localhost:7800",
      "/health": "http://localhost:7800",
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
```

`packages/vyrdx-app/src/test/setup.ts`

```ts
import "@testing-library/jest-dom/vitest";
```

`packages/vyrdx-app/src/lib/landing/content.ts`

```ts
export interface LandingPlateContent {
  id: string;
  chapter: 1 | 2 | 3;
  eyebrow: string;
  title: string;
  body: string;
}

export const PLATE_ASPECT_RATIO = 20 / 13;
export const CHAPTER_SEQUENCE = [3, 2, 2] as const;

export const LANDING_PLATES: LandingPlateContent[] = [
  {
    id: "protocol",
    chapter: 1,
    eyebrow: "Layer 01",
    title: "Protocol-grade business runtime",
    body: "VYRDON turns operational trust, execution structure, and runtime discipline into a visible system.",
  },
  {
    id: "signal",
    chapter: 1,
    eyebrow: "Layer 02",
    title: "Signal across every room",
    body: "Commercial, memory, finance, and execution surfaces share one visual backbone instead of fragmented dashboards.",
  },
  {
    id: "authority",
    chapter: 1,
    eyebrow: "Layer 03",
    title: "Authority held in motion",
    body: "The landing page should feel like an active system, not a static brochure or template.",
  },
  {
    id: "chain",
    chapter: 2,
    eyebrow: "Layer 04",
    title: "Chain-linked visual field",
    body: "The fixed background keeps the blockchain atmosphere present while the content moves through it.",
  },
  {
    id: "plates",
    chapter: 2,
    eyebrow: "Layer 05",
    title: "Narrative plates, not cards",
    body: "Each plate lands with typographic force, then clears space for the next chapter without replacing the world behind it.",
  },
  {
    id: "depth",
    chapter: 3,
    eyebrow: "Layer 06",
    title: "Centered depth anchor",
    body: "The 3D VYRDON lockup stays fixed in the center as the scroll narrative moves around it.",
  },
  {
    id: "finish",
    chapter: 3,
    eyebrow: "Layer 07",
    title: "Built to close the loop",
    body: "The localhost experience must already feel deployable, not like a rough concept pass.",
  },
];

export function groupPlatesByChapter(
  plates: LandingPlateContent[],
): LandingPlateContent[][] {
  return [1, 2, 3].map((chapter) =>
    plates.filter((plate) => plate.chapter === chapter),
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
cd /opt/kitty/packages/vyrdx-app
npm run test -- src/lib/landing/content.test.ts
```

Expected: PASS with 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/vyrdx-app/package.json packages/vyrdx-app/vite.config.ts packages/vyrdx-app/src/test/setup.ts packages/vyrdx-app/src/lib/landing/content.ts packages/vyrdx-app/src/lib/landing/content.test.ts
git add packages/vyrdx-app/package-lock.json
git commit -m "test: add landing content and frontend test harness"
```

## Task 2: Add The Club GSAP Vendor Path And Safe Plugin Bridge

**Files:**
- Create: `packages/vyrdx-app/public/vendor/gsap/README.md`
- Create: `packages/vyrdx-app/src/types/gsap-club.d.ts`
- Create: `packages/vyrdx-app/src/lib/landing/clubPlugins.ts`
- Test: `packages/vyrdx-app/src/lib/landing/clubPlugins.test.ts`
- Modify: `packages/vyrdx-app/index.html`

- [ ] **Step 1: Write the failing plugin bridge test**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

describe("club plugin bridge", () => {
  afterEach(() => {
    delete (window as Window & { ScrollSmoother?: unknown }).ScrollSmoother;
    delete (window as Window & { SplitText?: unknown }).SplitText;
    vi.resetModules();
  });

  it("throws a clear error when the licensed plugins are missing", async () => {
    const { getClubPlugins } = await import("./clubPlugins");
    expect(() => getClubPlugins()).toThrowError(
      /public\/vendor\/gsap/i,
    );
  });

  it("returns the browser globals once they exist", async () => {
    (window as Window & { ScrollSmoother?: unknown }).ScrollSmoother = {
      create: vi.fn(),
    };
    (window as Window & { SplitText?: unknown }).SplitText = {
      create: vi.fn(),
    };

    const { getClubPlugins } = await import("./clubPlugins");
    const plugins = getClubPlugins();

    expect(plugins.ScrollSmoother).toBe(window.ScrollSmoother);
    expect(plugins.SplitText).toBe(window.SplitText);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd /opt/kitty/packages/vyrdx-app
npm run test -- src/lib/landing/clubPlugins.test.ts
```

Expected: FAIL because `clubPlugins.ts` does not exist yet.

- [ ] **Step 3: Add the vendor instructions, browser-global types, plugin bridge, and HTML script tags**

`packages/vyrdx-app/public/vendor/gsap/README.md`

```md
# Club GSAP Assets

Copy your licensed GSAP files into this directory before running the landing page locally:

- `ScrollSmoother.min.js`
- `SplitText.min.js`

Expected final paths:

- `public/vendor/gsap/ScrollSmoother.min.js`
- `public/vendor/gsap/SplitText.min.js`

These files are intentionally not committed.
```

`packages/vyrdx-app/src/types/gsap-club.d.ts`

```ts
export interface ScrollSmootherInstance {
  kill: () => void;
}

export interface ScrollSmootherGlobal {
  create: (config: Record<string, unknown>) => ScrollSmootherInstance;
}

export interface SplitTextInstance {
  chars?: Element[];
  words?: Element[];
  lines?: Element[];
  revert: () => void;
}

export interface SplitTextGlobal {
  create: (
    target: string | Element,
    vars?: Record<string, unknown>,
  ) => SplitTextInstance;
}

declare global {
  interface Window {
    ScrollSmoother?: ScrollSmootherGlobal;
    SplitText?: SplitTextGlobal;
  }
}
```

`packages/vyrdx-app/src/lib/landing/clubPlugins.ts`

```ts
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;

export function getClubPlugins() {
  if (!window.ScrollSmoother || !window.SplitText) {
    throw new Error(
      "Missing Club GSAP files. Copy ScrollSmoother.min.js and SplitText.min.js into packages/vyrdx-app/public/vendor/gsap/ before running the landing page.",
    );
  }

  return {
    ScrollSmoother: window.ScrollSmoother,
    SplitText: window.SplitText,
  };
}

export function registerLandingGsap() {
  const { ScrollSmoother, SplitText } = getClubPlugins();

  if (!registered) {
    gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText);
    registered = true;
  }

  return { gsap, ScrollTrigger, ScrollSmoother, SplitText };
}
```

`packages/vyrdx-app/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VYRDON</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body, #root { width: 100%; min-height: 100%; background: #030308; }
      body { overflow-x: hidden; }
    </style>
    <script defer src="/vendor/gsap/ScrollSmoother.min.js"></script>
    <script defer src="/vendor/gsap/SplitText.min.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
cd /opt/kitty/packages/vyrdx-app
npm run test -- src/lib/landing/clubPlugins.test.ts
```

Expected: PASS with 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/vyrdx-app/public/vendor/gsap/README.md packages/vyrdx-app/src/types/gsap-club.d.ts packages/vyrdx-app/src/lib/landing/clubPlugins.ts packages/vyrdx-app/src/lib/landing/clubPlugins.test.ts packages/vyrdx-app/index.html
git commit -m "feat: add Club GSAP bridge for landing page"
```

## Task 3: Replace The App Shell With The Plate DOM Structure

**Files:**
- Create: `packages/vyrdx-app/src/landing/LandingPlate.tsx`
- Create: `packages/vyrdx-app/src/landing/LandingChapters.tsx`
- Create: `packages/vyrdx-app/src/landing/LandingChapters.test.tsx`
- Create: `packages/vyrdx-app/src/landing/landing.css`
- Modify: `packages/vyrdx-app/src/App.tsx`

- [ ] **Step 1: Write the failing chapter render test**

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingChapters } from "./LandingChapters";

describe("LandingChapters", () => {
  it("renders 3 chapter sections with a 3 / 2 / 2 plate split", () => {
    render(<LandingChapters />);

    const chapters = screen.getAllByTestId("landing-chapter");
    expect(chapters).toHaveLength(3);

    expect(within(chapters[0]!).getAllByTestId("landing-plate")).toHaveLength(3);
    expect(within(chapters[1]!).getAllByTestId("landing-plate")).toHaveLength(2);
    expect(within(chapters[2]!).getAllByTestId("landing-plate")).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd /opt/kitty/packages/vyrdx-app
npm run test -- src/landing/LandingChapters.test.tsx
```

Expected: FAIL because the chapter component does not exist yet.

- [ ] **Step 3: Build the plate components, chapter renderer, CSS, and new app shell**

`packages/vyrdx-app/src/landing/LandingPlate.tsx`

```tsx
import type { LandingPlateContent } from "../lib/landing/content";

interface LandingPlateProps {
  plate: LandingPlateContent;
}

export function LandingPlate({ plate }: LandingPlateProps) {
  return (
    <article
      className="landing-plate"
      data-plate-id={plate.id}
      data-split-scope="true"
      data-testid="landing-plate"
    >
      <p className="landing-plate__eyebrow">{plate.eyebrow}</p>
      <h2 className="landing-plate__title" data-split="heading">
        {plate.title}
      </h2>
      <p className="landing-plate__body" data-split="body">
        {plate.body}
      </p>
    </article>
  );
}
```

`packages/vyrdx-app/src/landing/LandingChapters.tsx`

```tsx
import {
  LANDING_PLATES,
  groupPlatesByChapter,
} from "../lib/landing/content";
import { LandingPlate } from "./LandingPlate";

const chapterGroups = groupPlatesByChapter(LANDING_PLATES);

export function LandingChapters() {
  return (
    <div className="landing-chapters">
      {chapterGroups.map((group, index) => (
        <section
          key={`chapter-${index + 1}`}
          className="landing-chapter"
          data-chapter-index={index + 1}
          data-testid="landing-chapter"
        >
          <div className="landing-chapter__grid">
            {group.map((plate) => (
              <LandingPlate key={plate.id} plate={plate} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

`packages/vyrdx-app/src/landing/landing.css`

```css
:root {
  --landing-bg-start: #003073;
  --landing-bg-end: #029797;
  --plate-aspect: 20 / 13;
  --plate-max-width: min(42vw, 40rem);
  --plate-border: rgba(255, 255, 255, 0.12);
  --plate-fill: rgba(7, 18, 33, 0.72);
  --plate-shadow: 0 30px 80px rgba(0, 0, 0, 0.28);
  --text-main: rgba(255, 255, 255, 0.96);
  --text-muted: rgba(225, 233, 244, 0.76);
  --text-faint: rgba(193, 222, 255, 0.54);
}

body {
  margin: 0;
  background: linear-gradient(135deg, var(--landing-bg-start), var(--landing-bg-end));
  color: var(--text-main);
  font-family: "Inter", sans-serif;
}

.landing-root {
  position: relative;
  min-height: 100vh;
}

.landing-chapters {
  position: relative;
  z-index: 3;
}

.landing-chapter {
  min-height: 100vh;
  display: flex;
  align-items: center;
  padding: 8rem clamp(1.5rem, 4vw, 4rem);
}

.landing-chapter__grid {
  width: min(1200px, 100%);
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: clamp(1rem, 2vw, 2rem);
}

.landing-plate {
  grid-column: span 4;
  aspect-ratio: var(--plate-aspect);
  max-width: var(--plate-max-width);
  border: 1px solid var(--plate-border);
  border-radius: 1.75rem;
  background: var(--plate-fill);
  backdrop-filter: blur(18px);
  box-shadow: var(--plate-shadow);
  padding: clamp(1.25rem, 2vw, 2rem);
}

.landing-plate__eyebrow {
  margin: 0 0 1rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.72rem;
  color: var(--text-faint);
}

.landing-plate__title {
  margin: 0 0 1rem;
  font-family: "Space Grotesk", sans-serif;
  font-size: clamp(1.5rem, 2.2vw, 2.6rem);
  line-height: 0.95;
}

.landing-plate__body {
  margin: 0;
  font-size: clamp(0.95rem, 1.2vw, 1.15rem);
  line-height: 1.55;
  color: var(--text-muted);
}

@media (max-width: 1024px) {
  .landing-plate {
    grid-column: span 6;
  }
}

@media (max-width: 720px) {
  .landing-chapter {
    padding-top: 7rem;
    padding-bottom: 7rem;
  }

  .landing-plate {
    grid-column: 1 / -1;
    max-width: 100%;
  }
}
```

`packages/vyrdx-app/src/App.tsx`

```tsx
import "./landing/landing.css";
import { LandingChapters } from "./landing/LandingChapters";

export function App() {
  return (
    <main className="landing-root">
      <LandingChapters />
    </main>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
cd /opt/kitty/packages/vyrdx-app
npm run test -- src/landing/LandingChapters.test.tsx
```

Expected: PASS with 1 test passing.

- [ ] **Step 5: Commit**

```bash
git add packages/vyrdx-app/src/App.tsx packages/vyrdx-app/src/landing/LandingPlate.tsx packages/vyrdx-app/src/landing/LandingChapters.tsx packages/vyrdx-app/src/landing/LandingChapters.test.tsx packages/vyrdx-app/src/landing/landing.css
git commit -m "feat: render landing chapter and plate structure"
```

## Task 4: Add The Fixed Three.js Scene And Center Unlock Overlay

**Files:**
- Create: `packages/vyrdx-app/src/lib/landing/waveGrid.ts`
- Test: `packages/vyrdx-app/src/lib/landing/waveGrid.test.ts`
- Create: `packages/vyrdx-app/src/landing/LandingScene.tsx`
- Modify: `packages/vyrdx-app/src/App.tsx`
- Modify: `packages/vyrdx-app/src/landing/landing.css`

- [ ] **Step 1: Write the failing wave-grid helper test**

```ts
import { describe, expect, it } from "vitest";
import { buildWaveGrid } from "./waveGrid";

describe("buildWaveGrid", () => {
  it("creates a centered grid with the requested dimensions", () => {
    const points = buildWaveGrid({ amountX: 4, amountY: 3, separation: 10 });

    expect(points).toHaveLength(12);
    expect(points[0]).toEqual({ x: -20, z: -15 });
    expect(points.at(-1)).toEqual({ x: 10, z: 5 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd /opt/kitty/packages/vyrdx-app
npm run test -- src/lib/landing/waveGrid.test.ts
```

Expected: FAIL because `waveGrid.ts` does not exist yet.

- [ ] **Step 3: Add the wave helper, fixed scene, and intro overlay**

`packages/vyrdx-app/src/lib/landing/waveGrid.ts`

```ts
export interface WaveGridPoint {
  x: number;
  z: number;
}

interface BuildWaveGridOptions {
  amountX: number;
  amountY: number;
  separation: number;
}

export function buildWaveGrid({
  amountX,
  amountY,
  separation,
}: BuildWaveGridOptions): WaveGridPoint[] {
  const points: WaveGridPoint[] = [];

  for (let ix = 0; ix < amountX; ix += 1) {
    for (let iy = 0; iy < amountY; iy += 1) {
      points.push({
        x: ix * separation - (amountX * separation) / 2,
        z: iy * separation - (amountY * separation) / 2,
      });
    }
  }

  return points;
}
```

`packages/vyrdx-app/src/landing/LandingScene.tsx`

```tsx
import { Component, type ReactNode, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { buildWaveGrid } from "../lib/landing/waveGrid";

interface SceneErrorState {
  hasError: boolean;
}

class SceneErrorBoundary extends Component<{ children: ReactNode }, SceneErrorState> {
  state: SceneErrorState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="landing-scene-fallback">
          <p>WebGL scene failed to load. Refresh and try again.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

function WaveParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const points = useMemo(
    () => buildWaveGrid({ amountX: 64, amountY: 44, separation: 18 }),
    [],
  );

  const positions = useMemo(() => {
    const data = new Float32Array(points.length * 3);
    points.forEach((point, index) => {
      data[index * 3] = point.x;
      data[index * 3 + 1] = 0;
      data[index * 3 + 2] = point.z;
    });
    return data;
  }, [points]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;

    const t = clock.elapsedTime;
    const attribute = pointsRef.current.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;

    for (let index = 0; index < points.length; index += 1) {
      const point = points[index]!;
      const y =
        Math.sin((point.x / 18 + t) * 0.3) * 32 +
        Math.sin((point.z / 18 + t) * 0.5) * 32;

      attribute.setY(index, y);
    }

    attribute.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={positions.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#dfe7f7"
        size={4.2}
        sizeAttenuation
        transparent
        opacity={0.8}
        depthWrite={false}
      />
    </points>
  );
}

function CenterMark() {
  return (
    <Text
      position={[0, 25, 80]}
      fontSize={42}
      letterSpacing={0.28}
      color="#f5fbff"
      anchorX="center"
      anchorY="middle"
    >
      VYRDON
    </Text>
  );
}

export function LandingScene() {
  return (
    <SceneErrorBoundary>
      <Canvas
        camera={{ position: [0, 130, 420], fov: 42 }}
        style={{ position: "fixed", inset: 0, zIndex: 1 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.setClearColor("#000000", 0);
        }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[180, 220, 180]} intensity={1.1} color="#5fd5ff" />
        <pointLight position={[-160, 120, 120]} intensity={0.9} color="#6ef0c2" />
        <fog attach="fog" args={["#0a2036", 260, 860]} />
        <WaveParticles />
        <CenterMark />
      </Canvas>
    </SceneErrorBoundary>
  );
}
```

`packages/vyrdx-app/src/App.tsx`

```tsx
import { useState } from "react";
import "./landing/landing.css";
import { LandingChapters } from "./landing/LandingChapters";
import { LandingScene } from "./landing/LandingScene";

export function App() {
  const [unlocked, setUnlocked] = useState(false);

  return (
    <main className="landing-root">
      <LandingScene />
      <div className={`landing-hero ${unlocked ? "landing-hero--open" : ""}`}>
        <button
          type="button"
          className="landing-hero__button"
          onClick={() => setUnlocked(true)}
        >
          <span className="landing-hero__title">VYRDON</span>
          <span className="landing-hero__hint">Enter the system</span>
        </button>
      </div>
      <div className={`landing-content-shell ${unlocked ? "landing-content-shell--open" : ""}`}>
        <LandingChapters />
      </div>
    </main>
  );
}
```

Append to `packages/vyrdx-app/src/landing/landing.css`

```css
.landing-scene-fallback {
  position: fixed;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.95rem;
}

.landing-content-shell {
  position: relative;
  z-index: 3;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.45s ease;
}

.landing-content-shell--open {
  opacity: 1;
  pointer-events: auto;
}

.landing-hero {
  position: fixed;
  inset: 0;
  z-index: 4;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.landing-hero--open {
  opacity: 0;
  transition: opacity 0.6s ease;
}

.landing-hero__button {
  pointer-events: auto;
  border: 0;
  background: transparent;
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
  cursor: pointer;
}

.landing-hero__title {
  font-family: "Space Grotesk", sans-serif;
  font-size: clamp(2.8rem, 8vw, 8rem);
  letter-spacing: 0.16em;
  text-shadow: 0 0 45px rgba(0, 180, 255, 0.42);
}

.landing-hero__hint {
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 0.78rem;
  color: rgba(225, 233, 244, 0.7);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
cd /opt/kitty/packages/vyrdx-app
npm run test -- src/lib/landing/waveGrid.test.ts
```

Expected: PASS with 1 test passing.

- [ ] **Step 5: Commit**

```bash
git add packages/vyrdx-app/src/lib/landing/waveGrid.ts packages/vyrdx-app/src/lib/landing/waveGrid.test.ts packages/vyrdx-app/src/landing/LandingScene.tsx packages/vyrdx-app/src/App.tsx packages/vyrdx-app/src/landing/landing.css
git commit -m "feat: add fixed VYRDON landing scene"
```

## Task 5: Wire ScrollSmoother And SplitText Into The Plate Layer

**Files:**
- Create: `packages/vyrdx-app/src/landing/SmoothScrollShell.tsx`
- Test: `packages/vyrdx-app/src/landing/SmoothScrollShell.test.tsx`
- Modify: `packages/vyrdx-app/src/landing/LandingChapters.tsx`
- Modify: `packages/vyrdx-app/src/landing/LandingPlate.tsx`
- Modify: `packages/vyrdx-app/src/App.tsx`
- Modify: `packages/vyrdx-app/src/landing/landing.css`

- [ ] **Step 1: Write the failing smoother shell test**

```tsx
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/landing/clubPlugins", () => ({
  registerLandingGsap: () => ({
    ScrollSmoother: {
      create: () => ({ kill: vi.fn() }),
    },
  }),
}));

import { SmoothScrollShell } from "./SmoothScrollShell";

describe("SmoothScrollShell", () => {
  it("renders the required wrapper and content nodes", () => {
    render(
      <SmoothScrollShell>
        <div>plates</div>
      </SmoothScrollShell>,
    );

    expect(screen.getByTestId("smooth-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("smooth-content")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd /opt/kitty/packages/vyrdx-app
npm run test -- src/landing/SmoothScrollShell.test.tsx
```

Expected: FAIL because `SmoothScrollShell.tsx` does not exist yet.

- [ ] **Step 3: Add the smoother shell, GSAP registration, and SplitText targets**

`packages/vyrdx-app/src/landing/SmoothScrollShell.tsx`

```tsx
import { useLayoutEffect, type PropsWithChildren } from "react";
import { registerLandingGsap } from "../lib/landing/clubPlugins";

export function SmoothScrollShell({ children }: PropsWithChildren) {
  useLayoutEffect(() => {
    const { ScrollSmoother } = registerLandingGsap();

    const smoother = ScrollSmoother.create({
      smooth: 1,
      effects: true,
      smoothTouch: 0.1,
    });

    return () => {
      smoother.kill();
    };
  }, []);

  return (
    <div id="smooth-wrapper" data-testid="smooth-wrapper">
      <div id="smooth-content" data-testid="smooth-content">
        {children}
      </div>
    </div>
  );
}
```

Update `packages/vyrdx-app/src/landing/LandingPlate.tsx`

```tsx
import { useLayoutEffect, useRef } from "react";
import type { LandingPlateContent } from "../lib/landing/content";
import { registerLandingGsap } from "../lib/landing/clubPlugins";

interface LandingPlateProps {
  plate: LandingPlateContent;
}

export function LandingPlate({ plate }: LandingPlateProps) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const { gsap, ScrollTrigger, SplitText } = registerLandingGsap();

    const heading = node.querySelector<HTMLElement>("[data-split='heading']");
    const body = node.querySelector<HTMLElement>("[data-split='body']");
    if (!heading || !body) return;

    const splitHeading = SplitText.create(heading, { type: "lines,chars" });
    const splitBody = SplitText.create(body, { type: "lines,words" });

    const animation = gsap.timeline({
      scrollTrigger: {
        trigger: node,
        start: "top 78%",
        end: "bottom 40%",
        scrub: 0.8,
      },
    });

    animation
      .from(splitHeading.chars ?? [], {
        yPercent: 120,
        autoAlpha: 0,
        stagger: 0.025,
        duration: 0.7,
      })
      .from(
        splitBody.lines ?? [],
        {
          y: 28,
          autoAlpha: 0,
          stagger: 0.08,
          duration: 0.45,
        },
        "-=0.35",
      );

    return () => {
      animation.scrollTrigger?.kill();
      animation.kill();
      splitHeading.revert();
      splitBody.revert();
      ScrollTrigger.refresh();
    };
  }, []);

  return (
    <article
      ref={ref}
      className="landing-plate"
      data-plate-id={plate.id}
      data-split-scope="true"
      data-testid="landing-plate"
    >
      <p className="landing-plate__eyebrow">{plate.eyebrow}</p>
      <h2 className="landing-plate__title" data-split="heading">
        {plate.title}
      </h2>
      <p className="landing-plate__body" data-split="body">
        {plate.body}
      </p>
    </article>
  );
}
```

Update `packages/vyrdx-app/src/landing/LandingChapters.tsx`

```tsx
import {
  LANDING_PLATES,
  groupPlatesByChapter,
} from "../lib/landing/content";
import { LandingPlate } from "./LandingPlate";

const chapterGroups = groupPlatesByChapter(LANDING_PLATES);

export function LandingChapters() {
  return (
    <div className="landing-chapters">
      {chapterGroups.map((group, index) => (
        <section
          key={`chapter-${index + 1}`}
          className="landing-chapter"
          data-chapter-index={index + 1}
          data-testid="landing-chapter"
        >
          <div className={`landing-chapter__grid landing-chapter__grid--${index + 1}`}>
            {group.map((plate) => (
              <LandingPlate key={plate.id} plate={plate} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

Update `packages/vyrdx-app/src/App.tsx`

```tsx
import { useState } from "react";
import "./landing/landing.css";
import { LandingChapters } from "./landing/LandingChapters";
import { LandingScene } from "./landing/LandingScene";
import { SmoothScrollShell } from "./landing/SmoothScrollShell";

export function App() {
  const [unlocked, setUnlocked] = useState(false);

  return (
    <main className="landing-root">
      <LandingScene />
      <div className={`landing-hero ${unlocked ? "landing-hero--open" : ""}`}>
        <button
          type="button"
          className="landing-hero__button"
          onClick={() => setUnlocked(true)}
        >
          <span className="landing-hero__title">VYRDON</span>
          <span className="landing-hero__hint">Enter the system</span>
        </button>
      </div>
      <div className={`landing-content-shell ${unlocked ? "landing-content-shell--open" : ""}`}>
        <SmoothScrollShell>
          <LandingChapters />
        </SmoothScrollShell>
      </div>
    </main>
  );
}
```

Append to `packages/vyrdx-app/src/landing/landing.css`

```css
#smooth-wrapper {
  position: relative;
  z-index: 3;
}

#smooth-content {
  position: relative;
}

.landing-root {
  overflow: clip;
}

.landing-chapter__grid--1 .landing-plate:nth-child(1) { transform: translateY(-2rem) rotate(-4deg); }
.landing-chapter__grid--1 .landing-plate:nth-child(2) { transform: translateY(2rem) rotate(2deg); }
.landing-chapter__grid--1 .landing-plate:nth-child(3) { transform: translateY(-1rem) rotate(4deg); }
.landing-chapter__grid--2 .landing-plate:nth-child(1) { transform: translateY(-1rem) rotate(-3deg); }
.landing-chapter__grid--2 .landing-plate:nth-child(2) { transform: translateY(2rem) rotate(3deg); }
.landing-chapter__grid--3 .landing-plate:nth-child(1) { transform: translateY(-2rem) rotate(-2deg); }
.landing-chapter__grid--3 .landing-plate:nth-child(2) { transform: translateY(1rem) rotate(2deg); }
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
cd /opt/kitty/packages/vyrdx-app
npm run test -- src/landing/SmoothScrollShell.test.tsx
```

Expected: PASS with 1 test passing.

- [ ] **Step 5: Commit**

```bash
git add packages/vyrdx-app/src/landing/SmoothScrollShell.tsx packages/vyrdx-app/src/landing/LandingPlate.tsx packages/vyrdx-app/src/landing/LandingChapters.tsx packages/vyrdx-app/src/App.tsx packages/vyrdx-app/src/landing/landing.css packages/vyrdx-app/src/landing/SmoothScrollShell.test.tsx
git commit -m "feat: wire GSAP smoother and plate text animation"
```

## Task 6: Verify The Localhost Build And Finish The Surface

**Files:**
- Test: `packages/vyrdx-app/src/App.test.tsx`
- Modify: `packages/vyrdx-app/src/landing/LandingScene.tsx`
- Modify: `packages/vyrdx-app/src/landing/landing.css`
- Verify: `packages/vyrdx-app/public/vendor/gsap/ScrollSmoother.min.js`
- Verify: `packages/vyrdx-app/public/vendor/gsap/SplitText.min.js`

- [ ] **Step 1: Write the failing app smoke test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./landing/LandingScene", () => ({
  LandingScene: () => <div data-testid="scene-layer" />,
}));

vi.mock("./landing/SmoothScrollShell", () => ({
  SmoothScrollShell: ({ children }: { children: ReactNode }) => (
    <div data-testid="smooth-shell">{children}</div>
  ),
}));

import { App } from "./App";

describe("App", () => {
  it("renders the fixed scene, hero trigger, and landing chapters together", () => {
    render(<App />);

    expect(screen.getByTestId("scene-layer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /vyrdon/i })).toBeInTheDocument();
    expect(screen.getByTestId("smooth-shell")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd /opt/kitty/packages/vyrdx-app
npm run test -- src/App.test.tsx
```

Expected: FAIL until the final app shell is fully wired and imports resolve cleanly.

- [ ] **Step 3: Finish verification-safe cleanup and run the local checks**

Run:

```bash
cd /opt/kitty/packages/vyrdx-app
test -f public/vendor/gsap/ScrollSmoother.min.js
test -f public/vendor/gsap/SplitText.min.js
npm run test
npm run typecheck
npm run build
```

Expected:

- `test -f ...` exits with code `0` for both licensed plugin files.
- `npm run test` passes.
- `npm run typecheck` passes.
- `npm run build` emits the Vite production bundle without errors.

- [ ] **Step 4: Start the localhost preview**

Run:

```bash
cd /opt/kitty/packages/vyrdx-app
npm run dev -- --host 0.0.0.0
```

Expected:

- Vite serves on `http://localhost:3100/`
- The background remains fixed.
- `VYRDON` stays centered.
- Clicking the center hero opens the plate experience.
- Seven plates appear over three chapter passes.
- `ScrollSmoother` is visibly active.
- `SplitText` reveals fire on each plate without leaving broken markup after refresh.

- [ ] **Step 5: Commit**

```bash
git add packages/vyrdx-app/src/App.test.tsx packages/vyrdx-app/src/App.tsx packages/vyrdx-app/src/landing/LandingScene.tsx packages/vyrdx-app/src/landing/landing.css
git commit -m "feat: finalize localhost VYRDON landing page"
```

## Self-Review

### Spec coverage

- Fixed animated background: handled by Task 4.
- Fixed 3D `VYRDON` center lockup: handled by Task 4.
- Seven plates in `3 / 2 / 2`: handled by Tasks 1 and 3.
- Real `ScrollSmoother`: handled by Tasks 2 and 5.
- Real `SplitText`: handled by Tasks 2 and 5.
- Persistent background while only plates scroll: handled by Tasks 3, 4, and 5.
- Localhost-ready preview: handled by Task 6.

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” markers remain.
- Club GSAP handling is explicit: local files must exist in `public/vendor/gsap/`.
- Commands and expected outputs are concrete.

### Type consistency

- Plate data shape is defined in `content.ts` and reused by `LandingPlate.tsx`.
- Club-plugin access is centralized in `clubPlugins.ts`.
- The smoother shell owns only wrapper/content creation.
- The scene stays fixed and isolated from the plate layer.
