# Coding Rules

## Scope
These rules apply to all code contributions in this repository until superseded by a future governance update.

## File Size Rules
- **Target file size:** Keep files under **300 lines** where practical.
- **Soft limit:** Files over **500 lines** should be refactored when touched.
- **Hard limit:** Do not introduce new files over **800 lines** unless explicitly approved in the PR description.
- Split large modules by feature/domain responsibility instead of by arbitrary naming.

## Function & Component Size Rules
- Prefer functions under **60 lines**.
- If a function exceeds **100 lines**, extract helper functions.
- UI components should be focused and ideally under **200 lines** (excluding formatting-only markup when unavoidable).

## Import Rules
- Use **absolute imports** via project aliases when configured; avoid deep relative traversal such as `../../../../`.
- Group imports in this order, with a blank line between groups:
  1. External libraries
  2. Internal modules (aliases)
  3. Relative imports
  4. Type-only imports (if language/framework supports)
- Remove unused imports before submitting a PR.
- Avoid circular dependencies between modules.
- Do not use wildcard imports (`*`) unless required by framework convention.

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
