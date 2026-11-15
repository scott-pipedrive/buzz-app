import "../../shared/styles/globals.css";
import "../../app/spheres-theme.css";
import "@fontsource-variable/inter/wght.css";
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Button } from "../../shared/design-system/ui/Button";
import { useKeyboardFocusVisibility } from "../../shared/design-system/useKeyboardFocusVisibility";
import { SpheresField, SpheresWordmark } from "./SpheresArtwork";
import styles from "./IdentitySetup.module.css";

/** A local artwork replay that never mounts identity or workspace services. */
function SpheresWelcomePreview() {
  const [replay, setReplay] = useState(0);
  useKeyboardFocusVisibility();
  return (
    <main
      className={`${styles.landing} ${styles.welcome} light`}
      aria-labelledby="welcome-preview-title"
    >
      <SpheresField key={replay} />
      <div className={styles.titlebar} aria-hidden="true" />
      <div className={styles.content}>
        <div className={styles.brand}>
          <h1 id="welcome-preview-title" className={styles.wordmark}>
            <SpheresWordmark />
          </h1>
        </div>
        <div className={styles.actions}>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => setReplay((count) => count + 1)}
          >
            Replay animation
          </Button>
        </div>
      </div>
    </main>
  );
}

const container = document.getElementById("root");
if (container) createRoot(container).render(<SpheresWelcomePreview />);
