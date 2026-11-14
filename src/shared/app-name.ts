/** The display name for the current distribution. Protocol names stay independent. */
export function appName() {
  return typeof document !== "undefined" &&
    document.documentElement.hasAttribute("data-spheres")
    ? "Spheres"
    : "Buzz";
}
