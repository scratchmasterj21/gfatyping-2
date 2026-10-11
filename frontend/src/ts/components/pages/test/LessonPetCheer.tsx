import { useQuery } from "@tanstack/solid-query";
import { JSXElement, Show } from "solid-js";

import { PET_ITEMS, PetItem } from "../../../pet-shop/pet-items";
import { getPetState } from "../../../pet-shop/pet-state";
import { getUserId } from "../../../states/core";
import { PetSprite } from "../../common/PetSprite";

const CHEERS = ["Great job!", "You did it!", "Keep going!", "Wow, nice!"];

/** The student's first placed pet, cheering on the lesson result. */
export function LessonPetCheer(props: { enabled: boolean }): JSXElement {
  const petQuery = useQuery(() => ({
    queryKey: ["petState", getUserId()],
    queryFn: async () => {
      const uid = getUserId();
      if (uid === null) return { coins: 0, ownedPets: {}, storedPets: {} };
      return getPetState(uid);
    },
    enabled: props.enabled && getUserId() !== null,
    staleTime: 5 * 60 * 1000,
  }));

  const pet = (): PetItem | undefined => {
    const data = petQuery.data;
    if (data === undefined) return undefined;
    return PET_ITEMS.find(
      (p) => data.ownedPets[p.id] === true && data.storedPets[p.id] !== true,
    );
  };
  const cheer = CHEERS[Math.floor(Math.random() * CHEERS.length)];

  return (
    <Show when={pet()}>
      {(p) => (
        <div class="flex items-end justify-center gap-2 py-1">
          <div class="animate-bounce">
            <PetSprite species={p().species} sizePx={48} />
          </div>
          <span class="mb-6 rounded-lg bg-sub-alt px-3 py-1 text-sm font-medium text-text">
            {cheer}
          </span>
        </div>
      )}
    </Show>
  );
}
