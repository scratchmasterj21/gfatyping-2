/**
 * Optional intro video shown as a tile on the Lessons page for a given lesson
 * group (see LessonsPage.tsx). Add an entry here to add a video for a group -
 * no other wiring needed. A value starting with "/" is a self-hosted MP4 in
 * static/ (a .jpg poster with the same name sits next to it); anything else is
 * a YouTube video id.
 */
export const LESSON_GROUP_INTRO_VIDEOS: Record<string, string> = {
  "home-row": "/videos/lessons/home-row.mp4",
  "top-row": "/videos/lessons/top-row.mp4",
  "bottom-row": "/videos/lessons/bottom-row.mp4",
  "all-keys": "/videos/lessons/all-keys.mp4",
};

/** True when the intro video is a self-hosted file rather than a YouTube id. */
export function isLocalIntroVideo(video: string): boolean {
  return video.startsWith("/");
}

/** Poster image for a self-hosted intro video. */
export function introVideoPoster(video: string): string {
  return video.replace(/\.mp4$/, ".jpg");
}
