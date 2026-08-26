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
import AsyncContent from "../../common/AsyncContent";
import { LoadingCircle } from "../../common/LoadingCircle";
import { Page } from "../../common/Page";
import { Separator } from "../../common/Separator";
import { GameScoresSection } from "./GameScoresSection";
import { Navigation } from "./Navigation";
import { NextUpdate } from "./NextUpdate";
import { Sidebar } from "./Sidebar";
import { Table } from "./Table";
import { Title } from "./Title";
import { UserRank } from "./UserRank";

const pageName: PageName = "leaderboards";

export function LeaderboardPage(): JSXElement {
  const isOpen = () => getActivePage() === pageName;

  const [scrollToUser, setScrollToUser] = createSignal(false);

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
        isOpen() && isClassroom() && hasRequiredScope && !isGamesMetric(),
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

  return (
    <Page id="leaderboards">
      <div class="content-grid flex flex-col gap-5 lg:flex-row lg:gap-8">
        <div class="w-full shrink-0 lg:w-60 2xl:w-75">
          <AsyncContent queries={{ serverConfigurationQuery }}>
            {({ serverConfigurationQueryData }) => (
              <Sidebar
                selection={getSelection}
                onSelect={onSelectionChange}
                validModeRules={
                  serverConfigurationQueryData().dailyLeaderboards
                    .validModeRules ?? []
                }
              />
            )}
          </AsyncContent>
        </div>

        <div class="flex w-full flex-1 flex-col gap-5 lg:gap-8">
          <Title
            selection={getSelection()}
            onPreviousSelect={() =>
              setSelection((old) => ({ ...old, previous: !old.previous }))
            }
          />

          <Show
            when={
              isAuthenticated() && !isClassroom() && !entriesQuery().isLoading
            }
            fallback={<Separator />}
          >
            <AsyncContent
              queries={{
                entriesQuery: entriesQuery(),
                rankQuery,
                serverConfigurationQuery,
              }}
              alwaysShowContent
              errorClass="rounded bg-sub-alt p-4"
            >
              {({
                entriesQueryData,
                rankQueryData,
                serverConfigurationQueryData,
              }) => {
                const minWpm = () => {
                  const d = entriesQueryData();
                  return d && "minWpm" in d ? (d.minWpm as number) : undefined;
                };

                return (
                  <UserRank
                    type={tableType() as "speed" | "xp"}
                    data={rankQueryData()}
                    friendsOnly={getSelection().friendsOnly}
                    total={entriesQueryData()?.count}
                    minWpm={minWpm()}
                    memoryDifference={getLbMemoryDifference(
                      getSelection(),
                      rankQueryData()?.rank,
                    )}
                    isLbOptOut={getSnapshot()?.lbOptOut ?? false}
                    isBanned={getSnapshot()?.banned ?? false}
                    minTimeTyping={
                      serverConfigurationQueryData()?.leaderboards
                        .minTimeTyping ?? 0
                    }
                    userTimeTyping={getSnapshot()?.typingStats.timeTyping ?? 0}
                  />
                );
              }}
            </AsyncContent>
          </Show>

          <Show when={isGamesMetric()}>
            <GameScoresSection
              scope={(getSelection() as ClassroomSelectionType).type}
              classId={(getSelection() as ClassroomSelectionType).classId}
              grade={(getSelection() as ClassroomSelectionType).grade}
              selfUid={getSnapshot()?.uid}
              isOpen={isOpen()}
              selectedGameId={(getSelection() as ClassroomSelectionType).gameId}
            />
          </Show>

          <Show when={!isGamesMetric()}>
            <AsyncContent
              queries={{ entriesQuery: entriesQuery() }}
              loader={
                <div class="flex justify-center pt-4 text-4xl">
                  <LoadingCircle />
                </div>
              }
            >
              {({ entriesQueryData }) => (
                <div>
                  <Show when={!isClassroom()}>
                    <div
                      class={cn(
                        "mb-2 grid grid-cols-1 items-center justify-between gap-2 text-sm sm:grid-cols-2 sm:text-base",
                      )}
                    >
                      <NextUpdate type={getSelection().type} />
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
                        class="w-full sm:w-max"
                      />
                    </div>
                  </Show>

                  <Show when={canHideAdmin()}>
                    <label class="mb-2 flex w-max items-center gap-2 text-sm text-sub">
                      <input
                        type="checkbox"
                        checked={getHideAdmin()}
                        onChange={(e) => setHideAdmin(e.currentTarget.checked)}
                      />
                      Hide teacher from rankings
                    </label>
                  </Show>

                  <div>
                    <Table
                      type={tableType()}
                      compactXp={isClassroom()}
                      entries={entriesQueryData()?.entries ?? []}
                      friendsOnly={getSelection().friendsOnly}
                      scrollToUser={scrollToUser}
                      onScrolledToUser={() => setScrollToUser(false)}
                    />
                  </div>

                  <Show when={!isClassroom()}>
                    <div class="mt-4 grid grid-cols-1 items-center justify-between text-sm sm:text-base">
                      <Navigation
                        lastPage={Math.ceil(
                          (entriesQueryData()?.count ?? 0) / pageSize,
                        )}
                        currentPage={getPage()}
                        onPageChange={setPage}
                        onScrollToUser={setScrollToUser}
                        class="w-full sm:w-max"
                      />
                    </div>
                  </Show>
                </div>
              )}
            </AsyncContent>
          </Show>
        </div>
      </div>
    </Page>
  );
}
