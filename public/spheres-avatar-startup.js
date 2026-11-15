import { mountSpheresAvatar } from "./spheres-avatar-loader.js";

for (const host of document.querySelectorAll("[data-spheres-avatar-auto]")) {
  if (
    !host.closest("#buzz-launch") ||
    !document.documentElement.hasAttribute("data-welcome-intro")
  ) {
    mountSpheresAvatar(host);
  }
}
