import { useQuery } from "@tanstack/solid-query";
import { createMemo, createSignal, For, JSXElement, Show } from "solid-js";

import {
  listAllStudents,
  setStudentClass,
  Student,
} from "../../../classroom/classroom";
import { CLASS_IDS } from "../../../constants/classes";
import { queryClient } from "../../../queries";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../../../states/notifications";
import { showSimpleModal } from "../../../states/simple-modal";
import { Button } from "../../common/Button";
import { Fa } from "../../common/Fa";

const studentsQueryKey = ["classroom", "students"];
const UNASSIGNED = "unassigned";
const CLASS_FILTER_ALL = "all";

const selectClass =
  "rounded bg-sub-alt px-2 py-1 text-text outline-none focus:ring-2 focus:ring-sub";

export function StudentsTab(): JSXElement {
  const studentsQuery = useQuery(() => ({
    queryKey: studentsQueryKey,
    queryFn: listAllStudents,
    staleTime: 1000 * 60 * 5, // 5 min — student rosters don't change mid-session
  }));

  const [search, setSearch] = createSignal("");
  const [classFilter, setClassFilter] = createSignal<string>(CLASS_FILTER_ALL);
  const [selected, setSelected] = createSignal(new Set<string>());
  const [bulkTarget, setBulkTarget] = createSignal<string>(CLASS_IDS[0]);
  const [busy, setBusy] = createSignal(false);
  const [savingUid, setSavingUid] = createSignal<string | null>(null);
  const [savedUid, setSavedUid] = createSignal<string | null>(null);

  const students = createMemo(() => studentsQuery.data ?? []);
  const unassignedCount = createMemo(
    () => students().filter((student) => student.classId === undefined).length,
  );

  const invalidate = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: studentsQueryKey });
  };

  const filtered = createMemo<Student[]>(() => {
    const term = search().trim().toLowerCase();
    const cf = classFilter();
    let list = students()
      .slice()
      .sort((a, b) => {
        const ca = a.classId ?? "";
        const cb = b.classId ?? "";
        if (ca !== cb) return ca.localeCompare(cb);
        return a.name.localeCompare(b.name);
      });
    if (cf === UNASSIGNED) {
      list = list.filter((s) => (s.classId ?? UNASSIGNED) === UNASSIGNED);
    } else if (cf !== CLASS_FILTER_ALL) {
      list = list.filter((s) => s.classId === cf);
    }
    if (term === "") return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.email?.toLowerCase().includes(term) ?? false),
    );
  });

  const toggle = (uid: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const allFilteredSelected = createMemo(() => {
    const list = filtered();
    return list.length > 0 && list.every((s) => selected().has(s.uid));
  });

  const toggleAll = (): void => {
    const list = filtered();
    setSelected((prev) => {
      const next = new Set(prev);
      if (list.every((s) => next.has(s.uid))) {
        for (const s of list) next.delete(s.uid);
      } else {
        for (const s of list) next.add(s.uid);
      }
      return next;
    });
  };

  const assignOne = async (uid: string, value: string): Promise<void> => {
    if (savingUid() !== null) return;
    setSavingUid(uid);
    setSavedUid(null);
    try {
      await setStudentClass(uid, value === UNASSIGNED ? null : value);
      await invalidate();
      setSavedUid(uid);
      window.setTimeout(() => {
        setSavedUid(null);
      }, 2000);
    } catch (e) {
      showErrorNotification("Failed to update class", { error: e });
    } finally {
      setSavingUid(null);
    }
  };

  const assignBulk = async (): Promise<void> => {
    const uids = [...selected()];
    if (uids.length === 0) return;
    if (uids.length >= 5) {
      const target = bulkTarget();
      showSimpleModal({
        title: `Assign ${uids.length} students?`,
        text: `Their class will be changed to ${target}.`,
        buttonText: "assign students",
        execFn: async () => {
          const success = await applyBulkAssignment(uids, false);
          return {
            status: success ? "success" : "error",
            message: success
              ? `Updated ${uids.length} students`
              : "Failed to update every student",
          };
        },
      });
      return;
    }
    await applyBulkAssignment(uids);
  };

  const applyBulkAssignment = async (
    uids: string[],
    notify = true,
  ): Promise<boolean> => {
    const target = bulkTarget() === UNASSIGNED ? null : bulkTarget();
    setBusy(true);
    try {
      for (const uid of uids) {
        await setStudentClass(uid, target);
      }
      await invalidate();
      setSelected(new Set<string>());
      if (notify) {
        showSuccessNotification(`Updated ${uids.length} student(s)`);
      }
      return true;
    } catch (e) {
      if (notify) {
        showErrorNotification("Failed to update classes", { error: e });
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section class="grid gap-4 rounded bg-sub-alt p-4 md:p-6">
      <div>
        <h3 class="text-xl text-text">students and classes</h3>
        <p class="mt-1 text-sm text-sub">
          Assign students to G1A–G6B. Filter unassigned students or select
          several students to update them together.
        </p>
      </div>
      <div class="grid gap-3">
        <div class="flex flex-wrap gap-2 text-sm">
          <Button
            variant="text"
            active={classFilter() === CLASS_FILTER_ALL}
            text={`All ${students().length}`}
            onClick={() => setClassFilter(CLASS_FILTER_ALL)}
          />
          <Button
            variant="text"
            active={classFilter() === UNASSIGNED}
            text={`Unassigned ${unassignedCount()}`}
            onClick={() => setClassFilter(UNASSIGNED)}
          />
        </div>
        <div class="flex gap-2">
          <input
            type="text"
            class="w-full rounded bg-bg px-3 py-2 text-text outline-none focus:ring-2 focus:ring-sub"
            placeholder="search name or email..."
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
          />
          <select
            class={selectClass}
            value={classFilter()}
            onChange={(e) => setClassFilter(e.currentTarget.value)}
          >
            <option value={CLASS_FILTER_ALL}>all classes</option>
            <option value={UNASSIGNED}>unassigned</option>
            <For each={CLASS_IDS}>{(c) => <option value={c}>{c}</option>}</For>
          </select>
        </div>

        <Show when={selected().size > 0}>
          <div class="flex flex-wrap items-center gap-2 rounded bg-bg p-2">
            <span class="text-sub">{selected().size} selected</span>
            <select
              class={selectClass}
              value={bulkTarget()}
              onChange={(e) => setBulkTarget(e.currentTarget.value)}
            >
              <For each={CLASS_IDS}>
                {(c) => <option value={c}>{c}</option>}
              </For>
              <option value={UNASSIGNED}>unassigned</option>
            </select>
            <Button
              text={busy() ? "assigning..." : "assign"}
              onClick={() => void assignBulk()}
              disabled={busy()}
            />
            <Button
              variant="text"
              text="clear selection"
              onClick={() => setSelected(new Set<string>())}
            />
          </div>
        </Show>

        <Show when={studentsQuery.isLoading}>
          <div class="text-sub">loading students...</div>
        </Show>
        <Show when={!studentsQuery.isLoading && !studentsQuery.isError}>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="text-sub">
                <tr>
                  <th class="p-2">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected()}
                      onChange={toggleAll}
                    />
                  </th>
                  <th class="p-2">name</th>
                  <th class="p-2">email</th>
                  <th class="p-2">class</th>
                </tr>
              </thead>
              <tbody>
                <For each={filtered()}>
                  {(student) => (
                    <tr
                      class={
                        student.classId === undefined
                          ? "border-t border-sub bg-bg"
                          : "border-t border-sub-alt"
                      }
                    >
                      <td class="p-2">
                        <input
                          type="checkbox"
                          checked={selected().has(student.uid)}
                          onChange={() => toggle(student.uid)}
                        />
                      </td>
                      <td class="p-2 text-text">{student.name}</td>
                      <td class="p-2 text-sub">{student.email ?? "—"}</td>
                      <td class="p-2">
                        <div class="flex items-center gap-2">
                          <select
                            class={selectClass}
                            value={student.classId ?? UNASSIGNED}
                            disabled={savingUid() !== null || busy()}
                            onChange={(e) =>
                              void assignOne(student.uid, e.currentTarget.value)
                            }
                          >
                            <option value={UNASSIGNED}>unassigned</option>
                            <For each={CLASS_IDS}>
                              {(c) => <option value={c}>{c}</option>}
                            </For>
                          </select>
                          <Show when={savingUid() === student.uid}>
                            <Fa icon="fa-spinner" spin class="text-sub" />
                          </Show>
                          <Show when={savedUid() === student.uid}>
                            <Fa icon="fa-check" class="text-main" />
                          </Show>
                        </div>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
            <Show when={filtered().length === 0}>
              <div class="p-2 text-sub">no students found</div>
            </Show>
          </div>
        </Show>
        <Show when={studentsQuery.isError}>
          <div class="flex flex-wrap items-center gap-3 rounded bg-bg p-4 text-error">
            <span>Could not load students.</span>
            <Button
              text={studentsQuery.isFetching ? "retrying..." : "retry"}
              disabled={studentsQuery.isFetching}
              onClick={() => void studentsQuery.refetch()}
            />
          </div>
        </Show>
      </div>
    </section>
  );
}
