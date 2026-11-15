/** The display name for the current distribution. Protocol names stay independent. */
export function appName() {
  return typeof document !== "undefined" &&
    document.documentElement.hasAttribute("data-spheres")
    ? "Spheres"
    : "Buzz";
}

/** The separate installation that can be imported into this app. */
export function previousAppName(capitalized = false) {
  if (appName() === "Spheres")
    return capitalized ? "The previous app" : "the previous app";
  return capitalized ? "Old Buzz" : "old Buzz";
}

export function legacyAppName() {
  return appName() === "Spheres" ? "Previous app" : "Buzz (Legacy)";
}
