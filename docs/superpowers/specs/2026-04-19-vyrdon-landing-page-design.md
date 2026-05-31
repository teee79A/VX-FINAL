# VYRDON Landing Page Design

Date: 2026-04-19
Target Surface: `packages/vyrdx-app`
Status: Approved in chat for spec writing

## Summary

Build a one-page VYRDON landing experience inside the existing Vite React app at `packages/vyrdx-app`. The page keeps a fixed blockchain-style animated background and a fixed 3D `VYRDON` center lockup while the content layer scrolls over it using real GSAP `ScrollSmoother`. Seven floating plates scroll in three chapters that read like three pages: `3 / 2 / 2`. Every plate uses real GSAP `SplitText` for text entry behavior. SVG-specific animation is out of scope.

## Goals

- Keep the background visible for the full landing page session.
- Keep a 3D `VYRDON` object fixed in the center as the visual anchor.
- Make the plates the primary scrolling narrative layer.
- Use real GSAP `ScrollSmoother` for the scrolling shell.
- Use real GSAP `SplitText` on each plate.
- Preserve the requested plate proportion of `10in` width by `6.5in` height as a responsive visual ratio.
- Make the experience feel like three scroll pages, not a long generic list.

## Non-Goals

- No SVG-specific animation plugin work.
- No multi-route marketing site or CMS integration.
- No backend/API work.
- No reuse of the legacy `THREE.REVISION 56` code. Its wave motion is a reference only.
- No implementation of alternative scrolling systems unless Club GSAP assets are unavailable.

## Existing Project Context

The best integration surface is already present:

- [`packages/vyrdx-app/package.json`](/opt/kitty/packages/vyrdx-app/package.json:1) already includes `three`, `@react-three/fiber`, `@react-three/drei`, and `gsap`.
- [`packages/vyrdx-app/src/App.tsx`](/opt/kitty/packages/vyrdx-app/src/App.tsx:1) currently composes a scene plus overlay structure.
- [`packages/vyrdx-app/src/VyrdxScene.tsx`](/opt/kitty/packages/vyrdx-app/src/VyrdxScene.tsx:1) already demonstrates a fixed full-screen `Canvas`, scene error boundary, title overlay pattern, and floating 3D background elements.
- [`packages/vyrdx-app/index.html`](/opt/kitty/packages/vyrdx-app/index.html:1) currently forces `overflow: hidden`, which must change for `ScrollSmoother`.

This means the landing page should be a focused replacement or restructuring of the current app shell rather than a new app.

## Recommended Approach

Use a fixed WebGL stage under a GSAP-controlled smooth-scrolling content shell.

Why this approach:

- It directly matches the request that the background always stays there.
- It keeps `VYRDON` stable in the center while the plates move independently.
- It maps cleanly to `ScrollSmoother`'s required wrapper/content structure.
- It avoids over-pinning or fake page transitions that would fight the plate narrative.

Alternative approaches were considered and rejected:

- Full-screen plate takeovers: too disruptive and weakens the persistent center anchor.
- Horizontal conveyor driven by vertical scroll: stylish, but conflicts with the requested three-page chapter feel.

## Experience Design

### Visual Frame

- Background base uses the provided blue-cyan atmospheric direction.
- A modern Three.js particle wave field evokes the supplied legacy demo: depth field, wave motion, and light drift.
- The scene stays fixed to the viewport for the entire landing page.
- A 3D `VYRDON` lockup sits in the center with low-amplitude parallax and idle motion.

### Entry

- Initial state shows centered `VYRDON` over the animated background.
- First user click unlocks the plate layer and transitions from intro emphasis to narrative scroll mode.
- The background and center lockup remain visible after unlock.

### Scroll Chapters

The page is structured as three chapters:

1. Chapter 1: 3 plates
2. Chapter 2: 2 plates
3. Chapter 3: 2 plates

This resolves the count conflict and preserves the requested "three pages" feel with seven total plates.

### Plate Behavior

- Plate proportion is implemented as a visual ratio, not literal physical inches.
- The requested `10in x 6.5in` proportion becomes CSS `aspect-ratio: 20 / 13`.
- Plates are landscape, floating, and slightly depth-staggered.
- Desktop chapters can show grouped compositions.
- Mobile keeps the same chapter order but reduces spread and overlap.

### Text Animation

- Each plate uses real GSAP `SplitText`.
- Headings animate by lines and/or characters depending on density.
- Supporting text animates by lines or words, not dense character floods.
- Plate text reveal is tied to chapter entry so the motion feels paced rather than noisy.

## Architecture

### High-Level Structure

The landing page will be composed from four layers:

1. Fixed WebGL background stage
2. Fixed center `VYRDON` hero lockup
3. `ScrollSmoother` wrapper/content shell
4. Chapter/plate content inside the smooth shell

The background stage and hero lockup are visually persistent. The scroll shell is the only moving narrative layer.

### Proposed Component Boundaries

