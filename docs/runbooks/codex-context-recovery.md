# Codex Context Recovery

Use this runbook to avoid losing execution state when Codex disconnects.

## 1) Start auto-guard

```bash
bin/codex-context-guard-up.sh 90
```

- Takes an automatic context snapshot every 90 seconds.
- Stores snapshots under `state/memory/codex_context/`.

## 2) Manual freeze before risky work

```bash
bin/codex-context-freeze.sh "what changed and what is next"
```

## 3) Resume after reconnect

```bash
bin/codex-context-resume.sh
```

Use the `Fast Resume Prompt` from `latest.md` in the next Codex session.

## 4) Stop auto-guard

```bash
bin/codex-context-guard-down.sh
```

## Files

- `state/memory/codex_context/latest.md` (current state)
- `state/memory/codex_context/context_*.md` (history)
- `state/memory/codex_context/guard.log` (guard activity)
- `state/memory/codex_context/guard.pid` (guard process)
