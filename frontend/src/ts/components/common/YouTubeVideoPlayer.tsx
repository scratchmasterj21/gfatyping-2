import {
  createEffect,
  createSignal,
  JSXElement,
  onCleanup,
  onMount,
  Show,
  untrack,
} from "solid-js";

import { useRef } from "../../hooks/useRef";
import { cn } from "../../utils/cn";
import { Fa } from "./Fa";

type YTPlayer = {
  destroy: () => void;
  getDuration: () => number;
  getCurrentTime: () => number;
  getIframe: () => HTMLIFrameElement;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  mute: () => void;
  unMute: () => void;
  setVolume: (volume: number) => void;
  cueVideoById: (videoId: string, startSeconds?: number) => void;
};

type YTPlayerReadyEvent = { target: YTPlayer };
type YTPlayerStateChangeEvent = { data: number; target: YTPlayer };

type YTNamespace = {
  Player: new (
    elementId: string,
    options: {
      host?: string;
      videoId: string;
      playerVars: Record<string, number>;
      events: {
        onReady?: (event: YTPlayerReadyEvent) => void;
        onStateChange?: (event: YTPlayerStateChangeEvent) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { PLAYING: number };
};

type WindowWithYT = Window & {
  YT?: YTNamespace;
  onYouTubeIframeAPIReady?: () => void;
};
type NavigatorWithStandalone = Navigator & { standalone?: boolean };

/** The subset of style properties saved/restored around fullscreen toggles. */
type SavedStyles = {
  overflow?: string;
  position?: string;
  top?: string;
  left?: string;
  width?: string;
  height?: string;
  zIndex?: string;
  backgroundColor?: string;
};

function getYT(): YTNamespace | undefined {
  return (window as WindowWithYT).YT;
}

let ytApiPromise: Promise<void> | null = null;

/** Loads the YouTube IFrame API script once, shared across all player instances. */
async function loadYouTubeApi(): Promise<void> {
  if (getYT()?.Player !== undefined) return Promise.resolve();
  if (ytApiPromise !== null) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const win = window as WindowWithYT;
    const previous = win.onYouTubeIframeAPIReady;
    win.onYouTubeIframeAPIReady = (): void => {
      previous?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
  });
  return ytApiPromise;
}

/**
 * A youtube-nocookie.com player with fully custom controls (no native YouTube
 * controls are ever shown - `controls: 0`), since the native iframe controls
 * aren't reliably clickable in some embedding contexts. Includes iOS Safari /
 * PWA-standalone-specific fullscreen fallbacks, since the standard Fullscreen
 * API is unreliable there.
 */
export function YouTubeVideoPlayer(props: {
  videoId: string;
  startTime?: number;
  allowFullScreen?: boolean;
  /** Pauses playback when set to false, e.g. when a wrapping modal closes. */
  active?: boolean;
}): JSXElement {
  const [containerRef, containerEl] = useRef<HTMLDivElement>();
  const playerElementId = `yt-player-${crypto.randomUUID()}`;
  let player: YTPlayer | null = null;
  let controlsTimeout: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let origBodyStyles: SavedStyles = {};
  let originalContainerStyles: SavedStyles | null = null;

  const [isPlaying, setIsPlaying] = createSignal(false);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [duration, setDuration] = createSignal(0);
  const [volume, setVolume] = createSignal(100);
  const [isMuted, setIsMuted] = createSignal(false);
  const [isFullScreen, setIsFullScreen] = createSignal(false);
  const [controlsVisible, setControlsVisible] = createSignal(true);

  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
  const isPWA =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as NavigatorWithStandalone).standalone === true;

  const startControlsTimer = (): void => {
    if (controlsTimeout !== null) clearTimeout(controlsTimeout);
    controlsTimeout = setTimeout(() => setControlsVisible(false), 2000);
  };

  const showControls = (): void => {
    setControlsVisible(true);
    startControlsTimer();
  };

  const applyPWAFullscreen = (): void => {
    const container = containerEl();
    if (container === undefined) return;

    originalContainerStyles = {
      position: container.style.position,
      top: container.style.top,
      left: container.style.left,
      width: container.style.width,
      height: container.style.height,
      zIndex: container.style.zIndex,
      backgroundColor: container.style.backgroundColor,
    };

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = "0";
    document.body.style.left = "0";
    document.body.style.width = "100%";
    document.body.style.height = "100%";

    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "100vw";
    container.style.height = "100vh";
    container.style.zIndex = "9999";
    container.style.backgroundColor = "black";

    const iframe = player?.getIframe();
    if (iframe !== undefined) {
      iframe.style.width = "100%";
      iframe.style.height = "100%";
    }

    if (isIOS && "orientation" in screen) {
      try {
        void (
          screen.orientation as unknown as {
            lock: (o: string) => Promise<void>;
          }
        )
          .lock("landscape")
          .catch(() => undefined);
      } catch {
        // orientation lock unsupported on this device - fine to ignore
      }
    }
  };

  const exitPWAFullscreen = (): void => {
    const container = containerEl();
    if (container === undefined || originalContainerStyles === null) return;

    for (const [key, value] of Object.entries(origBodyStyles)) {
      if (value !== undefined) {
        (document.body.style as unknown as Record<string, string>)[key] = value;
      }
    }
    for (const [key, value] of Object.entries(originalContainerStyles)) {
      if (value !== undefined) {
        (container.style as unknown as Record<string, string>)[key] = value;
      }
    }
    originalContainerStyles = null;

    if (isIOS && "orientation" in screen) {
      try {
        (screen.orientation as unknown as { unlock: () => void }).unlock();
      } catch {
        // orientation unlock unsupported on this device - fine to ignore
      }
    }
  };

  onMount(() => {
    origBodyStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      width: document.body.style.width,
      height: document.body.style.height,
    };

    const progressInterval = setInterval(() => {
      if (player !== null) {
        setCurrentTime(player.getCurrentTime());
        setDuration(player.getDuration());
      }
    }, 1000);

    startControlsTimer();

    const handleFullscreenChange = (): void => {
      if (!isPWA) setIsFullScreen(document.fullscreenElement !== null);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    onCleanup(() => {
      disposed = true;
      clearInterval(progressInterval);
      if (controlsTimeout !== null) clearTimeout(controlsTimeout);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      player?.destroy();
      player = null;
    });
  });

  // Tracks props.videoId so a persistent player instance (this component may
  // stay mounted across different videos, e.g. a singleton modal) re-cues
  // rather than silently pointing its iframe at a stale video/element.
  createEffect(() => {
    const videoId = props.videoId;
    const startTime = props.startTime ?? 0;

    if (player !== null) {
      player.cueVideoById(videoId, startTime);
      setIsPlaying(false);
      setCurrentTime(startTime);
      setDuration(0);
      return;
    }

    void loadYouTubeApi().then(() => {
      const YT = getYT();
      if (disposed || YT === undefined) return;
      player = new YT.Player(playerElementId, {
        host: "https://www.youtube-nocookie.com",
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          start: startTime,
          playsinline: 1,
        },
        events: {
          onReady: (event) => setDuration(event.target.getDuration()),
          onStateChange: (event) =>
            setIsPlaying(event.data === getYT()?.PlayerState.PLAYING),
        },
      });
      // If videoId changed again while the API/player was still loading,
      // cue the latest one instead of the stale value captured above.
      const latestVideoId = untrack(() => props.videoId);
      if (latestVideoId !== videoId) {
        player.cueVideoById(latestVideoId, untrack(() => props.startTime) ?? 0);
      }
    });
  });

  // Pause when a wrapping modal closes - AnimatedModal keeps this component
  // mounted (just hidden), so playback would otherwise keep running silently
  // in the background with sound still audible.
  createEffect(() => {
    if (props.active === false) player?.pauseVideo();
  });

  // Custom fixed-position fullscreen for PWA standalone mode, since iOS
  // Safari's real Fullscreen API doesn't work inside an installed PWA.
  createEffect(() => {
    if (!isFullScreen() || !isPWA) return;
    applyPWAFullscreen();
    onCleanup(() => {
      if (isPWA) exitPWAFullscreen();
    });
  });

  const togglePlay = (e?: MouseEvent): void => {
    e?.stopPropagation();
    if (player === null) return;
    if (isPlaying()) player.pauseVideo();
    else player.playVideo();
    startControlsTimer();
  };

  const skipBy = (seconds: number, e: MouseEvent): void => {
    e.stopPropagation();
    if (player === null) return;
    player.seekTo(Math.max(player.getCurrentTime() + seconds, 0), true);
    startControlsTimer();
  };

  const handleProgressBarClick = (
    e: MouseEvent & { currentTarget: HTMLDivElement },
  ): void => {
    if (player === null || duration() === 0) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration();
    const wasPlaying = isPlaying();
    player.seekTo(newTime, true);
    if (wasPlaying) {
      setTimeout(() => player?.playVideo(), 100);
    }
    startControlsTimer();
  };

  const toggleMute = (e: MouseEvent): void => {
    e.stopPropagation();
    if (player === null) return;
    if (isMuted()) {
      player.unMute();
      player.setVolume(volume());
    } else {
      player.mute();
    }
    setIsMuted(!isMuted());
    startControlsTimer();
  };

  const handleVolumeChange = (
    e: Event & { currentTarget: HTMLInputElement },
  ): void => {
    e.stopPropagation();
    const newVolume = Number(e.currentTarget.value);
    setVolume(newVolume);
    if (player === null) return;
    if (newVolume === 0) {
      player.mute();
      setIsMuted(true);
    } else {
      if (isMuted()) {
        player.unMute();
        setIsMuted(false);
      }
      player.setVolume(newVolume);
    }
    startControlsTimer();
  };

  const toggleIOSFullscreen = (next: boolean): void => {
    const container = containerEl();
    if (container === undefined) return;
    if (next) {
      const scrollPos = window.scrollY;
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollPos}px`;
      document.body.style.width = "100%";
      container.style.position = "fixed";
      container.style.top = "0";
      container.style.left = "0";
      container.style.width = "100%";
      container.style.height = "100%";
      container.style.zIndex = "9999";
      container.style.backgroundColor = "black";
    } else {
      const scrollPos = parseInt(document.body.style.top || "0", 10) * -1;
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollPos);
      container.style.position = "";
      container.style.top = "";
      container.style.left = "";
      container.style.width = "";
      container.style.height = "";
      container.style.zIndex = "";
      container.style.backgroundColor = "";
    }
  };

  const toggleFullScreen = (e: MouseEvent): void => {
    e.stopPropagation();
    if (player === null) return;
    const next = !isFullScreen();
    setIsFullScreen(next);

    if (isPWA) {
      if (!next) exitPWAFullscreen();
    } else if (isIOS) {
      toggleIOSFullscreen(next);
    } else if (document.fullscreenElement === null) {
      containerEl()
        ?.requestFullscreen()
        .catch((err: unknown) => {
          console.error("Error attempting to enable fullscreen:", err);
        });
    } else {
      document.exitFullscreen().catch((err: unknown) => {
        console.error("Error attempting to exit fullscreen:", err);
      });
    }

    startControlsTimer();
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div
      ref={containerRef}
      class={cn(
        "bg-black relative overflow-hidden rounded-lg",
        isFullScreen() ? "h-full w-full" : "aspect-video w-full",
      )}
      onMouseMove={showControls}
      onTouchStart={showControls}
      onClick={() => togglePlay()}
    >
      <div id={playerElementId} class="absolute inset-0 h-full w-full"></div>
      {/* Blocks clicks from reaching the iframe directly, so only our own
          controls below (which stopPropagation) can drive playback. */}
      <div class="absolute inset-0 z-10 bg-transparent"></div>

      <div
        class={cn(
          "bg-black/70 text-white absolute right-0 bottom-0 left-0 z-20 p-4 transition-opacity duration-300 ease-in-out",
          controlsVisible() ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div
          class="bg-gray-700 relative mb-4 h-1 cursor-pointer rounded-full"
          onClick={handleProgressBarClick}
        >
          <div
            class="bg-blue-500 absolute top-0 left-0 h-full rounded-full"
            style={{ width: `${(currentTime() / (duration() || 1)) * 100}%` }}
          ></div>
        </div>

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <button
              type="button"
              class="hover:bg-gray-700 rounded-full p-2 transition-colors"
              onClick={(e) => togglePlay(e)}
            >
              <Fa icon={isPlaying() ? "fa-pause" : "fa-play"} />
            </button>
            <button
              type="button"
              class="hover:bg-gray-700 rounded-full p-2 transition-colors"
              onClick={(e) => skipBy(-10, e)}
            >
              <Fa icon="fa-backward" />
            </button>
            <button
              type="button"
              class="hover:bg-gray-700 rounded-full p-2 transition-colors"
              onClick={(e) => skipBy(10, e)}
            >
              <Fa icon="fa-forward" />
            </button>
            <span class="text-sm">
              {formatTime(currentTime())} / {formatTime(duration())}
            </span>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="hover:bg-gray-700 rounded-full p-2 transition-colors"
                onClick={toggleMute}
              >
                <Fa icon={isMuted() ? "fa-volume-mute" : "fa-volume-up"} />
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={volume()}
                onInput={handleVolumeChange}
                class="w-20"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <Show when={props.allowFullScreen ?? true}>
              <button
                type="button"
                class="hover:bg-gray-700 rounded-full p-2 transition-colors"
                onClick={toggleFullScreen}
              >
                <Fa icon={isFullScreen() ? "fa-compress" : "fa-expand"} />
              </button>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
