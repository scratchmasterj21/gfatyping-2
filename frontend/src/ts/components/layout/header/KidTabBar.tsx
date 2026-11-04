import { For, JSXElement, Show } from "solid-js";

import { isKidThemeActive } from "../../../controllers/kid-theme-controller";
import { getIsScreenshotting } from "../../../states/core";
import { getSnapshot } from "../../../states/snapshot";
import { getFocus } from "../../../states/test";
import { FaSolidIcon } from "../../../types/font-awesome";
import { cn } from "../../../utils/cn";
import { Button } from "../../common/Button";
import { Fa } from "../../common/Fa";
import { isNavPageActive, onFreeTypingNavClick } from "./nav-utils";

type Tab = {
  page: string;
  href: string;
  label: string;
  ariaLabel: string;
  icon: FaSolidIcon;
  onClick?: () => void;
  needsAccount?: boolean;
};

const TABS: Tab[] = [
  {
    page: "lessons",
    href: "/",
    label: "Lessons",
    ariaLabel: "Typing lessons",
    icon: "fa-graduation-cap",
  },
  {
    page: "test",
    href: "/test",
    label: "Practice",
    ariaLabel: "Free typing practice",
    icon: "fa-keyboard",
    onClick: onFreeTypingNavClick,
  },
  {
    page: "leaderboards",
    href: "/leaderboards",
    label: "Rankings",
    ariaLabel: "Leaderboards",
    icon: "fa-crown",
  },
  {
    page: "race",
    href: "/race",
    label: "Race",
    ariaLabel: "Class race",
    icon: "fa-flag-checkered",
    needsAccount: true,
  },
  {
    page: "settings",
    href: "/settings",
    label: "Settings",
    ariaLabel: "Settings",
    icon: "fa-cog",
  },
];

/**
 * Shown for students on phones/tablets (below lg, or any touch screen):
 * big thumb-friendly tabs at the bottom instead of the header menu.
 * Classes shared with the header so the two never show at the same time.
 */
export const KID_TAB_BAR_VISIBLE = "hidden max-lg:flex pointer-coarse:flex";
export const KID_TAB_BAR_HIDES = "max-lg:hidden pointer-coarse:hidden";

export function KidTabBar(): JSXElement {
  const tabs = () =>
    TABS.filter((t) => t.needsAccount !== true || getSnapshot() !== undefined);

  return (
    <Show when={isKidThemeActive()}>
      {/* spacer so the fixed bar never covers the end of the page */}
      <div class={cn(KID_TAB_BAR_VISIBLE, "h-24")} aria-hidden="true"></div>
      <nav
        aria-label="Main navigation"
        data-ui-element="kidTabBar"
        class={cn(
          KID_TAB_BAR_VISIBLE,
          "fixed inset-x-0 bottom-0 z-50 justify-center border-t-2 border-sub-alt bg-bg px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] font-kid transition-[translate,opacity] duration-200",
          (getFocus() || getIsScreenshotting()) &&
            "pointer-events-none translate-y-full opacity-0",
        )}
      >
        <div class="flex w-full max-w-2xl justify-around gap-1">
          <For each={tabs()}>
            {(tab) => {
              const active = () => isNavPageActive(tab.page);
              return (
                <Button
                  variant="text"
                  href={tab.href}
                  router-link
                  active={active()}
                  aria-label={tab.ariaLabel}
                  aria-current={active() ? "page" : undefined}
                  dataset={{ "data-nav-item": `tab-${tab.page}` }}
                  onClick={() => tab.onClick?.()}
                  class="min-h-14 min-w-16 flex-1 flex-col gap-1 rounded-double p-1 text-xs font-semibold"
                >
                  <span
                    class={cn(
                      "grid h-8 w-14 place-items-center rounded-full transition-colors",
                      active() && "bg-main text-bg",
                    )}
                  >
                    <Fa icon={tab.icon} fixedWidth size={1.25} />
                  </span>
                  <span>{tab.label}</span>
                </Button>
              );
            }}
          </For>
        </div>
      </nav>
    </Show>
  );
}
