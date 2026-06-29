# Pronto_L3

Salesforce DX project (`sfdx-project.json`, API version 66.0). Source lives under `force-app/main/default/` (classes, triggers, lwc, aura, objects, flexipages, permissionsets, tabs, layouts, applications, staticresources, contentassets).

## Salesforce skills

This project bundles the [forcedotcom/sf-skills](https://github.com/forcedotcom/sf-skills) library under `.claude/skills/` (87 skills). **Whenever a request involves Salesforce, you MUST check for a matching skill and invoke it before doing the work by hand** — each skill encodes platform conventions, validation rules, and scoring rubrics that hand-written output will miss. Match on the skill's `description` frontmatter; the table below is a quick index.

When more than one skill could apply, prefer the most specific one. If no skill fits, proceed normally.

### Platform metadata & code
| Task | Skill |
|------|-------|
| Apex classes, triggers, services, selectors, batch/queueable, REST | `platform-apex-generate` |
| Apex test classes & coverage | `platform-apex-test-generate` |
| Run Apex tests | `platform-apex-test-run` |
| Debug logs / governor limits / stack traces | `platform-apex-logs-debug` |
| SOQL queries | `platform-soql-query` |
| Data import/export/manipulation | `platform-data-manage` |
| Custom object | `platform-custom-object-generate` |
| Custom field | `platform-custom-field-generate` |
| Custom tab | `platform-custom-tab-generate` |
| Custom application | `platform-custom-application-generate` |
| Lightning page / FlexiPage | `platform-flexipage-generate` |
| List view | `platform-list-view-generate` |
| Validation rule | `platform-validation-rule-generate` |
| Sharing rules | `platform-sharing-rules-generate` |
| Permission set | `platform-permission-set-generate` |
| Custom Lightning Type (CLT) for agent actions | `platform-custom-lightning-type-generate` |
| Full Lightning app (multi-component) | `platform-lightning-app-coordinate` |
| Deploy metadata | `platform-metadata-deploy` |
| Retrieve metadata | `platform-metadata-retrieve` |
| Metadata API context | `platform-metadata-api-context-get` |
| Official Salesforce docs lookup | `platform-docs-get` |

### LWC, UI & design
| Task | Skill |
|------|-------|
| Lightning Web Components | `experience-lwc-generate` |
| Apply SLDS styling | `design-systems-slds-apply` |
| Validate SLDS | `design-systems-slds-validate` |
| Migrate to SLDS2 | `design-systems-slds2-migrate` |
| UI bundle apps (React) | `experience-ui-bundle-app-coordinate` + `experience-ui-bundle-*` family |
| CMS brand apply | `experience-cms-brand-apply` |
| Media search | `experience-content-media-search` |

### Automation, integration & eventing
| Task | Skill |
|------|-------|
| Flows (screen, record-triggered, scheduled) | `automation-flow-generate` |
| Integration architecture (Named/External Credentials, External Services, callouts) | `integration-connectivity-generate` |
| Connected App / External Client App OAuth | `integration-connectivity-connected-app-configure` |
| Change Data Capture | `integration-eventing-cdc-configure` |
| Platform Event subscriptions | `integration-eventing-subscription-configure` |

### Agentforce
| Task | Skill |
|------|-------|
| Build/modify agents (Agent Script) | `agentforce-generate` |
| Test agents | `agentforce-test` |
| Observe / trace agents | `agentforce-observe` + `platform-tracing-agentforce-configure` |
| Agent architecture analysis | `agentforce-architecture-analyze` |

### DevOps & org management
| Task | Skill |
|------|-------|
| Deploy/scratch orgs/sandboxes | `dx-org-manage` |
| Switch default org | `dx-org-switch` |
| Assign permission sets | `dx-org-permission-set-assign` |
| Run Code Analyzer | `dx-code-analyzer-run` |
| Test pipeline / suites / failures | `dx-devops-*` |

### Other domains
- **Data Cloud / Data 360**: `data360-*` (connect, prepare, harmonize, segment, activate, query, schema, orchestrate).
- **OmniStudio / Vlocity**: `omnistudio-*` (omniscript, flexcard, integration-procedure, datamapper, callable-apex, datapacks-deploy, dependencies-analyze, epc-catalog).
- **Commerce B2B**: `commerce-b2b-*`.
- **Mobile**: `mobile-*`.
- **Diagrams**: `external-diagram-mermaid-generate`, `external-diagram-visual-generate`.

Full skill set with detailed trigger descriptions lives in `.claude/skills/*/SKILL.md`.
