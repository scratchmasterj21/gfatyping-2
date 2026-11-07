import { For, JSXElement, Show } from "solid-js";

import type { StudentSummary } from "../../../classroom/assignments";

import {
  CERTIFICATE_LEVELS,
  CertificateLevel,
  certificateNumber,
  nextLevel,
  reachedOn,
  stillNeeds,
} from "../../../classroom/certificate-levels";
import { cn } from "../../../utils/cn";
import { Avatar } from "../../common/Avatar";

/** Colours per level, from the game palette. */
const LEVEL_STYLE: Record<
  CertificateLevel["id"],
  {
    text: string;
    border: string;
    seal: string;
    line: string;
    ribbon: string;
    icon: string;
  }
> = {
  bronze: {
    text: "text-game-brown",
    border: "border-game-brown",
    seal: "text-game-orange",
    line: "bg-game-orange",
    ribbon: "text-game-brown",
    icon: "🥉",
  },
  silver: {
    text: "text-game-navy",
    border: "border-game-grey",
    seal: "text-game-grey",
    line: "bg-game-grey",
    ribbon: "text-game-navy",
    icon: "🥈",
  },
  gold: {
    text: "text-game-brown-dark",
    border: "border-game-gold",
    seal: "text-game-gold",
    line: "bg-game-gold",
    ribbon: "text-game-orange",
    icon: "🥇",
  },
  star: {
    text: "text-game-purple",
    border: "border-game-purple",
    seal: "text-game-purple",
    line: "bg-game-purple",
    ribbon: "text-game-pink",
    icon: "🌟",
  },
};

