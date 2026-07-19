import { UserCredential } from "firebase/auth";
import Ape from "../ape";
import * as AccountController from "../auth";
import { isAllowedAuthEmail } from "../auth";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../states/notifications";
import { showLoaderBar, hideLoaderBar } from "../states/loader-bar";
import { googleSignUpEvent } from "../events/google-sign-up";
import { resetIgnoreAuthCallback, setUserState } from "../firebase";
import { authEvent } from "../events/auth";
import { provisionAccount } from "../account-provisioning";

/**
 * Google-only, domain-locked sign up.
 *
 * Since there is no Express backend to verify a captcha, new Google users are
 * created automatically with a username derived from their account. The captcha
 * modal has been removed.
 */

async function cleanup(credential: UserCredential): Promise<void> {
  await Ape.users.delete().catch(() => {
    //ignore - user might not exist
  });
  await credential.user.delete().catch(() => {
    //user might be deleted already
  });
  AccountController.signOut();
}

async function createAccount(credential: UserCredential): Promise<void> {
  const user = credential.user;

  if (!isAllowedAuthEmail(user.email)) {
    showErrorNotification(
      `Only @${AccountController.ALLOWED_AUTH_DOMAIN} accounts are allowed to sign in.`,
      { durationMs: 7000 },
    );
    resetIgnoreAuthCallback();
    await cleanup(credential);
    return;
  }

  showLoaderBar();
  try {
    setUserState(user);
    await provisionAccount(user);
    showSuccessNotification("Account created");
    await AccountController.loadUser(user);

    // Only now re-arm the real onAuthStateChanged listener (suppressed since
    // the popup opened) - doing this any earlier lets it fire its own
    // redundant loadUser() call while this one is still in flight, racing
    // the brand-new account's snapshot init.
    resetIgnoreAuthCallback();

    authEvent.dispatch({
      type: "authStateChanged",
      data: { isUserSignedIn: true, loadPromise: Promise.resolve() },
    });
  } catch (e) {
    console.error(e);
    showErrorNotification("Failed to sign in with Google", { error: e });
    resetIgnoreAuthCallback();
    await cleanup(credential);
  } finally {
    hideLoaderBar();
  }
}

googleSignUpEvent.subscribe(({ signedInUser, isNewUser }) => {
  if (signedInUser !== undefined && isNewUser) {
    void createAccount(signedInUser);
  }
});
