# GitHub Pages Preview

This branch publishes a **static, public, read-only information page** from `docs/`.

## Important boundary

- GitHub Pages serves static files only; it does not run the Node.js API or PostgreSQL.
- The page does not include login forms, credentials, user data, market quotes, or investment recommendations.
- No financial transactions, brokerage connections, wallet operations, or private-key handling are present.
- The application API and database are not deployed by this workflow.

## Deployment

The workflow `.github/workflows/github-pages-preview.yml` validates `docs/index.html`, uploads the static artifact, and deploys it to the `github-pages` environment when this branch is pushed or the workflow is manually run.

The first deployment may require GitHub Pages to be enabled for the repository with **Build and deployment → Source: GitHub Actions**. Review the Actions run and the published URL before sharing it.

## Scope

This is a public Preview only. Do not add secrets or personal information to `docs/`.
