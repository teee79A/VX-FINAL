import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const HOST_ROOT = process.env.VYRDON_PREVIEW_PATH ?? "/home/t79/kitty/verfy/vyrdon.com";
const INDEX_PATH = path.join(HOST_ROOT, "index.html");
const APP_PATH = path.join(HOST_ROOT, "app.js");
const STYLE_PATH = path.join(HOST_ROOT, "style.css");

describe.skipIf(!existsSync(HOST_ROOT))("vyrdon static host preview", () => {
  it("uses local runtime assets and the rebuilt shell markup", () => {
    const html = readFileSync(INDEX_PATH, "utf8");

    expect(html).toContain('<canvas id="space-canvas"');
    expect(html).toContain('class="topbar"');
    expect(html).toContain('id="runtime-chip"');
    expect(html).toContain('id="center-logo"');
    expect(html).toContain('id="room-panel"');
    expect(html).toContain('id="drag-proxy"');

    expect(html).toContain("./vendor/three.min.js");
    expect(html).toContain("./vendor/gsap.min.js");
    expect(html).toContain("./vendor/ScrollTrigger.min.js");
    expect(html).toContain("Draggable.min.js");

    expect(existsSync(path.join(HOST_ROOT, "vendor", "three.min.js"))).toBe(true);
    expect(existsSync(path.join(HOST_ROOT, "vendor", "gsap.min.js"))).toBe(true);
    expect(existsSync(path.join(HOST_ROOT, "vendor", "ScrollTrigger.min.js"))).toBe(true);
  });

  it("keeps the experience viewable when webgl fails and drives the equation shell", () => {
    const js = readFileSync(APP_PATH, "utf8");

    expect(js).toContain("body.classList.add(\"no-webgl\")");
    expect(js).toContain("WebGL fail:");
    expect(js).toContain("function createStars()");
    expect(js).toContain("function createVyrdonMesh()");
    expect(js).toContain("function createFloatingBoxes()");
    expect(js).toContain("document.getElementById(\"space-canvas\")");
  });

  it("styles the host as a technical floating shell instead of the old plate page", () => {
    const css = readFileSync(STYLE_PATH, "utf8");

    expect(css).toContain('--font-mono: "IBM Plex Mono"');
    expect(css).toContain("#space-canvas");
    expect(css).toContain(".center-logo");
    expect(css).toContain(".topbar");
    expect(css).toContain(".runtime-chip");
    expect(css).toContain(".room-panel");
  });
});
