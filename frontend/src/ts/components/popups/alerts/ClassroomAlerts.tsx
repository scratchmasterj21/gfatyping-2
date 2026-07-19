import { For, JSXElement, Show } from "solid-js";

import { ClassroomAlert } from "../../../lessons/classroom-alerts";
import { Fa } from "../../common/Fa";
import { H3 } from "../../common/Headers";
import { AlertsSection } from "./AlertsSection";

export function ClassroomAlerts(props: {
  alerts: ClassroomAlert[];
}): JSXElement {
  return (
    <AlertsSection
      title={<H3 fa={{ icon: "fa-chalkboard-teacher" }} text="Classroom" />}
      body={
        <Show
          when={props.alerts.length > 0}
          fallback={<div class="place-self-center">Nothing to show</div>}
        >
          <div class="flex flex-col content-start gap-4 place-self-start">
            <For each={props.alerts}>{(alert) => <Alert alert={alert} />}</For>
          </div>
        </Show>
      }
    />
  );
}

function Alert(props: { alert: ClassroomAlert }): JSXElement {
  return (
    <div class="grid grid-cols-[1rem_1fr] gap-x-2">
      <Fa icon={props.alert.icon} class="mt-0.5 text-main" size={0.85} />
      <div>
        <div class="font-medium text-text">{props.alert.title}</div>
        <div class="text-xs wrap-break-word text-sub">
          {props.alert.message}
        </div>
      </div>
    </div>
  );
}
