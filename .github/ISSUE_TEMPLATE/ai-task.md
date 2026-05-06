---
name: AI Task
about: Structured issue template for AI/Codex-executed tasks
title: "[AI Task] "
labels: ["ai-task"]
assignees: []
---

## Objective
Describe the exact outcome required.

## Background / Context
Provide business and technical context needed for safe execution.

## Scope
- In scope:
- Out of scope:
- MVP must-have scope (Issue #1):

## Constraints
- [ ] Keep implementation strictly within MVP scope for Issue #1.
- [ ] Do not modify unrelated source files.
- [ ] Do not introduce schema migrations unless explicitly requested.
- [ ] Do not create app pages/views unless explicitly requested.
- [ ] Respect repository file size rules (Page <= 150, Component <= 200, Hook <= 100, API route <= 80, Type <= 150/domain, SQL migration <= 300).
- [ ] Respect import rules and import direction boundaries (`shared/` vs `features/`).
- [ ] Respect KaonA Agri role model (farmer, leader, inspector, truck_owner, staff, admin, service_account).
- [ ] Respect field data rules (required photo metadata, record attribution metadata, Citizen ID masking).

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2
- [ ] Criteria 3

## Deliverables
List exact files or artifacts expected.

## AI/Codex Task Rules
- Keep changes minimal and directly tied to scope.
- Prefer deterministic edits over broad generation.
- Document assumptions explicitly in PR.
- If requirements conflict, prioritize explicit issue instructions.
- Stop and report if task requires privileged data or missing decisions.

## Validation Steps
Include lint/test/manual checks expected before completion.

## Definition of Done
- [ ] All acceptance criteria met.
- [ ] PR checklist fully completed.
- [ ] No out-of-scope modifications.
