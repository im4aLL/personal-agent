---
name: verify-ticket
description: Review Jira tickets before implementation, identifying ambiguous or missing acceptance criteria.
disable-model-invocation: true
---

# Verify Ticket

## Purpose

Review a product ticket before developers begin work. Identify missing requirements, hidden assumptions, ambiguous acceptance criteria, edge cases, and implementation-impacting decisions. Produce a prioritized list of questions for Product, Design, Engineering, or other stakeholders so the ticket becomes implementation-ready.

This skill is intended primarily for JIRA tickets created by product stakeholders, but it applies equally to cards, stories, tasks, feature requests, and bug tickets.

## When to Use

Use this skill when the user asks to verify, validate, refine, review, challenge, or find gaps in a ticket, card, story, task, or acceptance criteria.

Trigger phrases include, but are not limited to:

- "verify this ticket"
- "verify ticket"
- "verify this card"
- "review this JIRA ticket"
- "find missing acceptance criteria"
- "is this story ready for development?"
- "refine this ticket"
- "what questions should developers ask?"
- "find gaps in this requirement"

## Required Input

The user should provide the ticket text, a readable ticket URL, or a file containing the ticket. A codebase path is optional.

If the ticket itself is unavailable, ask the user to provide it. Do not invent ticket details.

## Core Behavior

- Treat the ticket as incomplete until its behavior is precise, observable, and testable.
- Identify questions that must be answered before development begins.
- Focus on questions whose answers could change scope, architecture, UX, data, security, estimates, or testing.
- Separate genuinely unanswered decisions from facts discoverable in the supplied codebase.
- Do not ask stakeholders questions that can be answered confidently from code, tests, configuration, or documentation.
- Do not implement the ticket or modify the codebase unless the user separately asks for implementation.
- Do not silently turn assumptions into requirements.
- Produce the complete question list in one review rather than interviewing the user one question at a time.

## Codebase Investigation

When the user provides a codebase path:

1. Confirm that the path exists and identify the relevant project or package.
2. Read repository guidance and relevant documentation first.
3. Search for the feature area, routes, components, services, models, schemas, permissions, feature flags, analytics, and tests related to the ticket.
4. Trace current behavior far enough to understand integration points and established conventions.
5. Use existing tests to infer documented behavior, but flag conflicts between tests, code, and the ticket.
6. Record concise evidence using file paths and, when useful, symbols or line numbers.
7. Convert code findings into sharper ticket questions. For example, ask whether a new behavior should preserve an existing fallback rather than merely asking how the feature should work.

Keep investigation proportional. The goal is requirement discovery, not a full implementation plan or exhaustive code review.

If the supplied path is invalid or inaccessible, state that and continue with a ticket-only review if possible.

## Review Checklist

Evaluate only applicable areas, but do not skip an area merely because the ticket does not mention it.

### User and Business Outcome

- Target user, actor, and eligibility
- User problem and desired outcome
- Business rules and source of truth
- In-scope and explicitly out-of-scope behavior
- Definition of success

### Functional Behavior

- Trigger and prerequisites
- Happy path and alternate paths
- State transitions and lifecycle
- Defaults, ordering, filtering, pagination, and limits
- Duplicate, concurrent, repeated, or idempotent actions
- Dependencies on other features or systems

### UX and Content

- Entry points and discoverability
- Loading, empty, error, partial, and success states
- Validation and user-facing messages
- Responsive, accessibility, localization, timezone, and formatting expectations
- Design assets or copy that are still missing

### Data and Integrations

- Inputs, outputs, schemas, and validation
- Persistence, migration, backfill, retention, and deletion
- Ownership and source of truth
- API contracts, compatibility, retries, timeouts, and failure behavior
- Existing records and historical data

### Access and Risk

- Authentication, authorization, roles, and tenant boundaries
- Privacy, sensitive data, audit, and compliance requirements
- Abuse cases and security constraints
- Destructive actions and recovery behavior

### Delivery and Operations

- Feature flags, rollout, and rollback
- Analytics, audit events, logs, metrics, and alerts
- Performance and scale expectations
- Browser, device, platform, and version support
- Dependencies, release sequencing, and operational ownership

### Acceptance and Verification

- Observable pass/fail outcomes
- Testable acceptance criteria for happy paths and edge cases
- Regression expectations
- Required unit, integration, end-to-end, accessibility, or manual testing
- Definition of done and stakeholder sign-off

### Bug-Specific Checks

For bug tickets, also establish:

- Reproduction steps and reproducibility
- Expected versus actual behavior
- Affected environments, versions, users, and data
- Severity, frequency, and business impact
- Earliest known occurrence or suspected regression
- Evidence such as screenshots, logs, IDs, or traces
- Whether existing corrupted or inconsistent data must be repaired

## Question Quality Rules

Every question should:

- Address one decision or a tightly coupled decision set.
- Explain why the answer matters when the impact is not obvious.
- Be specific to the ticket and, when available, the codebase.
- Prefer bounded choices over vague prompts where sensible.
- Include a recommended answer when evidence or established conventions support one.
- Identify the best owner: Product, Design, Engineering, Security, Data, QA, or Operations.
- Avoid low-value questions that can safely be resolved during implementation without changing behavior or scope.

Bad:

```markdown
How should errors work?
```

Better:

```markdown
[P0 · Product] If submission succeeds in the billing service but the confirmation request times out, should the UI show the transaction as pending or failed? This determines whether users may retry and create a duplicate charge.
```

## Priority Levels

- **P0 — Blocking:** The answer can materially change scope, architecture, security, data integrity, core behavior, or the estimate. Development should not start without it.
- **P1 — Required:** Needed for complete, testable behavior, but some implementation discovery may proceed in parallel.
- **P2 — Clarification:** Improves completeness or consistency and can usually be resolved during development without major rework.

Do not inflate priority. Omit questions that have no meaningful effect on implementation or acceptance.

## Output Format

Use this structure:

```markdown
# Ticket Readiness Review

## Readiness
**Status:** Not ready | Ready with minor clarifications | Ready
**Summary:** <brief explanation of the largest gaps>

## Codebase Findings
- `<path or symbol>` — <relevant current behavior or constraint>

Omit this section when no codebase was supplied or no relevant findings were available.

## Questions to Answer Before Development

### P0 — Blocking
1. **[Owner] <question>**
   - Why it matters: <scope, behavior, risk, or implementation impact>
   - Recommended answer: <recommendation grounded in evidence, or "Product decision required">
   - Evidence: `<path/symbol>` or ticket wording, when applicable

### P1 — Required
...

### P2 — Clarifications
...

## Suggested Acceptance Criteria
- **Given** <precondition>, **when** <action>, **then** <observable result>.

Include only criteria supported by the ticket or clearly label them as proposed. Never present an unresolved product decision as agreed acceptance criteria.

## Existing Strengths
- <requirements already stated clearly and testably>
```

Omit empty priority sections. Keep questions deduplicated and order them by risk and dependency.

## Readiness Rules

Mark the ticket:

- **Not ready** when any P0 question remains or the core user outcome cannot be tested.
- **Ready with minor clarifications** when only P1/P2 questions remain and they are unlikely to cause major rework.
- **Ready** when behavior, boundaries, and observable acceptance criteria are sufficiently clear for development and testing.

Readiness is a requirements assessment, not an estimate of implementation difficulty.

## Completion Rule

End after presenting the readiness assessment, evidence, prioritized questions, and proposed acceptance criteria. Invite the user to provide stakeholder answers for a second pass, but do not begin implementation automatically.
