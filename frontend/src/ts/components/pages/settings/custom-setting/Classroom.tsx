import { useQuery } from "@tanstack/solid-query";
import { createMemo, createSignal, For, JSXElement, Show } from "solid-js";

import {
  listAllStudents,
  setStudentClass,
  Student,
} from "../../../../classroom/classroom";
import { CLASS_IDS } from "../../../../constants/classes";
import { queryClient } from "../../../../queries";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../../../../states/notifications";
import { Button } from "../../../common/Button";
import { Setting } from "../Setting";

const studentsQueryKey = ["classroom", "students"];
const UNASSIGNED = "unassigned";
const CLASS_FILTER_ALL = "all";

const selectClass =
  "rounded bg-sub-alt px-2 py-1 text-text outline-none focus:ring-2 focus:ring-sub";

export function Classroom(): JSXElement {
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

  const invalidate = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: studentsQueryKey });
  };

  const filtered = createMemo<Student[]>(() => {
    const term = search().trim().toLowerCase();
    const cf = classFilter();
    let list = (studentsQuery.data ?? []).slice().sort((a, b) => {
      const ca = a.classId ?? "zzz";
      const cb = b.classId ?? "zzz";
      if (ca !== cb) return ca.localeCompare(cb);
      return a.name.localeCompare(b.name);
    });
    if (cf === UNASSIGNED) {
      list = list.filter((s) => (s.classId ?? UNASSIGNED) === UNASSIGNED);
    } else if (cf !== CLASS_FILTER_ALL) {
      list = list.filter((s) => s.classId === cf);
    }
    if (term === "") return list;
    return list.filter((s) => s.name.toLowerCase().includes(term));
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
    try {
      await setStudentClass(uid, value === UNASSIGNED ? null : value);
      await invalidate();
    } catch (e) {
      showErrorNotification("Failed to update class", { error: e });
    }
  };

  const assignBulk = async (): Promise<void> => {
    const uids = [...selected()];
    if (uids.length === 0) return;
    const target = bulkTarget() === UNASSIGNED ? null : bulkTarget();
    setBusy(true);
    try {
      for (const uid of uids) {
        await setStudentClass(uid, target);
      }
      await invalidate();
      setSelected(new Set<string>());
      showSuccessNotification(`Updated ${uids.length} student(s)`);
    } catch (e) {
      showErrorNotification("Failed to update classes", { error: e });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Setting
      key="classroom"
      title="classroom"
      fa={{ icon: "fa-chalkboard-teacher" }}
      description="Assign students to classes (G1A-G6B). Filter to unassigned and use the checkboxes to bulk-assign a fresh roster, or reassign many students at once - e.g. promote a whole class at the end of the year."
      fullWidthInputs={
        <div class="grid gap-3">
          <div class="flex gap-2">
            <input
              type="text"
              class="w-full rounded bg-bg px-3 py-2 text-text outline-none focus:ring-2 focus:ring-sub"
              placeholder="search students..."
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
              <For each={CLASS_IDS}>
                {(c) => <option value={c}>{c}</option>}
              </For>
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

          <Show
            when={!studentsQuery.isLoading}
            fallback={<div class="text-sub">loading students...</div>}
          >
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
                    <th class="p-2">class</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={filtered()}>
                    {(student) => (
                      <tr class="border-t border-sub-alt">
                        <td class="p-2">
                          <input
                            type="checkbox"
                            checked={selected().has(student.uid)}
                            onChange={() => toggle(student.uid)}
                          />
                        </td>
                        <td class="p-2 text-text">{student.name}</td>
                        <td class="p-2">
                          <select
                            class={selectClass}
                            value={student.classId ?? UNASSIGNED}
                            onChange={(e) =>
                              void assignOne(student.uid, e.currentTarget.value)
                            }
                          >
                            <option value={UNASSIGNED}>unassigned</option>
                            <For each={CLASS_IDS}>
                              {(c) => <option value={c}>{c}</option>}
                            </For>
                          </select>
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
        </div>
      }
    />
  );
}
