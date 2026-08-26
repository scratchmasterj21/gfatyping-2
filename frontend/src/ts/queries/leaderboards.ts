import {
  GetLeaderboardQuery,
  GetLeaderboardRankQuery,
} from "@monkeytype/contracts/leaderboards";
import { queryOptions } from "@tanstack/solid-query";
import Ape from "../ape";
import {
  ClassroomMetric,
  ClassroomScope,
  getClassroomLeaderboard,
  getClassroomLeaderboardFromCache,
  WpmMode2,
} from "../classroom/classroom";
import { pageSize, Selection, setPage } from "../states/leaderboard-selection";

const queryKeys = {
  root: (options: Selection & { userSpecific?: true; hideAdmin?: boolean }) => [
    //don't use baseKey, we require the key to have the options at the same position for user and non user specific
    options.userSpecific === true || options.friendsOnly
      ? "user"
      : "leaderboard",
    "leaderboard",
    options.type,
    {
      mode: options.mode,
      mode2: options.mode2,
      language: options.language,
      friendsOnly: options.friendsOnly,
      previous: options.previous,
      hideAdmin: options.hideAdmin,
    },
  ],
  data: (options: Selection & { page: number; hideAdmin?: boolean }) => [
    ...queryKeys.root(options),
    { page: options.page },
  ],
  rank: (options: Selection & { hideAdmin?: boolean }) =>
    queryKeys.root({ ...options, userSpecific: true }), //rank is always user specific
};

export const getLeaderboardQueryOptions = (
  options: Selection & {
    page: number;
    hideAdmin?: boolean;
  }, // oxlint-disable-next-line typescript/explicit-function-return-type
) =>
  queryOptions({
    queryKey: queryKeys.data(options),
    queryFn: async () => {
      const baseQuery = {
        friendsOnly: options.friendsOnly ? true : undefined,
        pageSize,
        page: options.page,
      };

      let request;

      if (options.type === "weekly") {
        request = Ape.leaderboards.getWeeklyXp({
          query: {
            ...baseQuery,
            weeksBefore: options.previous ? 1 : undefined,
          },
        });
      } else {
        const speed = options as Extract<
          Selection,
          { type: "allTime" | "daily" }
        >;
        const modeQuery: GetLeaderboardQuery = {
          ...baseQuery,
          mode: speed.mode,
          mode2: speed.mode2,
          language: speed.language,
          hideAdmin: options.hideAdmin ? true : undefined,
        };

        if (options.type === "allTime") {
          request = Ape.leaderboards.get({ query: modeQuery });
        } else {
          request = Ape.leaderboards.getDaily({
            query: {
              ...modeQuery,
              daysBefore: options.previous ? 1 : undefined,
            },
          });
        }
      }

      const response = await request;
      if (response.status !== 200) {
        throw new Error(
          `Failed to get ${options.type} leaderboard data: ${
            response.body.message
          }`,
        );
      }

      if (response.body.data.entries.length === 0 && options.page !== 0) {
        const page = Math.max(
          0,
          Math.ceil(response.body.data.count / pageSize) - 1,
        );
        if (page !== options.page) {
          setPage(page);
        }
      }
      return response.body.data;
    },
    //5 minutes for alltime, one minute for others
    staleTime: options.type === "allTime" ? 1000 * 60 * 5 : 1000 * 60,
  });

export const getClassroomLeaderboardQueryOptions = (options: {
  scope: ClassroomScope;
  classId?: string;
  grade?: string;
  metric: ClassroomMetric;
  wpmMode2?: WpmMode2;
  // oxlint-disable-next-line typescript/explicit-function-return-type
}) =>
  queryOptions({
    queryKey: [
      "leaderboard",
      "classroom",
      options.scope,
      options.metric,
      options.classId ?? null,
      options.grade ?? null,
      options.metric === "wpm" ? (options.wpmMode2 ?? "30") : null,
    ],
    queryFn: async () => {
      if (options.scope === "class") {
        return getClassroomLeaderboard(options);
      }
      return getClassroomLeaderboardFromCache({
        scope: options.scope,
        grade: options.grade,
        metric: options.metric,
        wpmMode2: options.wpmMode2,
      });
    },
    staleTime: 1000 * 60,
  });

export const getRankQueryOptions = (
  options: Selection & { hideAdmin?: boolean }, // oxlint-disable-next-line typescript/explicit-function-return-type
) =>
  queryOptions({
    queryKey: queryKeys.rank(options),
    queryFn: async () => {
      let request;
      if (options.type === "weekly") {
        request = Ape.leaderboards.getWeeklyXpRank({
          query: {
            friendsOnly: options.friendsOnly ? true : undefined,
            weeksBefore: options.previous ? 1 : undefined,
          },
        });
      } else {
        const speed = options as Extract<
          Selection,
          { type: "allTime" | "daily" }
        >;
        const baseQuery: GetLeaderboardRankQuery = {
          mode: speed.mode,
          mode2: speed.mode2,
          language: speed.language,
          friendsOnly: speed.friendsOnly ? true : undefined,
          hideAdmin: options.hideAdmin ? true : undefined,
        };
        if (options.type === "allTime") {
          request = Ape.leaderboards.getRank({ query: baseQuery });
        } else {
          request = Ape.leaderboards.getDailyRank({
            query: {
              ...baseQuery,
              daysBefore: options.previous ? 1 : undefined,
            },
          });
        }
      }

      const response = await request;
      if (response.status !== 200) {
        throw new Error(
          `Failed to get ${options.type} leaderboard rank: ${
            response.body.message
          }`,
        );
      }
      return response.body.data;
    },
    //5 minutes for alltime, one minute for others
    staleTime: options.type === "allTime" ? 1000 * 60 * 5 : 1000 * 60,
  });
