import { createSignal, For, JSXElement, Show } from "solid-js";

import { applyPendingInboxActions } from "../../../collections/inbox";
import { useClassroomAlerts } from "../../../lessons/classroom-alerts";
import { hideModalAndClearChain } from "../../../states/modals";
import { FaSolidIcon } from "../../../types/font-awesome";
import { cn } from "../../../utils/cn";
import { AnimatedModal } from "../../common/AnimatedModal";
import { Button } from "../../common/Button";
import { Fa } from "../../common/Fa";
import { ClassroomAlerts } from "./ClassroomAlerts";
import { Inbox } from "./Inbox";
import { NotificationHistory } from "./NotificationHistory";
import { Psas } from "./Psas";

type AlertTab = "classroom" | "inbox" | "announcements" | "history";

const TABS: { id: AlertTab; label: string; icon: FaSolidIcon }[] = [
  { id: "classroom", label: "Classroom", icon: "fa-chalkboard-teacher" },
  { id: "inbox", label: "Inbox", icon: "fa-inbox" },
  { id: "announcements", label: "News", icon: "fa-bullhorn" },
  { id: "history", label: "History", icon: "fa-comment-alt" },
];

export function AlertsPopup(): JSXElement {
  const { alerts, markAllSeen } = useClassroomAlerts();
  const [tab, setTab] = createSignal<AlertTab>("classroom");

  return (
    <AnimatedModal
      id="Alerts"
      modalClass="h-full absolute right-0 top-0 max-w-[calc(100vw-5rem)] sm:max-w-[calc(350px+2rem)] rounded-l bg-bg sm:p-4 p-4 sm:pt-8 pt-8 block overflow-hidden"
      customAnimations={{
        show: {
          modal: {
            marginRight: ["-10rem", "0"],
          },
        },
        hide: {
          modal: {
            marginRight: ["0", "-10rem"],
          },
        },
      }}
      onEscape={() => hideModalAndClearChain("Alerts")}
      onBackdropClick={() => hideModalAndClearChain("Alerts")}
      afterHide={() => {
        setTimeout(() => {
          applyPendingInboxActions();
          markAllSeen();
        }, 125);
      }}
    >
      <MobileClose />
      <div class="grid h-full grid-rows-[auto_1fr] gap-4 px-4 text-xs">
        <div class="flex gap-1 rounded bg-sub-alt p-1">
          <For each={TABS}>
            {(t) => (
              <button
                type="button"
                class={cn(
                  "relative flex flex-1 flex-col items-center gap-1 rounded px-2 py-2 transition-colors",
                  tab() === t.id
                    ? "bg-bg text-text"
                    : "text-sub hover:text-text",
                )}
                onClick={() => setTab(t.id)}
              >
                <Fa icon={t.icon} size={0.9} />
                <span class="text-em-xs">{t.label}</span>
                <Show when={t.id === "classroom" && alerts().length > 0}>
                  <span class="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-main"></span>
                </Show>
              </button>
            )}
          </For>
        </div>
        <div class="overflow-y-scroll">
          <Show when={tab() === "classroom"}>
            <ClassroomAlerts alerts={alerts()} />
          </Show>
          <Show when={tab() === "inbox"}>
            <Inbox />
          </Show>
          <Show when={tab() === "announcements"}>
            <Psas />
          </Show>
          <Show when={tab() === "history"}>
            <NotificationHistory />
          </Show>
        </div>
      </div>
    </AnimatedModal>
  );
}

function MobileClose(): JSXElement {
  return (
    <Button
      class="mb-8 hidden w-full pointer-coarse:flex"
      onClick={() => hideModalAndClearChain("Alerts")}
      text="Close"
      fa={{ icon: "fa-times" }}
    />
  );
}
