export type SideImageSet = {
  label?: string;
  left: string | null;
  right: string | null;
};

export function parseSets(data: unknown): SideImageSet[] {
  if (data === null || data === undefined) return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d["sets"])) return d["sets"] as SideImageSet[];
  // legacy single-pair format (no "sets" array, just left/right at the root)
  if ("left" in d || "right" in d) {
    return [
      {
        left: (d["left"] as string | null) ?? null,
        right: (d["right"] as string | null) ?? null,
      },
    ];
  }
  return [];
}
