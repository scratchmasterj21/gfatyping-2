import { envConfig } from "virtual:env-config";

import { addBanner } from "../states/banners";

/**
 * "New version - please refresh" banner. iPads keep the app open for days
 * (and the service worker serves the cached build), so fixes don't reach
 * students until a reload. Every build writes /version.json (never cached,
 * see vite.config.ts); when it no longer matches this build, ask to refresh.
 * Hits Vercel's static file only - no Firebase reads.
 */

const CHECK_EVERY_MS = 10 * 60 * 1000;
/** Don't re-check more often than this when the tab comes back. */
const MIN_GAP_MS = 60 * 1000;
const FIRST_CHECK_MS = 30 * 1000;

let lastCheckAt = 0;
let bannerShown = false;

async function latestVersion(): Promise<string | undefined> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { version?: unknown };
    return typeof data.version === "string" ? data.version : undefined;
  } catch {
    return undefined; // offline - try again later
  }
}

/** Update the service worker first, so the reload gets the new build. */
async function refreshToLatest(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg !== undefined) {
      await reg.update();
      // a new worker takes over (skipWaiting + clientsClaim) - give it a moment
      await new Promise<void>((resolve) => {
        const done = (): void => resolve();
        navigator.serviceWorker.addEventListener("controllerchange", done, {
          once: true,
        });
        setTimeout(done, 2500);
      });
    }
  } catch {
    // reload anyway
  }
  window.location.reload();
}

function showBanner(): void {
  if (bannerShown) return;
  bannerShown = true;
  addBanner({
    level: "success",
    icon: "fas fa-fw fa-gift",
    important: true,
    customContent: (
      <span class="flex flex-wrap items-center justify-center gap-2 font-kid text-base font-semibold">
        🎉 GFA Typing has an update! Tap refresh to get the newest version.
        <button
          type="button"
          class="cursor-pointer rounded-full bg-bg px-4 py-1 text-main hover:bg-text hover:text-bg"
          onClick={() => void refreshToLatest()}
        >
          refresh
        </button>
      </span>
    ),
  });
}

async function check(): Promise<void> {
  if (bannerShown || document.hidden) return;
  if (Date.now() - lastCheckAt < MIN_GAP_MS) return;
  lastCheckAt = Date.now();
  const latest = await latestVersion();
  if (latest !== undefined && latest !== envConfig.clientVersion) {
    showBanner();
  }
}

/** Start watching for new builds (production only). */
export function startVersionCheck(): void {
  if (envConfig.isDevelopment) return;
  setTimeout(() => void check(), FIRST_CHECK_MS);
  setInterval(() => void check(), CHECK_EVERY_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void check();
  });
}
