type Point = { x: number; y: number };
type PointerInput = { pointer: Point | null; size: number; dt: number };
type PaintMerge = (
  seconds: number,
  still?: "merged" | null,
  input?: PointerInput,
) => void;
export type CreateSpheresMerge = (
  canvas: HTMLCanvasElement,
  options?: { inks?: readonly number[]; beginMerged?: boolean; roam?: boolean },
) => PaintMerge;

type Scene = Point & {
  tile: HTMLCanvasElement;
  paint: PaintMerge;
  phase: number;
  delay: number;
  size: number;
  opacity: number;
  vx: number;
  vy: number;
};

const FIELD = [
  { at: [0.19, 0.19], inks: [0, 1, 2] },
  { at: [0.7, 0.14], inks: [0, 1] },
  { at: [0.1, 0.51], inks: [1, 2] },
  { at: [0.86, 0.54], inks: [0, 1, 2] },
  { at: [0.25, 0.87], inks: [0, 1, 2] },
  { at: [0.74, 0.83], inks: [0, 2] },
  { at: [0.46, 0.11], inks: [0, 1, 2] },
  { at: [0.5, 0.92], inks: [0, 1, 2] },
  { at: [0.04, 0.28], inks: [0, 2] },
  { at: [0.95, 0.27], inks: [0, 1, 2] },
  { at: [0.12, 0.72], inks: [0, 1] },
  { at: [0.89, 0.74], inks: [0, 1, 2] },
] as const;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));
const smooth = (value: number) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

export function mountBraidHandoff(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  createMerge: CreateSpheresMerge,
) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const ctx = context;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");

  const createScene = (index: number, inks?: readonly number[]): Scene => {
    const tile = document.createElement("canvas");
    return {
      x: 0,
      y: 0,
      tile,
      paint: createMerge(tile, {
        ...(inks ? { inks } : {}),
        beginMerged: !inks,
        roam: true,
      }),
      phase: index * 1.73,
      delay: inks ? 4 + index * 1.71 : 0,
      size: 0,
      opacity: inks ? 0.46 + (index % 5) * 0.032 : 1,
      vx: (index % 2 ? 1 : -1) * (9 + (index % 5) * 2.7),
      vy: (index % 3 ? -1 : 1) * (3.8 + (index % 4) * 1.2),
    };
  };
  const hero = createScene(0);
  const field = FIELD.map(({ inks }, index) => createScene(index, inks));
  const scenes = [hero, ...field];
  let pointer: Point | null = null;
  let width = 0;
  let height = 0;
  let restingHero: Point = { x: 0, y: 0 };
  let elapsed = 0;
  let previous: number | undefined;
  let frame = 0;

  function step(dt: number) {
    elapsed += dt;
    for (const scene of field) {
      const margin = scene.size / 2;
      scene.x += (scene.vx + 5 * Math.cos(elapsed * 0.31 + scene.phase)) * dt;
      scene.y += (scene.vy + 13 * Math.sin(elapsed * 0.43 + scene.phase)) * dt;
      if (scene.x < -margin) scene.x = width + margin;
      else if (scene.x > width + margin) scene.x = -margin;
      if (scene.y < -margin) scene.y = height + margin;
      else if (scene.y > height + margin) scene.y = -margin;
    }
  }

  function positionHero(still: boolean) {
    const travel = still ? 0 : smooth((elapsed - 1.1) / 4);
    hero.x =
      restingHero.x +
      Math.min(128, width * 0.2) * travel * Math.sin(elapsed * 0.38);
    hero.y =
      restingHero.y +
      Math.min(34, height * 0.081) * travel * Math.sin(elapsed * 0.49);
  }

  function paintScene(
    scene: Scene,
    opacity: number,
    still: boolean,
    dt: number,
  ) {
    const { size } = scene;
    scene.paint(elapsed + scene.delay, still ? "merged" : null, {
      pointer: pointer
        ? {
            x: pointer.x - scene.x + size / 2,
            y: pointer.y - scene.y + size / 2,
          }
        : null,
      size,
      dt,
    });
    ctx.globalAlpha = opacity;
    ctx.drawImage(
      scene.tile,
      scene.x - size / 2,
      scene.y - size / 2,
      size,
      size,
    );
  }

  const draw = (dt = 0) => {
    ctx.clearRect(0, 0, width, height);
    const still = reduced.matches;
    const reveal = still ? 0 : smooth((elapsed - 0.24) / 2.4);
    if (reveal > 0) {
      const visible = width < 690 || height < 480 ? field.slice(0, 7) : field;
      for (const scene of visible)
        paintScene(scene, scene.opacity * reveal, false, dt);
    }
    positionHero(still);
    paintScene(hero, 1, still, dt);
  };

  const tick = (now: number) => {
    const dt =
      previous === undefined ? 0 : Math.min(0.05, (now - previous) / 1000);
    previous = now;
    if (dt > 0) step(dt);
    draw(dt);
    frame = requestAnimationFrame(tick);
  };
  const play = () => {
    cancelAnimationFrame(frame);
    previous = undefined;
    if (
      canvas.clientWidth &&
      canvas.clientHeight &&
      !reduced.matches &&
      !document.hidden
    )
      frame = requestAnimationFrame(tick);
  };
  const resize = () => {
    const nextWidth = canvas.clientWidth;
    const nextHeight = canvas.clientHeight;
    if (!nextWidth || !nextHeight) {
      cancelAnimationFrame(frame);
      return;
    }
    for (const [index, scene] of field.entries()) {
      const [x, y] = FIELD[index]!.at;
      scene.x = width ? (scene.x * nextWidth) / width : x * nextWidth;
      scene.y = height ? (scene.y * nextHeight) / height : y * nextHeight;
    }
    width = nextWidth;
    height = nextHeight;
    const shortSide = Math.min(width, height);
    hero.size = clamp(shortSide * 0.29, 116, 152) * 2;
    const portrait = clamp(shortSide * 0.16, 59, 106);
    for (const [index, scene] of field.entries()) {
      scene.size = portrait * (0.84 + (index % 5) * 0.065) * 2;
    }
    const dpr = Math.min(devicePixelRatio, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const { tile, size } of scenes) {
      const pixels = Math.round(size * dpr);
      if (tile.width !== pixels || tile.height !== pixels)
        tile.width = tile.height = pixels;
    }
    const title = host.querySelector("h1")?.getBoundingClientRect();
    const bounds = canvas.getBoundingClientRect();
    restingHero = {
      x: title ? title.left + title.width / 2 - bounds.left : width / 2,
      y: title
        ? Math.max(
            hero.size * 0.185,
            title.top - bounds.top - hero.size * 0.245,
          )
        : height * 0.3,
    };
    draw();
    play();
  };
  const motionChanged = () => {
    pointer = null;
    draw();
    play();
  };
  const move = (event: PointerEvent) => {
    if (event.pointerType === "touch" || reduced.matches) return;
    const bounds = canvas.getBoundingClientRect();
    pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };
  const leave = () => {
    pointer = null;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  host.addEventListener("pointermove", move);
  host.addEventListener("pointerleave", leave);
  reduced.addEventListener("change", motionChanged);
  document.addEventListener("visibilitychange", play);
  window.addEventListener("blur", leave);
  resize();
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    host.removeEventListener("pointermove", move);
    host.removeEventListener("pointerleave", leave);
    reduced.removeEventListener("change", motionChanged);
    document.removeEventListener("visibilitychange", play);
    window.removeEventListener("blur", leave);
  };
}
