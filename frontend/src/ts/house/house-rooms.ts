import { deleteField, doc, setDoc } from "firebase/firestore";

import { callApi } from "../api-client";
import { getDb } from "../firebase";

/**
 * Extra rooms. Furniture is bought once and lives in ONE room at a time
 * (users.houseItemRooms: itemId -> room; missing = living room), so its
 * saved position/size still apply wherever it is. Rooms unlock from lesson
 * trophies (users.achievements, see lessons/achievements.ts).
 */

export type RoomId = "living" | "bedroom" | "kitchen" | "playroom";

export type HouseRoom = {
  id: RoomId;
  name: string;
  emoji: string;
  /** lesson trophy that unlocks it (none = always open) */
  unlockAchievement?: string;
  goal?: string;
};

export const HOUSE_ROOMS: HouseRoom[] = [
  { id: "living", name: "Living room", emoji: "🛋️" },
  {
    id: "bedroom",
    name: "Bedroom",
    emoji: "🛏️",
    unlockAchievement: "home-row-done",
    goal: "Finish the Home row lessons",
  },
  {
    id: "kitchen",
    name: "Kitchen",
    emoji: "🍳",
    unlockAchievement: "top-row-done",
    goal: "Finish the Top row lessons",
  },
  {
    id: "playroom",
    name: "Playroom",
    emoji: "🎮",
    unlockAchievement: "all-letters",
    goal: "Finish the All keys lessons",
  },
];

export function isRoomId(value: unknown): value is RoomId {
  return HOUSE_ROOMS.some((r) => r.id === value);
}

export function isRoomUnlocked(
  room: HouseRoom,
  achievements: string[],
): boolean {
  return (
    room.unlockAchievement === undefined ||
    achievements.includes(room.unlockAchievement)
  );
}

/** Which room an item is in (living room unless moved). */
export function roomOfItem(
  itemRooms: Record<string, RoomId>,
  itemId: string,
): RoomId {
  return itemRooms[itemId] ?? "living";
}

/** Moves one piece of furniture to another room. */
export async function setItemRoom(
  uid: string,
  itemId: string,
  room: RoomId,
): Promise<void> {
  await setDoc(
    doc(getDb(), "users", uid),
    { houseItemRooms: { [itemId]: room === "living" ? deleteField() : room } },
    { merge: true },
  );
}

/** Wallpaper/floor for an extra room - ownership checked server-side. */
export async function selectRoomTheme(
  room: Exclude<RoomId, "living">,
  themeId: string,
): Promise<void> {
  await callApi("/api/equip-item", {
    target: "roomTheme",
    room,
    itemId: themeId,
  });
}
