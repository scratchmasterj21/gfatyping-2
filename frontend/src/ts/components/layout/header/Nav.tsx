import { useQuery } from "@tanstack/solid-query";
import {
  createMemo,
  createSignal,
  JSXElement,
  onCleanup,
  Show,
} from "solid-js";

import { isCurrentUserAdmin } from "../../../auth";
import { usePendingConnectionsQuery } from "../../../collections/connections";
import { restartTestEvent } from "../../../events/test";
import { createEffectOn } from "../../../hooks/effects";
import { useRefWithUtils } from "../../../hooks/useRefWithUtils";
import { useClassroomAlerts } from "../../../lessons/classroom-alerts";
import { prefetchLeaderboardPage } from "../../../queries/prefetch";
import { getServerConfigurationQueryOptions } from "../../../queries/server-configuration";
import { getActivePage } from "../../../states/core";
import {
  getAccountButtonSpinner,
  getAnimatedLevel,
  setAnimatedLevel,
} from "../../../states/header";
import { showModal } from "../../../states/modals";
import { getSnapshot } from "../../../states/snapshot";
import { getFocus } from "../../../states/test";
import { cn } from "../../../utils/cn";
import { getLevelFromTotalXp } from "../../../utils/levels";
import { Anime } from "../../common/anime";
import { AnimePresence } from "../../common/anime/AnimePresence";
import { Button } from "../../common/Button";
import { Fa } from "../../common/Fa";
import { NotificationBubble } from "../../common/NotificationBubble";
import { User } from "../../common/User";
import { AccountMenu } from "./AccountMenu";
import { AccountXpBar } from "./AccountXpBar";

