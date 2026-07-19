import { createSignal } from "solid-js";

import { Race, RaceParticipant } from "./race-types";

/** Whether the current user is hosting (teacher) or competing (student). */
export type RaceRole = "host" | "participant";

/** The PIN of the race the user is currently in, or null. */
export const [getActiveRacePin, setActiveRacePin] = createSignal<string | null>(
  null,
);

export const [getRaceRole, setRaceRole] = createSignal<RaceRole | null>(null);

/** Latest race control doc from the realtime subscription. */
export const [getCurrentRace, setCurrentRace] = createSignal<Race | null>(null);

/** Latest participant list from the realtime subscription. */
export const [getRaceParticipants, setRaceParticipants] = createSignal<
  RaceParticipant[]
>([]);

export function resetRaceState(): void {
  setActiveRacePin(null);
  setRaceRole(null);
  setCurrentRace(null);
  setRaceParticipants([]);
}
