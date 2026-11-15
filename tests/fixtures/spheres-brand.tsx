// Visual study: production artwork and welcome styling, without account access.
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import {
  SpheresField,
  SpheresWordmark,
} from "../../src/features/identity/SpheresArtwork";
import { Button } from "../../src/shared/design-system/ui/Button";
import styles from "../../src/features/identity/IdentitySetup.module.css";
import "../../src/shared/styles/globals.css";
import "@fontsource-variable/inter/wght.css";
import "./spheres-brand.css";

const conceptAssets = import.meta.glob("./spheres-concepts/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;
const conceptUrl = (file: string | undefined) =>
  conceptAssets[`./spheres-concepts/${file}`];
const directions = [
  [
    "06-cmyk-spheres.png",
    "Colour in common",
    "Cyan. Magenta. Yellow. Shared possibilities.",
    "Latest direction",
  ],
  [
    "04-shared-space.png",
    "Shared space",
    "People and agents. Common ground.",
    "Venn",
  ],
  [
    "01-ink-circles-refined.png",
    "Ink circles",
    "Expressive, warm, and human.",
    "Ink",
  ],
  [
    "02-opal-glass-refined.png",
    "Opal",
    "Quiet, tactile, softly luminous.",
    "Glass",
  ],
  [
    "03-paper-sphere.png",
    "Paper sphere",
    "A sculptural world of possibilities.",
    "Sculpture",
  ],
];
function Preview() {
  const params = new URLSearchParams(location.search);
  const [view, setView] = useState(params.get("view") || "welcome");
  const [dark, setDark] = useState(params.has("dark"));
  const [intro, setIntro] = useState(false);
  const [take, setTake] = useState(0);
  const [message, setMessage] = useState("");
  useEffect(() => {
    document.documentElement.dataset.colorMode = dark ? "dark" : "light";
  }, [dark]);
  const introRun = intro ? take : 0;
  useEffect(() => {
    if (!introRun) return;
    const finish = () => setIntro(false);
    const timer = setTimeout(finish, 8400);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) finish();
    reduced.addEventListener("change", finish, { once: true });
    const skip = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
    };
    window.addEventListener("keydown", skip);
    return () => {
      clearTimeout(timer);
      reduced.removeEventListener("change", finish);
      window.removeEventListener("keydown", skip);
    };
  }, [introRun]);
  const select = (next: string) => {
    setView(next);
    setIntro(false);
    setMessage("");
  };
  const replay = () => {
    setView("welcome");
    setTake(take + 1);
    setIntro(true);
    setMessage("");
  };
  const illustration = () =>
    setMessage(
      "This is the visual preview. Sign-in continues in your Mac app.",
    );
  return (
    <div className={`spheres-preview ${dark ? "night" : "day"}`}>
      <nav className="preview-tools" aria-label="Design preview">
        <span className="preview-label">
          Spheres <span>Design study</span>
        </span>
        <div>
          <button
            type="button"
            aria-pressed={view === "icons"}
            onClick={() => select("icons")}
          >
            Icons
          </button>
          <button
            type="button"
            aria-pressed={view === "welcome"}
            onClick={() => select("welcome")}
          >
            Welcome
          </button>
          <button
            type="button"
            aria-pressed={view === "bubbles"}
            onClick={() => select("bubbles")}
          >
            Motion
          </button>
          <button
            type="button"
            aria-pressed={view === "loading"}
            onClick={() => select("loading")}
          >
            Loading
          </button>
          <button type="button" onClick={replay}>
            Replay intro
          </button>
          <button
            type="button"
            aria-pressed={dark}
            onClick={() => setDark(!dark)}
          >
            {dark ? "Light" : "Dark"}
          </button>
        </div>
      </nav>
      {view === "icons" ? (
        <section className="icon-study">
          <p className="eyebrow">An identity for shared possibility</p>
          <h1>Where our worlds overlap.</h1>
          <p className="study-description">
            People and agents creating something together.
          </p>
          <div className="icon-grid">
            {directions.map(([file, title, description, label]) => (
              <article key={file}>
                <div className="icon-stage">
                  <img src={conceptUrl(file)} alt={`${title} Mac app icon`} />
                </div>
                <span className="direction-label">{label}</span>
                <h2>{title}</h2>
                <p>{description}</p>
                <div className="dock-sizes">
                  <img
                    src={conceptUrl(file)}
                    width="48"
                    height="48"
                    alt="48 pixel preview"
                  />
                  <img
                    src={conceptUrl(file)}
                    width="32"
                    height="32"
                    alt="32 pixel preview"
                  />
                  <img
                    src={conceptUrl(file)}
                    width="16"
                    height="16"
                    alt="16 pixel preview"
                  />
                </div>
              </article>
            ))}
          </div>
          <button type="button" className="study-replay" onClick={replay}>
            See the Spheres opening sequence <span aria-hidden="true">↗</span>
          </button>
        </section>
      ) : view === "loading" ? (
        <section className="loading-study" aria-label="Spheres loading preview">
          <picture>
            <source
              media="(prefers-reduced-motion: reduce)"
              srcSet="/spheres-mark.svg"
            />
            <img
              src="/spheres-loading-mark.svg"
              alt="Opening Spheres"
              width="100"
              height="100"
            />
          </picture>
          <p>Finding common ground.</p>
        </section>
      ) : (
        <>
          <div className="desktop-study" aria-hidden="true">
            <span>Desktop reveal preview</span>
            <div className="desktop-orbit" />
          </div>
          {view === "bubbles" ? (
            <section
              className="bubble-study"
              aria-label="Floating circles preview"
            >
              <SpheresField />
              <div className="bubble-caption">
                <h1>Room to connect.</h1>
                <p>Move your pointer. Watch the spheres find each other.</p>
              </div>
            </section>
          ) : (
            <main
              key={take}
              className={`${styles.landing} ${styles.welcome} light`}
              data-color-mode="light"
              data-intro={intro ? "running" : "done"}
              aria-labelledby="welcome-title"
            >
              <SpheresField />
              <header className={styles.titlebar} />
              <div className={styles.content}>
                <div className={styles.brand}>
                  <h1 id="welcome-title" className={styles.wordmark}>
                    <SpheresWordmark />
                  </h1>
                </div>
                <div className={styles.actions} inert={intro}>
                  <Button variant="prominent" size="lg" onClick={illustration}>
                    Create account
                  </Button>
                  <Button
                    variant="glass-clear"
                    size="lg"
                    onClick={illustration}
                  >
                    Sign in
                  </Button>
                  <Button variant="ghost" size="lg" onClick={illustration}>
                    Other options
                  </Button>
                </div>
              </div>
            </main>
          )}
          {message && (
            <p className="preview-notice" role="status">
              {message}
            </p>
          )}
        </>
      )}
    </div>
  );
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<Preview />);
