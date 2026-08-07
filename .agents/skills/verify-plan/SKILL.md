---
name: verify-plan
description: Interview the user to verify, grill, and stress-test a plan, decision, or idea before acting on it.
disable-model-invocation: true
---

# Verify Plan

## Purpose

Interview the user rigorously about a plan, decision, or idea until there is shared understanding. Stress-test assumptions, resolve dependencies between decisions, and explore every branch that could materially affect feasibility, risk, or execution.

Be thorough without interrogating the user about immaterial details.

## When to Use

Use this skill when the user wants to verify, validate, grill, stress-test, review, or think through a plan, decision, idea, implementation approach, architecture, product direction, or tradeoff.

Trigger phrases include, but are not limited to:

- "verify this plan"
- "verify plan"
- "stress-test this"
- "think this through"
- "challenge this idea"
- "is this a good plan?"
- "review my approach"
- "validate this decision"
- "help me decide"
- "grill this"
- "grill me"
- "grill this plan"
- "poke holes in this"
- "play devil's advocate"

## Core Behavior

- Investigate discoverable facts before questioning the user.
- Ask only questions whose answers could materially change the plan, its feasibility, its risks, or its execution.
- Group related, sufficiently independent questions into small batches of normally 3–5 questions.
- Ask a single question when its answer gates or could invalidate subsequent questions.
- Never ask the entire decision tree at once.
- For every question, provide a recommended answer, brief rationale, confidence level, and main tradeoff.
- Wait for the user's response after each batch before continuing.
- Resolve dependencies and contradictions before moving to dependent branches.
- Do not act on the plan until the user confirms shared understanding and explicitly authorizes action.

## Research Before Asking

If a fact can be found by exploring the environment, look it up instead of asking the user.

Examples:

- Inspect files, project structure, configuration, tests, documentation, package files, or existing code.
- Use available tools to verify implementation details.
- Search repository content and available documentation.

Keep research proportional to the decision. Only ask the user for decisions, preferences, priorities, constraints, or tradeoffs that cannot be determined from the environment.

If a fact cannot be verified, identify it as an unknown or assumption rather than disguising it as a decision. Read-only investigation is allowed before confirmation. Do not make persistent changes, run mutating commands, implement the plan, or cause external side effects.

## Decision Management

Maintain a concise working decision ledger containing:

- discovered facts;
- assumptions and unknowns;
- resolved and unresolved decisions;
- dependencies between decisions;
- risks and mitigations;
- rejected alternatives and their rationale.

Use the ledger to determine the next highest-leverage question or batch. It does not need to be shown after every exchange.

If a new answer conflicts with an earlier decision, surface the conflict immediately. Revisit that decision and every dependent conclusion before continuing.

## Question Format

Use this format for a batch:

```markdown
## Batch N: <topic>

1. <single focused question>
   - Recommended answer: <recommended decision>
   - Rationale: <brief reasoning>
   - Confidence: <high, medium, or low>
   - Main tradeoff: <what the recommendation sacrifices>

2. <single focused question>
   - Recommended answer: <recommended decision>
   - Rationale: <brief reasoning>
   - Confidence: <high, medium, or low>
   - Main tradeoff: <what the recommendation sacrifices>

Please answer by number. You can accept a recommendation with “1: agree.”
```

Ask only one question when it gates later decisions. Use the same recommendation fields, but omit the batch framing if unnecessary.

When evidence is insufficient, the recommended answer may be to defer the decision until a named fact or prerequisite is known.

## Process

1. Identify the plan, decision, or idea being verified.
2. Gather discoverable facts through read-only investigation.
3. Establish the objective and success criteria.
4. Create a working decision ledger and dependency tree.
5. Ask the highest-leverage gating question alone, if one exists.
6. Otherwise, ask a coherent batch of 3–5 related questions that can be answered independently.
7. Incorporate the answers and identify contradictions, changed assumptions, and affected dependencies.
8. Resolve conflicts before exploring dependent branches.
9. Repeat until no unresolved decision could materially change the plan, its feasibility, or its principal risks.
10. Summarize the shared understanding and ask for explicit confirmation and authorization before acting.

## Completion Criteria

The interview is complete when, where applicable:

- the objective and success criteria are explicit;
- constraints and priorities are understood;
- major assumptions have been tested or recorded as unknowns;
- material risks, failure modes, and mitigations have been addressed;
- key tradeoffs have been decided;
- ownership, sequencing, and rollback are understood;
- no unresolved decision could materially change the plan.

Do not prolong the interview for immaterial details.

## Final Summary

Summarize:

- the objective and success criteria;
- the agreed plan;
- important decisions and rationale;
- known facts, assumptions, and unknowns;
- risks and mitigations;
- unresolved questions;
- rejected alternatives;
- ownership, sequencing, rollback, and next actions where applicable.

Then request explicit confirmation and authorization:

```markdown
I think we have reached shared understanding. Does this summary match your intent, and should I act on this plan now?
```

Do not edit files, run mutating commands, implement the plan, or cause external side effects until the user explicitly confirms both shared understanding and authorization to act.
