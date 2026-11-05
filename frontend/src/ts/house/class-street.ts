import { collection, getDocs, query, where } from "firebase/firestore";

import { EquippedAvatar, equippedFromDoc } from "../avatar/equipped-from-doc";
import { getDb } from "../firebase";
import { PetState, petStateFromDoc } from "../pet-shop/pet-state";
import { queryClient } from "../queries";
import { HouseState, houseStateFromDoc } from "./house-state";

export type StreetHouse = {
  uid: string;
  name: string;
  isMe: boolean;
  equipped: EquippedAvatar;
  house: HouseState;
  pets: PetState;
};

/**
 * Every house on your class's street. One read per classmate (their user
 * doc holds the whole house), cached by the caller; also seeds the house /
 * avatar / pet caches so visiting a house costs no extra reads.
 */
export async function getClassStreet(
  classId: string,
  myUid: string | null,
): Promise<StreetHouse[]> {
  const snap = await getDocs(
    query(collection(getDb(), "users"), where("classId", "==", classId)),
  );
  const houses = snap.docs.map((d) => {
    const data = d.data();
    const uid = typeof data["uid"] === "string" ? data["uid"] : d.id;
    return {
      uid,
      name: typeof data["name"] === "string" ? data["name"] : "Student",
      isMe: uid === myUid,
      equipped: equippedFromDoc(data),
      house: houseStateFromDoc(data),
      pets: petStateFromDoc(data),
    };
  });
  for (const h of houses) {
    if (h.isMe) continue; // your own house always loads fresh
    queryClient.setQueryData(["houseState", h.uid], h.house);
    queryClient.setQueryData(["houseEquippedAvatar", h.uid], h.equipped);
    queryClient.setQueryData(["petState", h.uid], h.pets);
  }
  return houses.sort(
    (a, b) => Number(b.isMe) - Number(a.isMe) || a.name.localeCompare(b.name),
  );
}
