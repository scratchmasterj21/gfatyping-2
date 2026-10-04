import { JSXElement, Setter, Show } from "solid-js";
import { z } from "zod";

import { setPage } from "../../../states/leaderboard-selection";
import { showSimpleModal } from "../../../states/simple-modal";
import { cn } from "../../../utils/cn";
import { Button } from "../../common/Button";
import { LoadingCircle } from "../../common/LoadingCircle";

export function Navigation(props: {
  lastPage: number;
  userPage?: number;
  currentPage: number;
  onPageChange: Setter<number>;
  onScrollToUser: Setter<boolean>;
  isLoading?: boolean;
  class?: string;
}): JSXElement {
  const buttonClass = "px-2 sm:px-3 text-em-sm sm:text-em-base";

  return (
    <div
      class={cn("flex flex-wrap items-center justify-end gap-2", props.class)}
    >
      <Show when={props.isLoading}>
        <LoadingCircle color="sub" class="text-2xl" />
      </Show>
      <span class="w-full text-center text-sm text-sub sm:w-auto sm:text-right">
        Page {props.currentPage + 1} of {Math.max(1, props.lastPage)}
      </span>
      <Button
        onClick={() => props.onPageChange(0)}
        fa={{ icon: "fa-crown", fixedWidth: true }}
        text="Top"
        disabled={props.currentPage === 0}
        class={buttonClass}
        aria-label="First page"
      />
      <Show when={props.userPage !== undefined}>
        <Button
          onClick={() => {
            props.onPageChange(props.userPage as number);
            props.onScrollToUser(true);
          }}
          fa={{ icon: "fa-user", fixedWidth: true }}
          text="My rank"
          disabled={
            props.userPage === undefined || props.currentPage === props.userPage
          }
          class={buttonClass}
          aria-label="Go to my rank"
        />
      </Show>
      <Button
        onClick={() => {
          const lastPage = props.lastPage;
          props.onPageChange((old) => Math.max(0, Math.min(old, lastPage) - 1));
        }}
        fa={{ icon: "fa-chevron-left", fixedWidth: true }}
        text="Prev"
        disabled={props.currentPage === 0}
        class={buttonClass}
        aria-label="Previous page"
      />
      <Button
        onClick={() =>
          showSimpleModal({
            title: "Go to page",
            schema: z.object({
              pageNumber: z.number().int().safe().min(1),
            }),
            inputs: {
              pageNumber: {
                type: "number",
                placeholder: "Page number",
              },
            },
            buttonText: "Go",
            execFn: async ({ pageNumber }) => {
              setPage(pageNumber - 1);
              return {
                status: "success",
                showNotification: false,
              };
            },
          })
        }
        fa={{ icon: "fa-hashtag", fixedWidth: true }}
        class={buttonClass}
        disabled={props.lastPage <= 1}
        aria-label="Jump to page"
      >
        {props.currentPage + 1}
      </Button>
      <Button
        onClick={() => props.onPageChange((old) => old + 1)}
        fa={{ icon: "fa-chevron-right", fixedWidth: true }}
        text="Next"
        disabled={props.currentPage + 1 >= props.lastPage}
        class={buttonClass}
        aria-label="Next page"
      />
    </div>
  );
}