function formatName(name: string): string {
  if (name.includes(" ")) return name;
  return name.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function formatLongDate(at: number): string {
  return new Date(at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** A starburst points string for the seal. */
function burst(points: number, outer: number, inner: number): string {
  const out: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    out.push(`${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`);
  }
  return out.join(" ");
}

function Seal(props: { level: CertificateLevel }): JSXElement {
  const style = (): (typeof LEVEL_STYLE)[CertificateLevel["id"]] =>
    LEVEL_STYLE[props.level.id];
  return (
    <svg viewBox="0 0 100 120" class="h-full w-auto" aria-hidden="true">
      {/* ribbon tails */}
      <g class={style().ribbon} fill="currentColor">
        <polygon points="30,70 20,118 34,108 44,118 50,74"></polygon>
        <polygon points="70,70 80,118 66,108 56,118 50,74"></polygon>
      </g>
      <g class={style().seal} fill="currentColor">
        <polygon points={burst(24, 48, 42)}></polygon>
      </g>
      <circle
        cx="50"
        cy="50"
        r="36"
        class="text-game-cream"
        fill="currentColor"
      ></circle>
      <circle
        cx="50"
        cy="50"
        r="32"
        class={style().seal}
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        style={{ "stroke-dasharray": "3 2" }}
      ></circle>
      <text
        x="50"
        y="50"
        text-anchor="middle"
        font-size="22"
        // a site-wide rule fades SVG text; keep the seal's text visible
        style={{ fill: "currentColor", opacity: 1 }}
      >
        {style().icon}
      </text>
      <text
        x="50"
        y="68"
        text-anchor="middle"
        font-size="9"
        style={{
          fill: "currentColor",
          opacity: 1,
          "font-weight": "700",
          "letter-spacing": "1px",
        }}
        class={style().text}
        fill="currentColor"
      >
        {props.level.name.toUpperCase()}
      </text>
    </svg>
  );
}

function Stat(props: { value: string; label: string }): JSXElement {
  return (
    <div class="rounded-[1cqw] bg-game-ink/5 px-[1.5cqw] py-[0.8cqw]">
      <div class="text-[2.6cqw] leading-tight font-bold text-game-ink">
        {props.value}
      </div>
      <div class="text-[1.2cqw] tracking-wide text-game-ink/60 uppercase">
        {props.label}
      </div>
    </div>
  );
}

/**
 * A printable certificate on cream "paper" (looks the same on screen and on
 * A4 landscape): level title and what it means, the student's results, a
 * medal seal, signatures, the date reached and a certificate number. All
 * sizes are in container units so it scales as one piece.
 */
export function CertificateCard(props: {
  id?: string;
  data: StudentSummary;
  level?: CertificateLevel;
}): JSXElement {
  const reachedAt = (): number | undefined =>
    props.level === undefined
      ? undefined
      : reachedOn(props.level, props.data.lessonMarks);
  const toward = (): CertificateLevel =>
    nextLevel(props.data) ?? (CERTIFICATE_LEVELS[0] as CertificateLevel);
  const style = (): (typeof LEVEL_STYLE)[CertificateLevel["id"]] =>
    LEVEL_STYLE[(props.level ?? toward()).id];

  return (
    <div
      id={props.id}
      class="gfa-certificate relative mx-auto aspect-[297/210] w-full max-w-4xl overflow-hidden rounded-lg bg-game-cream font-kid text-game-ink shadow-xl"
      style={{ "container-type": "inline-size" }}
    >
      {/* soft corner flourishes */}
      <div class="pointer-events-none absolute -top-[6cqw] -left-[6cqw] h-[18cqw] w-[18cqw] rounded-full bg-game-yellow/30"></div>
      <div class="pointer-events-none absolute -right-[6cqw] -bottom-[6cqw] h-[18cqw] w-[18cqw] rounded-full bg-game-sky/30"></div>

      <div
        class={cn(
          "absolute inset-[1.6cqw] rounded-[1cqw] border-[0.6cqw] border-double",
          style().border,
        )}
      ></div>
      <div
        class={cn(
          "absolute inset-[2.8cqw] rounded-[0.6cqw] border-[0.15cqw] opacity-50",
          style().border,
        )}
      ></div>

      <div class="relative flex h-full flex-col items-center justify-between px-[7cqw] py-[4.5cqw] text-center">
        {/* top */}
        <div class="flex flex-col items-center gap-[0.6cqw]">
          <img
            src="/images/Felice Logo.svg"
            alt="Felice School"
            class="cert-logo h-[3.2cqw] w-auto"
          />
          <div class="text-[1.3cqw] tracking-[0.3em] text-game-ink/60 uppercase">
            GFA Typing
          </div>
          <div
            class={cn(
              "text-[4.4cqw] leading-none font-bold tracking-wide",
              style().text,
            )}
          >
            <Show when={props.level} fallback="Progress Certificate">
              Certificate of Achievement
            </Show>
          </div>
          <Show when={props.level}>
            {(level) => (
              <div
                class={cn(
                  "rounded-full border-[0.2cqw] px-[2cqw] py-[0.3cqw] text-[1.6cqw] font-semibold tracking-widest uppercase",
                  style().border,
                  style().text,
                )}
              >
                {level().name} level · {level().title}
              </div>
            )}
          </Show>
        </div>

        {/* middle */}
        <div class="flex flex-col items-center gap-[0.8cqw]">
          <div class="text-[1.6cqw] text-game-ink/70 italic">
            This certificate is proudly presented to
          </div>
          <div class="flex items-center gap-[2cqw]">
            <Show when={props.data.avatar}>
              {(a) => (
                <div class="h-[7cqw] w-[7cqw]">
                  <Avatar
                    color={a().color}
                    shape={a().shape}
                    hair={a().hair}
                    hat={a().hat}
                    accessory={a().accessory}
                    face={a().face}
                    background={a().background}
                    animalImage={a().animalImage}
                    class="h-full w-full"
                  />
                </div>
              )}
            </Show>
            <div class="text-[5.4cqw] leading-tight font-bold text-game-ink">
              {formatName(props.data.name)}
            </div>
          </div>
          <div
            class={cn(
              "h-[0.25cqw] w-[45cqw] rounded-full opacity-60",
              style().line,
            )}
          ></div>
          <Show when={props.data.classId}>
            {(c) => (
              <div class="text-[1.5cqw] text-game-ink/60">Class {c()}</div>
            )}
          </Show>
          <div class="max-w-[70cqw] text-[1.8cqw] leading-snug text-game-ink/80">
            <Show
              when={props.level}
              fallback={
                <>
                  is working hard toward the <b>{toward().name} certificate</b>{" "}
                  ({toward().title}). Still to go:{" "}
                  {stillNeeds(toward(), props.data)}.
                </>
              }
            >
              {(level) => (
                <>
                  for becoming a <b>{level().title}</b> - showing they can{" "}
                  {level().meaning}.
                </>
              )}
            </Show>
          </div>
          <div class="mt-[0.6cqw] grid grid-cols-4 gap-[1.2cqw]">
            <For
              each={[
                [`${Math.round(props.data.bestWpm)}`, "words per minute"],
                [`${Math.round(props.data.bestAcc)}%`, "accuracy"],
                [`${props.data.lessonsCompleted}`, "lessons passed"],
                [`${props.data.lessonStars} ★`, "stars earned"],
              ]}
            >
              {([value, label]) => (
                <Stat value={value ?? ""} label={label ?? ""} />
              )}
            </For>
          </div>
        </div>

        {/* bottom */}
        <div class="grid w-full grid-cols-[1fr_auto_1fr] items-end gap-[3cqw]">
          <div class="text-[1.3cqw] text-game-ink/70">
            <div class="h-[3cqw]"></div>
            <div class="border-t-[0.15cqw] border-game-ink/40 pt-[0.5cqw] tracking-wider">
              Head of English
            </div>
          </div>
          <div class="h-[12cqw]">
            <Show
              when={props.level}
              fallback={<div class="w-[10cqw] text-[6cqw]">⌨️</div>}
            >
              {(level) => <Seal level={level()} />}
            </Show>
          </div>
          <div class="text-[1.3cqw] text-game-ink/70">
            <div class="h-[3cqw]"></div>
            <div class="border-t-[0.15cqw] border-game-ink/40 pt-[0.5cqw] tracking-wider">
              Computer Class Teacher
            </div>
          </div>
          <div class="col-span-3 -mt-[1cqw] flex justify-between text-[1.1cqw] tracking-wider text-game-ink/50 uppercase">
            <span>
              {reachedAt() !== undefined
                ? `Reached ${formatLongDate(reachedAt() ?? 0)}`
                : `Issued ${formatLongDate(Date.now())}`}
            </span>
            <Show when={props.level}>
              {(level) => (
                <span>
                  No. {certificateNumber(props.data.uid, level(), reachedAt())}
                </span>
              )}
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