These names are design-level targets and may be adjusted slightly in implementation, but the boundaries should remain:

- `App`
  - Owns top-level landing composition instead of the current room/overlay flow.
- `LandingScene`
  - Owns the full-screen `Canvas`, scene error boundary, particle wave field, and 3D `VYRDON`.
- `LandingHeroLockup`
  - Owns intro state, first-click unlock, and center overlay coordination if the lockup needs DOM assistance.
- `SmoothScrollShell`
  - Owns the `#smooth-wrapper` and `#smooth-content` structure required by `ScrollSmoother`.
- `LandingChapters`
  - Owns chapter structure and chapter-level pin/reveal timing.
- `PlateGroup`
  - Owns one chapter's plate composition.
- `LandingPlate`
  - Owns individual plate layout, visual styling, and `SplitText` lifecycle.

### Expected File-Level Direction

- `src/App.tsx`
  - Replace current room-selection flow with the landing composition.
- `src/VyrdxScene.tsx`
  - Either refactor into the new landing scene or split reusable scene primitives out of it.
- New landing-specific files should live under `src/` and be narrowly scoped by responsibility.
- `index.html`
  - Must allow the smooth-scroll shell instead of forcing the entire page to remain non-scrollable.

## Animation and Data Flow

### Scroll System

- Register GSAP plugins before creating triggers.
- Create `ScrollSmoother` before any plate-level `ScrollTrigger` instances.
- Use the recommended structure:
  - `#smooth-wrapper`
  - `#smooth-content`
- Fixed elements that must remain visually pinned may live outside the smooth content when required by the plugin behavior.

### Scene-to-Scroll Relationship

- The WebGL scene does not scroll.
- The plate shell scrolls over the scene.
- The center `VYRDON` lockup remains visually centered while plate groups orbit the narrative around it.

### Chapter Motion

- Each chapter uses one chapter-level trigger to manage entrance timing and pacing.
- Individual plates animate within that chapter window.
- The first chapter should feel closest to the center lockup.
- Later chapters can widen the spread and depth slightly to avoid repetition.

### SplitText Lifecycle

- `SplitText` should be created when a plate becomes active and reverted on cleanup.
- Reversion is mandatory to avoid DOM fragmentation after refreshes, route reloads, or responsive recalculation.

## Styling and Layout Rules

- The background must remain visible behind all chapters.
- Plate size is controlled by ratio, max width, and viewport clamping rather than raw inch units.
- The plate ratio is fixed at `20 / 13`.
- The page should avoid default white backgrounds and generic product-site spacing.
- The visual direction should stay in the blue-cyan atmospheric family requested by the user.
- Motion should be smooth but not floaty to the point of reducing readability.

## Responsive Behavior

### Desktop

- Chapter 1 can present 3 plates in a balanced composition.
- Chapter 2 presents 2 larger plates with more breathing room.
- Chapter 3 presents 2 plates with strongest narrative closure.
- The center `VYRDON` remains dominant.

### Tablet and Mobile

- The center lockup remains fixed but may scale down.
- Plates keep the same ratio.
- Group compositions collapse inward to preserve legibility.
- SplitText staggering should be reduced on smaller screens.
- Smoothing on touch should be conservative to avoid lag and platform mismatch.

## Error Handling and Constraints

- If WebGL fails, preserve the existing scene-fallback pattern from `VyrdxScene.tsx` so the page does not hard crash.
- If Club GSAP plugins are not locally available, implementation is blocked because the approved design explicitly requires real `ScrollSmoother` and real `SplitText`.
- Scroll-trigger setup must clean up on unmount to prevent duplicate triggers during hot reloads.
- Plate text animation must revert cleanly on resize/refresh cycles.

## Performance Constraints

- The particle field should evoke the supplied motion reference without trying to recreate the full density of the legacy example.
- Avoid overly dense particle counts that compete with the plate layer.
- Keep chapter triggers coarse and plate triggers local to reduce ScrollTrigger overhead.
- Keep the fixed stage GPU load stable while scroll motion remains primarily DOM-driven.

## Verification Plan

Implementation will be considered complete only if all of the following are verified:

- The page loads in `packages/vyrdx-app` without the old room UI.
- The background remains visible throughout the entire scroll flow.
- The 3D `VYRDON` remains visually centered throughout the landing experience.
- `ScrollSmoother` is active and the plate layer is the only narrative scroll layer.
- Seven total plates render in `3 / 2 / 2` chapter order.
- Every plate uses `SplitText` and cleans up correctly on refresh/unmount.
- The plate ratio remains consistent across desktop and mobile.
- The page remains readable and usable when WebGL fails.

## Risks

- The approved experience depends on Club GSAP plugins being present locally.
- Replacing the current `vyrdx-app` room explorer means this work should be treated as an intentional surface change, not a drive-by visual add-on.
- Fixed-scene plus smooth-scroll layering is sensitive to `overflow`, containing blocks, and pinning rules, so CSS structure must stay disciplined.
