export interface HotkeyBinding {
  key: string;
  action: string;
  lane: string;
  risk: "safe" | "guarded";
}

export class HotkeyController {
  private readonly bindings: HotkeyBinding[] = [
    {
      key: "ctrl+shift+r",
      action: "tower.radar.snapshot",
      lane: "lane_08_logs",
      risk: "safe"
    },
    {
      key: "ctrl+shift+l",
      action: "tower.lanes.status",
      lane: "lane_01_core",
      risk: "safe"
    },
    {
      key: "ctrl+shift+s",
      action: "vyrdx.status",
      lane: "lane_02_runtime",
      risk: "guarded"
    },
    {
      key: "ctrl+shift+o",
      action: "vxstation.ops.registry",
      lane: "lane_03_ops",
      risk: "safe"
    },
    {
      key: "ctrl+shift+m",
      action: "media.stack.status",
      lane: "lane_07_media",
      risk: "safe"
    }
  ];

  list(): HotkeyBinding[] {
    return this.bindings;
  }
}
