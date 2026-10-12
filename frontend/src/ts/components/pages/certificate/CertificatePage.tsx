import { useQuery } from "@tanstack/solid-query";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  JSXElement,
  Show,
} from "solid-js";

import {
  getStudentSummary,
  StudentSummary,
} from "../../../classroom/assignments";
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
import { getActivePage } from "../../../states/core";
import { Avatar } from "../../common/Avatar";
import { Button } from "../../common/Button";
import { Fa } from "../../common/Fa";
import { Page } from "../../common/Page";

function formatName(name: string): string {
  if (name.includes(" ")) return name;
  return name.replace(/([a-z])([A-Z])/g, "$1 $2");
}

// margin:0 removes the browser-injected URL / date / page-number headers.
const printCss = `
@page { size: A4 landscape; margin: 0; }
@media print {
  html, body { margin: 0; padding: 0; }
  body * { visibility: hidden; }
  #gfaCertificate, #gfaCertificate * { visibility: visible; }
  #gfaCertificate {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    max-width: none !important;
    border-radius: 0 !important;
    overflow: visible !important;
    background: white !important;
  }
  .cert-outer {
    height: calc(100vh - 1.5rem) !important;
    display: flex !important;
    flex-direction: column !important;
  }
  .cert-inner {
    flex: 1 !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: space-between !important;
  }
  #gfaCertificate * {
    color: #1a1a1a !important;
    border-color: #bbb !important;
    background: transparent !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  #gfaCertificate .cert-award-icon { color: #b8860b !important; }
  #gfaCertificate .cert-logo { filter: none !important; }
}
`;

const batchPrintCss = `
@page { size: A4 landscape; margin: 0; }
@media print {
  html, body { margin: 0; padding: 0; }
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
    border-radius: 0 !important;
    background: white !important;
    break-after: page;
    page-break-after: always;
  }
  .cert-outer {
    height: calc(100vh - 1.5rem) !important;
    display: flex !important;
    flex-direction: column !important;
  }
  .cert-inner {
    flex: 1 !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: space-between !important;
  }
  .gfa-certificate * {
    color: #1a1a1a !important;
    border-color: #bbb !important;
    background: transparent !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .gfa-certificate .cert-award-icon { color: #b8860b !important; }
  .gfa-certificate .cert-logo { filter: none !important; }
}
`;

function printCssFor(isBatch: boolean): string {
  return isBatch ? batchPrintCss : printCss;
}

function Divider(): JSXElement {
  return (
    <div class="mx-auto flex max-w-sm items-center gap-3 text-main/40">
      <div class="h-px flex-1 bg-main/30"></div>
      <span class="text-xs">✦</span>
      <div class="h-px flex-1 bg-main/30"></div>
    </div>
  );
}

