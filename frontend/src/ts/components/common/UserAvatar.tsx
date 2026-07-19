import { useQuery } from "@tanstack/solid-query";
import { JSXElement } from "solid-js";

import { getEquippedAvatar } from "../../avatar/avatar-state";
import { Avatar } from "./Avatar";

type Props = {
  uid: string;
  size?: number;
  class?: string;
  celebrate?: boolean;
};

/** The app's default profile picture - a procedural avatar customized by whatever the student has equipped. */
export function UserAvatar(props: Props): JSXElement {
  const equippedQuery = useQuery(() => ({
    queryKey: ["avatarEquipped", props.uid],
    queryFn: async () => getEquippedAvatar(props.uid),
    staleTime: 5 * 60 * 1000,
  }));

  return (
    <Avatar
      color={equippedQuery.data?.color}
      shape={equippedQuery.data?.shape}
      hair={equippedQuery.data?.hair}
      hat={equippedQuery.data?.hat}
      accessory={equippedQuery.data?.accessory}
      face={equippedQuery.data?.face}
      background={equippedQuery.data?.background}
      highlightColor={equippedQuery.data?.highlight}
      celebrate={props.celebrate}
      size={props.size}
      class={props.class}
    />
  );
}
