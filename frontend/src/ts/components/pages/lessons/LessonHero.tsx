import { createSignal, JSXElement, Show } from "solid-js";

import { AvatarShape } from "../../../avatar/avatar-items";
import { FaSolidIcon } from "../../../types/font-awesome";
import { Avatar } from "../../common/Avatar";
import { Fa } from "../../common/Fa";
import { Mascot } from "../../common/Mascot";
import { DailyGoalRing } from "./DailyGoalRing";

export type PracticeRecommendation = {
  icon: FaSolidIcon;
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  onStart: () => void;
  /** Scroll the lesson grid to the next lesson or checkpoint card. */
  onScrollToTarget?: () => void;
};

type AvatarProps = {
  color?: string;
  shape?: AvatarShape;
  hair?: string;
  hat?: string;
  accessory?: string;
  face?: string;
  background?: string;
  highlightColor?: string;
  animalImage?: string;
};

export function LessonHero(props: {
  signedIn: boolean;
  showClassSetupNotice: boolean;
  isNewStudent: boolean;
  streakDays: number;
  streakFreezes: number;
  avatar?: AvatarProps;
  /** Shown as a pill in the welcome card so kids always see their coins. */
  coins?: number;
}): JSXElement {
  const [showFreezeInfo, setShowFreezeInfo] = createSignal(false);
  return (
    <>
      <section class="flex flex-wrap items-center gap-3 rounded-double border-2 border-[color-mix(in_srgb,var(--sub-color)_35%,transparent)] bg-sub-alt px-4 py-3 font-kid">
        <Show
          when={props.signedIn && props.avatar !== undefined}
          fallback={<Mascot mood="happy" size={72} />}
        >
          <div class="shrink-0">
            <Avatar
              color={props.avatar?.color}
              shape={props.avatar?.shape}
              hair={props.avatar?.hair}
              hat={props.avatar?.hat}
              accessory={props.avatar?.accessory}
              face={props.avatar?.face}
              background={props.avatar?.background}
              highlightColor={props.avatar?.highlightColor}
              size={56}
              animalImage={props.avatar?.animalImage}
            />
          </div>
        </Show>
        <div class="min-w-0 flex-1 basis-48">
          <p class="lesson-hero-heading text-xl font-bold text-text">
            {props.isNewStudent ? "Welcome! 👋" : "Welcome back! 👋"}
          </p>
          <Show when={props.isNewStudent}>
            <p class="mt-1 text-base text-sub">
              Tap a big button below to start!
            </p>
          </Show>
        </div>
        <Show when={props.signedIn}>
          <DailyGoalRing class="bg-bg" />
        </Show>
        <Show when={props.signedIn && props.coins !== undefined}>
          <div
            class="flex items-center gap-2 rounded-full bg-bg px-4 py-2.5 text-lg font-bold text-main"
            aria-label={`${props.coins ?? 0} coins`}
          >
            <Fa icon="fa-coins" />
            {props.coins}
          </div>
        </Show>
        <Show when={props.streakDays > 0}>
          <div class="flex items-center gap-2 rounded-2xl bg-bg px-4 py-3 text-main">
            <Fa icon="fa-fire" />
            <span class="font-bold">{props.streakDays}</span>
            <span class="text-sub">day streak</span>
            <Show when={props.streakFreezes > 0}>
              <button
                type="button"
                class="cursor-pointer rounded bg-sub-alt px-1.5 py-0.5 text-em-xs text-sub hover:text-text pointer-coarse:min-h-8"
                title="Miss a day and this protects your streak once."
                aria-expanded={showFreezeInfo()}
                onClick={() => setShowFreezeInfo(!showFreezeInfo())}
              >
                <Fa icon="fa-snowflake" size={0.7} class="mr-1" />
                {showFreezeInfo()
                  ? "protects your streak if you miss a day"
                  : "freeze ready"}
              </button>
            </Show>
          </div>
        </Show>
      </section>

      <Show when={!props.signedIn}>
        <section class="rounded-double bg-sub-alt p-4 text-center text-base text-sub">
          <Fa icon="fa-info-circle" class="mr-2" />
          Sign in to save your lesson progress across devices.
        </section>
      </Show>

      <Show when={props.showClassSetupNotice}>
        <section class="rounded-2xl bg-sub-alt p-4 text-center">
          <div class="font-bold text-text">
            <Fa icon="fa-user-clock" class="mr-2 text-main" />
            Welcome! Your teacher is setting up your class.
          </div>
          <p class="mt-1 text-sm text-sub">
            You can start lessons now. Class assignments and scores will appear
            automatically when ready.
          </p>
        </section>
      </Show>
    </>
  );
}
