# Coding Rules

## Scope
These rules apply to all code contributions in this repository until superseded by a future governance update.

## File Size Rules
- **Page file:** must be **<= 150 lines**.
- **Component file:** must be **<= 200 lines**.
- **Hook file:** must be **<= 100 lines**.
- **API route file:** must be **<= 80 lines**.
- **Type file:** must be **<= 150 lines per domain**.
- **SQL migration file:** must be **<= 300 lines**; split into multiple migrations if larger.

## Import Rules
- Use absolute imports via project aliases when configured; avoid deep relative traversal such as `../../../../`.
- Group imports in this order, with a blank line between groups:
  1. External libraries
  2. Internal modules (aliases)
  3. Relative imports
  4. Type-only imports (if language/framework supports)
- Remove unused imports before submitting a PR.
- Avoid circular dependencies between modules.
- Do not use wildcard imports (`*`) unless required by framework convention.

## Import Direction Rules
- `shared/` **must not** import from `features/`.
- `features/` **may** import from `shared/`.
- One feature **must not** import another feature directly.
- If logic is used by more than 2 features, move it to `shared/`.

## Field Data Rules
- OCR outputs must not store full citizen ID plaintext; keep masked values and/or irreversible hashes only.
- OCR/manual fallback workflow must preserve review status and reviewer audit fields.
- GPS evidence moderation must track source, verification state, and evidence review status.
- MVP geospatial model is point coordinates only; polygon/geofence logic is Phase 2 scope.
- Photo records must include: `lat`, `lng`, `accuracy`, `captured_at`, `uploaded_by`.
- Field records must include: `created_by`, `role_used`, `timestamp`.
- Citizen ID must be masked in normal UI views and only shown in full where explicitly authorized.

## General Code Quality Rules
- Keep modules single-purpose and domain-oriented.
- Favor explicit naming over abbreviations.
- Add or update tests when business logic changes.
- Do not leave commented-out dead code in committed changes.
- Keep lint and formatter checks passing.

## AI/Codex Contribution Rules
- AI-generated code must follow all repository coding standards.
- AI-assisted PRs must include a short “AI usage note” in the PR body stating:
  - what was generated,
  - what was reviewed manually,
  - and any remaining risks.
- Never commit secrets, tokens, or generated placeholder credentials.
- Do not auto-generate large files without clear structure and review.

## Prohibited Changes Without Explicit Issue Scope
- No schema migrations unless issue explicitly requests them.
- No new app pages/views unless issue explicitly requests them.
- No broad refactors outside issue scope.
