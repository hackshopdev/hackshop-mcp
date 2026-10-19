import { createElement } from "../../site/node_modules/react";
import { createRoot } from "../../site/node_modules/react-dom/client";
import { WalkthroughVideo } from "../../site/components/community/BuildVideo";

// Isolated browser fixture, not a site route or a claimed Hackshop walkthrough.
// The video ID is the example in YouTube's official player documentation.
createRoot(document.getElementById("root")!).render(createElement(WalkthroughVideo, {
  title: "YouTube player integration test — not a Hackshop build",
  videoUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
  transcript: "Player integration fixture only. No hardware result is claimed.",
  chapters: [{ seconds: 0, title: "Official player example" }],
}));
