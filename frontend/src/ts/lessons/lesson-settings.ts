import { deleteField, doc, getDoc, setDoc } from "firebase/firestore";

import { getDb } from "../firebase";
import { queryClient } from "../queries";

/**
 * Teacher lesson settings, per class with per-student overrides. One small
 * shared doc: schoolConfig/lessonSettings (admin-write, domain-read).
 *   homeRowOff.classes[classId] = true  -> no home-row check for the class
 *   homeRowOff.students[uid] = true/false -> off / on, beating the class
 */
export type LessonSettings = {
  homeRowOff: {
    classes: Record<string, boolean>;
    students: Record<string, boolean>;
  };
};

export const LESSON_SETTINGS_KEY = ["lessonSettings"];
const STALE_MS = 30 * 60 * 1000;

function settingsRef(): ReturnType<typeof doc> {
  return doc(getDb(), "schoolConfig", "lessonSettings");
}

function boolMap(raw: unknown): Record<string, boolean> {
  if (raw === null || typeof raw !== "object") return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "boolean") out[k] = v;
  }
  return out;
}

export function parseLessonSettings(data: unknown): LessonSettings {
  const h =
    data !== null && typeof data === "object"
      ? (data as { homeRowOff?: unknown }).homeRowOff
      : undefined;
  const r =
    h !== null && typeof h === "object"
      ? (h as { classes?: unknown; students?: unknown })
      : {};
  return {
    homeRowOff: { classes: boolMap(r.classes), students: boolMap(r.students) },
  };
}

export async function getLessonSettings(): Promise<LessonSettings> {
  const snap = await getDoc(settingsRef());
  return parseLessonSettings(snap.exists() ? snap.data() : null);
}

/** Cached for 30 minutes - safe to call before every lesson. */
export async function getLessonSettingsCached(): Promise<LessonSettings> {
  return queryClient.fetchQuery({
    queryKey: LESSON_SETTINGS_KEY,
    queryFn: getLessonSettings,
    staleTime: STALE_MS,
  });
}

/** Student override first, then the class; on by default. */
export function homeRowCheckOn(
  settings: LessonSettings | undefined,
  classId: string | undefined,
  uid: string | undefined,
): boolean {
  if (settings === undefined) return true;
  const own = uid === undefined ? undefined : settings.homeRowOff.students[uid];
  if (own !== undefined) return !own;
  return classId === undefined || settings.homeRowOff.classes[classId] !== true;
}

/** Admin only. */
export async function setClassHomeRowOff(
  classId: string,
  off: boolean,
): Promise<void> {
  await setDoc(
    settingsRef(),
    { homeRowOff: { classes: { [classId]: off ? true : deleteField() } } },
    { merge: true },
  );
}

/** Admin only. `null` = use the class setting. */
export async function setStudentHomeRowOff(
  uid: string,
  off: boolean | null,
): Promise<void> {
  await setDoc(
    settingsRef(),
    { homeRowOff: { students: { [uid]: off ?? deleteField() } } },
    { merge: true },
  );
}
