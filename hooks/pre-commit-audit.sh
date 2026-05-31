#!/usr/bin/env bash
# Nexus pre-commit: arch-audit (N1–N5). Source: scripts/arch-audit.sh.
exec bash "$(git rev-parse --show-toplevel)/scripts/arch-audit.sh"
