import { etaSecondsToStop, flattenRoute, planFromResponse, snapshotAt } from "./tripSimulator";

function basePlan() {
  return planFromResponse({
    startedAt: null,
    serverNow: "2020-01-01T00:00:00.000Z",
    speed: 10,
    status: "planned",
    legs: [
      {
        coordinates: [
          [0, 0],
          [10, 0],
        ],
        duration_s: 100,
        distance_m: 1000,
      },
      {
        coordinates: [
          [10, 0],
          [10, 10],
        ],
        duration_s: 50,
        distance_m: 500,
      },
    ],
  });
}

test("flattenRoute concatenates legs without duplicate join point", () => {
  const plan = basePlan();
  const out = flattenRoute(plan.legs);
  expect(out).toEqual([
    [0, 0],
    [10, 0],
    [10, 10],
  ]);
});

test("snapshotAt returns start position before trip begins", () => {
  const plan = basePlan();
  const snap = snapshotAt(plan, 0);
  expect(snap.legIndex).toBe(0);
  expect(snap.legProgress).toBe(0);
  expect(snap.pos).toEqual([0, 0]);
  expect(snap.done).toBe(false);
});

test("etaSecondsToStop uses sim durations when not started", () => {
  const plan = basePlan();
  // stopSequence is 1-indexed; stop 1 corresponds to leg 0
  const eta = etaSecondsToStop(plan, 1, 0);
  expect(eta).toBe(Math.round(100 / 10));
});

