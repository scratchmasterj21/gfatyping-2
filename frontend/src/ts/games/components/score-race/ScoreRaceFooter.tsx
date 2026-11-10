import { JSXElement } from "solid-js";

import { GameMultiplayerRoomFooter } from "../GameMultiplayerRoomFooter";
import { ScoreRace } from "./use-score-race";

/** Setup footer in "together" mode: create / join / wait for an invite. */
export function ScoreRaceFooter(props: {
  race: ScoreRace;
  onCreate: () => void;
}): JSXElement {
  return (
    <GameMultiplayerRoomFooter
      gameId={props.race.gameId}
      roomBusy={props.race.busy()}
      joinCode={props.race.joinCode()}
      onJoinCodeChange={props.race.setJoinCode}
      onCreateRoom={() => props.onCreate()}
      onJoinRoom={() => void props.race.join()}
    />
  );
}
