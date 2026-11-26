import { createSignal } from "solid-js";

import { showModal } from "../../states/modals";

/** Whose zoo the My Zoo window shows: someone else's (view only) or yours. */
const [zooVisit, setZooVisit] = createSignal<
  { uid: string; name: string } | undefined
>();

export { zooVisit, setZooVisit };

/** Opens a student's zoo, view only (teacher Activity tab, Class Street). */
export function openZooVisit(uid: string, name: string): void {
  setZooVisit({ uid, name });
  showModal("Zoo");
}
