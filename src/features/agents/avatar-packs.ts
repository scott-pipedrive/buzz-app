import catalog from "./avatar-packs/catalog.json";
import { appName } from "../../shared/app-name";
import {
  spheresAvatarPack,
  spheresAvatars,
  spheresExpressionUrl,
  type SpheresAvatarExpression,
} from "./spheres-avatar-pack";

const posters = import.meta.glob<string>("./avatar-packs/*.png", {
  eager: true,
  query: "?url",
  import: "default",
});

export const avatarPacks = catalog.collections;
export const agentAvatars = catalog.assets.map((asset) => ({
  ...asset,
  preview: posters[`./avatar-packs/${asset.id}.png`],
}));

export type PackAvatar = {
  id: string;
  label: string;
  collectionId: string;
  url: string;
  preview: string | undefined;
};

export function agentAvatarChoices(): readonly PackAvatar[] {
  return appName() === "Spheres" ? spheresAvatars : agentAvatars;
}

export function agentAvatarCollections() {
  return appName() === "Spheres" ? [spheresAvatarPack] : avatarPacks;
}

const sources = (avatars: readonly PackAvatar[]) =>
  new Map(
    avatars.flatMap((avatar) => [
      [avatar.url, avatar] as const,
      [avatar.preview, avatar] as const,
    ]),
  );
const buzzSources = sources(agentAvatars);
const spheresSources = sources(spheresAvatars);
const legacySpheres = new Map(
  agentAvatars.map(({ id }) => {
    let hash = 0;
    for (const char of id)
      hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
    return [id, spheresAvatars[hash % spheresAvatars.length]];
  }),
);

/** Translate saved stock art for display without editing anyone's profile. */
export function findPackAvatar(src: string | undefined) {
  if (!src) return undefined;
  const still = src.split("#", 1)[0];
  const spheres = spheresSources.get(still);
  if (spheres) return spheres;
  const buzz = buzzSources.get(still);
  return buzz && appName() === "Spheres" ? legacySpheres.get(buzz.id) : buzz;
}

/** The bundled copy of pack art, which can be read back from a canvas: the
 * CDN sends no CORS header. */
export const bundledPoster = (src: string) => findPackAvatar(src)?.preview;

/** Conversation activity can change the stock artwork without editing a profile. */
export function expressiveAvatar(
  src: string | undefined,
  expression: SpheresAvatarExpression | undefined,
) {
  if (!expression || appName() !== "Spheres") return src;
  const avatar = findPackAvatar(src);
  return avatar?.collectionId === "spheres"
    ? spheresExpressionUrl(avatar.id, expression)
    : src;
}

/** Animations stream from the catalog's CDN; the bundled poster covers offline use. */
export function avatarAnimation(id: string) {
  const spheres = spheresAvatars.find((avatar) => avatar.id === id);
  if (spheres) return { webm: spheres.webm, hevc: spheres.hevc };
  const animations = catalog.assets.find(
    (asset) => asset.id === id,
  )?.animations;
  return { webm: animations?.webm.url, hevc: animations?.hevc.url };
}

export function randomAgentAvatar() {
  const choices = agentAvatarChoices();
  const avatar = choices[Math.floor(Math.random() * choices.length)];
  if (!avatar) throw new Error("Bundled avatar catalog is empty");
  return avatar;
}
