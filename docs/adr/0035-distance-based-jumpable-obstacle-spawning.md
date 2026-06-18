---
status: accepted
---

# Distance-based obstacle spawning with a speed-derived jumpable gap

## Context

Penguin Run's first cut spawned a single Obstacle on a **time interval** that ramped down as the Round progressed, while the scroll speed ramped up independently. Because the penguin's horizontal jump reach is a function of scroll speed (`reach = speed × jump-airtime`), a fixed-time interval cannot guarantee the gap between obstacles stays clearable: as speed rises, the same time interval covers more distance early on but the *jump* also reaches further, and there is no invariant tying the two together. We also want Obstacle Groups (1–3 contiguous obstacles), variable spacing, and a frequency that climbs over time — all without ever producing an unclearable arrangement.

## Decision

Spawn by **distance, not time**. The spawn loop tracks ground distance scrolled since the trailing edge of the last Obstacle Group and emits the next group only once a chosen clear gap has passed:

```
airtime   = 2·|JUMP_VELOCITY| / GRAVITY
minGap    = scrollSpeed · airtime · SAFETY            (SAFETY ≈ 1.3)
chosenGap = minGap + rand(0, extraRange(elapsed))
```

- **minGap** is recomputed from the *current* speed at spawn time, so a land-and-rejump window always exists, at any speed.
- A group is 1–3 **contiguous** obstacles (one jump clears the whole cluster); group span is asserted ≤ jump reach, which holds comfortably (max span ≈ 3 sprite widths ≪ reach).
- Group size is weighted-random with the distribution shifting heavier over the Round.
- **extraRange** shrinks over elapsed time toward a small slack floor (never zero), so groups arrive more frequently as the Round goes on — frequency rising on top of, and independent of, raw speed.

The selection logic lives in a pure, RNG-injectable planner so the "always jumpable" invariant (`gap ≥ minGap`, `span ≤ reach`) is unit-testable without a canvas.

## Consequences

- Replaces the time-interval ramp constants; difficulty is now governed by speed, group-size weighting, and a shrinking spacing range rather than a single spawn-interval floor.
- Fairness is structural, not tuned: no combination of speed and RNG can produce an unclearable group. A forgiving (~60%) hitbox sits on top; the server score ceiling (ADR 0034) makes generous collision non-exploitable.
