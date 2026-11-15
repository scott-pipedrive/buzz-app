import type { ReactNode } from "react";
import { AvatarArtworkContext } from "../../shared/design-system/ui/Avatar";
import { findPackAvatar } from "./avatar-packs";

function renderArtwork(src: string) {
  const avatar = findPackAvatar(src);
  return avatar ? (
    <img
      data-loaded="true"
      src={avatar.preview}
      alt=""
      style={{ width: "100%", height: "100%", objectFit: "contain" }}
    />
  ) : null;
}

/** Shared avatars stay static; the Agents page opts into animated artwork directly. */
export function AgentAvatarArtworkProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AvatarArtworkContext value={renderArtwork}>
      {children}
    </AvatarArtworkContext>
  );
}
