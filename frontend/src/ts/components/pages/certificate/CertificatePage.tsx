import { useQuery } from "@tanstack/solid-query";
import {
  createEffect,
  createMemo,
  createSignal,
  JSXElement,
  Show,
} from "solid-js";

import { getStudentSummary } from "../../../classroom/assignments";
import { getAuthenticatedUser } from "../../../firebase";
import { getActivePage } from "../../../states/core";
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

function Divider(): JSXElement {
  return (
    <div class="mx-auto flex max-w-sm items-center gap-3 text-main/40">
      <div class="h-px flex-1 bg-main/30"></div>
      <span class="text-xs">✦</span>
      <div class="h-px flex-1 bg-main/30"></div>
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

  const uid = createMemo(
    () => search().get("uid") ?? getAuthenticatedUser()?.uid ?? "",
  );

  const summary = useQuery(() => ({
    queryKey: ["certificate", uid()],
    queryFn: async () => getStudentSummary(uid()),
    enabled: getActivePage() === "certificate" && uid() !== "",
  }));

  const today = (): string =>
    new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <Page id="certificate">
      <style>{printCss}</style>
      <div class="content-grid grid gap-6 py-8">
        <div class="flex justify-center gap-2 print:hidden">
          <Button
            text="print / save as PDF"
            fa={{ icon: "fa-print" }}
            onClick={() => {
              window.print();
            }}
          />
        </div>

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
          {(data) => (
            <div
              id="gfaCertificate"
              class="relative mx-auto w-full max-w-4xl overflow-hidden rounded-lg"
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
                        Certificate of Achievement
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
                    <div class="mt-1 text-[2.5em] leading-tight font-bold text-main">
                      {formatName(data().name)}
                    </div>
                    <Show when={data().classId !== undefined}>
                      <div class="mt-1 text-em-sm text-sub">
                        {data().classId}
                      </div>
                    </Show>
                    <div class="mx-auto mt-4 max-w-xl text-sub">
                      has demonstrated typing proficiency, reaching a best speed
                      of{" "}
                      <span class="font-semibold text-text">
                        {Math.round(data().bestWpm)} wpm
                      </span>{" "}
                      at{" "}
                      <span class="font-semibold text-text">
                        {Math.round(data().bestAcc)}%
                      </span>{" "}
                      accuracy, completing{" "}
                      <span class="font-semibold text-text">
                        {data().lessonsCompleted}
                      </span>{" "}
                      lesson(s) and earning{" "}
                      <span class="font-semibold text-text">
                        {data().lessonStars}
                      </span>{" "}
                      star(s).
                    </div>
                  </div>

                  {/* Bottom block */}
                  <div>
                    <Divider />
                    <div class="mt-3 inline-block rounded border border-main/25 px-5 py-1 text-em-xs tracking-widest text-sub uppercase">
                      Issued {today()}
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
          )}
        </Show>
      </div>
    </Page>
  );
}
