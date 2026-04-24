// Pure trip-simulation math. Used by both the manager and customer maps so the
// robot dot stays in lockstep across views. No React, no fetches, no DOM.

export type Leg = {
  coordinates: [number, number][];
  duration_s: number;
  distance_m: number;
};

export type TripPlan = {
  startedAtMs: number | null; // server-side trip.started_at, ms since epoch
  serverNowMs: number; // server clock at the moment we got the plan
  clientAnchorMs: number; // performance.now() at the moment we received the plan
  speed: number; // SIMULATION_SPEED multiplier
  legs: Leg[];
  status: "planned" | "in_progress" | "completed" | "cancelled";
};

export type SimSnapshot = {
  /** 0-based index of the leg the robot is currently on. */
  legIndex: number;
  /** 0..1 progress within the active leg. */
  legProgress: number;
  /** Total stops fully delivered (== legIndex while in progress, == legs.length when done). */
  completedStops: number;
  /** Robot position. */
  pos: [number, number];
  /** True once the robot has reached the final stop. */
  done: boolean;
  /** Sim-seconds elapsed since startedAt. */
  simElapsedS: number;
};

/**
 * Convert a now() in client-clock-ms to the corresponding server-anchored time.
 * This compensates for any clock skew between browser and backend by using the
 * `serverNow + (clientNow - clientAnchor)` relationship recorded on fetch.
 */
export function serverTimeNow(plan: TripPlan, clientNowMs: number): number {
  return plan.serverNowMs + (clientNowMs - plan.clientAnchorMs);
}

/** Linear arc-length interpolation along a polyline at `progress` (0..1). */
function pointAtProgress(coords: [number, number][], progress: number): [number, number] {
  if (coords.length === 0) return [0, 0];
  if (coords.length === 1) return coords[0];
  if (progress <= 0) return coords[0];
  if (progress >= 1) return coords[coords.length - 1];

  // Cumulative segment distances (degrees, fine for interpolation at street scale).
  let total = 0;
  const segs: number[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const dx = coords[i + 1][0] - coords[i][0];
    const dy = coords[i + 1][1] - coords[i][1];
    const d = Math.sqrt(dx * dx + dy * dy);
    segs.push(d);
    total += d;
  }
  if (total === 0) return coords[0];

  const target = progress * total;
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= target) {
      const t = segs[i] === 0 ? 0 : (target - acc) / segs[i];
      return [
        coords[i][0] + t * (coords[i + 1][0] - coords[i][0]),
        coords[i][1] + t * (coords[i + 1][1] - coords[i][1]),
      ];
    }
    acc += segs[i];
  }
  return coords[coords.length - 1];
}

export function snapshotAt(plan: TripPlan, clientNowMs: number): SimSnapshot {
  const legs = plan.legs;

  if (plan.status === "completed" || plan.status === "cancelled") {
    const last = legs.length > 0 ? legs[legs.length - 1].coordinates : [];
    return {
      legIndex: legs.length,
      legProgress: 1,
      completedStops: legs.length,
      pos: last.length > 0 ? last[last.length - 1] : [0, 0],
      done: true,
      simElapsedS: 0,
    };
  }

  if (!plan.startedAtMs || legs.length === 0) {
    const start = legs.length > 0 ? legs[0].coordinates[0] : ([0, 0] as [number, number]);
    return {
      legIndex: 0,
      legProgress: 0,
      completedStops: 0,
      pos: start,
      done: false,
      simElapsedS: 0,
    };
  }

  const serverNow = serverTimeNow(plan, clientNowMs);
  const elapsedReal = Math.max(0, (serverNow - plan.startedAtMs) / 1000);
  const simElapsed = elapsedReal * plan.speed;

  let acc = 0;
  for (let i = 0; i < legs.length; i++) {
    const dur = Math.max(0, legs[i].duration_s);
    if (simElapsed < acc + dur) {
      const within = dur === 0 ? 1 : (simElapsed - acc) / dur;
      return {
        legIndex: i,
        legProgress: within,
        completedStops: i,
        pos: pointAtProgress(legs[i].coordinates, within),
        done: false,
        simElapsedS: simElapsed,
      };
    }
    acc += dur;
  }

  // Past the end — done.
  const lastLeg = legs[legs.length - 1].coordinates;
  return {
    legIndex: legs.length,
    legProgress: 1,
    completedStops: legs.length,
    pos: lastLeg[lastLeg.length - 1],
    done: true,
    simElapsedS: simElapsed,
  };
}

/**
 * Real-world wall-clock seconds remaining until the robot reaches stop
 * `targetStopSequence` (1-indexed). Useful for ETA labels on the customer page.
 */
