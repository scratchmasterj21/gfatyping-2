import { doc, getDoc, updateDoc } from "firebase/firestore";
import {
  createEffect,
  createSignal,
  For,
  JSXElement,
  onCleanup,
  Show,
} from "solid-js";

import {
  getSideImagesVersion,
  parseSets,
  SideImageSet,
} from "../../../classroom/side-images";
import { getDb } from "../../../firebase";
import { getUserId } from "../../../states/core";
import { resultVisibleSignal } from "../../../test/test-state";
import { focusWords } from "../../../test/test-ui";
import { cn } from "../../../utils/cn";

const ACTIVE_INDEX_WRITE_DEBOUNCE_MS = 500;

// total = sets.length + 1; the last slot (index === sets.length) means "off"
function Panel(props: {
  src: string | null;
  side: "left" | "right";
  current: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  // only passed on one of the two panels, so the picker only shows up once
  sets?: SideImageSet[];
  onPick?: (idx: number) => void;
}): JSXElement {
  const [failed, setFailed] = createSignal(false);
  const [pickerOpen, setPickerOpen] = createSignal(false);
  const isOff = (): boolean => props.current >= props.total - 1;
  const setCount = (): number => props.total - 1;
  const currentLabel = (): string =>
    isOff() ? "off" : `${props.current + 1}/${setCount()}`;

  return (
    <div
      class="pointer-events-none absolute top-0 z-10 hidden h-full md:flex md:flex-col md:items-center md:justify-center"
      style={{
        [props.side]: "1rem",
        width: "clamp(4rem, 8vw, 10rem)",
      }}
    >
      <Show when={props.src !== null && !failed()}>
        <img
          src={props.src ?? ""}
          alt=""
          class="max-h-full w-full rounded object-contain opacity-85"
          onError={() => setFailed(true)}
        />
      </Show>
      <Show when={props.total > 1}>
        <div class="pointer-events-auto relative mt-1 flex items-center gap-1">
          <button
            type="button"
            class="rounded px-1.5 py-0.5 text-sm text-text transition-colors hover:text-main"
            onClick={() => {
              props.onPrev();
              focusWords();
            }}
          >
            ‹
          </button>
          <Show
            when={props.sets !== undefined}
            fallback={
              <span class="max-w-16 truncate text-xs text-sub">
                {currentLabel()}
              </span>
            }
          >
            <button
              type="button"
              class="max-w-16 truncate text-xs text-sub transition-colors hover:text-main"
              onClick={() => {
                setPickerOpen((v) => !v);
                focusWords();
              }}
            >
              {currentLabel()}
            </button>
          </Show>
          <button
            type="button"
            class="rounded px-1.5 py-0.5 text-sm text-text transition-colors hover:text-main"
            onClick={() => {
              props.onNext();
              focusWords();
            }}
          >
            ›
          </button>

          <Show when={pickerOpen() && props.sets !== undefined}>
            <div class="absolute top-full left-1/2 z-20 mt-1 max-h-64 w-36 -translate-x-1/2 overflow-y-auto rounded bg-bg p-1 shadow-lg ring-1 ring-sub-alt">
              <For each={props.sets}>
                {(s, idx) => (
                  <button
                    type="button"
                    class={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-sub-alt",
                      idx() === props.current ? "text-main" : "text-text",
                    )}
                    onClick={() => {
                      props.onPick?.(idx());
                      setPickerOpen(false);
                      focusWords();
                    }}
                  >
                    <Show when={s.left !== null}>
                      <img
                        src={s.left ?? ""}
                        alt=""
                        class="h-6 w-6 shrink-0 rounded object-cover"
                      />
                    </Show>
                    <span class="truncate">{`Set ${idx() + 1}`}</span>
                  </button>
                )}
              </For>
              <button
                type="button"
                class={cn(
                  "w-full rounded px-2 py-1 text-left text-xs transition-colors hover:bg-sub-alt",
                  isOff() ? "text-main" : "text-text",
                )}
                onClick={() => {
                  props.onPick?.(props.sets?.length ?? 0);
                  setPickerOpen(false);
                  focusWords();
                }}
              >
                off
              </button>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

export function SideImagePanels(): JSXElement {
  const [sets, setSets] = createSignal<SideImageSet[]>([]);
  const [activeIndex, setActiveIndex] = createSignal(0);
  let writeTimeout: ReturnType<typeof setTimeout> | null = null;

  onCleanup(() => {
    if (writeTimeout !== null) clearTimeout(writeTimeout);
  });

  createEffect(() => {
    const uid = getUserId();
    getSideImagesVersion(); // tracked read: refetch whenever a purchase bumps this
    if (uid === null) return;

    void (async () => {
      const [userSnap, schoolSnap] = await Promise.all([
        getDoc(doc(getDb(), "users", uid)),
        getDoc(doc(getDb(), "schoolConfig", "sideImages")),
      ]);

      const schoolCatalog = parseSets(
        schoolSnap.exists() ? schoolSnap.data() : null,
      );
      const userData = userSnap.exists() ? userSnap.data() : undefined;

      // School-wide sets are shop items - only show ones this student has
      // bought (see side-images.ts's buySideImageSet / ownedSideImageSets).
      const ownedIds =
        (userData?.["ownedSideImageSets"] as
          | Record<string, true>
          | undefined) ?? {};
      const ownedSchoolSets = schoolCatalog.filter(
        (s) => s.id !== undefined && ownedIds[s.id] === true,
      );

      // Per-student teacher-assigned sets are a free bonus, always shown in
      // addition to anything bought from the shop - never a purchase.
      const rawUser = (userData as { sideImages?: unknown } | undefined)
        ?.sideImages;
      let perStudentSets: SideImageSet[] = [];
      let rawIdx: number | undefined;
      if (rawUser !== undefined && rawUser !== null) {
        const d = rawUser as Record<string, unknown>;
        rawIdx = d["activeIndex"] as number | undefined;
        if (Array.isArray(d["sets"])) {
          perStudentSets = d["sets"] as SideImageSet[];
        } else if ("left" in d || "right" in d) {
          // legacy single-pair format
          perStudentSets = parseSets(rawUser);
        }
      }

      const effectiveSets = [...perStudentSets, ...ownedSchoolSets];

      // allow idx === effectiveSets.length (the "off" slot)
      const idx = Math.max(0, Math.min(rawIdx ?? 0, effectiveSets.length));

      setSets(effectiveSets);
      setActiveIndex(idx);
    })();
  });

  const setIndex = (idx: number): void => {
    setActiveIndex(idx);

    const uid = getUserId();
    if (uid === null) return;
    if (writeTimeout !== null) clearTimeout(writeTimeout);
    writeTimeout = setTimeout(() => {
      void updateDoc(doc(getDb(), "users", uid), {
        "sideImages.activeIndex": idx,
      });
    }, ACTIVE_INDEX_WRITE_DEBOUNCE_MS);
  };

  const navigate = (dir: 1 | -1): void => {
    const total = sets().length + 1; // +1 for the "off" slot
    if (total <= 1) return;
    setIndex((activeIndex() + dir + total) % total);
  };

  const isOff = (): boolean => activeIndex() >= sets().length;
  const currentSet = (): SideImageSet | null =>
    isOff() ? null : (sets()[activeIndex()] ?? null);

  return (
    <Show when={!resultVisibleSignal() && sets().length > 0}>
      {/* Left panel always rendered — keeps nav (and the set picker) accessible in "off" mode */}
      <Panel
        src={currentSet()?.left ?? null}
        side="left"
        current={activeIndex()}
        total={sets().length + 1}
        onPrev={() => navigate(-1)}
        onNext={() => navigate(1)}
        sets={sets()}
        onPick={setIndex}
      />
      {/* Right panel only in image mode */}
      <Show when={!isOff() && (currentSet()?.right ?? null)} keyed>
        {(src) => (
          <Panel
            src={src}
            side="right"
            current={activeIndex()}
            total={sets().length + 1}
            onPrev={() => navigate(-1)}
            onNext={() => navigate(1)}
          />
        )}
      </Show>
    </Show>
  );
}
