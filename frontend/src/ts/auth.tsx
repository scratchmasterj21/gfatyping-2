import { PasswordSchema } from "@monkeytype/schemas/users";
import { tryCatch } from "@monkeytype/util/trycatch";
import { FirebaseError } from "firebase/app";
import {
  AuthProvider,
  GoogleAuthProvider,
  reauthenticateWithPopup,
  updateProfile,
  User,
  User as UserType,
} from "firebase/auth";
import { z, ZodString } from "zod";

import { provisionAccount } from "./account-provisioning";
import Ape from "./ape";
import { waitForPresetsReady } from "./collections/presets";
import { waitForTagsReady } from "./collections/tags";
import { updateFromServer as updateConfigFromServer } from "./config/remote";
import * as DB from "./db";
import { authEvent } from "./events/auth";
import {
  signOut as authSignOut,
  createUserWithEmailAndPassword,
  getAuthenticatedUser,
  isAuthAvailable,
  resetIgnoreAuthCallback,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "./firebase";
import { getUserId, isAuthenticated, setUserId } from "./states/core";
import { hideLoaderBar, showLoaderBar } from "./states/loader-bar";
import {
  showErrorNotification,
  showNoticeNotification,
  showSuccessNotification,
} from "./states/notifications";
import { isDevEnvironment } from "./utils/env";
import { createErrorMessage } from "./utils/error";
import { typedKeys } from "./utils/misc";
import { SnapshotInitError } from "./utils/snapshot-init-error";
import { OneOf } from "./utils/types";

type AuthMethodInfo = {
  display: string;
} & OneOf<{
  provider: AuthProvider;
  providerId: string;
}>;

/**
 * Only accounts from this Google Workspace domain may sign in.
 */
export const ALLOWED_AUTH_DOMAIN = "felice.ed.jp";

function createGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  // Restrict the Google account chooser to the school domain.
  provider.setCustomParameters({ hd: ALLOWED_AUTH_DOMAIN });
  return provider;
}

export function isAllowedAuthEmail(email: string | null | undefined): boolean {
  return (
    email !== null &&
    email !== undefined &&
    email.toLowerCase().endsWith(`@${ALLOWED_AUTH_DOMAIN}`)
  );
}

/**
 * The single admin account allowed to manage classroom assignments.
 */
export const ADMIN_EMAIL = "john.limpiada@felice.ed.jp";

/**
 * Whether the currently signed-in user is the classroom admin. Reads the
 * reactive user id so Solid callers re-evaluate on login/logout.
 */
export function isCurrentUserAdmin(): boolean {
  getUserId();
  return getAuthenticatedUser()?.email?.toLowerCase() === ADMIN_EMAIL;
}

/**
 * auth methods, keep order from most to least preferred.
 * This is used for reauthenticate
 */
const authMethods = {
  google: {
    display: "Google",
    provider: createGoogleProvider(),
  },
} as const satisfies Record<string, AuthMethodInfo>;

export type AuthMethod = keyof typeof authMethods;

export type AuthResult =
  | {
      success: true;
    }
  | {
      success: false;
      message: string;
    };

type ReauthSuccess = {
  status: "success";
  message: string;
  user: User;
};

type ReauthFailed = {
  status: "error" | "notice";
  message: string;
};

type ReauthenticateOptions = {
  excludeMethod?: AuthMethod;
  password?: string;
};

export async function sendVerificationEmail(): Promise<void> {
  if (!isAuthAvailable()) {
    showErrorNotification("Authentication uninitialized", { durationMs: 3000 });
    return;
  }

  showLoaderBar();
  const response = await Ape.users.verificationEmail();
  if (response.status !== 200) {
    hideLoaderBar();
    showErrorNotification("Failed to request verification email", { response });
  } else {
    hideLoaderBar();
    showSuccessNotification("Verification email sent");
  }
}

