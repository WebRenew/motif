# Kaizen

## Agent Recommendations
- Add a `supabase/config.toml` with the linked project ref to avoid CLI link drift.
- Re-run `supabase db pull` after consolidation to confirm no diff.
- Investigate why `supabase db pull` exits non-zero with no diff.