function formatLongDate(at: number): string {
  return new Date(at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function CertificateCard(props: {
  id?: string;
  data: StudentSummary;
  level?: CertificateLevel;
}): JSXElement {
  const today = (): string => formatLongDate(Date.now());
  const reached = (): string | undefined => {
    const level = props.level;
    if (level === undefined) return undefined;
    const at = reachedOn(level, props.data.lessonMarks);
    return at === undefined ? undefined : formatLongDate(at);
  };
  const toward = (): CertificateLevel =>
    nextLevel(props.data) ??
    CERTIFICATE_LEVELS[0] ?? {
      id: "bronze",
      name: "Bronze",
      lessons: 5,
      stars: 5,
      wpm: 8,
    };
  return (
    <div
      id={props.id}
      class="gfa-certificate relative mx-auto w-full max-w-4xl overflow-hidden rounded-lg"
      style={{
        background:
          "radial-gradient(ellipse at center, var(--sub-alt-color) 0%, var(--bg-color) 72%)",
      }}
    >
      {/* Corner ornaments */}
      <span class="absolute top-4 left-4 text-xl text-main/30 select-none">
        ✦
      </span>
      <span class="absolute top-4 right-4 text-xl text-main/30 select-none">
        ✦
      </span>
      <span class="absolute bottom-4 left-4 text-xl text-main/30 select-none">
        ✦
      </span>
      <span class="absolute right-4 bottom-4 text-xl text-main/30 select-none">
        ✦
      </span>

      {/* Outer border */}
      <div class="cert-outer m-3 rounded-md border-2 border-main/40">
        {/* Inner border — flex column so space-between fills height on print */}
        <div class="cert-inner m-1.5 rounded border border-main/20 px-16 py-8 text-center">
          {/* Top block — logo as letterhead, award icon beside title */}
          <div>
            <img
              src="/images/Felice Logo.svg"
              alt="Felice School"
              class="cert-logo mx-auto h-8 w-auto"
              style={{ filter: "brightness(0) invert(1)" }}
            />
            <div class="mt-3">
              <Divider />
            </div>
            <div class="mt-3 flex items-center justify-center gap-3">
              <Fa
                icon="fa-award"
                class="cert-award-icon text-main"
                size={1.5}
              />
              <span class="text-2xl tracking-wider text-text">
                {props.level !== undefined
                  ? `${props.level.name} Certificate`
                  : `Working toward ${toward().name}`}
              </span>
              <Fa
                icon="fa-award"
                class="cert-award-icon text-main"
                size={1.5}
              />
            </div>
          </div>

          {/* Middle block */}
          <div>
            <Divider />
            <div class="mt-4 text-sub italic">This certifies that</div>
            <div class="mt-1 flex items-center justify-center gap-4">
              <Show when={props.data.avatar}>
                {(a) => (
                  <Avatar
                    color={a().color}
                    shape={a().shape}
                    hair={a().hair}
                    hat={a().hat}
                    accessory={a().accessory}
                    face={a().face}
                    background={a().background}
                    animalImage={a().animalImage}
                    size={64}
                  />
                )}
              </Show>
              <div class="text-[2.5em] leading-tight font-bold text-main">
                {formatName(props.data.name)}
              </div>
            </div>
            <Show when={props.data.classId !== undefined}>
              <div class="mt-1 text-em-sm text-sub">{props.data.classId}</div>
            </Show>
            <div class="mx-auto mt-4 max-w-xl text-sub">
              <Show
                when={props.level}
                fallback={
                  <>
                    is working toward the {toward().name} certificate. Still
                    needs {stillNeeds(toward(), props.data)}.
                  </>
                }
              >
                {(level) => (
                  <>
                    has earned the {level().name} certificate, with a best speed
                    of{" "}
                    <span class="font-semibold text-text">
                      {Math.round(props.data.bestWpm)} wpm
                    </span>{" "}
                    at{" "}
                    <span class="font-semibold text-text">
                      {Math.round(props.data.bestAcc)}%
                    </span>{" "}
                    accuracy,{" "}
                    <span class="font-semibold text-text">
                      {props.data.lessonsCompleted}
                    </span>{" "}
                    lessons and{" "}
                    <span class="font-semibold text-text">
                      {props.data.lessonStars}
                    </span>{" "}
                    stars.
                  </>
                )}
              </Show>
            </div>
          </div>

          {/* Bottom block */}
          <div>
            <Divider />
            <div class="mt-3 inline-block rounded border border-main/25 px-5 py-1 text-em-xs tracking-widest text-sub uppercase">
              {reached() !== undefined
                ? `Reached ${reached()}`
                : `Issued ${today()}`}
            </div>
            <div class="mt-6 flex items-end justify-around gap-8 text-em-xs text-sub">
              <div class="flex-1 text-center">
                <div class="h-8"></div>
                <div class="border-t border-main/30 pt-2 tracking-wider">
                  Head of English
                </div>
              </div>
              <div class="self-center pb-3 text-xl text-main/20 select-none">
                ✦
              </div>
              <div class="flex-1 text-center">
                <div class="h-8"></div>
                <div class="border-t border-main/30 pt-2 tracking-wider">
                  Computer Class Teacher
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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

        <Show when={batch() === undefined}>
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
                              class="rounded-lg bg-sub-alt p-3 text-left disabled:opacity-50"
                              disabled={!have()}
                              onClick={() => setPickedLevelId(level.id)}
                            >
                              <div class="font-bold text-text">
                                {level.name}
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
                </>
              );
            }}
          </Show>
        </Show>
      </div>
    </Page>
  );
}
