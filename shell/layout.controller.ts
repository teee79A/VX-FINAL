export interface LayoutLane {
  id: string;
  label: string;
  purpose: string;
  priority: "critical" | "high" | "normal";
}

export class LayoutController {
  lanes(): LayoutLane[] {
    return [
      {
        id: "lane_01_core",
        label: "core",
        purpose: "terminal doctrine, policies, and route control",
        priority: "critical"
      },
      {
        id: "lane_02_runtime",
        label: "runtime",
        purpose: "vyrdx runtime verification and deploy controls",
        priority: "critical"
      },
      {
        id: "lane_03_ops",
        label: "ops",
        purpose: "vxstation operations and orchestration panels",
        priority: "high"
      },
      {
        id: "lane_04_data",
        label: "data",
        purpose: "central storage, sync, integrity, and rag spine",
        priority: "high"
      },
      {
        id: "lane_05_archive",
        label: "archive",
        purpose: "evidence snapshots and cold archive handoff",
        priority: "normal"
      },
      {
        id: "lane_06_lab",
        label: "lab",
        purpose: "ai_room experiments under controlled boundaries",
        priority: "normal"
      },
      {
        id: "lane_07_media",
        label: "media",
        purpose: "livekit, coturn, stt, tts, and voice lanes",
        priority: "high"
      },
      {
        id: "lane_08_logs",
        label: "logs",
        purpose: "alerts, rejection trails, and evidence stream",
        priority: "critical"
      }
    ];
  }
}
