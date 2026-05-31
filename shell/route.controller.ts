import { access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

export interface LaneRoute {
  lane: string;
  label: string;
  root: string;
  class: "core" | "runtime" | "ops" | "data" | "archive" | "lab" | "media" | "logs";
}

type LaneClass = LaneRoute["class"];

const LANE_DEFS: Array<{ lane: string; label: string; class: LaneClass }> = [
  { lane: "lane_01_core",    label: "core",    class: "core" },
  { lane: "lane_02_runtime", label: "runtime", class: "runtime" },
  { lane: "lane_03_ops",     label: "ops",     class: "ops" },
  { lane: "lane_04_data",    label: "data",    class: "data" },
  { lane: "lane_05_archive", label: "archive", class: "archive" },
  { lane: "lane_06_lab",     label: "lab",     class: "lab" },
  { lane: "lane_07_media",   label: "media",   class: "media" },
  { lane: "lane_08_logs",    label: "logs",    class: "logs" },
];

function buildLaneRoutes(): LaneRoute[] {
  const towerRoot = process.env.VYRDON_TOWER_ROOT
    ?? path.join(
      process.env.KITTY_ROOT ?? path.join(import.meta.dirname, ".."),
      "../VYRDON/VYRDX/terminal/tower/vyrdon_main",
    );
  return LANE_DEFS.map((def) => ({
    ...def,
    root: path.join(towerRoot, def.lane),
  }));
}

export class RouteController {
  private readonly routes: LaneRoute[] = buildLaneRoutes();

  list(): LaneRoute[] {
    return this.routes;
  }

  async status(): Promise<Array<LaneRoute & { online: boolean }>> {
    const statuses = await Promise.all(
      this.routes.map(async (route) => {
        const online = await this.pathExists(route.root);
        return { ...route, online };
      })
    );
    return statuses;
  }

  private async pathExists(target: string): Promise<boolean> {
    try {
      await access(target, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}
