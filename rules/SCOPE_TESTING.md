# Applicability and scope testing

Your workbook separates provisions by **`scope_tag`** (see `schemas/legend.json`):

- **MATERIAL** — does the situation fall within what the law regulates (what)?
- **TERRITORIAL** — is there a jurisdictional link to the EU (where)?
- **TEMPORAL** — is the instrument in force for this assessment (when)?
- **EXCLUSION** — hard carve-out: when true, the law does not apply to the scenario.

**ORCHESTRATION** rows in the legend are the rules that combine these dimensions (your spreadsheet’s `applies/3`-style conclusions).

## What the repo does today

- **`rules/golden/scope_applicability.dl`** — minimal **orchestration** used in tests and `POST /api/reason` with `profile: "scope_applicability"`:  
  `law_applies(C,R)` iff material ∧ territorial ∧ temporal ∧ ¬`exclusion_holds(C,R)`.
- **`tests/fixtures/scope/*.json`** — canned cases: EU processing + in-force law, missing territorial link, exclusion blocks.
- **`schemas/articles_rules.json`** — each real rule row has `scope_tag`; future work is to **compile** rows into Soufflé (or generate facts) **per tag**, then merge into one orchestration program instead of this toy.

## Better test environment (recommended practice)

1. **Add one JSON fixture per scenario** under `tests/fixtures/scope/` (facts + `expect_verdict` + optional notes).
2. **Parametrize pytest** over those files so every scenario runs validation + Soufflé when installed.
3. **Grow `scope_applicability.dl`** only when a batch of real `datalog_rule` cells for ORCHESTRATION / a given `scope_tag` is ready — or generate `.dl` from Excel export and `.include` fragments by tag.
4. **Neo4j**: use playbook + legal retrieval to **emit** the extensional predicates (`processing_personal_data`, `territorial_link_eu`, …) that feed the same predicate names the engine expects.

Re-export rules after Excel changes: `make export-rules`.
