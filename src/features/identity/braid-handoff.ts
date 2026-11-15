const TAU = Math.PI * 2;
const RADIUS = 35;
const DIAMETER = RADIUS * 2;
const COLOURS = [0, 1, 2] as const;
type Colour = (typeof COLOURS)[number];
const LAUNCH_X = [-28, 28, 2] as const;
const LAUNCH_Y = [-8, 3, 36] as const;
const ICON_OFFSETS = [
  [-0.53, -0.45],
  [0.59, -0.22],
  [-0.06, 0.67],
] as const;
type Point = { x: number; y: number };
type Body = Point & {
  col: Colour;
  phase: number;
  band: number;
  base: number;
  vx: number;
  vy: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));
const ease = (value: number) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};
const random = (index: number, channel: number) => {
  const value = Math.sin((index + 1) * 127.1 + channel * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

function makeInks(ctx: CanvasRenderingContext2D) {
  const size = 192;
  const grain = new Float32Array(size * size);
  const layers = [
    [2, 7],
    [4, 9],
    [8, 5],
  ] as const;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const pixel = y * size + x;
      let tone = (random(pixel, 43) - 0.5) * 7;
      for (const [scale, strength] of layers) {
        const cells = size / scale;
        const col = Math.floor(x / scale);
        const row = Math.floor(y / scale);
        const u = ease((x % scale) / scale);
        const v = ease((y % scale) / scale);
        const right = (col + 1) % cells;
        const top = row * cells;
        const bottom = ((row + 1) % cells) * cells;
        const a =
          random(top + col, scale) * (1 - u) + random(top + right, scale) * u;
        const b =
          random(bottom + col, scale) * (1 - u) +
          random(bottom + right, scale) * u;
        tone += (a * (1 - v) + b * v - 0.5) * strength;
      }
      grain[pixel] = tone;
    }
  }
  type Channels = readonly [number, number, number];
  // Each pattern has the same origin, so circles travel across stationary grain.
  const ink = (colour: Channels, variation: Channels) => {
    const solid = `rgb(${colour.join(",")})`;
    const tile = document.createElement("canvas");
    tile.width = tile.height = size;
    const tileCtx = tile.getContext("2d");
    if (!tileCtx) return solid;
    const pixels = tileCtx.createImageData(size, size);
    for (const [i, tone] of grain.entries()) {
      const offset = i * 4;
      pixels.data[offset] = colour[0] + tone * variation[0];
      pixels.data[offset + 1] = colour[1] + tone * variation[1];
      pixels.data[offset + 2] = colour[2] + tone * variation[2];
      pixels.data[offset + 3] = 255;
    }
    tileCtx.putImageData(pixels, 0, 0);
    return ctx.createPattern(tile, "repeat") ?? solid;
  };
  const cyan = [0, 0.95, 0.8] as const;
  const magenta = [0.45, 1.05, 0.85] as const;
  const yellow = [0.2, 0.49, 0] as const;
  return {
    single: [
      ink([0, 162, 207], cyan),
      ink([239, 14, 115], magenta),
      ink([252, 204, 0], yellow),
    ] as const,
    doubled: [
      ink([0, 144, 185], cyan),
      ink([216, 10, 96], magenta),
      ink([241, 183, 0], yellow),
    ] as const,
    mixed: [
      [[0, 1], ink([0, 26, 138], [0, 0.7, 1.05])],
      [[0, 2], ink([6, 129, 29], [0.8, 0.9, 0.75])],
      [[1, 2], ink([228, 11, 5], [1, 0.65, 0.45])],
      [[0, 1, 2], ink([12, 5, 18], [0.5, 0.3, 0.5])],
    ] as const,
  };
}

