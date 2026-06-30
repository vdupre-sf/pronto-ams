# Salesforce DX and Agentforce Copilot instructions

This workspace is a Salesforce DX project. When generating or changing metadata, follow these conventions:

- Keep changes aligned with the existing structure under force-app/main/default.
- Prefer metadata-first development and preserve deployable patterns for Apex, LWC, Flow, and agent-related metadata.
- For Apex, favor bulk-safe and governor-friendly code. Avoid SOQL or DML inside loops and add or update tests for new behavior.
- For Lightning Web Components, follow standard LWC patterns, use SLDS-friendly markup, and keep components reusable and accessible.
- For Flow and automation, prefer declarative automation when it fits the requirement; use Apex only when the logic is too complex or needs custom behavior.
- For Agentforce Script and agent metadata, keep instructions deterministic, grounded, and tool-aware. Define clear fallback behavior, guardrails, and state handling.
- Validate changes with the relevant checks such as npm run lint, npm run test:unit, and Apex test execution when appropriate.
- Prefer existing naming conventions and avoid unnecessary dependencies or custom architecture unless the user explicitly asks for it.