export function etaSecondsToStop(
  plan: TripPlan,
  targetStopSequence: number,
  clientNowMs: number,
): number {
  if (plan.legs.length === 0) return 0;
  if (plan.status === "completed" || plan.status === "cancelled") return 0;

  const targetIdx = Math.max(0, Math.min(plan.legs.length, targetStopSequence));
  const targetSimEnd = plan.legs.slice(0, targetIdx).reduce((a, l) => a + l.duration_s, 0);

  if (!plan.startedAtMs || plan.status !== "in_progress") {
    return Math.max(0, Math.round(targetSimEnd / Math.max(plan.speed, 0.001)));
  }

  const serverNow = serverTimeNow(plan, clientNowMs);
  const elapsedReal = Math.max(0, (serverNow - plan.startedAtMs) / 1000);
  const simElapsed = elapsedReal * plan.speed;
  const remainingSim = Math.max(0, targetSimEnd - simElapsed);
  return Math.max(0, Math.round(remainingSim / Math.max(plan.speed, 0.001)));
}

/** Concatenate per-leg coordinates into a single polyline for drawing the route. */
export function flattenRoute(legs: Leg[]): [number, number][] {
  const out: [number, number][] = [];
  for (const leg of legs) {
    if (leg.coordinates.length === 0) continue;
    if (out.length > 0) {
      const last = out[out.length - 1];
      const first = leg.coordinates[0];
      if (last[0] === first[0] && last[1] === first[1]) {
        out.push(...leg.coordinates.slice(1));
        continue;
      }
    }
    out.push(...leg.coordinates);
  }
  return out;
}

/**
 * Split the full route into a `traveled` portion (already covered by the robot)
 * and a `remaining` portion. Both are guaranteed to share the robot's current
 * position so the two lines meet visually with no gap.
 */
export function splitRoute(
  legs: Leg[],
  snap: SimSnapshot,
): { traveled: [number, number][]; remaining: [number, number][] } {
  if (legs.length === 0) return { traveled: [], remaining: [] };

  const traveled: [number, number][] = [];
  for (let i = 0; i < snap.legIndex && i < legs.length; i++) {
    if (traveled.length > 0 && legs[i].coordinates.length > 0) {
      const last = traveled[traveled.length - 1];
      const first = legs[i].coordinates[0];
      if (last[0] === first[0] && last[1] === first[1]) {
        traveled.push(...legs[i].coordinates.slice(1));
        continue;
      }
    }
    traveled.push(...legs[i].coordinates);
  }

  const remaining: [number, number][] = [];
  if (snap.done || snap.legIndex >= legs.length) {
    return { traveled, remaining: [] };
  }

  const activeLeg = legs[snap.legIndex].coordinates;
  // Build active-leg traveled and remaining halves around snap.pos.
  let total = 0;
  const segs: number[] = [];
  for (let i = 0; i < activeLeg.length - 1; i++) {
    const dx = activeLeg[i + 1][0] - activeLeg[i][0];
    const dy = activeLeg[i + 1][1] - activeLeg[i][1];
    const d = Math.sqrt(dx * dx + dy * dy);
    segs.push(d);
    total += d;
  }
  const target = total * snap.legProgress;
  let acc = 0;
  let splitIdx = 0;
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= target) {
      splitIdx = i;
      break;
    }
    acc += segs[i];
    splitIdx = i + 1;
  }

  // Stitch traveled with the front half of the active leg.
  const activeFront = activeLeg.slice(0, splitIdx + 1);
  if (traveled.length > 0 && activeFront.length > 0) {
    const last = traveled[traveled.length - 1];
    const first = activeFront[0];
    if (last[0] === first[0] && last[1] === first[1]) {
      traveled.push(...activeFront.slice(1));
    } else {
      traveled.push(...activeFront);
    }
  } else {
    traveled.push(...activeFront);
  }
  traveled.push(snap.pos);

  // Remaining starts at robot position, then the back half of the active leg,
  // then any subsequent legs.
  remaining.push(snap.pos);
  remaining.push(...activeLeg.slice(splitIdx + 1));
  for (let i = snap.legIndex + 1; i < legs.length; i++) {
    if (legs[i].coordinates.length === 0) continue;
    const last = remaining[remaining.length - 1];
    const first = legs[i].coordinates[0];
    if (last[0] === first[0] && last[1] === first[1]) {
      remaining.push(...legs[i].coordinates.slice(1));
    } else {
      remaining.push(...legs[i].coordinates);
    }
  }

  return { traveled, remaining };
}

/** Helper to construct a TripPlan from a backend response. */
export function planFromResponse(args: {
  startedAt: string | null;
  serverNow: string;
  speed: number;
  legs: Leg[];
  status: TripPlan["status"];
}): TripPlan {
  return {
    startedAtMs: args.startedAt ? new Date(args.startedAt).getTime() : null,
    serverNowMs: new Date(args.serverNow).getTime(),
    clientAnchorMs: performance.now(),
    speed: args.speed,
    legs: args.legs,
    status: args.status,
  };
}
