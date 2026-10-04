import { ValidModeRule } from "@monkeytype/schemas/configuration";
import { useQuery } from "@tanstack/solid-query";
import { createEffect, createSignal, JSXElement, Show } from "solid-js";

import { ClassroomScope } from "../../../classroom/classroom";
import { getSnapshot, updateLbMemory } from "../../../db";
import { createEffectOn } from "../../../hooks/effects";
import { PageName } from "../../../pages/page";
import { queryClient } from "../../../queries";
import {
  getClassroomLeaderboardQueryOptions,
  getLeaderboardQueryOptions,
  getRankQueryOptions,
} from "../../../queries/leaderboards";
import { getServerConfigurationQueryOptions } from "../../../queries/server-configuration";
import { getActivePage, isAuthenticated } from "../../../states/core";
import {
  ClassroomSelectionType,
  getGoToUserPage,
  getHideAdmin,
  getPage,
  getSelection,
  isClassroomType,
  pageSize,
  Selection,
  setGoToUserPage,
  setHideAdmin,
  setPage,
  setSelection,
  updateGetParameters,
} from "../../../states/leaderboard-selection";
import { cn } from "../../../utils/cn";
import { abbreviateNumber } from "../../../utils/numbers";
import AsyncContent from "../../common/AsyncContent";
import { Fa } from "../../common/Fa";
import { LoadingCircle } from "../../common/LoadingCircle";
import { Page } from "../../common/Page";
import { GameScoresSection } from "./GameScoresSection";
import { Navigation } from "./Navigation";
import { SelfSummaryCard } from "./SelfSummaryCard";
import { Sidebar } from "./Sidebar";
import { Table, TableEntry } from "./Table";
import { Title } from "./Title";
import { TopThreePodium } from "./TopThreePodium";

const pageName: PageName = "leaderboards";

