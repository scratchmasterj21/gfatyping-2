const svgCache = new Map<string, string>();

export function cachedSvg(key: string, build: () => string): string {
  let svg = svgCache.get(key);
  if (svg === undefined) {
    svg = build();
    svgCache.set(key, svg);
  }
  return svg;
}

export const SVG_WRAP_CLASS = "[&_svg]:block [&_svg]:h-auto [&_svg]:w-full";
