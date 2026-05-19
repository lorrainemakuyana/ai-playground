---
name: deploy
description: Deploy a feature by pushing the branch, creating a GitHub PR, and sending an email notification. Use when a feature is tested and ready for review.
disable-model-invocation: true
---

You are a deployment assistant. Follow these steps in order.

## 0. First-time setup check

If `.github/workflows/ci.yml` does not exist, stop and tell the user to run `/setup-cicd` first before deploying.

## 1. Pre-flight checks

```bash
git status
```

- If there are uncommitted changes, stop and ask the user to commit or stash them first.
- Confirm with the user that `/test` has been run and passed.

## 2. Push branch

```bash
git push -u origin HEAD
```

## 3. Create Pull Request

Generate a PR title from the feature name and a description using `PLAN.md` if it exists. Then:

```bash
gh pr create --base develop --title "<title>" --body "$(cat <<'EOF'
## Summary
<bullet points from PLAN.md goal and user stories>

## Changes
### Frontend (Next.js)
- <list key frontend changes>

### Backend (FastAPI)
- <list key backend changes>

## Test plan
- [ ] Unit/integration tests pass (`/test`)
- [ ] Acceptance criteria verified (see PLAN.md)
- [ ] No TypeScript errors (`npx tsc --noEmit`)

🤖 Generated with [Claude Code](https://claude.ai/code)
EOF
)"
```

## 4. Get the PR URL

```bash
gh pr view --json url,title -q '"Title: \(.title)\nURL: \(.url)"'
```

## 5. Ensure PR notification workflow exists

Check whether `.github/workflows/pr-notification.yml` exists. If it does not, create it:

```yaml
name: PR Notification

on:
  pull_request:
    types: [opened]
    branches:
      - develop

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Send email notification
        uses: dawidd6/action-send-mail@v3
        with:
          server_address: ${{ secrets.NOTIFY_SMTP_HOST }}
          server_port: ${{ secrets.NOTIFY_SMTP_PORT }}
          username: ${{ secrets.NOTIFY_EMAIL_USER }}
          password: ${{ secrets.NOTIFY_EMAIL_PASSWORD }}
          subject: "PR Ready for Review: ${{ github.event.pull_request.title }}"
          to: ${{ secrets.NOTIFY_EMAIL_RECIPIENT }}
          from: ${{ secrets.NOTIFY_EMAIL_USER }}
          body: |
            A new pull request is ready for review.

            Title:  ${{ github.event.pull_request.title }}
            URL:    ${{ github.event.pull_request.html_url }}
            Author: ${{ github.event.pull_request.user.login }}
            Branch: ${{ github.event.pull_request.head.ref }} → ${{ github.event.pull_request.base.ref }}

            GitHub Actions CI is running automatically on this PR.
```

If the workflow file was just created, commit and push it before creating the PR:
```bash
git add .github/workflows/pr-notification.yml
git commit -m "ci: add PR email notification workflow"
git push
```

Remind the user to configure these GitHub repository secrets if not already set:
- `NOTIFY_SMTP_HOST` — SMTP server (e.g. `smtp.gmail.com`)
- `NOTIFY_SMTP_PORT` — SMTP port (e.g. `465`)
- `NOTIFY_EMAIL_USER` — sender email address
- `NOTIFY_EMAIL_PASSWORD` — sender email password or app password
- `NOTIFY_EMAIL_RECIPIENT` — recipient email address

## 6. GitHub Actions CI

GitHub Actions triggers automatically on PR creation. Confirm the workflow is running:

```bash
gh pr checks --watch
```

## 7. Report to user

Summarize:
- PR URL and title
- CI check status
- Whether the email notification was sent successfully
