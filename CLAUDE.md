# Project Rules

## Rule nbr15: File Size & Commit Audit

1. **No file over 150 lines.** If any source file exceeds 150 lines, refactor it before committing (split into modules, extract helpers, etc.).
2. **Pre-commit audit.** Run the line-count audit hook before every commit to catch violations. The hook is at `hooks/pre-commit-audit.sh`.