export function LeaderboardPage(): JSXElement {
  const isOpen = () => getActivePage() === pageName;

  const [scrollToUser, setScrollToUser] = createSignal(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = createSignal(false);

  const classroomSelfStat = (
    entry: TableEntry | undefined,
  ): string | undefined => {
    if (entry === undefined) return undefined;
    if (tableType() === "speed" && "wpm" in entry) {
      return `${Math.round(entry.wpm)} WPM`;
    }
    if ("totalXp" in entry) {
      const xp = entry.totalXp;
      return `${xp < 1000 ? xp.toFixed(0) : abbreviateNumber(xp)} XP`;
    }
    if ("bestRaceWpm" in entry) {
      return tableType() === "raceacc"
        ? `${Math.round(entry.bestRaceAcc)}% acc`
        : `${Math.round(entry.bestRaceWpm)} WPM`;
    }
    return undefined;
  };

  //invalidate cache for daily and weekly lb on close
  createEffectOn(isOpen, (open) => {
    if (!open) {
      void queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey.length >= 3 &&
          query.queryKey[1] === "leaderboard" &&
          ["weekly", "daily"].includes(query.queryKey[2] as string),
      });
    }
  });

  const isClassroom = () => isClassroomType(getSelection().type);

  // The "hide admin" checkbox only makes sense on the all-time English speed
  // board, which is the specific board students asked to filter.
  const canHideAdmin = () => {
    const sel = getSelection();
    return sel.type === "allTime" && sel.language === "english";
  };

  const isGamesMetric = () =>
    isClassroom() &&
    (getSelection() as ClassroomSelectionType).metric === "games";

  const tableType = (): "speed" | "xp" | "racewpm" | "raceacc" => {
    const sel = getSelection();
    if (isClassroomType(sel.type)) {
      const metric = (sel as ClassroomSelectionType).metric;
      if (metric === "wpm") return "speed";
      if (metric === "racewpm") return "racewpm";
      if (metric === "raceacc") return "raceacc";
      return "xp";
    }
    return sel.type === "weekly" ? "xp" : "speed";
  };

  //prefetch next page (paged boards only; classroom boards are single-page)
  createEffect(() => {
    if (isOpen() && !isClassroom()) {
      void queryClient.prefetchQuery(
        getLeaderboardQueryOptions({
          ...getSelection(),
          page: getPage() + 1,
          hideAdmin: canHideAdmin() && getHideAdmin(),
        }),
      );
    }
  });

  //update url after the data is loaded
  createEffect(() => {
    if (isOpen() && entriesQuery().isSuccess) {
      updateGetParameters(getSelection(), getPage());
    }
  });

  //update lb memory after the rank is loaded
  createEffect(() => {
    if (isOpen() && rankQuery.isSuccess) {
      syncLbMemory();
    }
  });

  //handle goToUserPage url param once rank is loaded
  createEffect(() => {
    if (isOpen() && getGoToUserPage() && rankQuery.isSuccess) {
      setGoToUserPage(false);
      const page = userPage();
      if (page !== undefined) {
        setPage(page);
        setScrollToUser(true);
      }
    }
  });

  const standardEntriesQuery = useQuery(() => ({
    ...getLeaderboardQueryOptions({
      ...getSelection(),
      page: getPage() ?? 0,
      hideAdmin: canHideAdmin() && getHideAdmin(),
    }),
    enabled: isOpen() && !isClassroom(),
  }));

  const classroomEntriesQuery = useQuery(() => {
    const cs = getSelection() as ClassroomSelectionType;
    const hasRequiredScope =
      cs.type === "school" ||
      (cs.type === "class" && cs.classId !== undefined) ||
      (cs.type === "grade" && cs.grade !== undefined);
    return {
      ...getClassroomLeaderboardQueryOptions({
        scope: (isClassroom() ? cs.type : "school") as ClassroomScope,
        classId: cs.classId,
        grade: cs.grade,
        metric: cs.metric === "games" ? "xp" : (cs.metric ?? "xp"),
        wpmMode2: cs.mode2,
      }),
      enabled:
        isAuthenticated() &&
        isOpen() &&
        isClassroom() &&
        hasRequiredScope &&
        !isGamesMetric(),
    };
  });

  // the active board depends on whether a classroom scope is selected
  const entriesQuery = () =>
    isClassroom() ? classroomEntriesQuery : standardEntriesQuery;

  const rankQuery = useQuery(() => ({
    ...getRankQueryOptions({
      ...getSelection(),
      hideAdmin: canHideAdmin() && getHideAdmin(),
    }),
    enabled: isAuthenticated() && isOpen() && !isClassroom(),
  }));

  const serverConfigurationQuery = useQuery(() => ({
    ...getServerConfigurationQueryOptions(),
    enabled: isOpen(),
  }));

  const onSelectionChange = (newSelection: Selection) => {
    setSelection(newSelection);
    setPage(0);
  };

  /**
   * the page that contains the user
   */
  const userPage = () => {
    const userRank = getSelection().friendsOnly
      ? rankQuery.data?.friendsRank
      : rankQuery.data?.rank;
    if (userRank === undefined) return undefined;
    const page = Math.ceil(userRank / pageSize) - 1;
    return page;
  };

  const syncLbMemory = () => {
    if (
      rankQuery.data !== undefined &&
      rankQuery.data !== null &&
      getSelection() !== undefined &&
      getSelection().type === "allTime"
    ) {
      const diff = getLbMemoryDifference(getSelection(), rankQuery.data.rank);

      if (diff !== 0) {
        void updateLbMemory(
          "time",
          getSelection().mode2,
          "english",
          rankQuery.data.rank,
          true,
        );
      }
    }
  };

  const getLbMemoryDifference = (
    selection: Selection,
    currentRank: number | undefined,
  ): number | undefined => {
    if (
      selection.type !== "allTime" ||
      selection.mode !== "time" ||
      selection.language !== "english" ||
      selection.friendsOnly ||
      currentRank === undefined
    ) {
      return undefined;
    }
    const oldRank =
      getSnapshot()?.lbMemory?.time?.[selection.mode2]?.english ?? 0;
    const diff = oldRank - currentRank;

    return diff;
  };

  const sidebarContent = (validModeRules: ValidModeRule[]) => (
    <Sidebar
      selection={getSelection}
      onSelect={onSelectionChange}
      validModeRules={validModeRules}
      canHideAdmin={canHideAdmin()}
      hideAdmin={getHideAdmin()}
      onHideAdminChange={setHideAdmin}
    />
  );

  return (
    <Page id="leaderboards">
      <div class="rankings-student-ui content-grid">
        <div class="grid gap-6 lg:grid-cols-[minmax(17.5rem,20rem)_1fr] lg:items-start">
          <aside class="lg:sticky lg:top-4 lg:self-start">
            <div class="mb-2 lg:hidden">
              <button
                type="button"
                class="flex w-full items-center justify-between rounded-lg bg-sub-alt px-4 py-3 text-left font-semibold text-text"
                aria-expanded={mobileFiltersOpen()}
                onClick={() => setMobileFiltersOpen((open) => !open)}
              >
                Choose ranking
                <Fa
                  icon="fa-chevron-down"
                  class={cn(
                    "transition-transform",
                    mobileFiltersOpen() ? "rotate-180" : "",
                  )}
                />
              </button>
            </div>
            <div
              class={cn("grid gap-3", !mobileFiltersOpen() && "hidden lg:grid")}
            >
              <AsyncContent queries={{ serverConfigurationQuery }}>
                {({ serverConfigurationQueryData }) =>
                  sidebarContent(
                    serverConfigurationQueryData().dailyLeaderboards
                      .validModeRules ?? [],
                  )
                }
              </AsyncContent>
            </div>
          </aside>

          <main class="flex min-w-0 flex-col gap-5 lg:gap-6">
            <Title
              selection={getSelection()}
              onPreviousSelect={() =>
                setSelection((old) => ({ ...old, previous: !old.previous }))
              }
            />

            <Show when={isGamesMetric()}>
              <GameScoresSection
                scope={(getSelection() as ClassroomSelectionType).type}
                classId={(getSelection() as ClassroomSelectionType).classId}
                grade={(getSelection() as ClassroomSelectionType).grade}
                selfUid={getSnapshot()?.uid}
                isOpen={isOpen()}
                selectedGameId={
                  (getSelection() as ClassroomSelectionType).gameId
                }
              />
            </Show>

            <Show when={!isGamesMetric()}>
              <AsyncContent
                queries={{
                  entriesQuery: entriesQuery(),
                  ...(isClassroom() ? {} : { rankQuery }),
                  serverConfigurationQuery,
                }}
                loader={
                  <div class="flex justify-center pt-4 text-4xl">
                    <LoadingCircle />
                  </div>
                }
                alwaysShowContent
              >
                {(queryResults) => {
                  const entriesQueryData = queryResults.entriesQueryData;
                  const rankQueryData = queryResults.rankQueryData;
                  const serverConfigurationQueryData =
                    queryResults.serverConfigurationQueryData;
                  const entries = () => entriesQueryData()?.entries ?? [];
                  const selfEntry = () =>
                    entries().find(
                      (entry) => entry.uid === getSnapshot()?.uid,
                    ) as TableEntry | undefined;
                  const minWpm = () => {
                    const d = entriesQueryData();
                    return d && "minWpm" in d
                      ? (d.minWpm as number)
                      : undefined;
                  };
                  const showPodium = () =>
                    getPage() === 0 && entries().length >= 2;

                  return (
                    <div class="grid gap-4">
                      <Show when={isAuthenticated()}>
                        <SelfSummaryCard
                          type={tableType()}
                          data={
                            isClassroom()
                              ? (selfEntry() ?? null)
                              : (rankQueryData?.() ?? null)
                          }
                          classroomRank={selfEntry()?.rank}
                          classroomPrimaryLabel={classroomSelfStat(selfEntry())}
                          friendsOnly={getSelection().friendsOnly}
                          total={entriesQueryData()?.count}
                          minWpm={minWpm()}
                          memoryDifference={
                            isClassroom()
                              ? undefined
                              : getLbMemoryDifference(
                                  getSelection(),
                                  rankQueryData?.()?.rank,
                                )
                          }
                          isLbOptOut={getSnapshot()?.lbOptOut ?? false}
                          isBanned={getSnapshot()?.banned ?? false}
                          minTimeTyping={
                            serverConfigurationQueryData()?.leaderboards
                              .minTimeTyping ?? 0
                          }
                          userTimeTyping={
                            getSnapshot()?.typingStats.timeTyping ?? 0
                          }
                          loading={
                            entriesQuery().isLoading ||
                            (!isClassroom() && rankQuery.isLoading)
                          }
                        />
                      </Show>

                      <Show when={!isClassroom()}>
                        <Navigation
                          isLoading={
                            entriesQuery().isLoading ||
                            entriesQuery().isFetching ||
                            entriesQuery().isRefetching
                          }
                          lastPage={Math.ceil(
                            (entriesQueryData()?.count ?? 0) / pageSize,
                          )}
                          userPage={userPage()}
                          currentPage={getPage()}
                          onPageChange={setPage}
                          onScrollToUser={setScrollToUser}
                        />
                      </Show>

                      <TopThreePodium
                        type={tableType()}
                        entries={entries()}
                        friendsOnly={getSelection().friendsOnly}
                        compactXp={isClassroom()}
                        enabled={showPodium()}
                        selfUid={getSnapshot()?.uid}
                      />

                      <Table
                        type={tableType()}
                        compactXp={isClassroom()}
                        entries={entries()}
                        friendsOnly={getSelection().friendsOnly}
                        scrollToUser={scrollToUser}
                        onScrolledToUser={() => setScrollToUser(false)}
                        currentPage={getPage()}
                        showPodium={showPodium()}
                        selfUid={getSnapshot()?.uid}
                      />

                      <Show when={!isClassroom()}>
                        <Navigation
                          lastPage={Math.ceil(
                            (entriesQueryData()?.count ?? 0) / pageSize,
                          )}
                          currentPage={getPage()}
                          onPageChange={setPage}
                          onScrollToUser={setScrollToUser}
                        />
                      </Show>
                    </div>
                  );
                }}
              </AsyncContent>
            </Show>
          </main>
        </div>
      </div>
    </Page>
  );
}
