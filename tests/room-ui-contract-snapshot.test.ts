import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.env.KITTY_ROOT ?? path.join(import.meta.dirname, "..");
const GLOBALS_CSS_PATH = path.join(ROOT, "web", "app", "globals.css");
const ROOM_VIEW_PATH = path.join(ROOT, "web", "app", "rooms", "RoomContractView.tsx");

async function loadContracts() {
  const [globalsCss, roomView] = await Promise.all([
    readFile(GLOBALS_CSS_PATH, "utf8"),
    readFile(ROOM_VIEW_PATH, "utf8"),
  ]);
  return { globalsCss, roomView };
}

describe("room ui contract lock", () => {
  it("locks typography tokens (font family and size)", async () => {
    const { globalsCss } = await loadContracts();

    const fontContract = {
      hasIbmPlexMonoImport: globalsCss.includes("IBM+Plex+Mono"),
      hasMonoFamily: globalsCss.includes('font-family: "IBM Plex Mono", monospace;'),
      hasBase14px: globalsCss.includes("font-size: 14px;"),
    };

    expect(fontContract).toMatchInlineSnapshot(`
      {
        "hasBase14px": true,
        "hasIbmPlexMonoImport": true,
        "hasMonoFamily": true,
      }
    `);
  });

  it("locks footer presence and ordering text", async () => {
    const { roomView } = await loadContracts();

    const footerContract = {
      hasFooterTag: roomView.includes("<footer className=\"room-footer\">"),
      hasRightsReserved: roomView.includes("© 2026 VYRDON. All rights reserved."),
      hasCalendarLine: roomView.includes("Calendar:"),
      hasPlaneLine: roomView.includes("Plane: ASUS authority / DELL execution"),
      hasRecordClassLine: roomView.includes("Record class:"),
    };

    expect(footerContract).toMatchInlineSnapshot(`
      {
        "hasCalendarLine": true,
        "hasFooterTag": true,
        "hasPlaneLine": true,
        "hasRecordClassLine": true,
        "hasRightsReserved": true,
      }
    `);
  });

  it("locks certificate accent isolation", async () => {
    const { globalsCss, roomView } = await loadContracts();

    const accentContract = {
      accentTokenUsageInCss: (globalsCss.match(/var\(--certificate-accent\)/g) ?? []).length,
      accentClassDefinitionCount: (globalsCss.match(/\.certificate-accent/g) ?? []).length,
      accentClassUsageInRoomView: (roomView.match(/certificate-accent/g) ?? []).length,
    };

    expect(accentContract).toMatchInlineSnapshot(`
      {
        "accentClassDefinitionCount": 1,
        "accentClassUsageInRoomView": 1,
        "accentTokenUsageInCss": 1,
      }
    `);
  });

  it("locks room block order", async () => {
    const { roomView } = await loadContracts();
    const cardTitles = Array.from(roomView.matchAll(/<div className="card-title">([^<]+)<\/div>/g)).map(
      (match) => match[1],
    );

    expect(cardTitles).toMatchInlineSnapshot(`
      [
        "summary",
        "summary",
        "status_reasons",
        "change_events",
        "actions",
      ]
    `);

    const enforcedOrder = ["summary", "status_reasons", "change_events", "actions"];
    const orderedIndexes = enforcedOrder.map((label) => cardTitles.indexOf(label));
    const [summaryIndex, statusReasonsIndex, changeEventsIndex, actionsIndex] = orderedIndexes;
    expect(orderedIndexes.every((index) => index >= 0)).toBe(true);
    expect(summaryIndex).toBeDefined();
    expect(statusReasonsIndex).toBeDefined();
    expect(changeEventsIndex).toBeDefined();
    expect(actionsIndex).toBeDefined();
    expect(summaryIndex! < statusReasonsIndex! && statusReasonsIndex! < changeEventsIndex! && changeEventsIndex! < actionsIndex!).toBe(true);
  });
});