function paintInks(
  ctx: CanvasRenderingContext2D,
  inks: ReturnType<typeof makeInks>,
  bodies: Body[],
  opacity: number,
) {
  const plates = [new Path2D(), new Path2D(), new Path2D()] as const;
  type Circle = { body: Body; path: Path2D };
  const groups: [Circle[], Circle[], Circle[]] = [[], [], []];
  for (const body of bodies) {
    const { x, y, col } = body;
    const path = new Path2D();
    path.arc(x, y, RADIUS, 0, TAU);
    plates[col].addPath(path);
    groups[col].push({ body, path });
  }
  ctx.globalAlpha = opacity;
  for (const col of COLOURS) {
    const plate = plates[col];
    ctx.fillStyle = inks.single[col];
    ctx.fill(plate);
    ctx.fillStyle = inks.doubled[col];
    const group = groups[col];
    for (const circle of group) {
      for (const other of group) {
        if (other === circle) break;
        const dx = circle.body.x - other.body.x;
        const dy = circle.body.y - other.body.y;
        if (dx * dx + dy * dy >= DIAMETER * DIAMETER) continue;
        ctx.save();
        ctx.clip(circle.path);
        ctx.fill(other.path);
        ctx.restore();
      }
    }
  }
  for (const [colours, ink] of inks.mixed) {
    ctx.save();
    ctx.fillStyle = ink;
    for (const col of colours) ctx.clip(plates[col]);
    ctx.fillRect(0, 0, ctx.canvas.clientWidth, ctx.canvas.clientHeight);
    ctx.restore();
  }
}

