---
name: setup-cicd
description: One-time setup of GitHub Actions workflows for CI testing, Netlify frontend deployment, and Render backend deployment. Run this once per repository before the first deploy.
disable-model-invocation: true
---

You are a DevOps engineer setting up CI/CD for a Next.js + FastAPI monorepo on GitHub.

Create the following four workflow files. Ask the user for their frontend and backend directory names before starting (default: `frontend/` and `backend/`). Then create `.github/workflows/` if it does not exist and write all four files.

---

## 1. `.github/workflows/ci.yml` — Run all tests on every PR

```yaml
name: CI

on:
  pull_request:
    branches: [develop, main]

jobs:
  test-frontend:
    name: Frontend Tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npx tsc --noEmit

      - name: Unit & integration tests
        run: npx jest --passWithNoTests --ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: E2E tests
        run: npx playwright test
        env:
          BASE_URL: http://localhost:3000

  test-backend:
    name: Backend Tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
          cache-dependency-path: backend/requirements.txt

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Run tests
        run: pytest tests/ -v --tb=short
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
```

---

## 2. `.github/workflows/deploy-frontend.yml` — Deploy to Netlify

Deploys to a **preview** environment on merge to `develop`, and **production** on merge to `main`.

```yaml
name: Deploy Frontend

on:
  push:
    branches: [develop, main]
    paths:
      - 'frontend/**'
      - '.github/workflows/deploy-frontend.yml'

jobs:
  deploy:
    name: Deploy to Netlify
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_API_URL: ${{ github.ref == 'refs/heads/main' && secrets.PROD_API_URL || secrets.STAGING_API_URL }}

      - name: Deploy to Netlify (preview)
        if: github.ref == 'refs/heads/develop'
        uses: nwtgck/actions-netlify@v3
        with:
          publish-dir: frontend/.next
          github-token: ${{ secrets.GITHUB_TOKEN }}
          deploy-message: "Preview deploy: ${{ github.sha }}"
          enable-pull-request-comment: true
          enable-commit-comment: false
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}

      - name: Deploy to Netlify (production)
        if: github.ref == 'refs/heads/main'
        uses: nwtgck/actions-netlify@v3
        with:
          publish-dir: frontend/.next
          production-deploy: true
          github-token: ${{ secrets.GITHUB_TOKEN }}
          deploy-message: "Production deploy: ${{ github.sha }}"
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

> Netlify requires `@netlify/plugin-nextjs` in `frontend/netlify.toml` for App Router support. Create it if missing:
> ```toml
> [[plugins]]
> package = "@netlify/plugin-nextjs"
> ```

---

## 3. `.github/workflows/deploy-backend.yml` — Deploy to Render

Triggers a Render deploy hook on merge to `develop` (staging service) or `main` (production service).

```yaml
name: Deploy Backend

on:
  push:
    branches: [develop, main]
    paths:
      - 'backend/**'
      - '.github/workflows/deploy-backend.yml'

jobs:
  deploy:
    name: Deploy to Render
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Render deploy
        run: |
          if [ "${{ github.ref }}" = "refs/heads/main" ]; then
            DEPLOY_HOOK="${{ secrets.RENDER_DEPLOY_HOOK_PROD }}"
          else
            DEPLOY_HOOK="${{ secrets.RENDER_DEPLOY_HOOK_STAGING }}"
          fi
          curl -s -X POST "$DEPLOY_HOOK" | jq .

      - name: Wait for deploy to complete
        run: |
          if [ "${{ github.ref }}" = "refs/heads/main" ]; then
            SERVICE_ID="${{ secrets.RENDER_SERVICE_ID_PROD }}"
          else
            SERVICE_ID="${{ secrets.RENDER_SERVICE_ID_STAGING }}"
          fi
          echo "Deploy triggered for service $SERVICE_ID. Monitor at https://dashboard.render.com"
```

> Render deploy hooks are found in the Render dashboard under your service → Settings → Deploy Hook.

---

## 4. Update `.github/workflows/pr-notification.yml`

Ensure the PR notification workflow exists (created by `/deploy` on first run). No changes needed here.

---

## After creating all files

Commit and push:
```bash
git add .github/
git commit -m "ci: add GitHub Actions workflows for CI, Netlify, and Render"
git push
```

Then tell the user exactly which GitHub repository secrets to configure:

### Required secrets (Settings → Secrets and variables → Actions)

| Secret | Description |
|---|---|
| `NETLIFY_AUTH_TOKEN` | Netlify personal access token (netlify.com → User settings → Personal access tokens) |
| `NETLIFY_SITE_ID` | Netlify site ID (Site settings → General → Site ID) |
| `STAGING_API_URL` | FastAPI backend URL for staging (e.g. `https://myapp-staging.onrender.com`) |
| `PROD_API_URL` | FastAPI backend URL for production |
| `RENDER_DEPLOY_HOOK_STAGING` | Render deploy hook URL for staging service |
| `RENDER_DEPLOY_HOOK_PROD` | Render deploy hook URL for production service |
| `RENDER_SERVICE_ID_STAGING` | Render service ID for staging |
| `RENDER_SERVICE_ID_PROD` | Render service ID for production |
| `TEST_DATABASE_URL` | Database URL for test runs (use a separate test DB) |
| `NOTIFY_SMTP_HOST` | SMTP server for PR email notifications |
| `NOTIFY_SMTP_PORT` | SMTP port |
| `NOTIFY_EMAIL_USER` | Sender email |
| `NOTIFY_EMAIL_PASSWORD` | Sender email password or app password |
| `NOTIFY_EMAIL_RECIPIENT` | Notification recipient email |
