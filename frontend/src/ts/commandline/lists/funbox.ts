import * as Funbox from "../../test/funbox/funbox";
import * as TestLogic from "../../test/test-logic";
import { getAllFunboxes, checkCompatibility } from "@monkeytype/funbox";
import { Command, CommandsSubgroup } from "../types";
import { getActiveFunboxNames } from "../../test/funbox/list";
import { getActiveLesson } from "../../lessons/lesson-progress";

const list: Command[] = [
  {
    id: "changeFunboxNone",
    display: "none",
    configValue: "none",
    alias: "off",
    sticky: true,
    exec: (): void => {
      if (Funbox.setFunbox([])) {
        TestLogic.restart();
      }
    },
  },
];

for (const funbox of getAllFunboxes()) {
  list.push({
    id: `changeFunbox${funbox.name}`,
    display: funbox.name.replace(/_/g, " "),
    available: () => {
      const activeNames = getActiveFunboxNames();
      if (activeNames.includes(funbox.name)) return true;
      return checkCompatibility(activeNames, funbox.name);
    },
    sticky: true,
    alias: funbox.alias,
    configValue: funbox.name,
    configValueMode: "include",
    exec: (): void => {
      Funbox.toggleFunbox(funbox.name);
      TestLogic.restart();
    },
  });
}

const subgroup: CommandsSubgroup = {
  title: "Funbox...",
  configKey: "funbox",
  list,
};

const commands: Command[] = [
  {
    id: "changeFunbox",
    display: "Funbox...",
    alias: "fun box",
    icon: "fa-gamepad",
    // Disabled during lessons - not a curated/intended part of the lesson
    // experience, and a stray funbox left active can carry into a lesson
    // run unexpectedly (see lesson-launcher.ts's funbox reset). Toggle this
    // back on by removing the `available` guard if funbox should be allowed
    // in lessons again later.
    available: () => getActiveLesson() === null,
    subgroup,
  },
];

export default commands;
