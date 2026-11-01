# GitHub Pages Preview

This branch prepares a **static, public, read-only information page** from `docs/`.

## Important boundary

- GitHub Pages serves static files only; it does not run the Node.js API or PostgreSQL.
- The page does not include login forms, credentials, user data, market quotes, or investment recommendations.
- No financial transactions, brokerage connections, wallet operations, or private-key handling are present.
- The application API and database are not deployed by this workflow.

## One-time repository setup

A repository administrator must enable Pages once:

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Save the setting.

The GitHub Actions token used by this repository cannot create the Pages site itself; this is a repository-administration operation. The workflow intentionally does not request a personal access token or additional secret.

## Deploy

After Pages is enabled:

1. Open the **Actions** tab.
2. Select **Publish static Preview to GitHub Pages**.
3. Choose **Run workflow** on branch `deploy/github-pages-preview`.
4. Wait for both jobs to pass, then open the URL shown on the `github-pages` environment/deployment.

## Scope

This is a public Preview only. Do not add secrets or personal information to `docs/`. The Node.js API and PostgreSQL still require a separate server deployment; they are not hosted by this Pages site.
