import { User as UserType } from "@monkeytype/schemas/users";
import { AnimationParams } from "animejs";
import { createEffect, createSignal, JSXElement, on, Show } from "solid-js";

import {
  getMatchingFlags,
  SupportsFlags,
  UserFlagOptions,
} from "../../controllers/user-flag-controller";
import { BreakpointKey } from "../../states/breakpoints";
import { cn } from "../../utils/cn";
import { Anime } from "./anime";
import { AnimePresence } from "./anime/AnimePresence";
import { Button } from "./Button";
import { Fa } from "./Fa";
import { NotificationBubble } from "./NotificationBubble";
import { UserAvatar } from "./UserAvatar";
import { UserBadge } from "./UserBadge";
import { UserFlags } from "./UserFlags";

type Props = {
  class?: string;
  user: SupportsFlags &
    Pick<UserType, "uid" | "name" | "discordId" | "discordAvatar" | "xp"> & {
      badgeId?: number;
      avatarUrl?: string;
    };
  showAvatar?: boolean;
  avatarFallback?: "user" | "user-circle";
  avatarColor?: "text" | "sub";
  flagsColor?: "text" | "sub";
  hideNameOnSmallScreens?: boolean;
  linkToProfile?: boolean;
  level?: number;
  showSpinner?: boolean;
  showNotificationBubble?: boolean;
  fontClass?: "text-em-xs" | "text-em-sm" | "text-em-md" | "text-em-lg";
  hideBadgeTextOnWidth?: BreakpointKey;
  /** Ellipsis long names (e.g. leaderboard rows). */
  truncateName?: boolean;
} & UserFlagOptions;

export function User(props: Props): JSXElement {
  const [flashAnimation, setFlashAnimation] = createSignal<
    AnimationParams | undefined
  >(undefined);
  const [isAnimating, setIsAnimating] = createSignal(false);
  let levelEl: HTMLElement | undefined;

  createEffect(
    on(
      () => props.level,
      () => {
        const rand = (Math.random() * 2 - 1) / 4;
        const rand2 = (Math.random() + 1) / 2;
        setFlashAnimation({
          scale: [1 + 0.5 * rand2, 1],
          backgroundColor: [
            "var(--themable-button-active)",
            "var(--themable-button-text)",
          ],
          rotate: [10 * rand, 0],
          duration: 2000,
          ease: "out(5)",
          onBegin: () => setIsAnimating(true),
          onComplete: () => {
            setIsAnimating(false);
            if (levelEl) {
              levelEl.style.backgroundColor = "";
            }
          },
        });
      },
      { defer: true },
    ),
  );

  return (
    <div
      class={cn(
        props.truncateName === true
          ? "flex max-w-full min-w-0 items-center gap-[0.5em]"
          : "grid grid-flow-col place-items-center gap-[0.5em]",
        props.class,
      )}
    >
      <Show when={props.showAvatar ?? true}>
        <div
          class={cn("relative w-[1.25em]", props.truncateName && "shrink-0")}
          data-ui-element="navAvatar"
        >
          <NotificationBubble
            variant="atCorner"
            show={props.showNotificationBubble ?? false}
            class="z-2 m-0.5"
          />
          <div class="grid place-items-center">
            <AnimePresence exitBeforeEnter>
              <Show
                when={props.showSpinner ?? false}
                fallback={
                  <Anime
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, duration: 125 }}
                    exit={{ opacity: 0, duration: 125 }}
                  >
                    <UserAvatar
                      uid={props.user.uid}
                      class={cn(
                        "h-[1.25em] w-[1.25em]",
                        props.avatarColor === "text" && "text-text",
                        props.avatarColor === "sub" && "text-sub",
                      )}
                    />
                  </Anime>
                }
              >
                <Anime
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, duration: 125 }}
                  exit={{ opacity: 0, duration: 125 }}
                >
                  <Fa icon={"fa-circle-notch"} spin={true} />
                </Anime>
              </Show>
            </AnimePresence>
          </div>
        </div>
      </Show>
      <div
        class={cn(props.fontClass, {
          "hidden sm:block": props.hideNameOnSmallScreens,
          "min-w-0 flex-1 truncate": props.truncateName === true,
        })}
        title={props.truncateName === true ? props.user.name : undefined}
      >
        <Show when={props.linkToProfile ?? false} fallback={props.user.name}>
          <Button
            variant="text"
            href={`/profile/${props.user.name}`}
            text={props.user.name}
            router-link
            class={cn(
              "px-0",
              props.truncateName === true &&
                "block max-w-full min-w-0 truncate text-left",
            )}
          />
        </Show>
      </div>

      <Show
        when={
          getMatchingFlags({ ...props.user, isFriend: props.isFriend }).length >
          0
        }
      >
        <div
          class={cn(
            "flex items-center justify-center gap-[0.5em]",
            props.truncateName && "shrink-0",
            cn(
              props.flagsColor === "text" && "text-text",
              props.flagsColor === "sub" && "text-sub",
            ),
          )}
        >
          <UserFlags
            {...props.user}
            isFriend={props.isFriend}
            iconsOnly={props.iconsOnly}
          />
        </div>
      </Show>
      <Show when={props.user.badgeId !== undefined}>
        <div class={cn(props.truncateName && "shrink-0")}>
          <UserBadge
            id={props.user.badgeId}
            hideTextOnWidth={props.hideBadgeTextOnWidth}
          />
        </div>
      </Show>
      <Show when={props.level !== undefined}>
        <Anime
          ref={(el) => (levelEl = el)}
          animation={flashAnimation()}
          class={cn(
            "bg-(--themable-button-text) text-(--bg-color)",
            "rounded-half px-[0.5em] py-[0.1em] text-[0.7em]",
            { "transition-colors duration-125": !isAnimating() },
          )}
          data-ui-element="userLevel"
        >
          {props.level}
        </Anime>
      </Show>
    </div>
  );
}
