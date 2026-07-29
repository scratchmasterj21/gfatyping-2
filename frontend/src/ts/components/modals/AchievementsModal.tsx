import { useQuery } from "@tanstack/solid-query";
import { For, JSXElement } from "solid-js";

import { getAuthenticatedUser } from "../../firebase";
import { Achievement, ACHIEVEMENTS } from "../../lessons/achievements";
import { getUserLessonStats } from "../../lessons/lesson-progress";
import { cn } from "../../utils/cn";
import { AnimatedModal } from "../common/AnimatedModal";
import { Fa } from "../common/Fa";

type Category = "lessons" | "speed" | "accuracy" | "streak";

const CATEGORY_ORDER: Category[] = ["lessons", "speed", "accuracy", "streak"];

const CATEGORY_LABELS: Record<Category, string> = {
  lessons: "Lessons",
  speed: "Speed",
  accuracy: "Accuracy",
  streak: "Streaks",
};

function categoryOf(id: string): Category {
  if (id.startsWith("speed")) return "speed";
  if (id.startsWith("accuracy")) return "accuracy";
  if (id.startsWith("streak")) return "streak";
  return "lessons";
}

export function AchievementsModal(): JSXElement {
  // Same queryKey LessonsPage.tsx/classroom-alerts.ts use for this data, so
  // opening this modal is usually a no-op read rather than an extra fetch.
  const statsQuery = useQuery(() => ({
    queryKey: ["userLessonStats"],
    queryFn: async () => {
      const uid = getAuthenticatedUser()?.uid;
      if (uid === undefined) {
        return {
          streakDays: 0,
          streakFreezesAvailable: 0,
          achievements: [] as string[],
          lastDailyChallengeDate: "",
          dailyChallengeDate: "",
          dailyChallengeLessonId: "",
          lastPracticedDate: "",
          lastSeenAssignmentsAt: 0,
          seenAchievementIds: [] as string[],
        };
      }
      return getUserLessonStats(uid);
    },
  }));

  const earnedSet = (): Set<string> =>
    new Set(statsQuery.data?.achievements ?? []);
  const isEarned = (id: string): boolean => earnedSet().has(id);
  const earnedCount = (): number => earnedSet().size;

  const grouped = (): { category: Category; items: Achievement[] }[] =>
    CATEGORY_ORDER.map((category) => ({
      category,
      items: ACHIEVEMENTS.filter((a) => categoryOf(a.id) === category),
    }));

  return (
    <AnimatedModal
      id="Achievements"
      title="Lesson Achievements"
      modalClass="max-w-2xl"
    >
      <div class="grid gap-4">
        <div class="text-center text-em-xs text-sub">
          {earnedCount()} / {ACHIEVEMENTS.length} unlocked
        </div>

        <For each={grouped()}>
          {(group) => (
            <div class="grid gap-2">
              <div class="text-em-xs font-medium text-sub uppercase">
                {CATEGORY_LABELS[group.category]}
              </div>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <For each={group.items}>
                  {(a) => {
                    const earned = (): boolean => isEarned(a.id);
                    return (
                      <div
                        class={cn(
                          "flex flex-col items-center gap-1 rounded p-3 text-center shadow-sm",
                          earned()
                            ? "bg-main text-bg"
                            : "bg-sub-alt text-sub opacity-60",
                        )}
                      >
                        <Fa icon={earned() ? a.icon : "fa-lock"} size={1.3} />
                        <span class="text-sm font-medium">{a.name}</span>
                        <span class="text-em-xs opacity-80">
                          {a.description}
                        </span>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>
    </AnimatedModal>
  );
}
