import admin from "firebase-admin";

/**
 * Firebase Admin SDK singleton - bypasses firestore.rules entirely, so this
 * (and only this) may write the economy fields (coins, xp, personalBests,
 * ownedX maps, etc.) that firestore.rules blocks direct client writes to.
 * Shared by every trusted API endpoint under api/. Same pattern already
 * proven in refresh-leaderboard-cache.ts.
 */
export function getAdminApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.app();
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (raw === undefined) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT env var is not set");
  }
  return admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(raw) as admin.ServiceAccount),
  });
}
