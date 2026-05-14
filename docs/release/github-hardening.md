# GitHub Hardening Guide

Recommended repository settings for `warzone.gg`:

## Branch protection (`main`)

- Require pull request before merging.
- Require at least 1 approval.
- Require status checks to pass before merge.
- Require branches to be up to date before merge.
- Restrict who can push to `main`.
- Disallow force pushes.
- Disallow branch deletion.

## Security settings

- Enable secret scanning (if available on your plan).
- Enable push protection for secrets (if available).
- Enable Dependabot alerts and security updates.

## Workflow hygiene

- Use short-lived feature branches.
- Keep PRs focused and reviewable.
- Use PR templates for test and security checklist items.
