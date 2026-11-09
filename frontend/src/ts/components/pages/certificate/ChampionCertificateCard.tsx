import { For, JSXElement, Show } from "solid-js";

import type { ChampionRecord } from "../../../race/race-db";

import { cn } from "../../../utils/cn";
import { schoolYearLabel, schoolYearOf } from "../../../utils/school-year";
import { formatLongDate } from "./CertificateCard";

type PlaceStyle = {
  title: string;
  icon: string;
  text: string;
  border: string;
  seal: string;
  line: string;
  ribbon: string;
};

const PLACE: Record<1 | 2 | 3, PlaceStyle> = {
  1: {
    title: "Class Champion",
    icon: "👑",
    text: "text-game-brown-dark",
    border: "border-game-gold",
    seal: "text-game-gold",
    line: "bg-game-gold",
    ribbon: "text-game-red",
  },
  2: {
    title: "Runner-up",
    icon: "🥈",
    text: "text-game-navy",
    border: "border-game-grey",
    seal: "text-game-grey",
    line: "bg-game-grey",
    ribbon: "text-game-blue",
  },
  3: {
    title: "Third Place",
    icon: "🥉",
    text: "text-game-brown",
    border: "border-game-brown",
    seal: "text-game-orange",
    line: "bg-game-orange",
    ribbon: "text-game-brown",
  },
};

function formatName(name: string): string {
  if (name.includes(" ")) return name;
  return name.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function burst(points: number, outer: number, inner: number): string {
  const out: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    out.push(`${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`);
  }
  return out.join(" ");
}

/** Stable certificate number, e.g. "GFA-2026-CH1-7K3Q". */
export function championCertificateNumber(
  record: ChampionRecord,
  place: number,
): string {
  let hash = 0;
  for (const ch of `${record.id}:${place}`) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  const code = hash.toString(36).toUpperCase().padStart(4, "0").slice(-4);
  return `GFA-${schoolYearOf(record.crownedAt)}-CH${place}-${code}`;
}

function Seal(props: { style: PlaceStyle; place: number }): JSXElement {
  return (
    <svg viewBox="0 0 100 120" class="h-full w-auto" aria-hidden="true">
      <g class={props.style.ribbon} fill="currentColor">
        <polygon points="30,70 20,118 34,108 44,118 50,74"></polygon>
        <polygon points="70,70 80,118 66,108 56,118 50,74"></polygon>
      </g>
      <g class={props.style.seal} fill="currentColor">
        <polygon points={burst(24, 48, 42)}></polygon>
      </g>
      <circle
        cx="50"
        cy="50"
        r="36"
        class="text-game-cream"
        fill="currentColor"
      ></circle>
      <text
        x="50"
        y="52"
        text-anchor="middle"
        font-size="26"
        style={{ fill: "currentColor", opacity: 1 }}
      >
        {props.style.icon}
      </text>
      <text
        x="50"
        y="70"
        text-anchor="middle"
        font-size="9"
        class={props.style.text}
        fill="currentColor"
        style={{
          fill: "currentColor",
          opacity: 1,
          "font-weight": "700",
          "letter-spacing": "1px",
        }}
      >
        {props.place === 1 ? "CHAMPION" : props.place === 2 ? "2ND" : "3RD"}
      </text>
    </svg>
  );
}

/**
 * Printable certificate for a Class Championship podium finish: gold for
 * the Class Champion, silver for 2nd, bronze for 3rd. Same cream-paper
 * layout as the level certificates (container units, prints as one piece).
 */
