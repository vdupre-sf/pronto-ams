---
applyTo: "**/*.{agent,md,yaml,yml,json,xml}"
---

# Agentforce Script guidance

When working on Agentforce Script or agent-related metadata:

- Favor clear, deterministic agent instructions over overly broad prompts.
- Define explicit goals, fallback behavior, and tool usage constraints.
- Keep agent actions scoped to the business use case and avoid ambiguous routing.
- Provide structured instructions for tool selection, error handling, and escalation paths.
- If the work touches agent bundles or authoring metadata, preserve the existing structure and naming conventions.
- Validate behavior with available preview, test, or deployment workflows when possible.
