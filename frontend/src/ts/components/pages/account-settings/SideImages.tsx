import {
  arrayRemove,
  arrayUnion,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { createSignal, For, JSXElement, onMount, Show } from "solid-js";

import { getAuthenticatedUser, getDb } from "../../../firebase";
import { cn } from "../../../utils/cn";
import { Fa } from "../../common/Fa";
import { H3 } from "../../common/Headers";

type SideImageStatus = "pending" | "approved" | "rejected";
export type SideImage = { url: string; status: SideImageStatus };
export type SideImageSet = {
  id: string;
  left: SideImage;
  right: SideImage;
  submittedAt: number;
};

function randomId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const STATUS_COLOR: Record<SideImageStatus, string> = {
  approved: "text-green-500",
  rejected: "text-error",
  pending: "text-yellow-500",
};

function ImageThumb(props: {
  side: "left" | "right";
  image: SideImage;
}): JSXElement {
  const [failed, setFailed] = createSignal(false);
  return (
    <div class="flex flex-col gap-1">
      <span class="text-xs text-sub capitalize">{props.side}</span>
      <Show
        when={!failed()}
        fallback={
          <div class="flex h-24 items-center justify-center rounded bg-sub text-xs text-sub">
            broken link
          </div>
        }
      >
        <img
          src={props.image.url}
          alt={`${props.side} side image`}
          class="h-24 w-full rounded object-cover"
          onError={() => setFailed(true)}
        />
      </Show>
      <span class={cn("text-xs capitalize", STATUS_COLOR[props.image.status])}>
        {props.image.status}
      </span>
    </div>
  );
}

function UrlField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}): JSXElement {
  const [preview, setPreview] = createSignal<string | null>(null);
  const [loadFailed, setLoadFailed] = createSignal(false);

  const applyPreview = (): void => {
    const v = props.value.trim();
    if (v === "") {
      setPreview(null);
      return;
    }
    try {
      new URL(v);
      setPreview(v);
      setLoadFailed(false);
    } catch {
      setPreview(null);
    }
  };

  return (
    <div class="flex flex-col gap-1">
      <label class="text-xs text-sub">{props.label}</label>
      <input
        type="url"
        class="w-full rounded bg-bg px-3 py-1.5 text-sm text-text outline-none focus:ring-2 focus:ring-sub"
        placeholder="https://..."
        value={props.value}
        onInput={(e) => props.onChange(e.currentTarget.value)}
        onBlur={applyPreview}
        onPaste={() => setTimeout(applyPreview, 0)}
      />
      <Show when={preview() !== null && !loadFailed()}>
        <img
          src={preview() ?? ""}
          alt="preview"
          class="h-24 w-full rounded object-cover"
          onError={() => setLoadFailed(true)}
        />
      </Show>
      <Show when={loadFailed()}>
        <p class="text-xs text-error">Could not load this image.</p>
      </Show>
    </div>
  );
}

