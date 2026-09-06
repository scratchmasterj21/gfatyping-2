import { ValidModeRule } from "@monkeytype/schemas/configuration";
import { Language } from "@monkeytype/schemas/languages";
import { Mode } from "@monkeytype/schemas/shared";
import { Accessor, For, JSXElement, Show } from "solid-js";

import { isCurrentUserAdmin } from "../../../auth";
import { CLASS_IDS, gradeOf, GRADES } from "../../../constants/classes";
import { isAuthenticated } from "../../../states/core";
import {
  ClassroomMetric,
  ClassroomSelectionType,
  isClassroomType,
  Selection,
  WpmMode2,
} from "../../../states/leaderboard-selection";
import { getSnapshot } from "../../../states/snapshot";
import { FaSolidIcon } from "../../../types/font-awesome";
import { Button } from "../../common/Button";

type GroupItem<T> = {
  id: T;
  text: string;
  icon: FaSolidIcon;
  description?: string;
};

type LanguagesByModeByMode2 = Partial<Record<Mode, Record<string, Language[]>>>;

type ValidLeaderboards = {
  allTime: LanguagesByModeByMode2;
  weekly: LanguagesByModeByMode2;
  daily: LanguagesByModeByMode2;
};

export type ModeSelect = Pick<Selection, "mode" | "mode2">;

