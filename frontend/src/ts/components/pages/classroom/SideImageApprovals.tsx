import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import {
  createMemo,
  createSignal,
  For,
  JSXElement,
  onMount,
  Show,
} from "solid-js";
import { createStore, produce, reconcile } from "solid-js/store";

import { listAllStudents, Student } from "../../../classroom/classroom";
import { parseSets, SideImageSet } from "../../../classroom/side-images";
import { getDb } from "../../../firebase";
import { cn } from "../../../utils/cn";
import { Fa } from "../../common/Fa";
import { H3 } from "../../common/Headers";

const inputClass =
  "w-full rounded bg-bg px-3 py-2 text-sm text-text outline-none focus:ring-2 focus:ring-sub";

function ImagePreview(props: { url: string | null }): JSXElement {
  const [failed, setFailed] = createSignal(false);
  return (
    <Show when={props.url !== null && props.url !== "" && !failed()}>
      <img
        src={props.url ?? ""}
        alt="preview"
        class="mt-1 h-28 w-full rounded object-contain"
        onError={() => setFailed(true)}
      />
    </Show>
  );
}

function ImageSetListEditor(props: {
  title: string;
  initialSets: SideImageSet[];
  onSave: (sets: SideImageSet[]) => Promise<void>;
  onClear?: () => Promise<void>;
}): JSXElement {
  const [sets, setSets] = createStore<SideImageSet[]>(
    props.initialSets.length > 0
      ? props.initialSets.map((s) => ({ ...s }))
      : [{ left: null, right: null }],
  );
  const [saving, setSaving] = createSignal(false);
  const [saved, setSaved] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [filter, setFilter] = createSignal("");

  // Indices into `sets` (not positions in a filtered copy), so editing/moving
  // still targets the right row regardless of what the filter is hiding.
  const visibleIndices = createMemo(() => {
    const q = filter().trim().toLowerCase();
    const indices = sets.map((_, i) => i);
    if (q === "") return indices;
    return indices.filter((i) =>
      (sets[i]?.label ?? "").toLowerCase().includes(q),
    );
  });

  // Store setters mutate paths in place (rather than replacing the whole
  // array/object like a signal would), so <For> keeps the same DOM node per
  // row across edits instead of remounting it and stealing input focus.
  const update = (
    idx: number,
    field: "left" | "right",
    value: string,
  ): void => {
    setSets(idx, field, value.trim() || null);
  };

  const updateLabel = (idx: number, value: string): void => {
    setSets(idx, "label", value.trim() || undefined);
  };

  const remove = (idx: number): void => {
    setSets(produce((s) => s.splice(idx, 1)));
  };

  const move = (idx: number, dir: -1 | 1): void => {
    const target = idx + dir;
    if (target < 0 || target >= sets.length) return;
    setSets(
      produce((s) => {
        const a = s[idx] as SideImageSet;
        const b = s[target] as SideImageSet;
        s[idx] = b;
        s[target] = a;
      }),
    );
  };

  const add = (): void => {
    setSets(produce((s) => s.push({ left: null, right: null })));
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    setSaved(false);
    const finalSets = sets.filter((s) => s.left !== null || s.right !== null);
    for (const s of finalSets) {
      for (const field of ["left", "right"] as const) {
        const url = s[field];
        if (url !== null) {
          try {
            new URL(url);
          } catch {
            setError(`Invalid URL: ${url}`);
            setSaving(false);
            return;
          }
        }
      }
    }
    try {
      await props.onSave(finalSets);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const clear = async (): Promise<void> => {
    if (props.onClear === undefined) return;
    setSaving(true);
    setError(null);
    try {
      await props.onClear();
      setSets(reconcile([{ left: null, right: null }]));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="flex flex-col gap-3 rounded bg-sub-alt p-4">
      <p class="text-sm font-medium text-text">{props.title}</p>
      <Show when={sets.length > 1}>
        <input
          type="text"
          class={inputClass}
          placeholder="Filter by label…"
          value={filter()}
          onInput={(e) => setFilter(e.currentTarget.value)}
        />
      </Show>
      <Show when={filter().trim() !== "" && visibleIndices().length === 0}>
        <p class="text-xs text-sub">No sets match &quot;{filter()}&quot;.</p>
      </Show>
      <For each={visibleIndices()}>
        {(idx) => (
          <div class="flex flex-col gap-2 rounded bg-bg p-3">
            <div class="flex items-center gap-2">
              <input
                type="text"
                class={cn(inputClass, "flex-1")}
                placeholder={`Set ${idx + 1} label (e.g. Space)`}
                value={sets[idx]?.label ?? ""}
                onInput={(e) => updateLabel(idx, e.currentTarget.value)}
              />
              <button
                type="button"
                class="rounded px-1.5 py-1 text-xs text-sub transition-colors enabled:hover:text-text disabled:opacity-30"
                disabled={idx === 0}
                onClick={() => move(idx, -1)}
              >
                <Fa icon="fa-chevron-up" />
              </button>
              <button
                type="button"
                class="rounded px-1.5 py-1 text-xs text-sub transition-colors enabled:hover:text-text disabled:opacity-30"
                disabled={idx === sets.length - 1}
                onClick={() => move(idx, 1)}
              >
                <Fa icon="fa-chevron-down" />
              </button>
              <button
                type="button"
                class="text-xs text-sub transition-colors hover:text-error"
                onClick={() => remove(idx)}
              >
                <Fa icon="fa-times" />
              </button>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1">
                <label class="text-xs text-sub">Left image URL</label>
                <input
                  type="url"
                  class={inputClass}
                  placeholder="https://..."
                  value={sets[idx]?.left ?? ""}
                  onInput={(e) => update(idx, "left", e.currentTarget.value)}
                />
                <ImagePreview url={sets[idx]?.left ?? null} />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-sub">Right image URL</label>
                <input
                  type="url"
                  class={inputClass}
                  placeholder="https://..."
                  value={sets[idx]?.right ?? ""}
                  onInput={(e) => update(idx, "right", e.currentTarget.value)}
                />
                <ImagePreview url={sets[idx]?.right ?? null} />
              </div>
            </div>
          </div>
        )}
      </For>
      <button
        type="button"
        class="self-start text-sm text-sub transition-colors hover:text-text"
        onClick={add}
      >
        <Fa icon="fa-plus" /> add set
      </button>
      <Show when={error() !== null}>
        <p class="text-xs text-error">{error()}</p>
      </Show>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="button primary"
          onClick={() => void save()}
          disabled={saving()}
        >
          {saving() ? "Saving…" : saved() ? "Saved!" : "Save"}
        </button>
        <Show when={props.onClear !== undefined}>
          <button
            type="button"
            class="rounded px-3 py-1.5 text-sm text-sub transition-colors hover:text-error"
            onClick={() => void clear()}
            disabled={saving()}
          >
            <Fa icon="fa-times" /> use school images
          </button>
        </Show>
      </div>
    </div>
  );
}

export function SideImageApprovals(): JSXElement {
  const [students, setStudents] = createSignal<Student[]>([]);
  const [selectedUid, setSelectedUid] = createSignal<string>("");
  const [schoolSets, setSchoolSets] = createSignal<SideImageSet[]>([]);
  const [studentSets, setStudentSets] = createSignal<SideImageSet[]>([]);
  const [loadingStudent, setLoadingStudent] = createSignal(false);
  const [schoolLoaded, setSchoolLoaded] = createSignal(false);

  onMount(() => {
    void (async () => {
      const [allStudents, schoolSnap] = await Promise.all([
        listAllStudents(),
        getDoc(doc(getDb(), "schoolConfig", "sideImages")),
      ]);
      setStudents(allStudents.sort((a, b) => a.name.localeCompare(b.name)));
      if (schoolSnap.exists()) {
        setSchoolSets(parseSets(schoolSnap.data()));
      }
      setSchoolLoaded(true);
    })();
  });

  const loadStudentSets = async (uid: string): Promise<void> => {
    if (uid === "") {
      setStudentSets([]);
      return;
    }
    setLoadingStudent(true);
    const snap = await getDoc(doc(getDb(), "users", uid));
    if (snap.exists()) {
      const raw = (snap.data() as { sideImages?: unknown }).sideImages;
      setStudentSets(
        raw !== null && raw !== undefined
          ? parseSets(
              (raw as Record<string, unknown>)["sets"] !== undefined
                ? raw
                : null,
            )
          : [],
      );
    } else {
      setStudentSets([]);
    }
    setLoadingStudent(false);
  };

  const saveSchool = async (sets: SideImageSet[]): Promise<void> => {
    await setDoc(doc(getDb(), "schoolConfig", "sideImages"), { sets });
    setSchoolSets(sets);
  };

  const saveStudent = async (sets: SideImageSet[]): Promise<void> => {
    const uid = selectedUid();
    if (uid === "") throw new Error("No student selected.");
    await updateDoc(doc(getDb(), "users", uid), { "sideImages.sets": sets });
    setStudentSets(sets);
  };

  const clearStudent = async (): Promise<void> => {
    const uid = selectedUid();
    if (uid === "") return;
    await updateDoc(doc(getDb(), "users", uid), { "sideImages.sets": null });
    setStudentSets([]);
  };

  return (
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <H3 fa={{ icon: "fa-school" }} text="school-wide images" />
        <p class="text-sm text-sub">
          Shown to all students unless overridden per-student. Students can
          cycle through sets and pick their favourite.
        </p>
        <Show
          when={schoolLoaded()}
          fallback={<p class="text-sm text-sub">Loading…</p>}
        >
          <ImageSetListEditor
            title="School-wide sets"
            initialSets={schoolSets()}
            onSave={saveSchool}
          />
        </Show>
      </div>

      <div class="flex flex-col gap-2">
        <H3 fa={{ icon: "fa-user" }} text="per-student images" />
        <p class="text-sm text-sub">
          Overrides school-wide for a specific student. Clear to fall back to
          school-wide.
        </p>
        <select
          class="rounded bg-bg px-3 py-2 text-sm text-text outline-none focus:ring-2 focus:ring-sub"
          value={selectedUid()}
          onChange={(e) => {
            const uid = e.currentTarget.value;
            setSelectedUid(uid);
            void loadStudentSets(uid);
          }}
        >
          <option value="">— select a student —</option>
          <For each={students()}>
            {(s) => <option value={s.uid}>{s.name}</option>}
          </For>
        </select>

        <Show
          when={
            selectedUid() !== "" && !loadingStudent() ? selectedUid() : null
          }
          keyed
        >
          {(uid) => (
            <ImageSetListEditor
              title={students().find((s) => s.uid === uid)?.name ?? "Student"}
              initialSets={studentSets()}
              onSave={saveStudent}
              onClear={clearStudent}
            />
          )}
        </Show>
        <Show when={loadingStudent()}>
          <p class="text-sm text-sub">Loading…</p>
        </Show>
      </div>
    </div>
  );
}
