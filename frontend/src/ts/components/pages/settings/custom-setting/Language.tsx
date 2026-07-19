import { Language as LanguageSchema } from "@monkeytype/schemas/languages";
import SlimSelectCore from "slim-select";
import { Optgroup, Option } from "slim-select/store";
import { createSignal, JSXElement, onMount } from "solid-js";

import { listWordLists, WordList } from "../../../../classroom/assignments";
import { configMetadata } from "../../../../config/metadata";
import { setConfig } from "../../../../config/setters";
import { getConfig } from "../../../../config/store";
import {
  LanguageGroupNames,
  LanguageGroups,
} from "../../../../constants/languages";
import * as CustomText from "../../../../test/custom-text";
import { getLanguageDisplayString } from "../../../../utils/strings";
import SlimSelect from "../../../ui/SlimSelect";
import { Setting } from "../Setting";

const [activeWordListId, setActiveWordListId] = createSignal<string | null>(
  null,
);

let cachedWordLists: WordList[] = [];

function buildLangGroups(): Optgroup[] {
  return LanguageGroupNames.map(
    (group) =>
      ({
        label: group,
        options: LanguageGroups[group]?.map((language) => ({
          text: getLanguageDisplayString(language),
          value: language,
        })),
      }) as Optgroup,
  );
}

function buildAllGroups(wls: WordList[]): Optgroup[] {
  const groups = buildLangGroups();
  if (wls.length > 0) {
    groups.unshift({
      label: "class word lists",
      options: wls.map((wl) => ({ text: wl.title, value: `wl_${wl.id}` })),
    } as Optgroup);
  }
  return groups;
}

export function Language(): JSXElement {
  let slimRef: SlimSelectCore | null = null;

  const selected = (): string =>
    activeWordListId() !== null
      ? `wl_${activeWordListId()}`
      : getConfig.language;

  const handleChange = (val: string | undefined): void => {
    if (val === undefined) return;
    if (val.startsWith("wl_")) {
      const id = val.slice(3);
      const wl = cachedWordLists.find((w) => w.id === id);
      if (wl === undefined) return;
      setActiveWordListId(id);
      const words = wl.text
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 0);
      setConfig("mode", "custom", { nosave: true });
      CustomText.setPipeDelimiter(false);
      CustomText.setMode("repeat");
      CustomText.setText(words);
      CustomText.setLimitMode("word");
      CustomText.setLimitValue(words.length);
    } else {
      setActiveWordListId(null);
      if (getConfig.language === (val as LanguageSchema)) return;
      setConfig("language", val as LanguageSchema);
    }
  };

  onMount(() => {
    // Use cached results if already loaded (e.g. settings tab revisited).
    if (cachedWordLists.length > 0) {
      injectWordLists(cachedWordLists);
      return;
    }
    void listWordLists()
      .then((wls) => {
        if (wls.length === 0) return;
        cachedWordLists = wls;
        injectWordLists(wls);
      })
      .catch((_e: unknown) => undefined);
  });

  const injectWordLists = (wls: WordList[]): void => {
    if (slimRef === null) return;
    const groups = buildAllGroups(wls);
    slimRef.store.setData(groups as unknown as Option[]);
    requestAnimationFrame(() => {
      if (slimRef === null) return;
      slimRef.render.renderValues();
      slimRef.render.renderOptions(slimRef.store.getData());
      slimRef.setSelected([selected()]);
    });
  };

  return (
    <Setting
      key="language"
      title="language"
      description={configMetadata.language.description}
      fa={configMetadata.language.fa}
      inputs={
        <SlimSelect
          optionGroups={buildLangGroups()}
          selected={selected()}
          onChange={handleChange}
          ref={(inst) => {
            slimRef = inst;
          }}
        />
      }
    />
  );
}
