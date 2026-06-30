---
applyTo: "**/*.{cls,trigger,js,html,css,xml,json,yaml,yml,md}"
---

# Salesforce development guidance

Use this project as a Salesforce DX workspace with standard metadata under force-app/main/default.

## Apex
- Write bulk-safe Apex and avoid SOQL, DML, or callouts inside loops.
- Use meaningful class and method names and keep logic testable.
- Add or update Apex tests for every new behavior and aim for realistic assertions.

## LWC
- Use Lightning Web Components patterns and SLDS markup.
- Keep component logic simple, reusable, and accessible.
- Prefer public properties and methods that are clearly documented.

## Flow and automation
- Favor declarative automation for simple business rules.
- Use Apex only where flow limitations require custom logic.
- Keep flows readable and avoid unnecessary complexity.

## Validation
- Run linting and unit tests when changing JS or LWC code.
- Run relevant Apex tests and deployment checks for Apex and metadata changes.
