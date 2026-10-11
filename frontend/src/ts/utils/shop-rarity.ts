export type Rarity = "common" | "rare" | "epic" | "legendary" | "limited";

export const RARITY_LABELS: Record<Rarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  limited: "Limited",
};

/** Price-based tiers shared by every shop; achievement items are legendary. */
export function rarityFor(
  price: number | undefined,
  limited: boolean,
  achievement = false,
): Rarity {
  if (achievement) return "legendary";
  if (limited) return "limited";
  const p = price ?? 0;
  if (p >= 55) return "epic";
  if (p >= 40) return "rare";
  return "common";
}

export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** 1-12 in Asia/Tokyo, matching how seasonal items are scheduled. */
export function currentJapanMonth(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      month: "numeric",
      timeZone: "Asia/Tokyo",
    }).format(new Date()),
  );
}
