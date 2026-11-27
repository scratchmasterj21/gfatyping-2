import { For, JSXElement, Show } from "solid-js";

import { DifficultySegmented } from "../components/DifficultySegmented";
import { GameHowTo } from "../components/GameHowTo";
import { GameModalHeader } from "../components/GameModalHeader";
import { GameMultiplayerRoomFooter } from "../components/GameMultiplayerRoomFooter";
import { GamePickLayout } from "../components/GamePickLayout";
import { GameSetupPrimaryAction } from "../components/GameSetupPrimaryAction";
import { GameSetupSection } from "../components/GameSetupSection";
import { SoloTogetherToggle } from "../components/SoloTogetherToggle";
import { KANA_DIFFICULTIES, KanaDifficulty } from "./kana-words";

/** The setup screen shared by the romaji games. */
export function KanaGameSetup(props: {
  gameId: string;
  title: string;
  howTo: string[];
  /** 2-3 short tips always shown above the full rules */
  tips: string[];
  mode: "solo" | "together";
  onModeChange: (m: "solo" | "together") => void;
  togetherLabel: string;
  difficulty: KanaDifficulty;
  onDifficulty: (d: KanaDifficulty) => void;
  /** extra setup (e.g. how many Tappys) */
  extra?: JSXElement;
  roomBusy: boolean;
  joinCode: string;
  onJoinCodeChange: (c: string) => void;
  onSolo: () => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onClose: () => void;
}): JSXElement {
  return (
    <GamePickLayout
      header={
        <GameModalHeader title={props.title} onClose={() => props.onClose()} />
      }
      footer={
        <Show
          when={props.mode === "together"}
          fallback={
            <GameSetupPrimaryAction
              text="Play Tappy"
              onClick={() => props.onSolo()}
            />
          }
        >
          <GameMultiplayerRoomFooter
            gameId={props.gameId}
            roomBusy={props.roomBusy}
            joinCode={props.joinCode}
            onJoinCodeChange={(c) => props.onJoinCodeChange(c)}
            onCreateRoom={() => props.onCreateRoom()}
            onJoinRoom={() => props.onJoinRoom()}
            createLabel="Create a room for friends"
          />
        </Show>
      }
    >
      <GameHowTo tips={props.tips}>
        <ul class="grid gap-2 font-kid text-base text-text">
          <For each={props.howTo}>{(line) => <li>{line}</li>}</For>
        </ul>
      </GameHowTo>
      <GameSetupSection title="Play with">
        <SoloTogetherToggle
          mode={props.mode}
          multiplayerUnlocked={true}
          unlockHint=""
          onModeChange={(m) => props.onModeChange(m)}
          soloLabel="vs Tappy"
          togetherLabel={props.togetherLabel}
        />
      </GameSetupSection>
      <Show when={props.mode === "solo"}>{props.extra}</Show>
      <GameSetupSection title="Words">
        <DifficultySegmented
          options={KANA_DIFFICULTIES}
          selectedLabel={props.difficulty.label}
          onSelect={(d) => props.onDifficulty(d)}
        />
      </GameSetupSection>
    </GamePickLayout>
  );
}
