import { createEffect, createSignal, JSXElement, Show } from "solid-js";

import {
  introVideoPoster,
  isLocalIntroVideo,
} from "../../lessons/lesson-intro-videos";
import { hideModal, isModalOpen, showModal } from "../../states/modals";
import { AnimatedModal } from "../common/AnimatedModal";
import { Button } from "../common/Button";
import { YouTubeVideoPlayer } from "../common/YouTubeVideoPlayer";

const [videoId, setVideoId] = createSignal("");

/**
 * Opens the shared lesson-intro-video popup for a YouTube video id or a
 * self-hosted MP4 path (see lesson-intro-videos.ts).
 */
export function showLessonIntroVideo(id: string): void {
  setVideoId(id);
  showModal("LessonIntroVideo");
}

function LocalVideo(props: { src: string; active: boolean }): JSXElement {
  let el: HTMLVideoElement | undefined;
  createEffect(() => {
    if (!props.active) el?.pause();
  });
  return (
    <video
      ref={(e) => {
        el = e;
        // Set as an attribute: iPad Safari needs it to play in the popup
        // instead of jumping to fullscreen.
        e.setAttribute("playsinline", "");
      }}
      src={props.src}
      poster={introVideoPoster(props.src)}
      class="aspect-video w-full rounded-lg bg-bg"
      controls
      preload="metadata"
    ></video>
  );
}

export function LessonIntroVideoModal(): JSXElement {
  return (
    <AnimatedModal
      id="LessonIntroVideo"
      modalClass="w-full max-w-4xl p-4"
      closeOnWrapperClick
      closeOnEscape
    >
      <div class="mb-2 flex items-center justify-between gap-2">
        <div class="text-lg font-medium text-text">Intro video</div>
        <Button
          variant="text"
          fa={{ icon: "fa-times", fixedWidth: true }}
          onClick={() => hideModal("LessonIntroVideo")}
        />
      </div>
      <Show
        when={isLocalIntroVideo(videoId())}
        fallback={
          <YouTubeVideoPlayer
            videoId={videoId()}
            active={isModalOpen("LessonIntroVideo")}
          />
        }
      >
        <LocalVideo src={videoId()} active={isModalOpen("LessonIntroVideo")} />
      </Show>
    </AnimatedModal>
  );
}
