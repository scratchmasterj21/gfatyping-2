import { createSignal, JSXElement } from "solid-js";

import { hideModal, isModalOpen, showModal } from "../../states/modals";
import { AnimatedModal } from "../common/AnimatedModal";
import { Button } from "../common/Button";
import { YouTubeVideoPlayer } from "../common/YouTubeVideoPlayer";

const [videoId, setVideoId] = createSignal("");

/** Opens the shared lesson-intro-video popup for a given YouTube video id. */
export function showLessonIntroVideo(id: string): void {
  setVideoId(id);
  showModal("LessonIntroVideo");
}

export function LessonIntroVideoModal(): JSXElement {
  return (
    <AnimatedModal
      id="LessonIntroVideo"
      modalClass="w-full max-w-2xl p-4"
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
      <YouTubeVideoPlayer
        videoId={videoId()}
        active={isModalOpen("LessonIntroVideo")}
      />
    </AnimatedModal>
  );
}