export function Sidebar(props: {
  selection: Accessor<Selection>;
  onSelect: (selection: Selection) => void;
  validModeRules: ValidModeRule[];
}): JSXElement {
  const updateSelection = (patch: Partial<Selection>) => {
    props.onSelect(
      normalizeSelection(
        { ...props.selection(), ...patch } as Selection,
        getValidLeaderboards(props.validModeRules),
      ),
    );
  };

  const selectType = (type: Selection["type"]) => {
    updateSelection({ type });
  };

  const selectMode = (value: ModeSelect) => {
    updateSelection({ mode: value.mode, mode2: value.mode2 });
  };

  const selectLanguage = (language: Language) => {
    updateSelection({ language });
  };
  const selectMetric = (metric: ClassroomMetric) => {
    updateSelection({ metric } as Partial<Selection>);
  };
  const selectGameId = (gameId: string) => {
    updateSelection({ gameId } as Partial<Selection>);
  };
  const selectWpmMode2 = (mode2: WpmMode2) => {
    updateSelection({ mode2 } as Partial<Selection>);
  };
  const selectClassId = (classId: string) => {
    updateSelection({ classId } as Partial<Selection>);
  };
  const selectGrade = (grade: string) => {
    updateSelection({ grade } as Partial<Selection>);
  };

  const classroom = () => props.selection() as ClassroomSelectionType;
  const isClassroom = () => isClassroomType(props.selection().type);
  const hasClass = () => typeof getSnapshot()?.classId === "string";
  const openSchoolRankings = (): void => {
    selectType(!isCurrentUserAdmin() && hasClass() ? "class" : "school");
  };

  return (
    <div class="grid gap-3">
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          class="min-h-14 justify-start px-4 text-base"
          active={isClassroom()}
          fa={{ icon: "fa-school", fixedWidth: true }}
          text="School rankings"
          onClick={openSchoolRankings}
        />
        <Button
          class="min-h-14 justify-start px-4 text-base"
          active={!isClassroom()}
          fa={{ icon: "fa-globe-americas", fixedWidth: true }}
          text="Global rankings"
          onClick={() => selectType("allTime")}
        />
      </div>

      <Show when={isClassroom() && isAuthenticated()}>
        <Show when={!isCurrentUserAdmin() && !hasClass()}>
          <div class="rounded bg-sub-alt p-4 text-sm text-sub">
            <div class="font-semibold text-text">Class setup in progress</div>
            Your class and grade rankings will appear after your teacher assigns
            you. You can view the whole-school ranking now.
          </div>
        </Show>
        <Group
          title="Who do you want to compare?"
          selected={props.selection().type}
          onSelect={selectType}
          items={[
            ...(isCurrentUserAdmin()
              ? [
                  {
                    id: "class" as const,
                    text: "Choose a class",
                    icon: "fa-users" as const,
                  },
                  {
                    id: "grade" as const,
                    text: "Choose a grade",
                    icon: "fa-user-friends" as const,
                  },
                ]
              : hasClass()
                ? [
                    {
                      id: "class" as const,
                      text: "My class",
                      icon: "fa-users" as const,
                      description: getSnapshot()?.classId,
                    },
                    {
                      id: "grade" as const,
                      text: "My grade",
                      icon: "fa-user-friends" as const,
                      description: gradeOf(getSnapshot()?.classId),
                    },
                  ]
                : []),
            { id: "school", text: "Whole school", icon: "fa-school" },
          ]}
        />
        <Group
          title="What do you want to rank?"
          selected={classroom().metric ?? "xp"}
          onSelect={selectMetric}
          items={[
            {
              id: "xp",
              text: "Weekly XP",
              icon: "fa-star",
              description: "Practice earned this week",
            },
            {
              id: "xpAllTime",
              text: "All-time XP",
              icon: "fa-crown",
              description: "Total XP earned",
            },
            {
              id: "wpm",
              text: "Typing speed",
              icon: "fa-bolt",
              description: "Best English test WPM",
            },
            {
              id: "racewpm",
              text: "Race speed",
              icon: "fa-flag-checkered",
              description: "Best race WPM",
            },
            {
              id: "raceacc",
              text: "Race accuracy",
              icon: "fa-bullseye",
              description: "Best race accuracy",
            },
            {
              id: "games",
              text: "Games",
              icon: "fa-gamepad",
              description: "High scores by game",
            },
          ]}
        />
      </Show>
      <Show when={isClassroom() && classroom().metric === "wpm"}>
        <Group
          title="Test duration"
          selected={classroom().mode2 ?? "30"}
          onSelect={selectWpmMode2}
          items={[
            { id: "15", text: "15 seconds", icon: "fa-clock" },
            { id: "30", text: "30 seconds", icon: "fa-clock" },
            { id: "60", text: "60 seconds", icon: "fa-clock" },
          ]}
        />
      </Show>
      <Show when={isClassroom() && classroom().metric === "games"}>
        <Group
          title="Choose a game"
          selected={classroom().gameId}
          onSelect={selectGameId}
          items={[
            { id: "word-defender", text: "word defender", icon: "fa-rocket" },
            { id: "balloon-pop", text: "balloon pop", icon: "fa-circle" },
            { id: "type-racer", text: "type racer", icon: "fa-car" },
            { id: "ghost-hunter", text: "ghost hunter", icon: "fa-ghost" },
            { id: "fruit-ninja", text: "fruit ninja", icon: "fa-leaf" },
            { id: "type-toss", text: "type toss", icon: "fa-basketball-ball" },
          ]}
        />
      </Show>
      <Show
        when={
          isClassroom() &&
          props.selection().type === "class" &&
          isCurrentUserAdmin()
        }
      >
        <Group
          title="Choose a class"
          selected={classroom().classId}
          onSelect={selectClassId}
          items={CLASS_IDS.map((id) => ({
            id: id as string,
            text: id as string,
            icon: "fa-chalkboard" as FaSolidIcon,
          }))}
        />
      </Show>
      <Show when={isClassroom() && props.selection().type === "grade"}>
        <Show when={isCurrentUserAdmin()}>
          <Group
            title="Choose a grade"
            selected={classroom().grade}
            onSelect={selectGrade}
            items={GRADES.map((id) => ({
              id: id as string,
              text: id as string,
              icon: "fa-user-friends" as FaSolidIcon,
            }))}
          />
        </Show>
      </Show>

      <Show when={!isClassroom()}>
        <Group
          title="Choose a global board"
          selected={props.selection().type}
          onSelect={selectType}
          items={[
            {
              id: "allTime",
              text: "All-time speed",
              icon: "fa-trophy",
              description: "Best scores ever",
            },
            {
              id: "daily",
              text: "Daily speed",
              icon: "fa-sun",
              description: "Today in Japan time",
            },
            {
              id: "weekly",
              text: "Weekly XP",
              icon: "fa-calendar-day",
              description: "XP earned this week",
            },
          ]}
        />
      </Show>
      <Show when={!isClassroom() && props.selection().type !== "weekly"}>
        <Group
          title="Test type"
          selected={{
            mode: props.selection().mode,
            mode2: props.selection().mode2,
          }}
          onSelect={selectMode}
          items={getModeButtons(
            getValidLeaderboards(props.validModeRules)[
              props.selection().type as "allTime" | "weekly" | "daily"
            ],
            props.selection().language,
          )}
        />
      </Show>
      <Show when={props.selection().type === "daily"}>
        <Group
          title="Language"
          selected={props.selection().language}
          onSelect={selectLanguage}
          items={getLanguageButtons(
            getValidLeaderboards(props.validModeRules).daily,
            props.selection().mode,
            props.selection().mode2,
          )}
        />
      </Show>
    </div>
  );
}

function Group<T>(props: {
  title: string;
  items: GroupItem<T>[];
  selected: T | undefined;
  onSelect: (selected: T) => void;
}): JSXElement {
  const isEqual = (a: unknown, b: unknown): boolean =>
    typeof a === "object" ? JSON.stringify(a) === JSON.stringify(b) : a === b;

  return (
    <div class="grid gap-2 rounded-xl bg-sub-alt p-3">
      <div class="text-sm font-semibold text-sub">{props.title}</div>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <For each={props.items}>
          {(item) => (
            <Button
              onClick={() => props.onSelect(item.id)}
              fa={{ icon: item.icon, fixedWidth: true }}
              class="min-h-12 justify-start px-3"
              active={isEqual(item.id, props.selected)}
            >
              <span class="grid text-left">
                <span>{item.text}</span>
                <Show when={item.description !== undefined}>
                  <span class="text-xs font-normal opacity-70">
                    {item.description}
                  </span>
                </Show>
              </span>
            </Button>
          )}
        </For>
      </div>
    </div>
  );
}

