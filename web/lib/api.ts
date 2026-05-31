const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function fetchApi<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, { next: { revalidate: 10 } });
  if (!res.ok) {
    throw new Error(`API ${path} returned ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface RoomSummary {
  room: string;
  status: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface BuildInfo {
  commit: string;
  branch: string;
  builtAt: string;
  nodeEnv: string;
  uptime: number;
  timestamp: string;
}