export function Nav(): JSXElement {
  const [getAccountMenuOpen, setAccountMenuOpen] = createSignal(false);
  const [getMobileMenuOpen, setMobileMenuOpen] = createSignal(false);
  const isCoarse = () => window.matchMedia("(pointer: coarse)").matches;
  const [accountMenuRef, accountMenuEl] = useRefWithUtils<HTMLDivElement>();
  const [mobileMenuRef, mobileMenuEl] = useRefWithUtils<HTMLDivElement>();

  const pendingConnections = usePendingConnectionsQuery();

  const handleClickOutside = (e: MouseEvent) => {
    const el = accountMenuEl();
    if (getAccountMenuOpen() && el && !el.native.contains(e.target as Node)) {
      setAccountMenuOpen(false);
    }
    const mobileEl = mobileMenuEl();
    if (
      getMobileMenuOpen() &&
      mobileEl &&
      !mobileEl.native.contains(e.target as Node)
    ) {
      setMobileMenuOpen(false);
    }
  };
  document.addEventListener("click", handleClickOutside);
  onCleanup(() => document.removeEventListener("click", handleClickOutside));

  const buttonClass = () =>
    cn("aspect-square min-h-10 min-w-10 xl:aspect-auto", {
      "opacity-(--nav-focus-opacity)": getFocus(),
    });

  const navLabel = (label: string): JSXElement => (
    <span class="hidden text-sm font-semibold lg:inline">{label}</span>
  );

  const pageProperties = (page: string, label: string) => ({
    active: getActivePage() === page,
    "aria-label": label,
    "aria-current": getActivePage() === page ? ("page" as const) : undefined,
  });

  const destinationButtonClass = () => cn(buttonClass(), "hidden lg:flex");
  const mobileDestinationClass = (page: string) =>
    cn(
      "w-full justify-start border-l-4 border-transparent",
      getActivePage() === page && "border-main bg-sub-alt text-text",
    );

  createEffectOn(getActivePage, () => setMobileMenuOpen(false));

  createEffectOn(getSnapshot, (snapshot) => {
    if (snapshot === undefined) {
      setAnimatedLevel(0);
      return;
    }
    setAnimatedLevel(getLevelFromTotalXp(snapshot.xp ?? 0));
  });

  const showFriendsNotificationBubble = createMemo((): boolean => {
    return pendingConnections().length > 0;
  });

  const { alerts: classroomAlerts } = useClassroomAlerts();

  const showAlertsNotificationBubble = createMemo((): boolean => {
    if (classroomAlerts().length > 0) return true;

    const snapshot = getSnapshot();
    if (snapshot === undefined) return false;

    return snapshot.inboxUnreadSize > 0;
  });

  const serverConfig = useQuery(() => getServerConfigurationQueryOptions());
  const showLoginButton = (): boolean =>
    serverConfig.data?.users.signUp ?? true;

  return (
    <nav class={cn("z-5 flex w-full items-center gap-1 md:gap-2")}>
      <div
        ref={mobileMenuRef}
        class="relative lg:hidden"
        onKeyDown={(event) => {
          if (event.key === "Escape") setMobileMenuOpen(false);
        }}
      >
        <button
          type="button"
          class="flex min-h-10 items-center gap-2 rounded px-3 font-semibold text-sub transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-main"
          aria-label={`${getMobileMenuOpen() ? "Close" : "Open"} navigation menu`}
          aria-expanded={getMobileMenuOpen()}
          aria-controls="student-navigation-menu"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <Fa icon="fa-bars" fixedWidth /> Menu
        </button>
        <Show when={getMobileMenuOpen()}>
          <div
            id="student-navigation-menu"
            role="group"
            aria-label="Main navigation"
            class="absolute top-full left-0 z-50 mt-2 grid min-w-52 gap-1 rounded bg-bg p-2 shadow-lg ring-2 ring-sub-alt"
          >
            <Button
              variant="text"
              fa={{ icon: "fa-keyboard", fixedWidth: true }}
              text="Type"
              class={mobileDestinationClass("test")}
              href="/"
              router-link
              {...pageProperties("test", "Typing practice")}
              onClick={() => {
                setMobileMenuOpen(false);
                if (getActivePage() === "test") restartTestEvent.dispatch();
              }}
            />
            <Button
              variant="text"
              fa={{ icon: "fa-graduation-cap", fixedWidth: true }}
              text="Continue lesson"
              class={mobileDestinationClass("lessons")}
              href="/lessons"
              router-link
              {...pageProperties("lessons", "Continue lesson")}
              onClick={() => setMobileMenuOpen(false)}
            />
            <Button
              variant="text"
              fa={{ icon: "fa-crown", fixedWidth: true }}
              text="Rankings"
              class={mobileDestinationClass("leaderboards")}
              href="/leaderboards"
              router-link
              {...pageProperties("leaderboards", "Leaderboards")}
              onClick={() => setMobileMenuOpen(false)}
            />
            <Show when={getSnapshot() !== undefined}>
              <Button
                variant="text"
                fa={{ icon: "fa-flag-checkered", fixedWidth: true }}
                text="Class race"
                class={mobileDestinationClass("race")}
                href="/race"
                router-link
                {...pageProperties("race", "Class race")}
                onClick={() => setMobileMenuOpen(false)}
              />
            </Show>
            <Show when={isCurrentUserAdmin()}>
              <Button
                variant="text"
                fa={{ icon: "fa-chalkboard-teacher", fixedWidth: true }}
                text="Teacher classroom"
                class={mobileDestinationClass("classroom")}
                href="/classroom"
                router-link
                {...pageProperties("classroom", "Teacher classroom")}
                onClick={() => setMobileMenuOpen(false)}
              />
              <Button
                variant="text"
                fa={{ icon: "fa-stopwatch", fixedWidth: true }}
                text="Host race"
                class={mobileDestinationClass("racehost")}
                href="/racehost"
                router-link
                {...pageProperties("racehost", "Host a class race")}
                onClick={() => setMobileMenuOpen(false)}
              />
            </Show>
            <Button
              variant="text"
              fa={{ icon: "fa-cog", fixedWidth: true }}
              text="Settings"
              class={mobileDestinationClass("settings")}
              href="/settings"
              router-link
              {...pageProperties("settings", "Settings")}
              onClick={() => setMobileMenuOpen(false)}
            />
          </div>
        </Show>
      </div>
      <Button
        variant="text"
        fa={{
          icon: "fa-keyboard",
          fixedWidth: true,
        }}
        router-link
        href="/"
        class={destinationButtonClass()}
        {...pageProperties("test", "Typing practice")}
        dataset={{
          "data-nav-item": "test",
        }}
        onClick={() => {
          if (getActivePage() === "test") restartTestEvent.dispatch();
        }}
      >
        {navLabel("Type")}
      </Button>
      <Button
        variant="text"
        fa={{
          icon: "fa-graduation-cap",
          fixedWidth: true,
        }}
        router-link
        dataset={{
          "data-nav-item": "lessons",
        }}
        class={destinationButtonClass()}
        href="/lessons"
        {...pageProperties("lessons", "Continue lesson")}
      >
        {navLabel("Continue lesson")}
      </Button>
      <Button
        variant="text"
        fa={{
          icon: "fa-crown",
          fixedWidth: true,
        }}
        router-link
        dataset={{
          "data-nav-item": "leaderboards",
        }}
        class={destinationButtonClass()}
        href="/leaderboards"
        {...pageProperties("leaderboards", "Leaderboards")}
        onMouseEnter={() => {
          prefetchLeaderboardPage();
        }}
      >
        {navLabel("Rankings")}
      </Button>
      <Show when={getSnapshot() !== undefined}>
        <Button
          variant="text"
          fa={{
            icon: "fa-flag-checkered",
            fixedWidth: true,
          }}
          router-link
          dataset={{
            "data-nav-item": "race",
          }}
          class={destinationButtonClass()}
          href="/race"
          {...pageProperties("race", "Class race")}
        >
          {navLabel("Race")}
        </Button>
      </Show>
      <Show when={isCurrentUserAdmin()}>
        <Button
          variant="text"
          fa={{
            icon: "fa-chalkboard-teacher",
            fixedWidth: true,
          }}
          router-link
          dataset={{
            "data-nav-item": "classroom",
          }}
          class={destinationButtonClass()}
          href="/classroom"
          {...pageProperties("classroom", "Teacher classroom")}
        >
          {navLabel("Classroom")}
        </Button>
        <Button
          variant="text"
          fa={{
            icon: "fa-stopwatch",
            fixedWidth: true,
          }}
          router-link
          dataset={{
            "data-nav-item": "racehost",
          }}
          class={destinationButtonClass()}
          href="/racehost"
          {...pageProperties("racehost", "Host a class race")}
        >
          {navLabel("Host race")}
        </Button>
      </Show>
      <Button
        variant="text"
        fa={{
          icon: "fa-cog",
          fixedWidth: true,
        }}
        class={buttonClass()}
        href="/settings"
        dataset={{
          "data-nav-item": "settings",
        }}
        router-link
        {...pageProperties("settings", "Settings")}
      >
        {navLabel("Settings")}
      </Button>
      <div class="grow"></div>
      <Button
        variant="text"
        fa={{
          icon: "fa-bell",
          fixedWidth: true,
        }}
        dataset={{
          "data-nav-item": "alerts",
        }}
        onClick={() => {
          showModal("Alerts");
        }}
        class={cn(buttonClass(), "relative")}
        aria-label="Notifications"
      >
        <NotificationBubble
          variant="fromCorner"
          show={showAlertsNotificationBubble()}
        />
      </Button>
      <AnimePresence exitBeforeEnter>
        <Show
          when={getSnapshot()}
          fallback={
            <Anime
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, duration: 125 }}
              exit={{ opacity: 0, duration: 125 }}
            >
              <Show when={showLoginButton()}>
                <Button
                  variant="text"
                  href="/login"
                  dataset={{
                    "data-nav-item": "login",
                  }}
                  fa={{
                    icon: "fa-user",
                    variant: "regular",
                    fixedWidth: true,
                  }}
                  router-link
                  class={buttonClass()}
                />
              </Show>
            </Anime>
          }
        >
          {(snap) => (
            <Anime
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, duration: 125 }}
              exit={{ opacity: 0, duration: 125 }}
            >
              <div
                ref={accountMenuRef}
                class={cn(
                  "relative",
                  !getFocus() &&
                    "hover:**:data-[ui-element='accountMenu']:pointer-events-auto hover:**:data-[ui-element='accountMenu']:opacity-100",
                  "has-focus-visible:**:data-[ui-element='accountMenu']:pointer-events-auto has-focus-visible:**:data-[ui-element='accountMenu']:opacity-100",
                  getAccountMenuOpen() &&
                    "**:data-[ui-element='accountMenu']:pointer-events-auto **:data-[ui-element='accountMenu']:opacity-100",
                )}
                // oxlint-disable-next-line react/no-unknown-property
                on:click={(e: MouseEvent) => {
                  if (isCoarse()) {
                    if (e.target instanceof HTMLAnchorElement) {
                      if (e.target.dataset["navItem"] === "account") {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                      setAccountMenuOpen((prev) => !prev);
                    }
                  }
                }}
              >
                <Button
                  variant="text"
                  class={cn(
                    "h-full",
                    "hover:**:data-[ui-element='userLevel']:bg-(--themable-button-hover-text)",
                    { "opacity-(--nav-focus-opacity)": getFocus() },
                  )}
                  href="/account"
                  router-link
                  dataset={{
                    "data-nav-item": "account",
                  }}
                >
                  <User
                    user={snap()}
                    showAvatar={true}
                    iconsOnly={true}
                    hideNameOnSmallScreens={true}
                    level={getAnimatedLevel()}
                    showSpinner={getAccountButtonSpinner()}
                    showNotificationBubble={showFriendsNotificationBubble()}
                    fontClass="text-em-xs"
                  />
                </Button>
                <AccountMenu
                  showFriendsNotificationBubble={showFriendsNotificationBubble()}
                />
              </div>
              <div class="relative">
                <AccountXpBar />
              </div>
            </Anime>
          )}
        </Show>
      </AnimePresence>
    </nav>
  );
}
