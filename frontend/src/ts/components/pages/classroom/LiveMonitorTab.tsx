import {
  createEffect,
  createMemo,
  createSignal,
  For,
  JSXElement,
  onCleanup,
  Show,
} from "solid-js";

import { StudentProgressRow } from "../../../classroom/assignments";
import {
  ClassPresenceMember,
  subscribeClassPresence,
} from "../../../classroom/class-presence";
import { findLesson } from "../../../lessons/lessons-data";
import { cn } from "../../../utils/cn";
import { Button } from "../../common/Button";
import { Fa } from "../../common/Fa";

const STALE_AWAY_MS = 45_000;
const STALE_OFFLINE_MS = 90_000;

type LiveStatus = "typing" | "onLessons" | "onTest" | "away" | "offline";

function statusFor(
  member: ClassPresenceMember | undefined,
  now: number,
): LiveStatus {
  if (member === undefined || now - member.lastSeen > STALE_OFFLINE_MS) {
    return "offline";
  }
  if (now - member.lastSeen > STALE_AWAY_MS) {
    return "away";
  }
  if (member.typing === true) return "typing";
  if (member.page === "lessons") return "onLessons";
  if (member.page === "test") return "onTest";
  return "away";
}

const statusLabel: Record<LiveStatus, string> = {
  typing: "Typing",
  onLessons: "On lessons",
  onTest: "On test",
  away: "Away",
  offline: "Offline",
};

function contextLabel(member: ClassPresenceMember | undefined): string {
  if (member === undefined) return "—";
  if (member.lessonId !== undefined) {
    return findLesson(member.lessonId)?.name ?? member.lessonId;
  }
  if (member.page === "test") return "Free typing";
  if (member.page === "lessons") return "Lessons hub";
  return "Other";
}

function formatLastSeen(ts: number | undefined, now: number): string {
  if (ts === undefined || ts <= 0) return "—";
  const sec = Math.round((now - ts) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  return `${min}m ago`;
}

export function LiveMonitorTab(props: {
  classId: string;
  rows: StudentProgressRow[];
}): JSXElement {
  const [members, setMembers] = createSignal<ClassPresenceMember[]>([]);
  const [now, setNow] = createSignal(Date.now());
  const [typingOnly, setTypingOnly] = createSignal(false);

  createEffect(() => {
    const classId = props.classId;
    const unsub = subscribeClassPresence(classId, setMembers);
    onCleanup(unsub);
  });

  const tick = setInterval(() => setNow(Date.now()), 2000);
  onCleanup(() => clearInterval(tick));

  const byUid = createMemo(() => {
    const map = new Map<string, ClassPresenceMember>();
    for (const m of members()) {
      map.set(m.uid, m);
    }
    return map;
  });

  const tableRows = createMemo(() => {
    const presence = byUid();
    let list = props.rows.map((row) => ({
      row,
      member: presence.get(row.uid),
      status: statusFor(presence.get(row.uid), now()),
    }));
    if (typingOnly()) {
      list = list.filter((r) => r.status === "typing");
    }
    list.sort((a, b) => {
      const order: Record<LiveStatus, number> = {
        typing: 0,
        onTest: 1,
        onLessons: 2,
        away: 3,
        offline: 4,
      };
      const d = order[a.status] - order[b.status];
      if (d !== 0) return d;
      return a.row.name.localeCompare(b.row.name);
    });
    return list;
  });

  const typingCount = createMemo(
    () =>
      props.rows.filter(
        (r) => statusFor(byUid().get(r.uid), now()) === "typing",
      ).length,
  );

  return (
    <div class="grid gap-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="text-sm text-sub">
          <span class="font-semibold text-text">{typingCount()}</span> typing
          now · updates every few seconds
        </div>
        <Button
          variant="text"
          text={typingOnly() ? "Show all" : "Typing only"}
          active={typingOnly()}
          onClick={() => setTypingOnly((v) => !v)}
        />
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-sub">
            <tr>
              <th class="p-2">name</th>
              <th class="p-2">status</th>
              <th class="p-2">context</th>
              <th class="p-2 text-right">progress</th>
              <th class="p-2 text-right">live wpm</th>
              <th class="p-2 text-right">last seen</th>
            </tr>
          </thead>
          <tbody>
            <For each={tableRows()}>
              {(entry) => (
                <tr class="border-t border-sub-alt">
                  <td
                    class="max-w-[10rem] truncate p-2 text-text"
                    title={entry.row.name}
                  >
                    {entry.row.name}
                  </td>
                  <td class="p-2">
                    <span
                      class={cn(
                        "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium",
                        entry.status === "typing" && "bg-main/20 text-main",
                        entry.status === "offline" && "text-sub",
                        entry.status === "away" && "text-sub",
                        (entry.status === "onLessons" ||
                          entry.status === "onTest") &&
                          "bg-sub-alt text-text",
                      )}
                    >
                      <Show when={entry.status === "typing"}>
                        <Fa icon="fa-keyboard" size={0.75} />
                      </Show>
                      {statusLabel[entry.status]}
                    </span>
                  </td>
                  <td class="max-w-[12rem] truncate p-2 text-sub">
                    {contextLabel(entry.member)}
                  </td>
                  <td class="p-2 text-right text-text">
                    <Show
                      when={
                        entry.member?.progress !== undefined &&
                        entry.status === "typing"
                      }
                      fallback="—"
                    >
                      {Math.round((entry.member?.progress ?? 0) * 100)}%
                    </Show>
                  </td>
                  <td class="p-2 text-right text-text">
                    <Show
                      when={
                        entry.member?.liveWpm !== undefined &&
                        entry.status === "typing"
                      }
                      fallback="—"
                    >
                      {entry.member?.liveWpm}
                    </Show>
                  </td>
                  <td class="p-2 text-right text-sub">
                    {formatLastSeen(entry.member?.lastSeen, now())}
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
        <Show when={props.rows.length === 0}>
          <div class="p-2 text-sub">no students in this class yet</div>
        </Show>
      </div>
    </div>
  );
}
