import { findAnimalAvatarItem } from "../animal-avatars/animal-avatar-items";
import { findTitle } from "../titles/titles";
import { AvatarCategory, AvatarShape, findAvatarItem } from "./avatar-items";

export type EquippedAvatar = {
  color?: string;
  hair?: string;
  hat?: string;
  accessory?: string;
  face?: string;
  background?: string;
  /** Hex color for the equipped leaderboard-row highlight, if any. */
  highlight?: string;
  shape?: AvatarShape;
  /**
   * Image URL for an equipped animal avatar, if any - takes over the whole
   * avatar display in place of the procedural color/hair/hat/etc pieces
   * above.
   */
  animalImage?: string;
  /** Earned title id picked by the student (see titles/titles.ts). */
  title?: string;
};

/** Resolves a raw users/{uid} doc into what `<Avatar>` needs to draw it. */
export function equippedFromDoc(data: Record<string, unknown>): EquippedAvatar {
  const equipped =
    (data["equipped"] as Partial<Record<AvatarCategory, string>> | undefined) ??
    {};
  const animalId = data["equippedAnimalAvatar"] as string | undefined;
  return {
    color:
      equipped.color === undefined
        ? undefined
        : findAvatarItem(equipped.color)?.value,
    hair: equipped.hair,
    hat: equipped.hat,
    accessory: equipped.accessory,
    face: equipped.face,
    background: equipped.background,
    highlight:
      equipped.highlight === undefined
        ? undefined
        : findAvatarItem(equipped.highlight)?.value,
    shape: data["avatarShape"] as AvatarShape | undefined,
    animalImage:
      animalId === undefined
        ? undefined
        : findAnimalAvatarItem(animalId)?.image,
    title: findTitle(data["selectedTitle"])?.id,
  };
}
