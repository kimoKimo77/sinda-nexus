# Robot Design Studio and Simulation Contract

## Design studio
Robot designs are immutable, versioned, project-scoped records. A design contains a bounded body envelope, allow-listed virtual sensors, allow-listed virtual actuators, and one supported motion model. The in-memory studio is a test/reference adapter only; production persistence and authenticated tenant enforcement must be wired through the durable repository and verified session layer before deployment.

## Supported simulation profiles
- `biped-walk`: abstract two-leg gait profile.
- `quadruped-trot`: abstract four-support gait profile.
- `soft-crawl`: abstract compliant locomotion profile.

These are mathematical abstractions, not validated physical models. Their stability and energy values are comparative simulation proxies, not engineering safety certifications or measured physical performance.

## Metrics
- Duration (seconds)
- Estimated distance (metres)
- Average speed (metres/second)
- Stability index (dimensionless proxy, 0–1)
- Energy proxy (joules, simplified model)
- Slip ratio

## Project isolation
The reference studio requires a caller-supplied authenticated project scope and checks it against the design's project ID. It does not establish production authentication or database row-level security. The production adapter must derive project scope from a verified session, not user/model payload, and repeat the same isolation rules at the repository/database boundary.

## Safety
The simulator only accepts allow-listed virtual component types and rejects unknown fields such as hardware IDs and motor commands. It has no hardware bridge, network, device discovery, or biological-material support.
