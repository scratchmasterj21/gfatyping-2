import { createSignal } from "solid-js";

import type { RoomId } from "./house-rooms";

/** Which place My House is showing. Kept in memory only — switching does not write to Firestore. */
export type HouseScene = "room" | "garden" | "street";
/** A place that has its own layout/shop (not the street). */
export type HousePlace = "room" | "garden";

const [houseScene, setHouseScene] = createSignal<HouseScene>("room");

/** A classmate's house being visited (view-only), or undefined for your own. */
export type HouseVisit = { uid: string; name: string };
const [houseVisit, setHouseVisit] = createSignal<HouseVisit | undefined>();

/** Which indoor room the "room" scene shows. */
const [houseRoom, setHouseRoom] = createSignal<RoomId>("living");

/** The room/garden being shown; the street counts as the room. */
const housePlace = (): HousePlace =>
  houseScene() === "garden" ? "garden" : "room";

export {
  houseScene,
  setHouseScene,
  houseVisit,
  setHouseVisit,
  housePlace,
  houseRoom,
  setHouseRoom,
};