function mean(points: Point[]): Point {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

export function mountBraidHandoff(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const inks = makeInks(ctx);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let width = 0;
  let height = 0;
  let elapsed = 0;
  let previous = 0;
  let frame = 0;
  let bodies: Body[] = [];
  let trio: [Body, Body, Body];
  let field: Body[] = [];
  let duet: { pair: [Body, Body]; age: number } | undefined;
  let nextDuet = 0;
  let encounter:
    | (Point & {
        age: number;
        travel: number;
        joined: boolean;
        vx: number;
        vy: number;
        first: number;
      })
    | undefined;
  let nextEncounter = 12;
  const sweep = { x: 0, y: 0, vx: 0, vy: 0, last: 0 };

  function seed() {
    const title = host.querySelector("h1")?.getBoundingClientRect();
    const bounds = canvas.getBoundingClientRect();
    const x = title ? title.left + title.width / 2 - bounds.left : width / 2;
    const y = title
      ? Math.max(RADIUS * 1.6, title.top - bounds.top - 70)
      : height * 0.3;
    elapsed = 0;
    nextDuet = 0;
    nextEncounter = 12;
    duet = undefined;
    encounter = undefined;
    const createBody = (i: number, col: Colour): Body => ({
      x: random(i, 3) * width,
      y: random(i, 4) * height,
      col,
      phase: random(i, 5) * TAU,
      band: random(i, 2),
      base: 1.8 + random(i, 6) * 16,
      vx: 0,
      vy: 0,
    });
    trio = [createBody(0, 0), createBody(1, 1), createBody(2, 2)];
    for (const col of COLOURS) {
      trio[col].x = x + ICON_OFFSETS[col][0] * RADIUS;
      trio[col].y = y + ICON_OFFSETS[col][1] * RADIUS;
    }
    field = Array.from({ length: 10 }, (_, i) =>
      COLOURS.map((col) => createBody((i + 1) * 3 + col, col)),
    ).flat();
    bodies = [...trio, ...field];
  }

  function chooseDuet() {
    let best = Infinity;
    for (const a of field) {
      if (a.col !== 1) continue;
      for (const b of field) {
        if (b.col !== 2) continue;
        const x = (a.x + b.x) / 2;
        const y = (a.y + b.y) / 2;
        if (
          x < RADIUS ||
          x > width - RADIUS ||
          y < RADIUS ||
          y > height - RADIUS
        )
          continue;
        if (
          Math.abs(x - width / 2) < width * 0.2 &&
          Math.abs(y - height / 2) < height * 0.23
        )
          continue;
        const gap = Math.hypot(a.x - b.x, a.y - b.y);
        const score = Math.abs(gap - RADIUS * 1.45);
        if (gap > RADIUS * 0.8 && gap < RADIUS * 2.7 && score < best) {
          best = score;
          duet = { pair: [a, b], age: 0 };
        }
      }
    }
    nextDuet = elapsed + (duet ? 9 : 1.2);
  }

  function updateEncounter(dt: number) {
    if (!encounter && elapsed < nextEncounter) return;
    const center = mean(trio);
    const visible = trio.every(
      ({ x, y }) =>
        x > RADIUS && x < width - RADIUS && y > RADIUS && y < height - RADIUS,
    );
    if (!encounter) {
      const spread = Math.max(
        ...trio.map(({ x, y }) => Math.hypot(x - center.x, y - center.y)),
      );
      if (!visible || spread >= Math.min(width * 0.36, height * 0.54)) return;
      const velocity = mean(trio.map(({ vx, vy }) => ({ x: vx, y: vy })));
      const speed = Math.hypot(velocity.x, velocity.y);
      const heading =
        speed > 2 ? Math.atan2(velocity.y, velocity.x) : trio[0].phase;
      encounter = {
        ...center,
        age: 0,
        travel: 0,
        joined: false,
        vx: Math.cos(heading) * clamp(speed, 10, 18),
        vy: Math.sin(heading) * clamp(speed, 10, 18),
        first: Math.floor(elapsed) % 3,
      };
    }
    encounter.age += dt;
    if (encounter.joined) {
      encounter.travel += dt;
      encounter.x += encounter.vx * dt;
      encounter.y += encounter.vy * dt;
    } else {
      encounter.x = center.x;
      encounter.y = center.y;
      encounter.joined = trio.every((body) => {
        const other = trio[body.col === 2 ? 0 : body.col === 1 ? 2 : 1];
        return Math.hypot(body.x - other.x, body.y - other.y) < RADIUS * 1.65;
      });
    }
    if (
      encounter.travel >= 6.1 ||
      (!encounter.joined && (!visible || encounter.age > 13))
    ) {
      encounter = undefined;
      nextEncounter = elapsed + 15;
    }
  }

  function step(dt: number) {
    elapsed += dt;
    sweep.vx *= Math.exp(-dt * 2.5);
    sweep.vy *= Math.exp(-dt * 2.5);
    if (!duet && elapsed >= nextDuet) chooseDuet();
    if (duet) {
      duet.age += dt;
      if (duet.age >= 5.6) duet = undefined;
    }
    updateEncounter(dt);
    const rx = Math.min(width * 0.27, 260);
    const ry = Math.min(height * 0.3, 155);
    for (const [i, body] of bodies.entries()) {
      const x = (body.x - width / 2) / rx;
      const y = (body.y - height / 2) / ry;
      const space = Math.exp(-1.9 * x * x - 0.65 * y * y);
      const driftY = Math.sin(elapsed * 0.42 + body.phase) * body.base * 1.3;
      let vx = body.base * (body.col === 0 ? 1 : -0.82);
      let vy = driftY + (body.band < 0.5 ? -1 : 1) * space * 19;
      body.y += Math.sin(elapsed * 0.14 + body.phase) * 7.8 * dt;
      if (duet?.pair.includes(body)) {
        const other = duet.pair[0] === body ? duet.pair[1] : duet.pair[0];
        const dx = other.x - body.x;
        const dy = other.y - body.y;
        const gap = Math.hypot(dx, dy);
        if (gap > 1 && gap < RADIUS * 4) {
          const blend = Math.sin((Math.PI * duet.age) / 5.6) ** 2;
          const pull = (gap - RADIUS * 1.35) * 0.75 * blend;
          vx += (dx / gap) * pull;
          vy += (dy / gap) * pull - blend * driftY * 0.64;
        }
      }
      const cursorDistance = Math.hypot(body.x - sweep.x, body.y - sweep.y);
      const influence =
        Math.max(0, 1 - cursorDistance / 164) ** 2 * (1 - space * 0.88);
      vx += sweep.vx * influence;
      vy += sweep.vy * influence;
      if (i < 3) {
        const release = ease((elapsed - 0.4) / 2);
        const launch = release * Math.max(0, 1 - elapsed / 9);
        vx = (vx * (1 - launch) + LAUNCH_X[body.col] * launch) * release;
        vy = (vy * (1 - launch) + LAUNCH_Y[body.col] * launch) * release;
        if (encounter) {
          const [offsetX, offsetY] = ICON_OFFSETS[body.col];
          const angle = Math.atan2(offsetY, offsetX);
          const dx = encounter.x + offsetX * RADIUS - body.x;
          const dy = encounter.y + offsetY * RADIUS - body.y;
          const order = (i - encounter.first + 3) % 3;
          const departure = encounter.joined
            ? ease((encounter.travel - 1.55 - order * 1.2) / 0.95)
            : 0;
          const weight = ease(encounter.age / 1.6) * (1 - departure);
          const peel =
            departure *
            (1 - ease((encounter.travel - 2.5 - order * 1.2) / 1.1)) *
            34;
          vx +=
            (encounter.vx + clamp(dx * 0.85, -43, 43) - vx) * weight +
            Math.cos(angle) * peel;
          vy +=
            (encounter.vy + clamp(dy * 0.85, -43, 43) - vy) * weight +
            Math.sin(angle) * peel;
        }
        const blend = 1 - Math.exp(-dt * 2.1);
        body.vx += (vx - body.vx) * blend;
        body.vy += (vy - body.vy) * blend;
        vx = body.vx;
        vy = body.vy;
      }
      body.x += vx * dt;
      body.y += vy * dt;
      const margin = RADIUS + 28 + body.band * 84;
      if (body.x < -margin) body.x = width + margin;
      else if (body.x > width + margin) body.x = -margin;
      if (body.y < -margin) body.y = height + margin;
      else if (body.y > height + margin) body.y = -margin;
    }
  }

  const draw = () => {
    ctx.clearRect(0, 0, width, height);
    const progress = reduced.matches ? 0 : ease((elapsed - 0.55) / 6);
    if (progress > 0) paintInks(ctx, inks, bodies, progress);
    if (progress < 1)
      paintInks(ctx, inks, trio, 1 - ease((progress - 0.65) / 0.35));
  };
  const tick = (now: number) => {
    if (previous) step(Math.min(0.035, (now - previous) / 1000));
    previous = now;
    draw();
    frame = requestAnimationFrame(tick);
  };
  const play = () => {
    cancelAnimationFrame(frame);
    previous = 0;
    if (width && height && !reduced.matches && !document.hidden)
      frame = requestAnimationFrame(tick);
  };
  const resize = () => {
    const nextWidth = canvas.clientWidth;
    const nextHeight = canvas.clientHeight;
    if (!nextWidth || !nextHeight) return;
    const scale = Math.min(devicePixelRatio, 2);
    const canRetain = width && height && elapsed >= 0.4 && !reduced.matches;
    if (canRetain) {
      for (const body of bodies) {
        body.x *= nextWidth / width;
        body.y *= nextHeight / height;
      }
      if (encounter) {
        encounter.x *= nextWidth / width;
        encounter.y *= nextHeight / height;
      }
    }
    width = nextWidth;
    height = nextHeight;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    if (!canRetain) seed();
    draw();
    play();
  };
  const motionChanged = () => {
    if (width && height) {
      seed();
      draw();
    }
    play();
  };
  const move = (event: PointerEvent) => {
    if (event.pointerType === "touch" || reduced.matches) return;
    const now = performance.now();
    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (sweep.last && now - sweep.last < 200) {
      const dt = Math.max(16, now - sweep.last) / 1000;
      sweep.vx = clamp(((x - sweep.x) / dt) * 0.1, -47, 47);
      sweep.vy = clamp(((y - sweep.y) / dt) * 0.1, -47, 47);
    }
    sweep.x = x;
    sweep.y = y;
    sweep.last = now;
  };
  const leave = () => {
    sweep.last = 0;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  host.addEventListener("pointermove", move);
  host.addEventListener("pointerleave", leave);
  reduced.addEventListener("change", motionChanged);
  document.addEventListener("visibilitychange", play);
  resize();
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    host.removeEventListener("pointermove", move);
    host.removeEventListener("pointerleave", leave);
    reduced.removeEventListener("change", motionChanged);
    document.removeEventListener("visibilitychange", play);
  };
}
