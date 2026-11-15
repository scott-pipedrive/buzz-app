// Canvas renderer and Merge choreography from the Spheres-agent-avatars preview.
/* Open Bot Avatar, commit 921907e.
MIT License

Copyright (c) 2026 Dominik Scholz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
//#region work/live-avatar/reference-merge-entry.js
function shapeEyes(expression, eye, time, reduced) {
	const right = eye.key === "eye-1";
	return expression?.eyes?.({
		right,
		time: reduced ? 0 : time
	}) ?? {};
}
const mergeScale = .68;
const pairPaths = [{
	home: [-23.6, -12],
	joint: [-4.8, -2.4],
	arc: 3,
	period: 6.9,
	phase: .3
}, {
	home: [23.6, 12],
	joint: [4.8, 2.4],
	arc: -4,
	period: 5.2,
	phase: 1.9
}];
const trioPaths = [
	{
		home: [-23.8, -17],
		joint: [-7, -5],
		stack: [-2.4, -1.9],
		arc: 3,
		period: 7.4,
		phase: .7
	},
	{
		home: [23.8, -17],
		joint: [7, -4],
		stack: [2.5, -1.05],
		arc: -4,
		period: 5.6,
		phase: 2.5
	},
	{
		home: [0, 24.6],
		joint: [-.6, 7],
		stack: [-.1, 2.95],
		arc: 4.5,
		period: 6.2,
		phase: 4.1
	}
];
function easeBetween(value, start, end) {
	const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
	return t * t * (3 - 2 * t);
}
function blink(time, start, depth = .88) {
	return depth * easeBetween(time, start, start + .09) * (1 - easeBetween(time, start + .09, start + .24));
}
function relativeBlink(time, period, phase) {
	return blink((time + phase) % period, period - .34);
}
function soloOrbit(time, home, period, phase) {
	const angle = Math.atan2(home[1], home[0]) + .37 * time + .17 * Math.sin(time * .58 + phase);
	const radius = Math.min(27, Math.hypot(...home)) - .9 + 1.45 * Math.sin(time * .67 + phase);
	const aroundX = radius * Math.cos(angle);
	const aroundY = radius * Math.sin(angle);
	return [
		aroundX,
		.82 * aroundY + 1.35 * Math.sin(time * 2 * Math.PI / period + phase),
		.58 * aroundY + .3 * aroundX + 2.5 * Math.sin(time * .71 + phase)
	];
}
function createMergeMotion(paths, random = Math.random, { beginMerged = false, spatial = false, roam = false } = {}) {
	const between = (min, max) => min + (max - min) * random();
	const indices = paths.map((_, index) => index);
	const trio = paths.length === 3;
	const wander = roam ? paths.map(() => ({ phase: between(0, 2 * Math.PI), pace: between(.79, 1.25) })) : [];
	function planEncounter(start, previous) {
		const possibleGuests = indices.filter((index) => index !== previous?.guest);
		const guest = trio ? possibleGuests[Math.floor(random() * possibleGuests.length)] : void 0;
		const pair = indices.filter((index) => index !== guest);
		if (random() < .5) pair.reverse();
		const staggered = trio && (!previous || random() < .65);
		const arrival = start + between(1.6, 1.88);
		const pairArrival = arrival + between(.12, .25);
		const guestStart = staggered ? pairArrival + between(1.3, 2.05) : pairArrival - between(1.12, 1.48);
		const guestArrival = guestStart + between(1.48, 1.74);
		const firstPeel = (trio ? Math.max(pairArrival, guestArrival) : pairArrival) + between(1.4, 1.95);
		const pairPeel = trio ? firstPeel + between(1.08, 1.42) : firstPeel;
		const lastPeel = pairPeel + between(1.12, 1.4);
		const timing = [];
		timing[pair[0]] = {
			begin: start,
			arrive: arrival,
			leave: lastPeel,
			regain: pairPeel + .32,
			exit: between(1.07, 1.19)
		};
		timing[pair[1]] = {
			begin: start + .16,
			arrive: pairArrival,
			leave: pairPeel,
			regain: pairPeel,
			exit: between(1.03, 1.16)
		};
		if (trio) timing[guest] = {
			begin: guestStart,
			arrive: guestArrival,
			leave: firstPeel,
			regain: firstPeel,
			exit: between(1.02, 1.16)
		};
		return {
			start,
			pairArrival,
			pairPeel,
			guest,
			timing,
			direction: random() < .5 ? -1 : 1,
			rise: between(-3.8, 3.8),
			exitOrder: trio ? [guest, ...pair.toReversed()] : pair.toReversed(),
			next: lastPeel + timing[pair[0]].exit + (spatial || roam ? between(4.8, 7.4) : between(3.3, 6.6))
		};
	}
	let encounter = planEncounter(.2, null);
	const origin = beginMerged ? (encounter.timing[encounter.guest]?.arrive ?? encounter.pairArrival) + .42 : 0;
	return (seconds, still) => {
		const time = seconds + (still ? 0 : origin);
		while (!still && time >= encounter.next) encounter = planEncounter(encounter.next, encounter);
		const { start, pairArrival, pairPeel, guest, timing, direction, rise, exitOrder } = encounter;
		const guestTiming = timing[guest];
		const stackAmount = guestTiming ? easeBetween(time, guestTiming.arrive - .55, guestTiming.arrive + .35) * (1 - easeBetween(time, guestTiming.leave, guestTiming.leave + .72)) : 0;
		const initialTurn = easeBetween(time, start, pairArrival);
		const travel = easeBetween(time, pairArrival - .43, pairPeel + .66);
		const driftX = direction * (-3.4 * initialTurn + 9.8 * travel);
		const driftY = rise * travel + Math.sin(Math.PI * travel) * 2.5;
		const bank = direction * (.1 * Math.sin(Math.PI * travel) - .055 * travel);
		const sharedOpen = easeBetween(time, pairArrival - .34, pairArrival + .19);
		const sharedClose = easeBetween(time, pairPeel + .21, pairPeel + .64);
		const sharedOpacity = still === "merged" ? 1 : sharedOpen * (1 - sharedClose);
		const sharedBlink = guestTiming ? Math.max(blink(time, guestTiming.arrive + .04, .73), blink(time, guestTiming.leave + .32, .65)) : relativeBlink(time, 4.6, 1.2);
		const sharedEyes = still === "merged" ? {} : {
			height: (1 - .61 * (1 - sharedOpen)) * (1 - .74 * sharedClose) * (1 - sharedBlink),
			x: direction * (1.6 * Math.sin(Math.PI * travel) - .55 * travel),
			y: -.75 * Math.sin(Math.PI * travel)
		};
		const faceWeights = [];
		const individualOpacities = [];
		const individualEyes = [];
		const positions = paths.map(({ home, joint, stack = joint, arc, period, phase }, index) => {
			if (still === "merged") {
				faceWeights.push(1);
				individualOpacities.push(0);
				individualEyes.push({});
				return [...stack.map((value) => value / mergeScale), 0];
			}
			const { begin, arrive, leave, regain, exit } = timing[index];
			const approach = easeBetween(time, begin, arrive);
			const peel = easeBetween(time, leave, leave + exit);
			const together = approach * (1 - peel);
			let [soloX, soloY, soloZ] = spatial ? soloOrbit(time, home, period, phase) : [
				home[0] + 2.35 * Math.sin(2 * Math.PI * time / period + phase),
				home[1] + 2 * Math.cos(2 * Math.PI * time / (period * 1.23) + phase),
				0
			];
			const drift = wander[index];
			const wanderTime = drift ? time * drift.pace + drift.phase : 0;
			if (drift) {
				// Each character has its own long arc through the open part of an encounter.
				soloX += home[0] * .64 + 13 * Math.sin(wanderTime * .57 + phase) + 9 * Math.cos(wanderTime * .23);
				soloY += home[1] * .66 + 13 * Math.cos(wanderTime * .51 + phase) + 8 * Math.sin(wanderTime * .29);
			}
			const joining = index === guest;
			const faceArrival = joining ? arrive : pairArrival;
			const faceClose = easeBetween(time, faceArrival - .57, faceArrival - .12);
			const faceOpen = easeBetween(time, regain + .3, regain + .76);
			individualOpacities.push(1 - faceClose + faceOpen);
			const towardMeeting = easeBetween(time, begin, begin + .7) * (1 - faceClose);
			const lookAway = faceOpen * (1 - easeBetween(time, regain + .85, regain + 1.75));
			const independentBlink = relativeBlink(drift ? wanderTime : time, period * .83, phase);
			const idle = drift ? (1 - together) * (1 - towardMeeting) : 0;
			individualEyes.push({
				x: (lookAway - towardMeeting) * home[0] * .13 + idle * 3.0 * Math.cos(wanderTime * .57 + phase),
				y: (lookAway - towardMeeting) * home[1] * .1 - idle * 1.8 * Math.sin(wanderTime * .51 + phase),
				height: (1 - .76 * faceClose * (1 - faceOpen)) * (1 - independentBlink) * (1 + idle * .07 * Math.sin(wanderTime * .91))
			});
			faceWeights.push(joining ? easeBetween(time, arrive - .65, arrive) * (1 - easeBetween(time, leave, leave + .6)) : 1);
			const localX = joint[0] + (stack[0] - joint[0]) * stackAmount;
			const localY = joint[1] + (stack[1] - joint[1]) * stackAmount;
			const targetX = localX * Math.cos(bank) - localY * Math.sin(bank) + driftX;
			const targetY = localX * Math.sin(bank) + localY * Math.cos(bank) + driftY;
			const targetZ = spatial ? 2.3 * Math.sin(Math.PI * travel) + (index - (paths.length - 1) / 2) * .8 : 0;
			const tangentX = soloY - targetY;
			const tangentY = targetX - soloX;
			const tangentLength = Math.hypot(tangentX, tangentY) || 1;
			const release = Math.sin(peel * Math.PI) ** 2;
			const bend = arc * (.52 * Math.sin(approach * Math.PI) ** 2 + 1.28 * release);
			const depth = soloZ + (targetZ - soloZ) * together;
			const exitLane = [
				22,
				-22,
				6
			][exitOrder.indexOf(index)] * direction;
			return [
				(soloX + (targetX - soloX) * together + bend * tangentX / tangentLength) / mergeScale,
				(soloY + (targetY - soloY) * together + bend * tangentY / tangentLength) / mergeScale,
				(spatial ? depth + (exitLane - depth) * .88 * release : 0) / mergeScale
			];
		});
		const totalWeight = faceWeights.reduce((sum, weight) => sum + weight, 0);
		const [sharedX, sharedY, sharedDepth] = [
			0,
			1,
			2
		].map((axis) => positions.reduce((sum, offset, index) => sum + offset[axis] * faceWeights[index], 0) / totalWeight);
		return {
			offsets: positions.map(([x, y]) => [x, y]),
			depths: positions.map(([, , z]) => z),
			scale: mergeScale,
			sharedOpacity,
			sharedOffset: [sharedX, sharedY],
			sharedDepth,
			sharedEyes,
			individualOpacities,
			individualEyes
		};
	};
}
const inks = [
	[[
		0,
		162,
		207
	], [
		0,
		.9,
		.75
	]],
	[[
		239,
		14,
		115
	], [
		.4,
		1,
		.8
	]],
	[[
		252,
		204,
		0
	], [
		.2,
		.45,
		0
	]]
];
const overlaps = [
	[[0, 1], [
		0,
		26,
		138
	]],
	[[0, 2], [
		6,
		129,
		29
	]],
	[[1, 2], [
		228,
		11,
		5
	]],
	[[
		0,
		1,
		2
	], [
		12,
		5,
		18
	]]
];
const characters = [
	{
		id: "cyan",
		name: "Cyan",
		ink: 0,
		eyeY: 48,
		eyeSpacing: 15,
		eyeInk: [
			8,
			44,
			62
		],
		eyeWidth: 1.09,
		eyeHeight: .93,
		tilt: -3,
		lift: -.2
	},
	{
		id: "magenta",
		name: "Magenta",
		ink: 1,
		eyeY: 46,
		eyeSpacing: 16,
		eyeInk: [
			68,
			14,
			43
		],
		eyeWidth: 1,
		eyeHeight: .95,
		tilt: 3,
		lift: -.9
	},
	{
		id: "yellow",
		name: "Yellow",
		ink: 2,
		eyeY: 51,
		eyeSpacing: 14,
		eyeInk: [
			67,
			44,
			12
		],
		eyeWidth: 1.14,
		eyeHeight: .8,
		tilt: 0,
		lift: .2
	}
];
const groupCentres = [
	[31, 37],
	[69, 40],
	[49, 67]
];
const soloCentre = [50, 50];
function centreFor(ink, spacing) {
	if (spacing === null) return soloCentre;
	return groupCentres[ink].map((coordinate) => 50 + (coordinate - 50) * spacing);
}
const radius = 34;
const circle = new Path2D();
circle.arc(50, 50, radius, 0, Math.PI * 2);
matchMedia("(prefers-reduced-motion: reduce)");
performance.now();
const rgb = (colour) => `rgb(${colour.join(" ")})`;
const paper = [
	248,
	239,
	225
];
const grainSize = 128;
const grain = new Float32Array(grainSize ** 2);
for (let i = 0; i < grain.length; i++) {
	const noise = Math.sin((i + 1) * 97.41) * 43758.5453;
	grain[i] = (noise - Math.floor(noise) - .5) * 8;
}
function makeTexture(colour, variation) {
	const tile = document.createElement("canvas");
	tile.width = tile.height = grainSize;
	const ctx = tile.getContext("2d");
	const pixels = ctx.createImageData(grainSize, grainSize);
	grain.forEach((tone, i) => {
		for (let channel = 0; channel < 3; channel++) pixels.data[i * 4 + channel] = colour[channel] + tone * variation[channel];
		pixels.data[i * 4 + 3] = 255;
	});
	ctx.putImageData(pixels, 0, 0);
	return tile;
}
const paperTile = makeTexture(paper, [
	.46,
	.48,
	.56
]);
const inkTiles = inks.map(([colour, variation]) => makeTexture(colour, variation));
const overlapTiles = overlaps.map(([, colour]) => makeTexture(colour, [
	.64,
	.73,
	.79
]));
const eyeTiles = characters.map(({ eyeInk }) => makeTexture(eyeInk, [
	1,
	1,
	1
]));
const sharedFace = {
	id: "stacked",
	name: "Stacked",
	eyeY: 50,
	eyeSpacing: 15,
	eyeInk: [
		246,
		235,
		218
	],
	eyeWidth: 1.04,
	eyeHeight: .9,
	tilt: 0,
	lift: 0
};
const sharedEyeTile = makeTexture(sharedFace.eyeInk, [
	1,
	1,
	1
]);
const eyeSegments = [
	[
		-.48,
		-.43,
		-.25,
		-.51,
		.02,
		-.5
	],
	[
		.3,
		-.49,
		.48,
		-.37,
		.49,
		-.16
	],
	[
		.51,
		.02,
		.48,
		.18,
		.46,
		.28
	],
	[
		.42,
		.44,
		.23,
		.5,
		-.02,
		.5
	],
	[
		-.29,
		.5,
		-.48,
		.4,
		-.49,
		.22
	],
	[
		-.51,
		.08,
		-.5,
		-.08,
		-.49,
		-.23
	]
];
function eyeOutline(bend = 0) {
	const path = new Path2D();
	const y = (x, value) => value + bend * (1 - 4 * x * x);
	path.moveTo(-.49, y(-.49, -.23));
	for (const [x1, y1, x2, y2, x, endY] of eyeSegments) path.bezierCurveTo(x1, y(x1, y1), x2, y(x2, y2), x, y(x, endY));
	path.closePath();
	return path;
}
const eyeStamp = eyeOutline();
function eyeGeometry(expression, eye, character, time, reduced) {
	const { mark } = eye;
	const shape = shapeEyes(expression, eye, time, reduced);
	const lift = eye.key === "eye-1" ? character.lift : 0;
	return {
		x: mark.x + mark.width / 2 + (shape.x ?? 0),
		y: mark.y + mark.height / 2 + lift + (shape.y ?? 0),
		angle: character.tilt * Math.PI / 180 + (shape.angle ?? 0),
		width: shape.widthPx ?? mark.width * character.eyeWidth * (shape.width ?? 1),
		height: shape.heightPx ?? mark.height * character.eyeHeight * (shape.height ?? 1),
		bend: shape.bend ?? 0
	};
}
function createPainter(canvas, extent = 1) {
	const ctx = canvas.getContext("2d");
	const patterns = [
		paperTile,
		...inkTiles,
		...overlapTiles
	].map((tile) => ctx.createPattern(tile, "repeat"));
	const eyePatterns = eyeTiles.map((tile) => ctx.createPattern(tile, "repeat"));
	const sharedEyes = ctx.createPattern(sharedEyeTile, "repeat");
	function paintPattern(pattern, colour) {
		ctx.save();
		ctx.resetTransform();
		ctx.fillStyle = pattern || rgb(colour);
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.restore();
	}
	function print(paths, pattern, colour) {
		ctx.save();
		for (const path of paths) ctx.clip(path);
		paintPattern(pattern, colour);
		ctx.restore();
	}
	function paintFace(frame, matrix, character, pattern, expression, time, reduced, transition, opacity = 1) {
		ctx.save();
		ctx.globalAlpha = opacity;
		ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
		ctx.strokeStyle = rgb(character.eyeInk);
		for (const eye of frame.shapes) {
			if (eye.kind !== "eye") continue;
			ctx.save();
			ctx.transform(...eye.matrix);
			const { mark } = eye;
			if (mark.shape === "arc") {
				ctx.lineCap = "round";
				ctx.lineWidth = mark.strokeWidth;
				ctx.stroke(new Path2D(mark.d));
			} else {
				const shape = eyeGeometry(expression, eye, character, time, reduced);
				if (transition) {
					const from = eyeGeometry(transition.from, eye, character, time, reduced);
					for (const key of Object.keys(shape)) shape[key] = from[key] + (shape[key] - from[key]) * transition.progress;
				}
				ctx.translate(shape.x, shape.y);
				ctx.rotate(shape.angle);
				ctx.scale(shape.width, shape.height);
				ctx.clip(shape.bend ? eyeOutline(shape.bend / shape.height) : eyeStamp);
				paintPattern(pattern, character.eyeInk);
			}
			ctx.restore();
		}
		ctx.restore();
	}
	return (agents, { spacing, offsets, face, scale = spacing === null ? 1 : .73, sharedOpacity = 1, sharedOffset = [0, 0], individualOpacity = face ? 0 : 1 }, time, reduced, expression, transition) => {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.save();
		ctx.scale(canvas.width / (100 * extent), canvas.height / (100 * extent));
		ctx.translate(50 * (extent - 1), 50 * (extent - 1));
		const spread = reduced ? 1 : 1 + .1 * Math.sin(time * .68);
		const layers = /* @__PURE__ */ new Map();
		const shapes = agents.map(({ character, frame, opacity = individualOpacity, eyePose }, index) => {
			const [cx, cy] = centreFor(character.ink, spacing);
			const [dx, dy] = offsets?.[index] ?? [0, 0];
			const matrix = new DOMMatrix().translateSelf(50 + (cx - 50) * spread, 50 + (cy - 50) * spread).scaleSelf(scale).translateSelf(-50, -50).multiplySelf(new DOMMatrix(frame.root));
			const path = new Path2D();
			path.addPath(circle, new DOMMatrix(matrix).translateSelf(dx * spread, dy * spread));
			layers.set(character.ink, path);
			return {
				frame,
				matrix,
				path,
				character,
				dx,
				dy,
				opacity,
				eyePose
			};
		});
		for (const { path, character: { ink } } of shapes) print([path], patterns[ink + 1], inks[ink][0]);
		overlaps.forEach(([indices, colour], index) => {
			const paths = indices.map((ink) => layers.get(ink));
			if (paths.every(Boolean)) print(paths, patterns[index + 4], colour);
		});
		if (face && sharedOpacity > 0) {
			const { frame, matrix } = shapes[0];
			paintFace(frame, new DOMMatrix(matrix).translateSelf(...sharedOffset), face, sharedEyes, expression, time, reduced, transition, sharedOpacity);
		}
		for (const { frame, matrix, character, path, dx, dy, opacity, eyePose } of shapes) {
			if (opacity <= 0) continue;
			ctx.save();
			if (face) ctx.clip(path);
			const [originalX, originalY] = centreFor(character.ink, spacing === null ? null : 1);
			const [x, y] = centreFor(character.ink, spacing);
			matrix.translateSelf((originalX - x) * 1.7, (originalY - y) * 1.7);
			if (face) matrix.translateSelf(dx * spread, dy * spread);
			const individualExpression = eyePose && { eyes: () => eyePose };
			paintFace(frame, matrix, character, eyePatterns[character.ink], individualExpression, time, reduced, void 0, opacity);
			ctx.restore();
		}
		ctx.restore();
	};
}
const REST = {
	x: 0,
	y: 0,
	attention: 0
};
/** Time constant of the look easing, seconds: quick enough to track a moving pointer. */
const TAU = .12;
/**
* Attention fades in and out more slowly, so taking up a target, losing it
* (pointer leaves, follow toggled off) or settling back into the resting turn
* is an unhurried turn rather than a snap.
*/
const ATTEND_TAU = .3;
/** Pointer distance, in avatar sizes, at which the look is at tanh(1) ≈ 76% of full. */
const REACH = 1;
/** Small avatars still get a usable reach, CSS px. */
const MIN_SIZE = 160;
/**
* Look direction (-1..1, x right, y down) toward a viewport point, from the
* avatar's bounding box. `origin` is where the look starts, as a fraction of
* the box (the eyes; default the center).
*/
function pointerGaze(pointer, box, origin = {
	x: .5,
	y: .5
}) {
	const reach = Math.max(box.width, box.height, MIN_SIZE) * REACH;
	const dx = (pointer.x - (box.left + box.width * origin.x)) / reach;
	const dy = (pointer.y - (box.top + box.height * origin.y)) / reach;
	const m = Math.hypot(dx, dy);
	if (!Number.isFinite(m) || m < 1e-9) return {
		x: 0,
		y: 0
	};
	const k = Math.tanh(m) / m;
	return {
		x: dx * k,
		y: dy * k
	};
}
/**
* One easing step toward `target` (null = not following: back to rest).
* Frame-rate independent; reduced motion snaps. Returns the next state and
* whether it still needs frames.
*/
function followStep(state, target, dt, reduced) {
	const goal = target ? {
		x: target.x,
		y: target.y,
		attention: 1
	} : REST;
	const step = Math.max(0, Math.min(dt, .1));
	const ease = (tau) => reduced ? 1 : 1 - Math.exp(-step / tau);
	const k = ease(target ? TAU : ATTEND_TAU);
	const next = {
		x: state.x + (goal.x - state.x) * k,
		y: state.y + (goal.y - state.y) * k,
		attention: state.attention + (goal.attention - state.attention) * ease(ATTEND_TAU)
	};
	const moving = Math.abs(goal.x - next.x) > .002 || Math.abs(goal.y - next.y) > .002 || Math.abs(goal.attention - next.attention) > .002;
	return {
		state: moving ? next : goal,
		moving
	};
}
/**
* The pose's look target for a follow state, nothing at all once at rest.
* Attention eased through a smoothstep is the weight, so the turn starts and
* ends gently rather than at full speed.
*/
function followGaze(state) {
	const a = Math.min(1, Math.max(0, state.attention));
	return a > 0 ? {
		x: state.x,
		y: state.y,
		weight: a * a * (3 - 2 * a)
	} : void 0;
}
const mergeFrame = {
	"name": "Stacked",
	"color": "#ff6a1a",
	"ink": "#151515",
	"paths": [{
		"id": "oba-1aoq0oc-0",
		"d": "M16 50A34 34 0 1 0 84 50A34 34 0 1 0 16 50Z",
		"evenOdd": false,
		"box": {
			"x": 16,
			"y": 16,
			"w": 68,
			"h": 68
		}
	}],
	"root": [
		1,
		0,
		0,
		1,
		0,
		0
	],
	"shapes": [
		{
			"kind": "slice",
			"key": "0z0",
			"path": "oba-1aoq0oc-0",
			"matrix": [
				1,
				0,
				0,
				1,
				0,
				0
			]
		},
		{
			"kind": "eye",
			"key": "eye-0",
			"matrix": [
				1,
				0,
				0,
				1,
				0,
				0
			],
			"mark": {
				"shape": "pill",
				"x": 40.064,
				"y": 43.301,
				"width": 4.872,
				"height": 13.398,
				"radius": 2.436
			}
		},
		{
			"kind": "eye",
			"key": "eye-1",
			"matrix": [
				1,
				0,
				0,
				1,
				0,
				0
			],
			"mark": {
				"shape": "pill",
				"x": 55.064,
				"y": 43.301,
				"width": 4.872,
				"height": 13.398,
				"radius": 2.436
			}
		}
	]
};
const gazeStyles = [
	{
		rate: 1.62,
		x: 1.25,
		y: .76
	},
	{
		rate: 1.02,
		x: .89,
		y: 1.24
	},
	{
		rate: .57,
		x: .72,
		y: .71
	}
];
const sharedGazeStyle = {
	rate: 1,
	x: 1,
	y: 1
};
/** Paint the published Spheres Merge preview onto a transparent canvas. */
function createSpheresMerge(canvas, { inks = [
	0,
	1,
	2
], beginMerged = false, random = Math.random, roam = false } = {}) {
	const extent = roam ? 2 : 1;
	const paint = createPainter(canvas, extent);
	const motion = createMergeMotion(inks.length === 3 ? trioPaths : pairPaths, random, { beginMerged, roam });
	const members = inks.map((ink) => characters[ink]);
	const followed = members.map(() => REST);
	let sharedFollow = REST;
	const eyesInFrame = mergeFrame.shapes.filter((shape) => shape.kind === "eye");
	const baseline = eyesInFrame.reduce((sum, { mark }) => sum + mark.y + mark.height / 2, 0) / eyesInFrame.length;
	return (seconds, still = null, input = null) => {
		const { sharedEyes, individualEyes, individualOpacities, ...layout } = motion(seconds, still);
		const update = (state, offset, style) => {
			if (still) return REST;
			if (!input) return state;
			const { pointer, size, dt } = input;
			const portrait = size / extent;
			const inset = (size - portrait) / 2;
			return followStep(state, pointer && pointerGaze(pointer, {
				left: inset,
				top: inset,
				width: portrait,
				height: portrait
			}, {
				x: .5 + offset[0] * layout.scale / 100,
				y: .5 + (offset[1] + baseline - 50) * layout.scale / 100
			}), dt * style.rate, false).state;
		};
		const pose = (eyes, state, style) => {
			const look = followGaze(state);
			if (!look) return eyes;
			const idle = 1 - look.weight;
			return {
				...eyes,
				x: (eyes.x ?? 0) * idle + look.x * style.x * look.weight * 7.2,
				y: (eyes.y ?? 0) * idle + look.y * style.y * look.weight * 6
			};
		};
		const agents = members.map((character, index) => {
			const style = gazeStyles[character.ink];
			followed[index] = update(followed[index], layout.offsets[index], style);
			return {
				character,
				frame: mergeFrame,
				opacity: individualOpacities[index],
				eyePose: pose(individualEyes[index], followed[index], style)
			};
		});
		sharedFollow = update(sharedFollow, layout.sharedOffset, sharedGazeStyle);
		paint(agents, {
			...layout,
			spacing: null,
			face: sharedFace
		}, 0, true, { eyes: () => pose(sharedEyes, sharedFollow, sharedGazeStyle) });
	};
}
function mountSpheresAvatar(host) {
	const canvas = host.querySelector("canvas");
	const motion = matchMedia("(prefers-reduced-motion: reduce)");
	if (!canvas?.getContext("2d")) return () => {};
	const paint = createSpheresMerge(canvas);
	let previous;
	let elapsed = 0;
	let request;
	function pause() {
		cancelAnimationFrame(request);
		previous = void 0;
		canvas.hidden = true;
		delete host.dataset.spheresAvatarPlaying;
	}
	function stop() {
		pause();
		motion.removeEventListener("change", sync);
		document.removeEventListener("visibilitychange", resetClock);
	}
	function resetClock() {
		previous = void 0;
	}
	function play(now) {
		if (!host.isConnected) {
			stop();
			return;
		}
		if (previous !== void 0 && !document.hidden) elapsed += (now - previous) / 1e3;
		previous = document.hidden ? void 0 : now;
		try {
			paint(elapsed);
		} catch {
			stop();
			return;
		}
		canvas.hidden = false;
		host.dataset.spheresAvatarPlaying = "";
		request = requestAnimationFrame(play);
	}
	function sync() {
		pause();
		if (!motion.matches) request = requestAnimationFrame(play);
	}
	motion.addEventListener("change", sync);
	document.addEventListener("visibilitychange", resetClock);
	sync();
	return stop;
}
for (const host of document.querySelectorAll("[data-spheres-avatar-auto]")) if (!host.closest("#buzz-launch") || !document.documentElement.hasAttribute("data-welcome-intro")) mountSpheresAvatar(host);
//#endregion
export { createSpheresMerge, mountSpheresAvatar };
