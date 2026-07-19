import { updateProfile, User } from "firebase/auth";
import Ape from "./ape";

function sanitizeName(raw: string): string {
  const cleaned = raw
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 16);
  return cleaned.length > 0 ? cleaned : "user";
}

async function isNameAvailable(name: string): Promise<boolean> {
  const response = await Ape.users.getNameAvailability({ params: { name } });
  return response.status === 200 && response.body.data.available;
}

async function pickUniqueName(base: string): Promise<string> {
  if (await isNameAvailable(base)) return base;

  for (let attempt = 0; attempt < 25; attempt++) {
    const suffix = Math.floor(Math.random() * 9000 + 1000).toString();
    const trimmed = base.slice(0, 16 - suffix.length);
    const candidate = `${trimmed}${suffix}`;
    if (await isNameAvailable(candidate)) return candidate;
  }

  throw new Error("Could not generate an available username");
}

/**
 * Create the Firestore `users/{uid}` doc for an already-authenticated Firebase
 * user who doesn't have one yet. Covers both a genuine new sign-up and a
 * Google account stuck from a previously interrupted sign-up (Firebase Auth
 * account exists, but account creation never finished, so `users/{uid}` is
 * missing even though `isNewUser` now reports false). `Ape.users.create` is
 * idempotent, so calling this for an account that already exists is harmless.
 * Caller must have already verified the account is allowed to sign in.
 */
export async function provisionAccount(user: User): Promise<string> {
  const base = sanitizeName(
    user.displayName ?? user.email?.split("@")[0] ?? "user",
  );
  const name = await pickUniqueName(base);

  const response = await Ape.users.create({ body: { name, captcha: "" } });
  if (response.status !== 200) {
    throw new Error(`Failed to create user: ${response.body.message}`);
  }

  await updateProfile(user, { displayName: name });
  return name;
}
