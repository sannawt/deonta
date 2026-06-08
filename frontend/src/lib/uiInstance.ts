export type UiMode = "chat" | "workflow" | "both";

export interface UiMeta {
  ui?: string;
  instance?: string;
  port?: number;
  prototype_mode?: boolean;
  ui_mode?: UiMode;
  default_route?: string;
  local_url?: string;
  peer_url?: string;
  peer_label?: string;
}

let cached: UiMeta | null = null;

export async function fetchUiMeta(): Promise<UiMeta> {
  if (cached) return cached;
  try {
    const res = await fetch("/api/ui-meta");
    if (!res.ok) throw new Error(String(res.status));
    cached = (await res.json()) as UiMeta;
    return cached;
  } catch {
    return { ui_mode: "both", default_route: "start" };
  }
}

export function clearUiMetaCache(): void {
  cached = null;
}
