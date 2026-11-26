import { For, JSXElement, Show } from "solid-js";

import { BuyButton } from "../../components/common/BuyButton";
import { Fa } from "../../components/common/Fa";
import { cn } from "../../utils/cn";
import { ZOO_INFO, ZooSpecies } from "./zoo-animals";
import { STARTER_ANIMAL, ZOO_AREAS, ZooArea, ZOO_PRICES } from "./zoo-areas";
import { ZOO_DECOR, ZooDecorId } from "./zoo-decor";
import { ZooAnimal } from "./ZooAnimal";
import { ZooDecor } from "./ZooDecor";

/** Animals for sale, area by area; locked areas say which lessons open them. */
export function ZooShopPanel(props: {
  coins: number;
  owned: ReadonlySet<ZooSpecies>;
  areaOpen: (area: ZooArea) => boolean;
  pendingId: string | null;
  onBuy: (species: ZooSpecies) => void;
  decorOwned: ReadonlySet<ZooDecorId>;
  onBuyDecor: (id: ZooDecorId) => void;
}): JSXElement {
  return (
    <div class="grid gap-4 font-kid">
      <For each={ZOO_AREAS}>
        {(area) => {
          const open = (): boolean => props.areaOpen(area);
          return (
            <section class="grid gap-2">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-lg font-bold text-text">{area.name}</h3>
                <Show when={!open()}>
                  <span class="flex items-center gap-1.5 rounded-full bg-sub-alt px-3 py-1 text-xs font-semibold text-sub">
                    <Fa icon="fa-lock" />
                    Finish the {area.requiresName} lessons to open
                  </span>
                </Show>
              </div>
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                <For each={area.species}>
                  {(s) => {
                    const owned = (): boolean => props.owned.has(s);
                    return (
                      <div
                        class={cn(
                          "flex flex-col items-center gap-1 rounded-double p-3",
                          owned() ? "bg-main/15" : "bg-sub-alt",
                          !open() && "opacity-60",
                        )}
                      >
                        <ZooAnimal
                          species={s}
                          mood={open() ? "happy" : "sleepy"}
                          class="h-20 w-auto"
                        />
                        <span class="text-base font-semibold text-text">
                          {ZOO_INFO[s].name}
                        </span>
                        <Show
                          when={!owned()}
                          fallback={
                            <span class="flex min-h-9 items-center gap-1 text-sm font-semibold text-main">
                              <Fa icon="fa-check-circle" />
                              {s === STARTER_ANIMAL
                                ? "your first friend"
                                : "in your zoo"}
                            </span>
                          }
                        >
                          <Show
                            when={open()}
                            fallback={
                              <span class="flex min-h-9 items-center gap-1 text-sm text-sub">
                                <Fa icon="fa-lock" />
                                {ZOO_PRICES[s] ?? 0}
                              </span>
                            }
                          >
                            <BuyButton
                              price={ZOO_PRICES[s] ?? 0}
                              coins={props.coins}
                              busy={props.pendingId === s}
                              locked={props.pendingId !== null}
                              onBuy={() => props.onBuy(s)}
                            />
                          </Show>
                        </Show>
                      </div>
                    );
                  }}
                </For>
              </div>
            </section>
          );
        }}
      </For>
      <section class="grid gap-2">
        <h3 class="text-lg font-bold text-text">Decorations</h3>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          <For each={ZOO_DECOR}>
            {(d) => {
              const owned = (): boolean => props.decorOwned.has(d.id);
              return (
                <div
                  class={cn(
                    "flex flex-col items-center gap-1 rounded-double p-3",
                    owned() ? "bg-main/15" : "bg-sub-alt",
                  )}
                >
                  <ZooDecor id={d.id} class="h-16 w-16" />
                  <span class="text-center text-sm font-semibold text-text">
                    {d.name}
                  </span>
                  <Show
                    when={!owned()}
                    fallback={
                      <span class="flex min-h-9 items-center gap-1 text-sm font-semibold text-main">
                        <Fa icon="fa-check-circle" />
                        in your zoo
                      </span>
                    }
                  >
                    <BuyButton
                      price={d.price}
                      coins={props.coins}
                      busy={props.pendingId === d.id}
                      locked={props.pendingId !== null}
                      onBuy={() => props.onBuyDecor(d.id)}
                    />
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </section>
    </div>
  );
}
