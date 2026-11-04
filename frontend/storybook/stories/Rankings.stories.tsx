import { XpLeaderboardEntry } from "@monkeytype/schemas/leaderboards";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { Component, JSXElement } from "solid-js";
import { fn } from "storybook/test";

import preview from "#.storybook/preview";

import { gapToNextLabel } from "../../src/ts/components/pages/leaderboard/rank-gap";
import { RankList } from "../../src/ts/components/pages/leaderboard/RankList";
import { SelfSummaryCard } from "../../src/ts/components/pages/leaderboard/SelfSummaryCard";
import { TopThreePodium } from "../../src/ts/components/pages/leaderboard/TopThreePodium";

const meta = preview.meta({
  title: "Rankings/Kid layout",
  component: TopThreePodium as Component,
  parameters: { layout: "padded" },
});

const NAMES: [string, number][] = [
  ["MarkSunaga", 9200],
  ["EmmaTakami", 6100],
  ["HenryWatanabe", 5900],
  ["SunnyTerashita", 4100],
  ["SofiaLimpiada", 3850],
  ["AliceIsshiki", 2400],
  ["EmilyKubo", 1200],
  ["KaitoMori", 640],
];

const entries: XpLeaderboardEntry[] = NAMES.map(([name, totalXp], i) => ({
  uid: `sample-${i}`,
  name,
  totalXp,
  rank: i + 1,
  timeTypedSeconds: 600 + i * 30,
  lastActivityTimestamp: 0,
}));

// Pre-filled avatar cache so the story never reads Firestore.
const COLORS = ["#ff8787", "#74c0fc", "#ffd43b", "#b197fc", "#8ce99a"];
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, retry: false } },
});
entries.forEach((e, i) =>
  queryClient.setQueryData(["avatarEquipped", e.uid], {
    color: COLORS[i % COLORS.length],
  }),
);
const withQuery = (child: () => JSXElement): JSXElement => (
  <QueryClientProvider client={queryClient}>{child()}</QueryClientProvider>
);

const SELF_UID = "sample-4";
const self = entries[4];

const common = {
  type: "xp" as const,
  friendsOnly: false,
  compactXp: true,
};

export const FullPage = meta.story({
  render: () =>
    withQuery(() => (
      <div class="mx-auto grid max-w-4xl gap-4 font-kid">
        <SelfSummaryCard
          type="xp"
          data={self}
          classroomRank={self?.rank}
          classroomPrimaryLabel="3.9k XP"
          friendsOnly={false}
          total={entries.length}
          memoryDifference={undefined}
          isLbOptOut={false}
          isBanned={false}
          minTimeTyping={0}
          userTimeTyping={1000}
          gapLabel={gapToNextLabel(entries, self, "xp")}
          onFindMe={fn()}
        />
        <TopThreePodium
          {...common}
          entries={entries}
          enabled
          selfUid={SELF_UID}
        />
        <RankList
          {...common}
          entries={entries}
          skipTop={3}
          selfUid={SELF_UID}
        />
      </div>
    )),
});

export const NotRankedYet = meta.story({
  render: () => (
    <div class="mx-auto max-w-4xl">
      <SelfSummaryCard
        type="xp"
        data={null}
        friendsOnly={false}
        total={entries.length}
        memoryDifference={undefined}
        isLbOptOut={false}
        isBanned={false}
        minTimeTyping={0}
        userTimeTyping={1000}
      />
    </div>
  ),
});

export const TwoOnPodium = meta.story({
  render: () =>
    withQuery(() => (
      <div class="mx-auto max-w-4xl">
        <TopThreePodium {...common} entries={entries.slice(0, 2)} enabled />
      </div>
    )),
});
