import { useQuery } from "@tanstack/solid-query";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  JSXElement,
  Show,
} from "solid-js";

import { getStudentSummary } from "../../../classroom/assignments";
import { readCertificateBatch } from "../../../classroom/certificate-batch";
import {
  CERTIFICATE_LEVELS,
  CertificateLevel,
  earnedLevels,
  nextLevel,
  reachedOn,
  stillNeeds,
} from "../../../classroom/certificate-levels";
import { getAuthenticatedUser } from "../../../firebase";
import {
  getChampionRecord,
  listPodiumFinishesFor,
  podiumPlace,
} from "../../../race/race-db";
import { getActivePage } from "../../../states/core";
import { Button } from "../../common/Button";
import { Page } from "../../common/Page";
import { CertificateCard, formatLongDate } from "./CertificateCard";
import { ChampionCertificateCard } from "./ChampionCertificateCard";

// margin:0 removes the browser-injected URL / date / page-number headers.
// The certificate keeps its colours when printed (print-color-adjust).
const printCss = `
@page { size: A4 landscape; margin: 0; }
@media print {
  html, body { margin: 0; padding: 0; background: white; }
  body * { visibility: hidden; }
  #gfaCertificate, #gfaCertificate * { visibility: visible; }
  #gfaCertificate {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    max-width: none !important;
    aspect-ratio: auto !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
`;

const batchPrintCss = `
@page { size: A4 landscape; margin: 0; }
@media print {
  html, body { margin: 0; padding: 0; background: white; }
  body * { visibility: hidden; }
  .gfa-cert-batch, .gfa-cert-batch * { visibility: visible; }
  .gfa-cert-batch {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100vw !important;
    gap: 0 !important;
  }
  .gfa-certificate {
    width: 100vw !important;
    height: 100vh !important;
    max-width: none !important;
    aspect-ratio: auto !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    break-after: page;
    page-break-after: always;
  }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
`;

function printCssFor(isBatch: boolean): string {
  return isBatch ? batchPrintCss : printCss;
}

