import { createSpheresMerge } from "../../../public/spheres-avatar-loader.js";
import paperGrain from "../../../public/spheres/paper-grain.png?inline";
import poster from "../../../public/spheres-avatar-poster.png?inline";
import { mountBraidHandoff } from "../../../src/features/identity/braid-handoff.ts";

export const inject = ["react", "pages", "navigation"];

const gettingStarted = [
  {
    heading: "Start a conversation",
    description: "Pick someone in Messages to send a direct message.",
    label: "Messages",
    pluginId: "buzz.channels",
    pageId: "channels",
  },
  {
    heading: "Create your first agent",
    description:
      "Give your agent a name and tell it what you’d like help with.",
    label: "Agents",
    pluginId: "buzz.agents",
    pageId: "agents",
  },
];

const layout = {
  padding: "var(--space-panel-inset)",
  display: "grid",
  gap: "var(--space-4)",
};
const hero = {
  position: "relative",
  isolation: "isolate",
  overflow: "hidden",
  boxSizing: "border-box",
  minHeight: "clamp(25rem, 67vw, 31rem)",
  display: "grid",
  alignItems: "end",
  textAlign: "center",
  padding: "var(--space-8) var(--space-4) clamp(3rem, 8vw, 5rem)",
  borderRadius: "var(--radius-card, 1rem)",
  backgroundColor: "#f5ecde",
  backgroundImage: `radial-gradient(ellipse at center, #f8efe2dc, #eee2d2db), url(${paperGrain})`,
  backgroundSize: "auto, 224px 224px",
  color: "#242521",
};
const field = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  pointerEvents: "none",
};
const cards = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 19rem), 1fr))",
  gap: "var(--space-4)",
};
const card = {
  padding: "var(--space-panel-inset)",
  display: "grid",
  gap: "var(--space-2)",
  gridTemplateRows: "auto 1fr auto",
  justifyItems: "start",
};

export function apply(ctx) {
  const { createElement: h, useEffect, useRef, useState } = ctx.react;

  function SpheresHome() {
    const scene = useRef(null);
    const canvas = useRef(null);
    const [replay, setReplay] = useState(0);
    const [staticArt, setStaticArt] = useState(false);
    const [notice, setNotice] = useState("");

    useEffect(() => {
      let stop;
      if (typeof ResizeObserver === "function") {
        try {
          stop = mountBraidHandoff(
            canvas.current,
            scene.current,
            createSpheresMerge,
          );
        } catch {
          // The poster keeps Home usable if the decorative renderer is unavailable.
        }
      }
      setStaticArt(!stop);
      return stop;
    }, [replay]);

    async function open(destination) {
      setNotice("");
      const { status } = await ctx.navigation.open({
        version: 1,
        kind: "plugin",
        pluginId: destination.pluginId,
        pageId: destination.pageId,
      });
      if (status === "failed") {
        setNotice(
          `${destination.label} could not open. Check that it’s enabled in Settings → Plugins.`,
        );
      }
    }

    return h(
      "div",
      { style: layout },
      h(
        "section",
        { ref: scene, style: hero, "aria-labelledby": "spheres-home-title" },
        h("canvas", { ref: canvas, style: field, "aria-hidden": true }),
        staticArt &&
          h("img", {
            src: poster,
            alt: "",
            style: {
              position: "absolute",
              width: "min(38%, 10rem)",
              left: "50%",
              top: "22%",
              transform: "translateX(-50%)",
            },
          }),
        h(
          "div",
          {
            style: {
              position: "relative",
              display: "grid",
              justifyItems: "center",
              gap: "var(--space-4)",
            },
          },
          h(
            "h1",
            {
              id: "spheres-home-title",
              style: {
                margin: 0,
                fontSize: "clamp(2.6rem, 9vw, 5rem)",
                fontWeight: 570,
                lineHeight: 1,
                letterSpacing: "-0.065em",
              },
            },
            "Spheres",
          ),
          h(
            "button",
            { type: "button", onClick: () => setReplay((value) => value + 1) },
            "Replay animation",
          ),
        ),
      ),
      h(
        "section",
        { "aria-label": "Getting started", style: cards },
        gettingStarted.map((destination) =>
          h(
            "article",
            { key: destination.pageId, className: "ui-card", style: card },
            h("h2", { style: { margin: 0 } }, destination.heading),
            h("p", { style: { margin: 0 } }, destination.description),
            h(
              "button",
              { type: "button", onClick: () => void open(destination) },
              `Open ${destination.label}`,
            ),
          ),
        ),
      ),
      notice && h("p", { role: "status", style: { margin: 0 } }, notice),
    );
  }

  ctx.pages.register({
    id: "home",
    title: "Spheres Home",
    primary: true,
    placement: "dock",
    icon: poster,
    layout: "document",
    component: SpheresHome,
  });
}
