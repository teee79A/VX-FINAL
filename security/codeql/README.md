# CodeQL Gate

`Kitty Governance CI` runs CodeQL with the `security-and-quality` suite on every push and pull request.

This gate is mandatory and complements Semgrep:

- Semgrep enforces explicit KITTY law patterns (module boundary and import bans).
- CodeQL enforces semantic security/data-flow analysis.

No module should bypass command-bus authority, execute directly, or import raw DB clients.
