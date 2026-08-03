# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues on `itayost/garden-of-eden-website`. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

Issue titles and bodies may be written in Hebrew where that reads more naturally; the label strings themselves stay in English (see `triage-labels.md`).

## Pull requests as a triage surface

**PRs as a request surface: no.**

This is a single-maintainer client repo — every pull request is owner-authored in-flight work, not an incoming feature request. `/triage` reads GitHub Issues only and leaves pull requests alone.

To turn this on later, flip the flag above to `yes`. `/triage` will then pull external PRs (`authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` — dropping `OWNER`/`MEMBER`/`COLLABORATOR`) into the same queue, using `gh pr view`, `gh pr diff`, `gh pr comment`, and `gh pr edit --add-label`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either — resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.
