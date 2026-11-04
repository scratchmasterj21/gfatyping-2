import { createSignal } from "solid-js";

/** Which place My House is showing. Kept in memory only — switching does not write to Firestore. */
export type HouseScene = "room" | "garden";

const [houseScene, setHouseScene] = createSignal<HouseScene>("room");

export { houseScene, setHouseScene };
