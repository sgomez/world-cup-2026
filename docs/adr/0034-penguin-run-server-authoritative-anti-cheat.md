# Penguin Run uses server-authoritative time-envelope anti-cheat

Because a browser arcade game runs entirely on an untrusted client, a naive "client posts its score" design is trivially forged. We make the **server** the authority on timing and on the maximum achievable score, while leaving the client authoritative only on the *actual* score within that envelope.

The mechanism:

- A **Penguin Run** is one game per **Play Day** (UTC calendar day). Starting a Run consumes that day's play immediately, whether or not it completes — so disconnecting to retry gains nothing.
- The server stamps Round start/end with **its own clock**, never the client's, and computes a **score ceiling** from elapsed real time (score is survival time, a known monotonic function). A reported score above the ceiling is capped.
- A periodic **Heartbeat** proves the Run is still live. If it lapses beyond tolerance, the Run is finalized server-side with the best Round score so far, and the Play Day stays consumed.
- Best-of-three Rounds; only the highest Round score reaches the **Arcade Ranking**.

## Considered options

- **Trust the client score** — rejected: forgeable in seconds via devtools, would make the ranking meaningless.
- **Fully server-simulated game** — rejected: far more complex, needs the server to model physics/obstacle spawns; the time-envelope cap blocks the only cheat that matters (claiming more points than time allows) at a fraction of the cost.

## Consequences

- Stale-Run finalization is done **lazily on read** of the Arcade Ranking (no new scheduler; the existing in-process poller of ADR 0019 is not extended).
- All timekeeping is UTC, consistent with the rest of the platform.
