import { useEffect, useRef, useSyncExternalStore } from "react";
import { launchVisible, subscribeLaunch } from "../../app/launch";
import { mountBraidHandoff } from "./braid-handoff";
import styles from "./SpheresArtwork.module.css";

export function SpheresWordmark() {
  return <span className={styles.wordmark}>Spheres</span>;
}

/** Decorative artwork behind the existing welcome actions. */
export function SpheresField({ waiting = false }: { waiting?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const launching = useSyncExternalStore(subscribeLaunch, launchVisible);
  useEffect(() => {
    const area = canvas.current;
    const host = area?.parentElement?.parentElement;
    if (
      !area ||
      !host ||
      waiting ||
      launching ||
      typeof ResizeObserver !== "function"
    )
      return;
    return mountBraidHandoff(area, host);
  }, [waiting, launching]);
  return (
    <div className={styles.field} aria-hidden="true">
      <canvas ref={canvas} data-spheres-field="" />
    </div>
  );
}
