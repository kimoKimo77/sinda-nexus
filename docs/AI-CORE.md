# Sinda AI Core (Preview)

## Purpose

This isolated module introduces an explainable decision layer and a guarded workspace writer. It is a foundation for future model-backed planning; it is **not yet an autonomous generative model** and does not connect to an external LLM or database.

## Current capabilities

- Classifies requested actions as allow, deny, or require-human-approval.
- Allows only explicitly listed low-impact actions: analyze, read, and workspace write.
- Requires approval for deployment, publication, deletion, permission changes, financial transactions, and high/unknown-risk actions.
- Writes UTF-8 text files beneath a configured workspace root, using a temporary file and atomic rename.
- Emits structured audit events through an injected audit callback.

## Safety boundaries

- No database credentials, provider API keys, wallet access, transaction signing, or deployment credentials are included.
- No deletion or production deployment capability is implemented.
- The writer is a local workspace utility, not a general-purpose filesystem agent.
- Approval is an integration responsibility: callers must not treat a request for approval as authorization.
- Production use requires additional hardening, including race-resistant filesystem handling, durable audit storage, authenticated user identity, per-project authorization, quotas, and integration tests.

## Verification

Run `npm test` or `npm run check` with Node.js 22 or newer.
