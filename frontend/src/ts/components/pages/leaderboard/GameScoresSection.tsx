import { useQuery } from "@tanstack/solid-query";
import { createSignal, For, JSXElement, Show } from "solid-js";

import {
  ClassroomScope,
  GameScoreEntry,
  GameScoresLeaderboard,
  getGameScoresLeaderboard,
} from "../../../classroom/classroom";
import { cn } from "../../../utils/cn";

export const GAME_LABELS: Record<string, string> = {
  "word-defender": "Word Defender",
  "balloon-pop": "Balloon Pop",
  "type-racer": "Type Racer",
  "ghost-hunter": "Ghost Hunter",
  "fruit-ninja": "Fruit Ninja",
  "type-toss": "Type Toss",
};

const GAME_ORDER = [
  "word-defender",
  "balloon-pop",
  "type-racer",
  "ghost-hunter",
  "fruit-ninja",
  "type-toss",
];

function ScoreBoard(props: {
  gameId: string;
  entries: GameScoreEntry[];
  selfUid: string | undefined;
  showTitle?: boolean;
  limit?: number;
}): JSXElement {
  const limit = (): number => props.limit ?? 5;
  const [expanded, setExpanded] = createSignal(false);
  const shown = (): GameScoreEntry[] =>
    expanded() ? props.entries : props.entries.slice(0, limit());
  return (
    <div class="rounded bg-sub-alt p-3">
      <Show when={props.showTitle !== false}>
        <div class="mb-2 text-em-xs font-semibold tracking-wider text-sub uppercase">
          {GAME_LABELS[props.gameId] ?? props.gameId}
        </div>
      </Show>
      <div class="grid gap-0.5">
        <For each={shown()}>
          {(entry, i) => (
            <div
              class={cn(
                "flex items-center gap-3 rounded px-1 py-1",
                entry.uid === props.selfUid ? "bg-main/10 text-main" : "",
              )}
            >
              <span class="w-5 text-center text-em-xs text-sub">{i() + 1}</span>
              <span class="min-w-0 flex-1 truncate text-em-sm">
                {entry.name}
                {entry.uid === props.selfUid ? " (you)" : ""}
              </span>
              <span class="text-em-sm font-semibold">{entry.score}</span>
            </div>
          )}
        </For>
      </div>
      <Show when={props.entries.length > limit()}>
        <button
          type="button"
          class="mt-2 text-em-xs text-sub hover:text-text"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded() ? "Show less" : `Show all ${props.entries.length}`}
        </button>
      </Show>
    </div>
  );
}

export function GameScoresSection(props: {
  scope: ClassroomScope;
  classId?: string;
  grade?: string;
  selfUid: string | undefined;
  isOpen: boolean;
  selectedGameId?: string;
}): JSXElement {
  const isReady = (): boolean => {
    if (props.scope === "class") return props.classId !== undefined;
    if (props.scope === "grade") return props.grade !== undefined;
    return true;
  };

  const query = useQuery<GameScoresLeaderboard>(() => ({
    queryKey: ["gameScores", props.scope, props.classId, props.grade],
    queryFn: async () =>
      getGameScoresLeaderboard({
        scope: props.scope,
        classId: props.classId,
        grade: props.grade,
      }),
    enabled: props.isOpen && isReady(),
    staleTime: 1000 * 60,
  }));

  const orderedGames = (): string[] => {
    const data = query.data;
    if (data === undefined) return [];
    const present = new Set(Object.keys(data));
    return [
      ...GAME_ORDER.filter((id) => present.has(id)),
      ...[...present].filter((id) => !GAME_ORDER.includes(id)),
    ];
  };

  // Single-game view: full ranked list
  return (
    <Show when={query.data !== undefined}>
      <Show
        when={props.selectedGameId !== undefined}
        fallback={
          <Show when={orderedGames().length > 0}>
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <For each={orderedGames()}>
                {(gameId) => (
                  <ScoreBoard
                    gameId={gameId}
                    entries={query.data?.[gameId] ?? []}
                    selfUid={props.selfUid}
                    limit={5}
                  />
                )}
              </For>
            </div>
          </Show>
        }
      >
        <Show
          when={(query.data?.[props.selectedGameId ?? ""] ?? []).length > 0}
          fallback={
            <p class="py-8 text-center text-sub">
              No scores yet for this game.
            </p>
          }
        >
          <ScoreBoard
            gameId={props.selectedGameId ?? ""}
            entries={query.data?.[props.selectedGameId ?? ""] ?? []}
            selfUid={props.selfUid}
            showTitle={false}
            limit={50}
          />
        </Show>
      </Show>
    </Show>
  );
}