function normalizeSelection(
  draft: Selection,
  valid: ValidLeaderboards,
): Selection {
  if (isClassroomType(draft.type)) {
    const cs = draft as ClassroomSelectionType;
    // ?? undefined: classId can come back as a literal null from Firestore
    // (teacher/unassigned accounts) even though the type says string |
    // undefined - null fails the classId/grade schemas' z.string().optional().
    const snapClassId = getSnapshot()?.classId ?? undefined;
    return {
      type: cs.type,
      metric: cs.metric ?? "xp",
      friendsOnly: false,
      previous: false,
      classId: cs.classId ?? snapClassId,
      grade: isCurrentUserAdmin()
        ? (cs.grade ??
          (snapClassId !== undefined ? gradeOf(snapClassId) : undefined))
        : snapClassId !== undefined
          ? gradeOf(snapClassId)
          : undefined,
      gameId: cs.gameId,
      mode: undefined,
      mode2: cs.metric === "wpm" ? (cs.mode2 ?? "30") : undefined,
      language: undefined,
    } as Selection;
  }

  if (draft.type === "weekly") {
    return {
      ...draft,
      mode: undefined,
      mode2: undefined,
      language: undefined,
      previous: false,
    };
  }

  const speed = draft as Extract<Selection, { type: "allTime" | "daily" }>;
  let { mode, mode2, language } = speed;
  const validModes = valid[speed.type];

  if (validModes === undefined) throw new Error("no valid leaderboards");

  if (mode === null || validModes[mode] === undefined) {
    const firstMode = Object.keys(validModes).sort()[0] as Mode | undefined;
    if (!firstMode) {
      throw new Error(`No valid mode for type ${draft.type}`);
    }
    mode = firstMode;
  }

  const validMode2 = validModes[mode] as Record<string, Language[]>;

  if (mode2 === null || validMode2[mode2] === undefined) {
    const firstMode2 = Object.keys(validMode2).sort(
      (a, b) => parseInt(a) - parseInt(b),
    )[0];
    if (firstMode2 === undefined) {
      throw new Error(`No valid mode2 for ${draft.type}:${mode}`);
    }
    mode2 = firstMode2;
  }

  const supportedLanguages = validMode2[mode2];
  if (!supportedLanguages || supportedLanguages.length === 0) {
    throw new Error(`Invalid leaderboard config for ${mode}:${mode2}`);
  }

  if (!language || !supportedLanguages.includes(language)) {
    language = supportedLanguages.sort()[0] as Language;
  }

  return { ...speed, mode, mode2, language };
}

function getModeButtons(
  valid: LanguagesByModeByMode2,
  language?: Language,
): GroupItem<ModeSelect>[] {
  const modes = Object.entries(valid).flatMap(([mode, mode2List]) =>
    Object.entries(mode2List)
      .filter(
        ([_, languages]) =>
          language === undefined || languages.includes(language),
      )
      .flatMap(([mode2]) => ({
        id: { mode, mode2 },
        text: `${mode} ${mode2}`,
        icon: mode === "time" ? "fa-clock" : "fa-align-left",
      })),
  );

  return modes as GroupItem<ModeSelect>[];
}

function getLanguageButtons(
  valid: LanguagesByModeByMode2,
  mode: Mode | undefined,
  mode2: string | undefined,
): GroupItem<Language>[] {
  if (mode === undefined || mode2 === undefined) return [];

  return (valid[mode]?.[mode2] ?? []).map((language) => ({
    id: language,
    text: language,
    icon: "fa-globe",
  }));
}
function getValidLeaderboards(
  validModeRules: ValidModeRule[],
): ValidLeaderboards {
  //a rule can contain multiple values. create a flat list out of them
  const dailyRules = validModeRules.flatMap((rule) => {
    const languages = convertRuleOption(rule.language) as Language[];
    const mode2List = convertRuleOption(rule.mode2);

    return mode2List.map((mode2) => ({
      mode: rule.mode as Mode,
      mode2,
      languages,
    }));
  });

  return {
    allTime: {
      time: {
        "15": ["english"],
        "30": ["english"],
        "60": ["english"],
      },
    },
    weekly: {},
    daily: dailyRules.reduce<
      Partial<Record<Mode, Record<string /*mode2*/, Language[]>>>
    >((acc, { mode, mode2, languages }) => {
      let modes = acc[mode];
      if (modes === undefined) {
        modes = {};
        acc[mode] = modes;
      }

      let modes2 = modes[mode2];
      if (modes2 === undefined) {
        modes2 = [];
        modes[mode2] = modes2;
      }

      modes2.push(...languages);
      return acc;
    }, {}),
  };
}

function convertRuleOption(rule: string): string[] {
  return rule.startsWith("(") ? rule.slice(1, -1).split("|") : [rule];
}
