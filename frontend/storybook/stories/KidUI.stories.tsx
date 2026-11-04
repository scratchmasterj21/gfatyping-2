import { Component, For } from "solid-js";
import { fn } from "storybook/test";

import preview from "#.storybook/preview";

import { Button } from "../../src/ts/components/common/Button";
import { Card } from "../../src/ts/components/common/Card";
import { Mascot, MascotMood } from "../../src/ts/components/common/Mascot";
import { Pill } from "../../src/ts/components/common/Pill";

const meta = preview.meta({
  title: "Kid UI/Overview",
  component: Card as Component,
  parameters: {
    layout: "padded",
  },
});

const moods: MascotMood[] = [
  "idle",
  "happy",
  "cheer",
  "sad",
  "thinking",
  "sleepy",
];

export const MascotMoods = meta.story({
  render: () => (
    <div class="flex flex-wrap gap-6 font-kid text-text">
      <For each={moods}>
        {(mood) => (
          <div class="grid justify-items-center gap-2">
            <Mascot mood={mood} size={110} />
            <span class="text-sm text-sub">{mood}</span>
          </div>
        )}
      </For>
    </div>
  ),
});

export const Buttons = meta.story({
  render: () => (
    <div class="flex flex-wrap items-center gap-4">
      <Button text="Classic" onClick={fn()} />
      <Button text="Chunky" chunky onClick={fn()} />
      <Button text="Chunky lg" chunky size="lg" onClick={fn()} />
      <Button
        text="Start lesson"
        chunky
        size="xl"
        active
        fa={{ icon: "fa-play" }}
        onClick={fn()}
      />
      <Button text="Disabled" chunky size="lg" disabled onClick={fn()} />
    </div>
  ),
});

export const Cards = meta.story({
  render: () => (
    <div class="grid max-w-3xl grid-cols-1 gap-4 font-kid sm:grid-cols-3">
      <Card tone="plain">
        <div class="font-semibold">Plain</div>
        <div class="text-sm text-sub">Quiet surface</div>
      </Card>
      <Card tone="raised">
        <div class="font-semibold">Raised</div>
        <div class="text-sm text-sub">Default card</div>
      </Card>
      <Card tone="accent" onClick={fn()}>
        <div class="font-semibold">Accent (tap me)</div>
        <div class="text-sm text-sub">Clickable, pressable</div>
      </Card>
    </div>
  ),
});

export const Pills = meta.story({
  render: () => (
    <div class="flex flex-wrap items-center gap-3">
      <Pill fa={{ icon: "fa-coins" }} text="120" />
      <Pill tone="sub" fa={{ icon: "fa-fire" }} text="5 day streak" />
      <Pill tone="error" text="Try again" />
      <Pill size="sm" text="Level 3" />
    </div>
  ),
});

export const LessonHeroSample = meta.story({
  render: () => (
    <Card tone="accent" padding="lg" class="max-w-xl font-kid">
      <div class="flex items-center gap-4">
        <Mascot mood="cheer" size={96} />
        <div class="grid gap-2">
          <div class="text-2xl font-semibold">Ready for Home Row?</div>
          <div class="flex gap-2">
            <Pill fa={{ icon: "fa-star" }} text="2 / 3" />
            <Pill tone="sub" text="Lesson 4" />
          </div>
          <Button
            text="Let's type!"
            chunky
            size="lg"
            active
            fa={{ icon: "fa-play" }}
            onClick={fn()}
          />
        </div>
      </div>
    </Card>
  ),
});
