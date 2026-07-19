import { JSXElement } from "solid-js";

import {
  ALLOWED_AUTH_DOMAIN,
  AuthResult,
  getAuthMethodDisplay,
  signInWithProvider,
} from "../../../auth";
import {
  disableLoginPageInputs,
  enableLoginPageInputs,
  getLoginPageInputsEnabled,
} from "../../../states/login";
import { showErrorNotification } from "../../../states/notifications";
import { Button } from "../../common/Button";
import { H3 } from "../../common/Headers";

export function Login(): JSXElement {
  const trySignIn = async (
    auth: () => Promise<AuthResult>,
    label?: string,
  ): Promise<void> => {
    disableLoginPageInputs();
    try {
      const data = await auth();
      if (!data.success) {
        showErrorNotification(
          `Failed to sign in${label !== undefined ? ` with ${label}` : ""}: ${data.message}`,
        );
      }
    } finally {
      enableLoginPageInputs();
    }
  };

  return (
    <div class="grid w-full grid-cols-1 justify-center gap-4 sm:w-80">
      <H3
        text="login"
        fa={{
          icon: "fa-sign-in-alt",
        }}
        class="p-0"
      />
      <Button
        fa={{ icon: "fa-google", variant: "brand" }}
        text="sign in with google"
        onClick={() =>
          void trySignIn(
            async () => signInWithProvider("google", { rememberMe: true }),
            getAuthMethodDisplay("google"),
          )
        }
        disabled={!getLoginPageInputsEnabled()}
      />
      <p class="text-center text-xs text-sub">
        Only @{ALLOWED_AUTH_DOMAIN} accounts are allowed.
      </p>
    </div>
  );
}
