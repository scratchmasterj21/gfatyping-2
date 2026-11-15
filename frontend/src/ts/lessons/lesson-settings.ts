import { deleteField, doc, getDoc, setDoc } from "firebase/firestore";

import {
  ClassThemePolicy,
  DEFAULT_THEME_POLICY,
  parseThemePolicy,
} from "../controllers/theme-policy";
import { getDb } from "../firebase";
import { queryClient } from "../queries";

/**
 * Teacher lesson settings, per class with per-student overrides. One small
 * shared doc: schoolConfig/lessonSettings (admin-write, domain-read).
 *   homeRowOff.classes[classId] = true  -> no home-row check for the class
 *   homeRowOff.students[uid] = true/false -> off / on, beating the class
 *   themes.classes[classId] = { mode: "kids" | "locked", theme? } (absent =
 *     any readable theme - see controllers/theme-policy.ts)
 */
export type LessonSettings = {
  homeRowOff: {
    classes: Record<string, boolean>;
    students: Record<string, boolean>;
  };
  themes: Record<string, ClassThemePolicy>;
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
  const rawThemes =
    data !== null && typeof data === "object"
      ? (data as { themes?: { classes?: unknown } }).themes?.classes
      : undefined;
  const themes: Record<string, ClassThemePolicy> = {};
  if (rawThemes !== null && typeof rawThemes === "object") {
    for (const [k, v] of Object.entries(rawThemes as Record<string, unknown>)) {
      const policy = parseThemePolicy(v);
      if (policy !== undefined) themes[k] = policy;
    }
  }
  return {
    homeRowOff: { classes: boolMap(r.classes), students: boolMap(r.students) },
    themes,
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

export function classThemePolicy(
  settings: LessonSettings | undefined,
  classId: string | undefined,
): ClassThemePolicy {
  if (settings === undefined || classId === undefined) {
    return DEFAULT_THEME_POLICY;
  }
  return settings.themes[classId] ?? DEFAULT_THEME_POLICY;
}

/** Admin only. "readable" clears the entry. */
export async function setClassThemePolicy(
  classId: string,
  policy: ClassThemePolicy,
): Promise<void> {
  await setDoc(
    settingsRef(),
    {
      themes: {
        classes: {
          [classId]:
            policy.mode === "readable"
              ? deleteField()
              : policy.theme === undefined
                ? { mode: policy.mode }
                : { mode: policy.mode, theme: policy.theme },
        },
      },
    },
    { merge: true },
  );
}
