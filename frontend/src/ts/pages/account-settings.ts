import { PageWithUrlParams } from "./page";
import * as Skeleton from "../utils/skeleton";
import { getActivePage } from "../states/core";
import { swapElements } from "../utils/misc";
import { getSnapshot } from "../db";
import * as StreakHourOffsetModal from "../modals/streak-hour-offset";
import { z } from "zod";
import { authEvent } from "../events/auth";
import { qs, qsr, onDOMReady } from "../utils/dom";
import { showUpdateNameModal } from "../components/modals/account-settings/UpdateNameModal";
import {
  showDeleteAccountModal,
  showOptOutOfLeaderboardsModal,
  showResetAccountModal,
  showResetPersonalBestsModal,
} from "../components/modals/account-settings/ReauthConfirmModals";

const pageElement = qsr(".page.pageAccountSettings");

const StateSchema = z.object({
  tab: z.enum(["account", "dangerZone", "blockedUsers"]),
});
type State = z.infer<typeof StateSchema>;

const UrlParameterSchema = StateSchema.partial();

const state: State = {
  tab: "account",
};

function updateTabs(): void {
  void swapElements(
    pageElement.qs(".tab.active"),
    pageElement.qs(`.tab[data-tab="${state.tab}"]`),
    250,
    async () => {
      //
    },
    async () => {
      pageElement.qsa(".tab")?.removeClass("active");
      pageElement.qs(`.tab[data-tab="${state.tab}"]`)?.addClass("active");
    },
  );
  pageElement.qsa("button")?.removeClass("active");
  pageElement.qs(`button[data-tab="${state.tab}"]`)?.addClass("active");
}

function updateAccountSections(): void {
  pageElement.qs(".section.optOutOfLeaderboards .optedOut")?.hide();
  pageElement.qs(".section.optOutOfLeaderboards .buttons")?.show();
  pageElement.qs(".section.setStreakHourOffset .info")?.hide();
  pageElement.qs(".section.setStreakHourOffset .buttons")?.show();

  const snapshot = getSnapshot();
  if (snapshot?.lbOptOut === true) {
    pageElement.qs(".section.optOutOfLeaderboards .optedOut")?.show();
    pageElement.qs(".section.optOutOfLeaderboards .buttons")?.hide();
  }
  if (snapshot?.streakHourOffset !== undefined) {
    pageElement.qs(".section.setStreakHourOffset .info")?.show();
    const sign = snapshot?.streakHourOffset > 0 ? "+" : "";
    pageElement
      .qs(".section.setStreakHourOffset .info span")
      ?.setText(sign + snapshot?.streakHourOffset);
    pageElement.qs(".section.setStreakHourOffset .buttons")?.hide();
  }
}

export function updateUI(): void {
  if (getActivePage() !== "accountSettings") return;
  updateAccountSections();
  updateTabs();
  page.setUrlParams(state);
}

qs(".page.pageAccountSettings")?.onChild("click", ".tabs button", (event) => {
  state.tab = (event.target as HTMLElement).getAttribute(
    "data-tab",
  ) as State["tab"];
  updateTabs();
  page.setUrlParams(state);
});

qs(".page.pageAccountSettings #setStreakHourOffset")?.on("click", () => {
  StreakHourOffsetModal.show();
});

qs(".pageAccountSettings")?.onChild("click", "#updateAccountName", () => {
  showUpdateNameModal();
});

qs(".pageAccountSettings")?.onChild("click", "#deleteAccount", () => {
  showDeleteAccountModal();
});

qs(".pageAccountSettings")?.onChild("click", "#resetAccount", () => {
  showResetAccountModal();
});

qs(".pageAccountSettings")?.onChild(
  "click",
  "#optOutOfLeaderboardsButton",
  () => {
    showOptOutOfLeaderboardsModal();
  },
);

qs(".pageAccountSettings")?.onChild(
  "click",
  "#resetPersonalBestsButton",
  () => {
    showResetPersonalBestsModal();
  },
);

authEvent.subscribe((event) => {
  if (event.type === "authConfigUpdated") {
    updateUI();
  }
});

export const page = new PageWithUrlParams({
  id: "accountSettings",
  display: "Account Settings",
  element: pageElement,
  path: "/account-settings",
  urlParamsSchema: UrlParameterSchema,
  afterHide: async (): Promise<void> => {
    Skeleton.remove("pageAccountSettings");
  },
  beforeShow: async (options): Promise<void> => {
    if (options.urlParams?.tab !== undefined) {
      state.tab = options.urlParams.tab;
    }
    Skeleton.append("pageAccountSettings", "main");
    pageElement.qs(`.tab[data-tab="${state.tab}"]`)?.addClass("active");
    updateUI();
  },
});

onDOMReady(() => {
  Skeleton.save("pageAccountSettings");
});