async function getDataAndInit(retryOnMissingUser = true): Promise<boolean> {
  try {
    console.log("getting account data");
    const snapshot = await DB.initSnapshot();
    //TODO: preload collections for now, remove when __nonReactive is removed from collections
    await waitForPresetsReady();
    await waitForTagsReady();

    if (snapshot === false) {
      throw new Error(
        "Snapshot didn't initialize due to lacking authentication even though user is authenticated",
      );
    }

    await updateConfigFromServer();
    return true;
  } catch (error) {
    // A signed-in Firebase Auth user with no Firestore users/{uid} doc yet:
    // either a genuine new sign-up, or a Google account stuck from a
    // previously interrupted sign-up (isNewUser now reports false even
    // though account creation never finished). Self-heal by provisioning
    // the doc and retrying once, instead of just signing the user back out.
    if (
      retryOnMissingUser &&
      error instanceof SnapshotInitError &&
      error.responseCode === 404
    ) {
      const user = getAuthenticatedUser();
      if (user !== null) {
        const { error: provisionError } = await tryCatch(
          provisionAccount(user),
        );
        if (provisionError === null) {
          return getDataAndInit(false);
        }
        console.error(
          "Failed to auto-provision missing account",
          provisionError,
        );
      }
    }

    console.error(error);
    if (error instanceof SnapshotInitError) {
      if (error.responseCode === 429) {
        showNoticeNotification(
          "Doing so will save you bandwidth, make the next test be ready faster and will not sign you out (which could mean your new personal best would not save to your account).",
          {
            durationMs: 0,
          },
        );
        showNoticeNotification(
          "You will run into this error if you refresh the website to restart the test. It is NOT recommended to do that. Instead, use tab + enter or just tab (with quick tab mode enabled) to restart the test.",
          {
            durationMs: 0,
          },
        );
      }

      showErrorNotification(`Failed to get user data: ${error.message}`);
    } else {
      showErrorNotification("Failed to get user data", { error });
    }
    return false;
  }
}

export async function loadUser(_user: UserType): Promise<void> {
  if (!(await getDataAndInit())) {
    signOut();
    return;
  }
  authEvent.dispatch({ type: "snapshotUpdated", data: { isInitial: true } });
}

export async function onAuthStateChanged(
  authInitialisedAndConnected: boolean,
  user: UserType | null,
): Promise<void> {
  console.debug(`account controller ready`);

  let userPromise: Promise<void> = Promise.resolve();

  if (authInitialisedAndConnected) {
    console.debug(`auth state changed, user ${user ? "true" : "false"}`);
    if (user && !isAllowedAuthEmail(user.email)) {
      // Account is not from the allowed domain. Reject and sign out.
      showErrorNotification(
        `Only @${ALLOWED_AUTH_DOMAIN} accounts are allowed to sign in.`,
        { durationMs: 7000 },
      );
      setUserId(null);
      DB.setSnapshot(undefined);
      signOut();
      authEvent.dispatch({
        type: "authStateChanged",
        data: { isUserSignedIn: false, loadPromise: Promise.resolve() },
      });
      return;
    }
    if (user) {
      setUserId(user.uid);
      userPromise = loadUser(user);
    } else {
      setUserId(null);
      DB.setSnapshot(undefined);
    }
  }

  authEvent.dispatch({
    type: "authStateChanged",
    data: { isUserSignedIn: user !== null, loadPromise: userPromise },
  });
}

export async function signIn(
  email: string,
  password: string,
  rememberMe: boolean,
): Promise<AuthResult> {
  if (!isAuthAvailable()) {
    return { success: false, message: "Authentication uninitialized" };
  }

  const { error } = await tryCatch(
    signInWithEmailAndPassword(email, password, rememberMe),
  );

  if (error !== null) {
    return { success: false, message: error.message };
  }
  return { success: true };
}

export async function signInWithProvider(
  authMethod: AuthMethod,
  options: { rememberMe: boolean },
): Promise<AuthResult> {
  if (!isAuthAvailable()) {
    return { success: false, message: "Authentication uninitialized" };
  }

  const provider = getAuthProvider(authMethod);
  if (provider === undefined) {
    return {
      success: false,
      message: `Authentication ${authMethod} is missing a provider`,
    };
  }

  const { error } = await tryCatch(
    signInWithPopup(provider, options.rememberMe),
  );

  if (error !== null) {
    return { success: false, message: error.message };
  }
  return { success: true };
}

export function signOut(): void {
  if (!isAuthAvailable()) {
    showErrorNotification("Authentication uninitialized", { durationMs: 3000 });
    return;
  }
  if (!isAuthenticated()) return;
  void authSignOut();
}

