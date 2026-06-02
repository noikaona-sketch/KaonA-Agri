# Failed legacy migrations

These migration files are intentionally preserved here instead of being deleted.
They previously lived in `supabase/migrations`, but they are not runnable against
the currently deployed legacy schema because they target newer table names or
assume objects that are not present when Supabase replays migrations in order.

They are superseded by the runnable recovery migration:

- `supabase/migrations/202606040003_recover_failed_schema_migrations.sql`

Keep these files out of `supabase/migrations` so the migrations directory only
contains migrations that can be replayed. Use the recovery migration above for
the deployed-schema-compatible replacements.

## Files moved here

- `202605290001_no_burn_timing.sql` — superseded by recovery logic that adds
  timing to `public.no_burn_applications` when present.
- `202605290002_inspection_gps_columns.sql` — superseded by recovery logic that
  adds GPS submission columns to `public.field_inspections` when present.
- `202605290003_farm_activity_logs.sql` — superseded by recovery logic that
  creates or repairs `public.farm_activity_logs` using the current legacy owner
  table.
- `202605310001_crop_care_schedule.sql` — superseded by recovery logic that
  creates crop-care defaults, seed-variety schedules, and farm activity reminder
  fields safely.
- `202605310002_update_corn_care_schedule.sql` — preserved with the legacy crop
  care schedule updates, but kept out of the runnable migration chain because it
  depends on the failed legacy crop-care migration ordering.
