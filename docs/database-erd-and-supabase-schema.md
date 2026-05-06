# Database ERD + Supabase Schema (Issue #2 + Issue #16)

## Purpose
Define and harden an MVP-ready relational schema for KaonA Agri LINE Mini App on Supabase (PostgreSQL), aligned to the approved MVP scope, workflows, entities, and role model.

## ERD (Mermaid)
```mermaid
erDiagram
    members ||--o{ member_roles : has
    members ||--o{ approvals : submits
    members ||--o{ plots : owns
    members ||--o{ planting_cycles : creates
    members ||--o{ seed_orders : requests
    members ||--o{ no_burn_requests : submits
    members ||--o{ inspections : performs
    members ||--o{ photos : uploads
    members ||--o{ notifications : receives

    plots ||--o{ planting_cycles : contains
    plots ||--o{ photos : documented_by

    planting_cycles ||--o{ seed_orders : supports
    planting_cycles ||--o{ no_burn_requests : applies_to

    no_burn_requests ||--o{ inspections : inspected_by
    no_burn_requests ||--o{ photos : evidenced_by

    inspections ||--o{ photos : attachment

    members {
      uuid id PK
      uuid auth_user_id UK_nullable
      text line_user_id UK
      text citizen_id_masked
      text full_name
      text phone
      text status
      timestamptz created_at
      timestamptz updated_at
    }

    member_roles {
      uuid id PK
      uuid member_id FK
      text role
      boolean is_primary
      timestamptz created_at
    }

    approvals {
      uuid id PK
      uuid member_id FK
      uuid requested_by FK
      uuid reviewed_by FK_nullable
      text resource_type
      uuid resource_id nullable
      text status
      text note
      timestamptz created_at
      timestamptz updated_at
    }

    plots {
      uuid id PK
      uuid member_id FK
      text name
      numeric area_rai
      numeric lat
      numeric lng
      numeric accuracy
      text status
      uuid created_by FK
      text role_used
      timestamptz timestamp
      timestamptz created_at
      timestamptz updated_at
    }
```

## Schema Hardening Added in Issue #16
- Added explicit status constraints across workflow tables (`members`, `approvals`, `plots`, `planting_cycles`, `seed_orders`, `no_burn_requests`, `inspections`, `notifications`).
- Added domain/resource integrity constraints for `approvals.resource_type`.
- Added one-primary-role uniqueness per member via partial unique index on `member_roles(member_id) where is_primary=true`.
- Added latitude/longitude range constraints on `plots` and `photos`.
- Added temporal consistency constraints for planting and inspection timelines.
- Added additional workflow/read indexes to support status-based and relation-based querying.

## Design Notes
- Uses UUID primary keys on all domain tables.
- Stores only masked citizen ID in the main member table for normal operational access.
- Normalizes multi-role users through `member_roles` to support farmer + leader scenarios.
- Tracks workflow status fields on request/approval entities for lifecycle progression.
- Preserves field/photo attribution metadata required by coding rules (`created_by`, `role_used`, `timestamp`, `uploaded_by`, geo metadata).
- Keeps RLS policies in place from Issue #10 migration.

## Supabase/PostgreSQL DDL
- Base schema: `supabase/migrations/202605060001_issue_2_schema.sql`
- RLS + updated_at triggers: `supabase/migrations/202605060002_issue_10_rls_and_updated_at.sql`
- MVP schema hardening: `supabase/migrations/202605060003_complete_mvp_sql_schema.sql`

## Migration Scope Notes
1. This migration is additive only (no rewrites of previous migrations).
2. This migration does not remove or modify existing RLS policy behavior.
3. This migration introduces only constraint/index hardening for MVP data correctness and queryability.
