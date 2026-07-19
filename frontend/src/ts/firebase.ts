import {
  FirebaseApp,
  FirebaseError,
  FirebaseOptions,
  getApp,
  getApps,
  initializeApp,
} from "firebase/app";
import {
  getAuth,
  Auth as AuthType,
  User,
  setPersistence as firebaseSetPersistence,
  browserSessionPersistence,
  signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword,
  signInWithPopup as firebaseSignInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  createUserWithEmailAndPassword as firebaseCreateUserWithEmailAndPassword,
  getIdToken as firebaseGetIdToken,
  UserCredential,
  AuthProvider,
  onAuthStateChanged,
  indexedDBLocalPersistence,
  getAdditionalUserInfo,
} from "firebase/auth";
import { promiseWithResolvers } from "./utils/misc";
import { isDevEnvironment } from "./utils/env";
import { createErrorMessage } from "./utils/error";

import {
  Analytics as AnalyticsType,
  getAnalytics as firebaseGetAnalytics,
} from "firebase/analytics";
import {
  getFirestore,
  Firestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { tryCatch } from "@monkeytype/util/trycatch";
import { googleSignUpEvent } from "./events/google-sign-up";
import { addBanner } from "./states/banners";
import { setUserId, setUserVerified } from "./states/core";

let app: FirebaseApp | undefined;
let Auth: AuthType | undefined;

/**
 * ignore auth callback. This is used during signup with google/github where we need to create the user on the backend first.
 */
let ignoreAuthCallback: boolean = false;

type ReadyCallback = (success: boolean, user: User | null) => Promise<void>;
let readyCallback: ReadyCallback | undefined;

const { promise: authPromise, resolve: resolveAuthPromise } =
  promiseWithResolvers();

const GOOGLE_CLIENT_ID =
  "462808707659-p03eibqftrou06lli01u1ue6peonqosm.apps.googleusercontent.com";

type GisPromptNotification = {
  isNotDisplayed(): boolean;
  isDismissedMoment(): boolean;
  getNotDisplayedReason(): string;
  getDismissedReason(): string;
};
type GisId = {
  initialize(config: {
    client_id: string;
    hd?: string;
    callback: (response: { credential: string }) => void;
  }): void;
  prompt(callback?: (notification: GisPromptNotification) => void): void;
  cancel(): void;
};
type WindowWithGis = Window & {
  google?: { accounts?: { id?: GisId } };
};

let gisScriptPromise: Promise<void> | null = null;
async function loadGisScript(): Promise<void> {
  if (gisScriptPromise !== null) return gisScriptPromise;
  gisScriptPromise = new Promise((resolve, reject) => {
    if ((window as WindowWithGis).google?.accounts?.id !== undefined) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
  return gisScriptPromise;
}

export async function init(callback: ReadyCallback): Promise<void> {
  try {
    let firebaseConfig: FirebaseOptions | null;

    firebaseConfig = (
      (await import("./constants/firebase-config")) as {
        firebaseConfig: FirebaseOptions;
      }
    ).firebaseConfig;

    readyCallback = callback;
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    Auth = getAuth(app);

    const rememberMe =
      window.localStorage.getItem("firebasePersistence") === "LOCAL";
    await setPersistence(rememberMe, false);

    void loadGisScript();

    onAuthStateChanged(Auth, async (user) => {
      if (!ignoreAuthCallback) {
        setUserState(user);
        await callback(true, user);
      }
    });
  } catch (e) {
    app = undefined;
    Auth = undefined;
    console.error("Firebase failed to initialize", e);
    await callback(false, null);
    setUserState(null);
    if (isDevEnvironment()) {
      addBanner({
        level: "notice",
        text: "Dev Info: Firebase failed to initialize",
        icon: "fas fa-exclamation-triangle",
      });
    }
  } finally {
    resolveAuthPromise();
  }
}

/**
 *
 * @returns the current user if authenticated, else `null`
 */
export function getAuthenticatedUser(): User | null {
  return Auth?.currentUser ?? null;
}

export function getAnalytics(): AnalyticsType {
  return firebaseGetAnalytics(app);
}

/**
 * Cloud Firestore instance. Used as the serverless backend (see ape/firestore).
 * `getFirestore` caches the instance per app, so calling this repeatedly is fine.
 */
let dbInstance: Firestore | undefined;

export function getDb(): Firestore {
  if (app === undefined) {
    throw new Error("Firebase is not initialized");
  }
  if (!dbInstance) {
    try {
      dbInstance = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } catch (e) {
      dbInstance = getFirestore(app);
    }
  }
  return dbInstance;
}

export function isAuthAvailable(): boolean {
  return Auth !== undefined;
}

export async function signOut(): Promise<void> {
  console.log("auth signout");
  await Auth?.signOut();
}

/**
 * Delete the current Firebase Auth account. Required after deleting the user's
 * Firestore data so the next Google sign-in is treated as a brand-new user and
 * recreates the account. Requires a recent login (reauthenticate first).
 */
export async function deleteAuthAccount(): Promise<void> {
  const user = getAuthenticatedUser();
  if (user !== null) {
    await user.delete();
  }
}

export async function signInWithEmailAndPassword(
  email: string,
  password: string,
  rememberMe: boolean,
): Promise<UserCredential> {
  if (Auth === undefined) throw new Error("Authentication uninitialized");
  await setPersistence(rememberMe, true);

  const { data: result, error } = await tryCatch(
    firebaseSignInWithEmailAndPassword(Auth, email, password),
  );
  if (error !== null) {
    console.error(error);
    throw translateFirebaseError(
      error,
      "Failed to sign in with email and password",
    );
  }

  return result;
}

export function setUserState(
  options: {
    uid: string;
    emailVerified: boolean;
  } | null,
): void {
  if (options === null) {
    setUserId(null);
    setUserVerified(false);
  } else {
    setUserId(options.uid);
    setUserVerified(options.emailVerified);
  }
}

async function signInWithGoogleOneTap(rememberMe: boolean): Promise<void> {
  if (Auth === undefined) throw new Error("Authentication uninitialized");
  await loadGisScript();
  await setPersistence(rememberMe, true);

  const gisId = (window as WindowWithGis).google?.accounts?.id;
  if (gisId === undefined) {
    throw new Error("Google Identity Services failed to load");
  }

  return new Promise<void>((resolve, reject) => {
    ignoreAuthCallback = true;
    let settled = false;

    gisId.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response: { credential: string }) => {
        if (settled) return;
        settled = true;
        void (async () => {
          try {
            const credential = GoogleAuthProvider.credential(
              response.credential,
            );
            const { data: userCredential, error } = await tryCatch(
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              signInWithCredential(Auth!, credential),
            );
            if (error !== null) {
              ignoreAuthCallback = false;
              reject(
                translateFirebaseError(error, "Failed to sign in with Google"),
              );
              return;
            }
            const info = getAdditionalUserInfo(userCredential);
            if (info?.isNewUser) {
              googleSignUpEvent.dispatch({
                signedInUser: userCredential,
                isNewUser: true,
              });
            } else {
              setUserState(userCredential.user);
              ignoreAuthCallback = false;
              await readyCallback?.(true, userCredential.user);
            }
            resolve();
          } catch (e) {
            ignoreAuthCallback = false;
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        })();
      },
    });

    gisId.prompt((notification) => {
      if (notification.isNotDisplayed()) {
        if (!settled) {
          settled = true;
          ignoreAuthCallback = false;
          reject(
            new Error(
              `Google sign-in unavailable (${notification.getNotDisplayedReason()}). Disable your adblocker or use email/password.`,
            ),
          );
        }
      } else if (
        notification.isDismissedMoment() &&
        notification.getDismissedReason() !== "credential_returned"
      ) {
        if (!settled) {
          settled = true;
          ignoreAuthCallback = false;
          reject(new Error("Sign-in cancelled"));
        }
      }
    });
  });
}

export async function signInWithPopup(
  provider: AuthProvider,
  rememberMe: boolean,
): Promise<void> {
  if (Auth === undefined) throw new Error("Authentication uninitialized");
  // Open the popup synchronously before any await so the browser/adblocker
  // trust chain from the user click gesture is preserved.
  ignoreAuthCallback = true;
  const popupPromise = firebaseSignInWithPopup(Auth, provider);
  await setPersistence(rememberMe, true);

  const { data: signedInUser, error } = await tryCatch(popupPromise);
  if (error !== null) {
    if (error instanceof FirebaseError && error.code === "auth/popup-blocked") {
      // Firebase popup blocked (adblocker filtering firebaseapp.com).
      // Fall back to Google One Tap which bypasses firebaseapp.com entirely.
      await signInWithGoogleOneTap(rememberMe);
      return;
    }
    ignoreAuthCallback = false;
    console.log(error);
    throw translateFirebaseError(error, "Failed to sign in with popup");
  }
  const additionalUserInfo = getAdditionalUserInfo(signedInUser);
  if (additionalUserInfo?.isNewUser) {
    googleSignUpEvent.dispatch({ signedInUser, isNewUser: true });
  } else {
    setUserState(signedInUser.user);
    ignoreAuthCallback = false;
    await readyCallback?.(true, signedInUser.user);
  }
}

export async function createUserWithEmailAndPassword(
  email: string,
  password: string,
): Promise<UserCredential> {
  if (Auth === undefined) throw new Error("Authentication uninitialized");
  ignoreAuthCallback = true;
  const result = await firebaseCreateUserWithEmailAndPassword(
    Auth,
    email,
    password,
  );

  return result;
}

export async function getIdToken(): Promise<string | null> {
  const user = getAuthenticatedUser();
  if (user === null) return null;
  return firebaseGetIdToken(user);
}
async function setPersistence(
  rememberMe: boolean,
  store = false,
): Promise<void> {
  if (Auth === undefined) throw new Error("Authentication uninitialized");
  const persistence = rememberMe
    ? indexedDBLocalPersistence
    : browserSessionPersistence;

  if (store) {
    window.localStorage.setItem(
      "firebasePersistence",
      rememberMe ? "LOCAL" : "SESSION",
    );
  }

  await firebaseSetPersistence(Auth, persistence);
}

function translateFirebaseError(
  error: Error | FirebaseError,
  defaultMessage: string,
): Error {
  let message = createErrorMessage(error, defaultMessage);

  if (error instanceof FirebaseError) {
    if (error.code === "auth/wrong-password") {
      message = "Incorrect password";
    } else if (error.code === "auth/user-not-found") {
      message = "User not found";
    } else if (error.code === "auth/invalid-email") {
      message =
        "Invalid email format (make sure you are using your email to login - not your username)";
    } else if (error.code === "auth/invalid-credential") {
      message =
        "Email/password is incorrect or your account does not have password authentication enabled.";
    } else if (error.code === "auth/popup-closed-by-user") {
      message = "Popup closed by user";
    } else if (error.code === "auth/popup-blocked") {
      message =
        "Sign in popup was blocked by the browser. Check the address bar for a blocked popup icon, or update your browser settings to allow popups.";
    } else if (error.code === "auth/user-cancelled") {
      message = "Cancelled by user";
    } else if (error.code === "auth/account-exists-with-different-credential") {
      message =
        "Account already exists, but its using a different authentication method. Try signing in with a different method";
    } else {
      message = `Firebase error: ${error.code}`;
    }
  }

  return new Error(message, { cause: error });
}

export function resetIgnoreAuthCallback(): void {
  ignoreAuthCallback = false;
}

export { authPromise };
