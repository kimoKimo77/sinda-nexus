# Sinda Project Intelligence

## Purpose

Project Intelligence is the portfolio control plane for discovering existing work, identifying evidenced gaps, prioritizing development, and preparing investor-review materials. It is not an autonomous investment platform and does not contact investors or move money.

## Confirmed repository inventory (read-only discovery)

The first GitHub inventory found five repositories accessible to the connected account:

| Repository | Evidence observed | Initial classification |
| --- | --- | --- |
| `kimoKimo77/sinda-nexus` | Arabic README describes project/file/report management; PRs #7–#10 are open Draft work | Portfolio platform / AI orchestration |
| `kimoKimo77/marketmaster-ai` | README describes AI warehouse simulation, autonomous pathfinding, shipment tracking, and 3D logistics | Logistics simulation |
| `kimoKimo77/vision-digital` | README describes Arabic/RTL digital agency website, auth pages, and AWS deployment workflow | Digital services / web |
| `kimoKimo77/kiom` | README defines a lightweight task and project productivity product; initial release remains a plan | Productivity SaaS concept |
| `kimoKimo77/demo-api-scalar-galaxy-docs` | README identifies a Scalar documentation starter with OpenAPI/MDX preview and configuration validation | API documentation starter |

This is an inventory of repositories visible to the current GitHub connection, not proof that it contains every project in external services, local files, Google AI Studio, Google Sites, or Gemini Library. Items discovered only in prior discussions must remain marked unverified until their source files and ownership are inspected.

## Gap candidates (proposals, not claims of existing projects)

1. **Portfolio intelligence dashboard** — unified catalog, ownership, status, dependencies, duplicate detection, evidence links, and change history.
2. **Investor readiness workspace** — evidence checklist, pitch narrative, product demo links, market research, business model, unit economics, legal/IP, team, and security review.
3. **Project delivery cockpit** — milestone planning, blockers, test evidence, release gates, and cross-project dependency tracking.
4. **Research and opportunity pipeline** — customer problem validation, market sizing sources, competitor map, and opportunity scoring.

These candidates require user review and evidence; do not create duplicate repositories or assume they are funded business opportunities.

## Prioritization

The current deterministic score uses transparent, bounded 0–5 inputs:
- User impact: 30%
- Strategic fit: 25%
- Delivery readiness: 20%
- Urgency: 15%
- Evidence strength: 10%

Scores rank work for review only. They are not market valuations or expected returns.

## Investor-readiness gates

A project is eligible for an investor review only when verified evidence exists for all of:
- Problem validation
- Market research
- Prototype/demo
- Business model
- Unit economics
- Legal and IP review
- Team
- Security review

A 100% checklist is not a guarantee of funding and does not constitute investment advice, an offer, valuation, or securities solicitation. Financial figures must be sourced, dated, and explicitly labeled as actual, forecast, or assumption.

## Governance and security

- Inventory sources are read-only. Do not crawl external services or import files without explicit authorization.
- Keep each project's repository, owner, source, and confidence level visible.
- No secret, credential, customer personal data, or private financial data in the portfolio record.
- AI may suggest classifications and plans; a human reviews and approves changes.
- No automatic repository creation, issue assignment, merge, deployment, investor outreach, or financial transaction.
- Investor-facing exports must include source dates, assumptions, unresolved risks, and a review status.
- This branch is a Preview foundation. Durable persistence, authenticated tenant scoping, UI, and external-source connectors remain separate gated work.

## Verification

Run `npm test` and `npm run check` in the repository. The module is pure and deterministic; it performs no network calls and has no write capability.
