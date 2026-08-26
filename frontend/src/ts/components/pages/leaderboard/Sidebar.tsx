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

type GroupItem<T> = { id: T; text: string; icon: FaSolidIcon };

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

  return (
    <>
      <Group
        selected={props.selection().type}
        onSelect={selectType}
        items={[
          {
            id: "allTime",
            text: "all-time english",
            icon: "fa-globe-americas",
          },
          { id: "weekly", text: "weekly xp", icon: "fa-calendar-day" },
          { id: "daily", text: "daily", icon: "fa-sun" },
        ]}
      />
      <Show when={isAuthenticated()}>
        <Group
          selected={props.selection().type}
          onSelect={selectType}
          items={[
            { id: "class", text: "my class", icon: "fa-users" },
            { id: "grade", text: "my grade", icon: "fa-user-friends" },
            { id: "school", text: "school", icon: "fa-school" },
          ]}
        />
      </Show>
      <Show when={isClassroom()}>
        <Group
          selected={classroom().metric ?? "xp"}
          onSelect={selectMetric}
          items={[
            { id: "xp", text: "xp (weekly)", icon: "fa-star" },
            { id: "xpAllTime", text: "xp (all-time)", icon: "fa-crown" },
            { id: "wpm", text: "wpm", icon: "fa-bolt" },
            { id: "racewpm", text: "race wpm", icon: "fa-flag-checkered" },
            { id: "raceacc", text: "race acc", icon: "fa-bullseye" },
            { id: "games", text: "games", icon: "fa-gamepad" },
          ]}
        />
      </Show>
      <Show when={isClassroom() && classroom().metric === "wpm"}>
        <Group
          selected={classroom().mode2 ?? "30"}
          onSelect={selectWpmMode2}
          items={[
            { id: "15", text: "time 15", icon: "fa-clock" },
            { id: "30", text: "time 30", icon: "fa-clock" },
            { id: "60", text: "time 60", icon: "fa-clock" },
          ]}
        />
      </Show>
      <Show when={isClassroom() && classroom().metric === "games"}>
        <Group
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
      <Show when={isClassroom() && props.selection().type === "class"}>
        <Group
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

      <Show when={!isClassroom() && props.selection().type !== "weekly"}>
        <Group
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
          selected={props.selection().language}
          onSelect={selectLanguage}
          items={getLanguageButtons(
            getValidLeaderboards(props.validModeRules).daily,
            props.selection().mode,
            props.selection().mode2,
          )}
        />
      </Show>
    </>
  );
}

function Group<T>(props: {
  items: GroupItem<T>[];
  selected: T | undefined;
  onSelect: (selected: T) => void;
}): JSXElement {
  const isEqual = (a: unknown, b: unknown): boolean =>
    typeof a === "object" ? JSON.stringify(a) === JSON.stringify(b) : a === b;

  return (
    <div class="mb-3 grid gap-2 rounded-xl bg-sub-alt p-3 lg:mb-4 lg:gap-4 lg:p-4">
      <For each={props.items}>
        {(item) => (
          <Button
            onClick={() => props.onSelect(item.id)}
            fa={{ icon: item.icon }}
            text={item.text}
            class="justify-start px-[0.75em]"
            active={isEqual(item.id, props.selected)}
          />
        )}
      </For>
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