export function ChampionCertificateCard(props: {
  id?: string;
  record: ChampionRecord;
  place: 1 | 2 | 3;
}): JSXElement {
  const style = (): PlaceStyle => PLACE[props.place];
  const person = (): ChampionRecord["podium"][number] | undefined =>
    props.record.podium[props.place - 1];
  const classmates = (): number => Math.max(0, props.record.players - 1);
  const year = (): string =>
    schoolYearLabel(schoolYearOf(props.record.crownedAt));
  const rounds = (): number | undefined => props.record.rounds;
  const sentence = (): string => {
    const where = `in Class ${props.record.classId}, ${year()}`;
    const over = rounds() !== undefined ? ` over ${rounds()} rounds` : "";
    if (props.place === 1) {
      return `for winning the Class Typing Championship ${where} - beating ${classmates()} classmates${over}.`;
    }
    const nth = props.place === 2 ? "2nd" : "3rd";
    return `for finishing ${nth} in the Class Typing Championship ${where}, against ${classmates()} classmates${over}.`;
  };
  const wins = (): number | undefined =>
    props.place === 1 ? props.record.wins : person()?.wins;
  const stats = (): [string, string][] => [
    [`${person()?.points ?? 0}`, "points"],
    ...(wins() !== undefined
      ? ([[`${wins()}`, "rounds won"]] as [string, string][])
      : []),
    [`${props.record.players}`, "players"],
    ...(rounds() !== undefined
      ? ([[`${rounds()}`, "rounds"]] as [string, string][])
      : []),
  ];

  return (
    <div
      id={props.id}
      class="gfa-certificate relative mx-auto aspect-[297/210] w-full max-w-4xl overflow-hidden rounded-lg bg-game-cream font-kid text-game-ink shadow-xl"
      style={{ "container-type": "inline-size" }}
    >
      <div class="pointer-events-none absolute -top-[6cqw] -left-[6cqw] h-[18cqw] w-[18cqw] rounded-full bg-game-yellow/30"></div>
      <div class="pointer-events-none absolute -right-[6cqw] -bottom-[6cqw] h-[18cqw] w-[18cqw] rounded-full bg-game-pink/20"></div>
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
        <div class="flex flex-col items-center gap-[0.6cqw]">
          <img
            src="/images/Felice Logo.svg"
            alt="Felice School"
            class="cert-logo h-[3.2cqw] w-auto"
          />
          <div class="text-[1.3cqw] tracking-[0.3em] text-game-ink/60 uppercase">
            GFA Typing · Class Typing Championship
          </div>
          <div
            class={cn(
              "text-[5cqw] leading-none font-bold tracking-wide",
              style().text,
            )}
          >
            {style().icon} {style().title}
          </div>
          <div
            class={cn(
              "rounded-full border-[0.2cqw] px-[2cqw] py-[0.3cqw] text-[1.6cqw] font-semibold tracking-widest uppercase",
              style().border,
              style().text,
            )}
          >
            Class {props.record.classId} · {year()}
          </div>
        </div>

        <div class="flex flex-col items-center gap-[0.8cqw]">
          <div class="text-[1.6cqw] text-game-ink/70 italic">
            This certificate is proudly presented to
          </div>
          <div class="flex items-center gap-[2cqw]">
            <Show when={props.place === 1 && props.record.avatarUrl}>
              {(url) => (
                <img
                  src={url()}
                  alt=""
                  class="h-[7cqw] w-[7cqw] rounded-full object-cover"
                />
              )}
            </Show>
            <div class="text-[5.4cqw] leading-tight font-bold text-game-ink">
              {formatName(person()?.name ?? "")}
            </div>
          </div>
          <div
            class={cn(
              "h-[0.25cqw] w-[45cqw] rounded-full opacity-60",
              style().line,
            )}
          ></div>
          <div class="max-w-[72cqw] text-[1.8cqw] leading-snug text-game-ink/80">
            {sentence()}
          </div>
          <div class="mt-[0.6cqw] flex gap-[1.2cqw]">
            <For each={stats()}>
              {([value, label]) => (
                <div class="min-w-[12cqw] rounded-[1cqw] bg-game-ink/5 px-[1.5cqw] py-[0.8cqw]">
                  <div class="text-[2.6cqw] leading-tight font-bold text-game-ink">
                    {value}
                  </div>
                  <div class="text-[1.2cqw] tracking-wide text-game-ink/60 uppercase">
                    {label}
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>

        <div class="grid w-full grid-cols-[1fr_auto_1fr] items-end gap-[3cqw]">
          <div class="text-[1.3cqw] text-game-ink/70">
            <div class="h-[3cqw]"></div>
            <div class="border-t-[0.15cqw] border-game-ink/40 pt-[0.5cqw] tracking-wider">
              Head of English
            </div>
          </div>
          <div class="h-[12cqw]">
            <Seal style={style()} place={props.place} />
          </div>
          <div class="text-[1.3cqw] text-game-ink/70">
            <div class="h-[3cqw]"></div>
            <div class="border-t-[0.15cqw] border-game-ink/40 pt-[0.5cqw] tracking-wider">
              Computer Class Teacher
            </div>
          </div>
          <div class="col-span-3 -mt-[1cqw] flex justify-between text-[1.1cqw] tracking-wider text-game-ink/50 uppercase">
            <span>Crowned {formatLongDate(props.record.crownedAt)}</span>
            <span>
              No. {championCertificateNumber(props.record, props.place)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
