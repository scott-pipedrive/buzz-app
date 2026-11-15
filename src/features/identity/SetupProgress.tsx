import styles from "./IdentitySetup.module.css";

export function SetupProgress({ label }: { label: string }) {
  return (
    <div className={styles.progress}>
      <picture>
        <source
          media="(prefers-reduced-motion: reduce)"
          srcSet="/spheres-mark.svg"
        />
        <img
          className={styles.loadingSpheres}
          src="/spheres-loading-mark.svg"
          alt=""
          width="80"
          height="80"
        />
      </picture>
      <h1
        id="welcome-title"
        tabIndex={-1}
        className="text-heading text-standard"
      >
        Getting ready
      </h1>
      <span role="status" className="sr-only">
        {label}
      </span>
    </div>
  );
}
