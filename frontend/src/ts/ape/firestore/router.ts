import { contract } from "@monkeytype/contracts";
import { CLIENT_CONFIGURATION } from "../../constants/server-configuration";
import {
  Handler,
  HandlerContext,
  HandlerError,
  HandlerResult,
  ok,
} from "./common";
import * as configs from "./configs";
import * as leaderboards from "./leaderboards";
import * as results from "./results";
import * as users from "./users";

const configurationGet: Handler = async () => ok(CLIENT_CONFIGURATION);
const psasGet: Handler = async () => ok([]);
// Presets aren't supported in the serverless model, but `presets.get` is awaited
// during sign-in, so return an empty list to keep startup working.
const presetsGet: Handler = async () => ok([]);
// Connections (friends) aren't supported; the collection still queries on load.
const connectionsGet: Handler = async () => ok([]);

/**
 * Map each ts-rest contract route (by object identity) to a Firestore handler.
 * Anything not listed resolves to 501 "not available".
 */
const handlers = new Map<unknown, Handler>([
  [contract.configuration.get, configurationGet],
  [contract.psas.get, psasGet],
  [contract.presets.get, presetsGet],

  [contract.users.get, users.get],
  [contract.users.create, users.create],
  [contract.users.delete, users.deleteUser],
  [contract.users.reset, users.reset],
  [contract.users.deletePersonalBests, users.deletePersonalBests],
  [contract.users.getNameAvailability, users.getNameAvailability],
  [contract.users.getProfile, users.getProfile],
  [contract.users.getTags, users.getTags],
  [contract.users.createTag, users.createTag],
  [contract.users.editTag, users.editTag],
  [contract.users.deleteTag, users.deleteTag],
  [contract.users.deleteTagPersonalBest, users.deleteTagPersonalBest],
  [contract.users.updateLeaderboardMemory, users.updateLeaderboardMemory],
  [contract.users.setStreakHourOffset, users.setStreakHourOffset],
  [contract.users.getTestActivity, users.getTestActivity],
  [contract.users.getCustomThemes, users.getCustomThemes],
  [contract.users.getInbox, users.getInbox],

  [contract.connections.get, connectionsGet],

  [contract.configs.get, configs.get],
  [contract.configs.save, configs.save],
  [contract.configs.delete, configs.remove],

  [contract.results.get, results.get],
  [contract.results.getById, results.getById],
  [contract.results.add, results.add],
  [contract.results.updateTags, results.updateTags],

  [contract.leaderboards.get, leaderboards.get],
  [contract.leaderboards.getRank, leaderboards.getRank],
  [contract.leaderboards.getDaily, leaderboards.getDaily],
  [contract.leaderboards.getDailyRank, leaderboards.getDailyRank],
  [contract.leaderboards.getWeeklyXp, leaderboards.getWeeklyXp],
  [contract.leaderboards.getWeeklyXpRank, leaderboards.getWeeklyXpRank],
]);

export async function dispatch(
  route: unknown,
  ctx: HandlerContext,
): Promise<HandlerResult> {
  const handler = handlers.get(route);
  if (handler === undefined) {
    return { status: 501, body: { message: "This feature is not available." } };
  }

  try {
    return await handler(ctx);
  } catch (e) {
    if (e instanceof HandlerError) {
      return { status: e.status, body: { message: e.message } };
    }
    console.error("Firestore handler error", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return { status: 500, body: { message } };
  }
}
