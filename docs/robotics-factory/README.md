# SINDA Robotics Factory — Digital Preview

## Approved scope

- Product type: digital-only engineering and research platform.
- Maturity: advanced research and development preview.
- Bio-inspired work: simulation only; no biological samples, organisms, wet-lab procedures, or biological processing.
- Physical robotics: disabled in this phase. No hardware actuation, device pairing, or real-world robot control.
- Deployment: preview branch and review only. No production deployment.

## Mission

Provide a governed digital factory for designing educational robots, running reproducible simulations, evaluating proposed improvements, and maintaining an auditable invention portfolio.

## Workspaces

1. **Factory Control Plane** — projects, users, roles, approvals, activity and audit events.
2. **Responsible AI Studio** — bounded task planning, evidence-linked recommendations, and human approval gates.
3. **Robot Design Studio** — robot profiles, components, sensor/actuator metadata, and versioned designs. These are descriptive models only.
4. **Simulation Lab** — deterministic scenarios, virtual sensors, virtual actuators, environment profiles, and repeatable runs.
5. **Bio-Inspired Simulation** — abstract locomotion and soft-robotics models inspired by nature. No biological experimentation.
6. **Invention Workshop** — hypotheses, novelty notes, design iterations, experiment cards, and evidence packages.
7. **Verification & Safety Center** — test suites, risk assessments, policy decisions, and release-readiness reports.

## Non-goals for this preview

- No physical robot control, motor commands, device discovery, or hardware bridge.
- No wet-lab, pathogen, genetic, organism, tissue, or biological sample handling.
- No medical diagnosis, treatment, or claims of biological efficacy.
- No autonomous deployment, self-granted permissions, or self-modifying production code.
- No payments, wallets, financial transactions, or production secrets.

## Engineering principles

- Simulation is the default and only execution target.
- Every run is isolated, bounded by resource/time limits, and reproducible from a versioned scenario.
- AI output is a proposal, not an authorization.
- Changes to policies, simulation definitions, or executable adapters require tests and human review.
- Every consequential action records actor, project, input version, policy decision, outcome, and timestamp.
- Untrusted model output is validated against strict schemas before use.

## Preview acceptance gates

A phase is accepted only when its tests pass, security checks pass, documentation matches observed behavior, and the review explicitly records remaining limitations. A skipped test is not a pass.
