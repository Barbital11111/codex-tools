# AGENTS.md

## Project

Codex Tools is a React + Tauri desktop console for managing Codex accounts, usage, account switching, local API proxying, remote proxy deployment, and related settings.

## Local Path And Privacy Rules

- Do not commit local absolute paths, usernames, machine-specific directories, auth files, tokens, account labels, emails, API keys, or generated runtime data.
- Use repo-relative paths such as `src/App.tsx` or placeholders such as `<repo-root>/src/App.tsx`.
- Keep local workflow state, `.dev-runtime/`, build outputs, and local implementation notes untracked.
- Treat `.dev-runtime/` as sensitive local data.

## Mandatory Pre-Push Privacy Gate

- Before every `git push`, release publish, tag push, or force push, run a multi-agent privacy review and block the push until it passes.
- Use at least three independent review lanes: one agent/check for current tracked content and staged diff, one for Git history and refs, and one for docs, release assets, generated files, and ignored local artifacts.
- The review must search for local paths, usernames, account labels, emails, API keys, auth tokens, private keys, generated runtime data, local workflow state, `.dev-runtime/`, `target/`, release scratch files, and any project-specific private domains.
- Treat any hit as a stop condition until it is explained as a safe placeholder or removed. Do not push with unresolved privacy findings.
- After fixes, rerun the full multi-agent privacy review. A single local grep is not enough for push approval.
- Record the privacy gate result in the final handoff or release note summary for that push.

## Development Notes

- Frontend: React + TypeScript + Vite.
- Backend: Tauri 2 + Rust.
- Prefer small, focused changes and verify with `npm run lint -- --max-warnings=0`, `npx tsc --noEmit`, and `cargo check` when relevant.
- Do not revert unrelated user changes in a dirty worktree.