export async function signUp(
  name: string,
  email: string,
  password: string,
  captchaToken: string,
): Promise<AuthResult> {
  if (!isAuthAvailable()) {
    return { success: false, message: "Authentication uninitialized" };
  }

  try {
    const createdAuthUser = await createUserWithEmailAndPassword(
      email,
      password,
    );

    const signInResponse = await Ape.users.create({
      body: {
        name: name,
        captcha: captchaToken,
        email,
        uid: createdAuthUser.user.uid,
      },
    });
    if (signInResponse.status !== 200) {
      throw new Error(`Failed to sign in: ${signInResponse.body.message}`);
    }

    await updateProfile(createdAuthUser.user, { displayName: name });
    await sendVerificationEmail();
    await onAuthStateChanged(true, createdAuthUser.user);
    resetIgnoreAuthCallback();

    showSuccessNotification("Account created");
    return { success: true };
  } catch (e) {
    let message = createErrorMessage(e, "Failed to create account");

    if (e instanceof Error) {
      if ("code" in e && e.code === "auth/email-already-in-use") {
        message = createErrorMessage(
          { message: "Email already in use" },
          "Failed to create account",
        );
      }
    }

    showErrorNotification(message);
    signOut();
    return { success: false, message };
  }
}

export function getAuthProvider(
  authMethod: AuthMethod,
): AuthProvider | undefined {
  const info = authMethods[authMethod] as AuthMethodInfo;
  return info.provider;
}

export async function reauthenticate(
  options: ReauthenticateOptions,
): Promise<ReauthSuccess | ReauthFailed> {
  if (!isAuthAvailable()) {
    return {
      status: "error",
      message: "Authentication is not initialized",
    };
  }

  const user = getAuthenticatedUser();
  if (user === null) {
    return {
      status: "error",
      message: "User is not signed in",
    };
  }

  const authMethod = getPreferredAuthenticationMethod(options.excludeMethod);

  try {
    if (authMethod === undefined) {
      return {
        status: "error",
        message:
          "Failed to reauthenticate: there is no valid authentication present on the account.",
      };
    }

    const provider = getAuthProvider(authMethod);
    if (provider === undefined) {
      return {
        status: "error",
        message: `Authentication ${authMethod} is missing a provider`,
      };
    }
    await reauthenticateWithPopup(user, provider);

    return {
      status: "success",
      message: "Reauthenticated",
      user,
    };
  } catch (e) {
    const typedError = e as FirebaseError;
    if (typedError.code === "auth/wrong-password") {
      return {
        status: "notice",
        message: "Incorrect password",
      };
    } else if (typedError.code === "auth/invalid-credential") {
      return {
        status: "notice",
        message:
          "Password is incorrect or your account does not have password authentication enabled.",
      };
    } else {
      return {
        status: "error",
        message: `Failed to reauthenticate: ${
          typedError?.message ?? JSON.stringify(e)
        }`,
      };
    }
  }
}

function getPreferredAuthenticationMethod(
  exclude?: AuthMethod,
): AuthMethod | undefined {
  const filteredMethods = typedKeys(authMethods).filter((it) => it !== exclude);
  for (const method of filteredMethods) {
    if (isUsingAuthentication(method)) return method;
  }
  return undefined;
}

function isUsingAuthentication(authMethod: AuthMethod): boolean {
  const providerId = getProviderId(authMethod);
  return (
    getAuthenticatedUser()?.providerData.some(
      (p) => p.providerId === providerId,
    ) ?? false
  );
}

export function getPasswordSchema(): ZodString {
  return isDevEnvironment() ? z.string().min(6) : PasswordSchema;
}

export function isUsingPasswordAuthentication(): boolean {
  return (
    getAuthenticatedUser()?.providerData.some(
      (p) => p.providerId === "password",
    ) ?? false
  );
}

export function hasAdditionalAuthMethods(authMethod: AuthMethod) {
  return typedKeys(authMethods).some(
    (it) => it !== authMethod && isUsingAuthentication(it),
  );
}

export function getAuthMethodDisplay(authMethod: AuthMethod): string {
  return authMethods[authMethod].display;
}

function getProviderId(authMethod: AuthMethod): string {
  const info = authMethods[authMethod] as AuthMethodInfo;

  if ("provider" in info && info.provider !== undefined) {
    return info.provider.providerId;
  }
  return info.providerId;
}