export function SideImages(): JSXElement {
  const [sets, setSets] = createSignal<SideImageSet[]>([]);
  const [activeId, setActiveId] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(true);

  const [leftUrl, setLeftUrl] = createSignal("");
  const [rightUrl, setRightUrl] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const userRef = () => {
    const uid = getAuthenticatedUser()?.uid;
    if (uid === undefined || uid === null) throw new Error("Not authenticated");
    return doc(getDb(), "users", uid);
  };

  onMount(() => {
    void (async () => {
      const uid = getAuthenticatedUser()?.uid;
      if (uid === undefined || uid === null) {
        setLoading(false);
        return;
      }
      const snap = await getDoc(doc(getDb(), "users", uid));
      if (snap.exists()) {
        const data = snap.data() as {
          sideImageSets?: SideImageSet[];
          activeSideImageSetId?: string | null;
        };
        setSets(data.sideImageSets ?? []);
        setActiveId(data.activeSideImageSetId ?? null);
      }
      setLoading(false);
    })();
  });

  const submit = async (): Promise<void> => {
    const l = leftUrl().trim();
    const r = rightUrl().trim();
    setError(null);
    if (l === "" || r === "") {
      setError("Both URLs are required.");
      return;
    }
    if (sets().length >= 10) {
      setError("Maximum 10 sets reached.");
      return;
    }
    try {
      new URL(l);
      new URL(r);
    } catch {
      setError("Please enter valid image URLs.");
      return;
    }
    setSubmitting(true);
    const newSet: SideImageSet = {
      id: randomId(),
      left: { url: l, status: "pending" },
      right: { url: r, status: "pending" },
      submittedAt: Date.now(),
    };
    try {
      await updateDoc(userRef(), { sideImageSets: arrayUnion(newSet) });
      setSets([...sets(), newSet]);
      setLeftUrl("");
      setRightUrl("");
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteSet = async (set: SideImageSet): Promise<void> => {
    const wasActive = activeId() === set.id;
    const updates: Record<string, unknown> = {
      sideImageSets: arrayRemove(set),
    };
    if (wasActive) updates["activeSideImageSetId"] = null;
    await updateDoc(userRef(), updates);
    setSets(sets().filter((s) => s.id !== set.id));
    if (wasActive) setActiveId(null);
  };

  const selectSet = async (id: string): Promise<void> => {
    await updateDoc(userRef(), { activeSideImageSetId: id });
    setActiveId(id);
  };

  return (
    <div class="flex flex-col gap-6">
      <H3 text="side images" fa={{ icon: "fa-image" }} />
      <Show when={loading()}>
        <p class="text-sm text-sub">Loading…</p>
      </Show>
      <Show when={!loading()}>
        <p class="text-sm text-sub">
          Submit image pairs (left + right) to decorate the sides of the screen
          while you type. Images need teacher approval before they appear. After
          approval, come back here and click{" "}
          <span class="text-main">use this</span> to activate a set.
          <br />
          <span class="text-main">
            Recommended: portrait or square images, roughly 300×500 px or
            taller.
          </span>
        </p>

        <div class="flex flex-col gap-3">
          <For
            each={sets()}
            fallback={<p class="text-sm text-sub">No image sets yet.</p>}
          >
            {(set) => (
              <div
                class={cn(
                  "flex flex-col gap-3 rounded bg-sub-alt p-3",
                  activeId() === set.id ? "ring-2 ring-main" : "",
                )}
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs text-sub">
                    Submitted {new Date(set.submittedAt).toLocaleDateString()}
                  </span>
                  <div class="flex items-center gap-2">
                    <Show
                      when={
                        set.left.status === "approved" ||
                        set.right.status === "approved"
                      }
                    >
                      <button
                        type="button"
                        class={cn(
                          "rounded px-2 py-0.5 text-xs transition-colors",
                          activeId() === set.id
                            ? "bg-main text-bg"
                            : "bg-sub text-sub hover:text-text",
                        )}
                        onClick={() => void selectSet(set.id)}
                      >
                        {activeId() === set.id ? "active" : "use this"}
                      </button>
                    </Show>
                    <button
                      type="button"
                      class="rounded px-2 py-0.5 text-xs text-sub transition-colors hover:text-error"
                      onClick={() => void deleteSet(set)}
                    >
                      <Fa icon="fa-trash" />
                    </button>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <ImageThumb side="left" image={set.left} />
                  <ImageThumb side="right" image={set.right} />
                </div>
              </div>
            )}
          </For>
        </div>

        <Show when={sets().length < 10}>
          <div class="flex flex-col gap-4 rounded border border-sub-alt p-4">
            <p class="text-sm font-medium text-text">Add new image set</p>
            <div class="grid grid-cols-2 gap-4">
              <UrlField
                label="Left image URL"
                value={leftUrl()}
                onChange={setLeftUrl}
              />
              <UrlField
                label="Right image URL"
                value={rightUrl()}
                onChange={setRightUrl}
              />
            </div>
            <Show when={error() !== null}>
              <p class="text-xs text-error">{error()}</p>
            </Show>
            <button
              type="button"
              class="button primary self-start"
              onClick={() => void submit()}
              disabled={submitting()}
            >
              {submitting() ? "Submitting…" : "Submit for approval"}
            </button>
          </div>
        </Show>

        <Show when={sets().length >= 10}>
          <p class="text-xs text-sub">
            Maximum 10 sets reached. Delete one to add more.
          </p>
        </Show>
      </Show>
    </div>
  );
}
