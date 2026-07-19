import { Configuration } from "@monkeytype/schemas/configuration";

/**
 * Static server "configuration" returned by the Firestore-backed
 * `Ape.configuration.get`. There is no Express backend anymore, so feature
 * flags are baked in here. Mirrors the backend BASE_CONFIGURATION shape, with
 * the features we support turned on.
 */
export const CLIENT_CONFIGURATION: Configuration = {
  maintenance: false,
  dev: {
    responseSlowdownMs: 0,
  },
  results: {
    savingEnabled: true,
    objectHashCheckEnabled: false,
    filterPresets: {
      enabled: false,
      maxPresetsPerUser: 0,
    },
    limits: {
      regularUser: 1000,
      premiumUser: 10000,
    },
    maxBatchSize: 1000,
  },
  quotes: {
    reporting: {
      enabled: false,
      maxReports: 0,
      contentReportLimit: 0,
    },
    submissionsEnabled: false,
    maxFavorites: 0,
  },
  admin: {
    endpointsEnabled: false,
  },
  apeKeys: {
    endpointsEnabled: false,
    acceptKeys: false,
    maxKeysPerUser: 0,
    apeKeyBytes: 24,
    apeKeySaltRounds: 5,
  },
  users: {
    signUp: true,
    lastHashesCheck: {
      enabled: false,
      maxHashes: 0,
    },
    discordIntegration: {
      enabled: false,
    },
    autoBan: {
      enabled: false,
      maxCount: 5,
      maxHours: 1,
    },
    profiles: {
      enabled: true,
    },
    xp: {
      enabled: true,
      funboxBonus: 0,
      gainMultiplier: 1,
      maxDailyBonus: 0,
      minDailyBonus: 0,
      streak: {
        enabled: true,
        maxStreakDays: 0,
        maxStreakMultiplier: 0,
      },
    },
    inbox: {
      enabled: false,
      maxMail: 0,
    },
    premium: {
      enabled: false,
    },
  },
  rateLimiting: {
    badAuthentication: {
      enabled: false,
      penalty: 0,
      flaggedStatusCodes: [],
    },
  },
  dailyLeaderboards: {
    enabled: true,
    maxResults: 200,
    leaderboardExpirationTimeInDays: 1,
    validModeRules: [
      { language: "english", mode: "time", mode2: "(15|30|60)" },
    ],
    scheduleRewardsModeRules: [],
    topResultsToAnnounce: 1,
    xpRewardBrackets: [],
  },
  leaderboards: {
    minTimeTyping: 0,
    weeklyXp: {
      enabled: true,
      expirationTimeInDays: 7,
      xpRewardBrackets: [],
    },
  },
  connections: { enabled: false, maxPerUser: 100 },
};
