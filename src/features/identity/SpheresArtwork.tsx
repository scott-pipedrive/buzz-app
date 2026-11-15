import { useEffect, useRef, useSyncExternalStore } from "react";
import { launchVisible, subscribeLaunch } from "../../app/launch";
import { mountBraidHandoff, type CreateSpheresMerge } from "./braid-handoff";
import styles from "./SpheresArtwork.module.css";

const avatarModule = "/spheres-avatar-loader.js";

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
    let disposed = false;
    let unmount: (() => void) | undefined;
    void import(/* @vite-ignore */ avatarModule)
      .then(
        ({
          createSpheresMerge,
        }: {
          createSpheresMerge: CreateSpheresMerge;
        }) => {
          if (!disposed)
            unmount = mountBraidHandoff(area, host, createSpheresMerge);
        },
      )
      .catch(() => {
        // Artwork is decorative. Keep the welcome actions available.
      });
    return () => {
      disposed = true;
      unmount?.();
    };
  }, [waiting, launching]);
  return (
    <div className={styles.field} aria-hidden="true">
      <canvas ref={canvas} data-spheres-field="" />
    </div>
  );
}