export function CertificatePage(): JSXElement {
  const [search, setSearch] = createSignal(
    new URLSearchParams(window.location.search),
  );

  createEffect(() => {
    if (getActivePage() === "certificate") {
      setSearch(new URLSearchParams(window.location.search));
    }
  });

  const batch = createMemo(() =>
    search().get("batch") === "1" ? readCertificateBatch() : undefined,
  );

  const uid = createMemo(
    () => search().get("uid") ?? getAuthenticatedUser()?.uid ?? "",
  );

  const [pickedLevelId, setPickedLevelId] = createSignal<string | undefined>();

  // ?champion=<id>&place=1|2|3 - a Class Championship certificate
  const championId = createMemo(() => search().get("champion") ?? undefined);
  const championPlace = createMemo((): 1 | 2 | 3 => {
    const p = Number(search().get("place"));
    return p === 2 || p === 3 ? p : 1;
  });
  const championQuery = useQuery(() => ({
    queryKey: ["championRecord", championId()],
    queryFn: async () => getChampionRecord(championId() ?? ""),
    enabled: getActivePage() === "certificate" && championId() !== undefined,
    staleTime: 5 * 60 * 1000,
  }));
  // this student's podium finishes, listed under their level certificates
  const podiumQuery = useQuery(() => ({
    queryKey: ["podiumFinishes", uid()],
    queryFn: async () => listPodiumFinishesFor(uid()),
    enabled:
      getActivePage() === "certificate" &&
      uid() !== "" &&
      batch() === undefined &&
      championId() === undefined,
    staleTime: 5 * 60 * 1000,
  }));

  const summary = useQuery(() => ({
    queryKey: ["certificate", uid()],
    queryFn: async () => getStudentSummary(uid()),
    enabled:
      getActivePage() === "certificate" &&
      uid() !== "" &&
      batch() === undefined,
  }));

  return (
    <Page id="certificate">
      <style>{printCssFor(batch() !== undefined)}</style>
      <div class="content-grid grid gap-6 py-8">
        <div class="flex justify-center gap-2 print:hidden">
          <Button
            text={
              batch() !== undefined
                ? `print all ${batch()?.length ?? 0} / save as PDF`
                : "print / save as PDF"
            }
            fa={{ icon: "fa-print" }}
            onClick={() => {
              window.print();
            }}
          />
        </div>

        <Show when={batch()}>
          {(list) => (
            <div class="gfa-cert-batch grid gap-6">
              <Show
                when={list().length > 0}
                fallback={
                  <div class="text-center text-sub">
                    No certificates to print. Select students on the Classroom
                    page first.
                  </div>
                }
              >
                <For each={list()}>
                  {(data) => (
                    <CertificateCard
                      data={data}
                      level={earnedLevels(data).at(-1)}
                    />
                  )}
                </For>
              </Show>
            </div>
          )}
        </Show>

        <Show when={championId() !== undefined}>
          <Show
            when={championQuery.data}
            fallback={
              <div class="text-center text-sub print:hidden">
                {championQuery.isLoading
                  ? "loading..."
                  : "Could not find that championship."}
              </div>
            }
          >
            {(record) => (
              <Show
                when={record().podium[championPlace() - 1]}
                fallback={
                  <div class="text-center text-sub print:hidden">
                    Nobody finished in that place.
                  </div>
                }
              >
                <ChampionCertificateCard
                  id="gfaCertificate"
                  record={record()}
                  place={championPlace()}
                />
              </Show>
            )}
          </Show>
        </Show>

        <Show when={batch() === undefined && championId() === undefined}>
          <Show
            when={summary.data}
            fallback={
              <div class="text-center text-sub print:hidden">
                <Show
                  when={!summary.isLoading}
                  fallback={<span>loading...</span>}
                >
                  <span>Could not load certificate.</span>
                </Show>
              </div>
            }
          >
            {(data) => {
              const earned = (): CertificateLevel[] => earnedLevels(data());
              const shown = (): CertificateLevel | undefined =>
                earned().find((level) => level.id === pickedLevelId()) ??
                earned().at(-1);
              const upcoming = (): CertificateLevel | undefined =>
                nextLevel(data());
              return (
                <>
                  <div class="grid gap-3 print:hidden">
                    <div class="text-center text-sm text-sub">
                      Your certificates
                    </div>
                    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <For each={CERTIFICATE_LEVELS}>
                        {(level) => {
                          const have = (): boolean =>
                            earned().some((item) => item.id === level.id);
                          const at = (): number | undefined =>
                            reachedOn(level, data().lessonMarks);
                          return (
                            <button
                              type="button"
                              class="grid content-start gap-0.5 rounded-lg bg-sub-alt p-3 text-left disabled:opacity-50"
                              disabled={!have()}
                              onClick={() => setPickedLevelId(level.id)}
                            >
                              <div class="font-bold text-text">
                                {level.name}
                              </div>
                              <div class="text-xs text-text/70">
                                {level.title}
                              </div>
                              <div class="text-xs text-sub">
                                <Show
                                  when={have()}
                                  fallback={stillNeeds(level, data())}
                                >
                                  {at() !== undefined
                                    ? formatLongDate(at() ?? 0)
                                    : "Earned"}
                                </Show>
                              </div>
                            </button>
                          );
                        }}
                      </For>
                    </div>
                    <Show when={upcoming()}>
                      {(level) => (
                        <div class="text-center text-sm text-sub">
                          Next certificate: {level().name}.{" "}
                          {stillNeeds(level(), data())}.
                        </div>
                      )}
                    </Show>
                  </div>
                  <CertificateCard
                    id="gfaCertificate"
                    data={data()}
                    level={shown()}
                  />
                  <Show when={(podiumQuery.data ?? []).length > 0}>
                    <div class="grid gap-2 print:hidden">
                      <div class="text-center text-sm text-sub">
                        Championship certificates
                      </div>
                      <div class="flex flex-wrap justify-center gap-2">
                        <For each={podiumQuery.data}>
                          {(r) => {
                            const place = podiumPlace(r, uid());
                            return (
                              <a
                                class="rounded-lg bg-sub-alt px-3 py-2 text-text hover:bg-main hover:text-bg"
                                href={`/certificate?champion=${r.id}&place=${place}`}
                              >
                                {place === 1
                                  ? "👑 Class Champion"
                                  : place === 2
                                    ? "🥈 Runner-up"
                                    : "🥉 Third place"}{" "}
                                · {r.classId} ·{" "}
                                {new Date(r.crownedAt).toLocaleDateString()}
                              </a>
                            );
                          }}
                        </For>
                      </div>
                    </div>
                  </Show>
                </>
              );
            }}
          </Show>
        </Show>
      </div>
    </Page>
  );
}
