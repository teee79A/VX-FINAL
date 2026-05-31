import { describe, expect, it } from "vitest";
import {
  CEO_ENGINE_LAYER_ORDER,
  CEO_SERVER_LAYER_ORDER,
  bootCeoEngineLayers,
  bootCeoServerLayers,
  createCeoTopologySnapshot,
} from "../ENGINES/ceo/index.js";

describe("CEO topology", () => {
  it("keeps the normalized engine layer set at parity", () => {
    const engines = bootCeoEngineLayers();
    const snapshot = createCeoTopologySnapshot(engines, bootCeoServerLayers());

    expect(snapshot.parity.engines).toBe(true);
    expect(snapshot.engineLayers).toHaveLength(10);
    expect(snapshot.engineLayers.map((entry) => entry.layer)).toEqual([...CEO_ENGINE_LAYER_ORDER]);
    expect(snapshot.engineLayers.map((entry) => entry.slot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(snapshot.engineLayers.some((entry) => entry.layer === "evidence")).toBe(true);
    expect(snapshot.engineLayers.some((entry) => entry.layer === "campaign")).toBe(true);
  });

  it("keeps the normalized server layer map complete", () => {
    const servers = bootCeoServerLayers();
    const snapshot = createCeoTopologySnapshot(bootCeoEngineLayers(), servers);

    expect(snapshot.parity.servers).toBe(true);
    expect(snapshot.serverLayers).toHaveLength(10);
    expect(snapshot.serverLayers.map((entry) => entry.serverLayer)).toEqual([...CEO_SERVER_LAYER_ORDER]);
    expect(snapshot.serverLayers.map((entry) => entry.slot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
