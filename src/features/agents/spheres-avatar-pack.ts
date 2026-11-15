const path = "/spheres/avatars/v1";
const publicPath = "https://hellospheres.com/spheres-preview/avatars/v1";

/** Still frames of the Spheres ink avatar study, including in reduced motion. */
export type SpheresAvatarExpression =
  | "listening"
  | "working"
  | "waiting"
  | "done"
  | "attention";
const designs = [
  ["cyan-magenta", "Cyan + Magenta"],
  ["cyan-yellow", "Cyan + Yellow"],
  ["magenta-yellow", "Magenta + Yellow"],
  ["cmy", "Three circles"],
  ["cyan", "Cyan"],
  ["magenta", "Magenta"],
  ["yellow", "Yellow"],
] as const;

export const spheresAvatars = designs.map(([name, label]) => ({
  id: `spheres-${name}`,
  label,
  collectionId: "spheres",
  url: `${publicPath}/${name}.png`,
  preview: `${path}/${name}.png`,
  webm: `${path}/${name}.webm`,
  hevc: `${path}/${name}.mov`,
}));

export function spheresExpressionUrl(
  id: string,
  expression: SpheresAvatarExpression,
) {
  return `${path}/expressions/${id.slice("spheres-".length)}-${expression}.webp`;
}

export const spheresAvatarPack = {
  id: "spheres",
  label: "Spheres",
  coverAvatarId: "spheres-cyan-magenta",
  avatarIds: spheresAvatars.map(({ id }) => id),
};
