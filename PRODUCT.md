# FetchLab Product Contract

## Product definition

- **Primary user:** An AI platform engineer or workflow owner preparing a tool-using AI system for production.
- **Moment of use:** A prompt, model, tool, permission, policy, or code change is ready for review.
- **Job:** Prove how the candidate changes external actions, decide which actions require approval, and publish a deterministic release policy.
- **Current alternative:** Combine traces, spreadsheets, eval dashboards, security review, cloud policy engines, and CI scripts. The evidence is fragmented and the approved behavior is rarely bound to the policy that runs.
- **Reason to return:** Every material AI change gets a behavior and authority review before release.
- **Counterfactual:** The current worksheet can be replaced by documents. The product becomes essential only when evidence, review, publication, and runtime decisions are one closed loop.

## First working slice

FetchLab is the change gate for AI systems that act through tools and APIs.

One complete path:

1. A workspace owner defines structured action rules.
2. The owner publishes an immutable policy revision.
3. An agent submits a real action attempt through the FetchLab decision API.
4. FetchLab returns `allow`, `require_approval`, or `deny` with the exact policy revision and reason.
5. Actions requiring approval wait for a workspace reviewer.
6. Approval is bound to the exact action payload and can be consumed once.
7. Every decision is stored as evidence.
8. A draft policy is replayed against stored evidence and exposes every authority expansion before publication.
9. The owner can publish only after required reviews are resolved.

## Deliberate exclusions

- FetchLab does not build or host the agent.
- FetchLab does not use an LLM to make authorization decisions.
- FetchLab does not infer that a successful HTTP response means the business outcome succeeded.
- Synthetic or sample events never count as production evidence.
- A JSON export is not described as enforcement unless a runtime used it to make a decision.
- Prompt quality, answer quality, and generic model benchmarking remain advanced tools, not the primary product path.

## Core objects

### Action attempt

An action attempt records:

- workspace and study
- agent and session identity
- tool name
- operation (`read`, `write`, `delete`, `execute`, or `unknown`)
- target resource
- arguments
- reversibility
- request timestamp

Arguments may contain sensitive data. Sensitive values are encrypted at rest and omitted from audit summaries.

### Policy rule

A rule has:

- stable ID and name
- effect (`allow`, `require_approval`, or `deny`)
- enabled state
- tool pattern
- operation
- target pattern
- zero or more typed argument constraints

Rules are deterministic. Deny wins over approval, and approval wins over allow. An unknown action defaults to deny.

### Policy revision

A published revision is an immutable snapshot with:

- monotonically increasing revision number
- canonical policy fingerprint
- publisher identity
- publication timestamp
- prior revision fingerprint

Runtime checks use only a published revision. Editing a draft cannot silently alter production behavior.

### Decision event

Every valid runtime check produces an append-only event with:

- canonical action hash
- policy revision and fingerprint
- decision and matched rule
- enforcement mode
- reason
- review and consumption state

### Authority diff

FetchLab replays stored real events through the published and draft policies.

- `expansion`: a previous deny becomes approval or allow, or approval becomes allow
- `restriction`: allow becomes approval or deny, or approval becomes deny
- `unchanged`: both policies return the same decision

Every expansion must be reviewed before publication. Restrictions remain visible but do not require an expansion approval.

## System guarantees

### Draft and publication

- Draft edits are saved independently from the published revision.
- Publishing requires the last-seen revision. A stale browser tab receives `409 Conflict` and cannot overwrite a newer publication.
- Publication is rejected when there is no enabled rule, an unresolved authority expansion, or an invalid rule.
- Publication creates an audit event containing fingerprints, counts, and publisher identity, never raw action arguments.

### Runtime decision

- Invalid input returns `400` and creates no evidence event.
- Missing or revoked credentials return `401`.
- A token cannot address another workspace.
- Missing study or published policy returns `404` or `409`; the service never invents a policy.
- Unknown actions return deny in enforcement mode.
- Shadow mode records the policy decision but returns `execute: true` so it cannot block traffic.
- Enforcement mode returns `execute: true` only for allow or a consumed exact-match approval.
- Policy evaluation performs no network or model calls.

### Human approval

- Only workspace members with member or admin role can review.
- Reviewers see the exact action packet, decision reason, policy revision, and sensitive-field redactions.
- A reviewer cannot approve a changed payload by reusing an event ID.
- Approval expires and can be consumed once.
- A denied or expired approval can never become executable without a new action attempt.

### Evidence

- Runtime events are append-only through product APIs.
- Review identity and timestamps are retained.
- Deleting a study requires admin-level intent and remains in the audit log.
- Sample data is visually and structurally separate from real evidence.

## Experience states

### Empty workspace

Show one path: define the first rule, publish it, then send a real test action. Do not populate fake metrics.

### Invalid rule

Show the exact field and reason. Keep the previous published revision active.

### No server or database

Local mode can build policies, paste action JSON, replay evidence stored on the device, and export artifacts. It clearly states that no shared runtime endpoint, team approval, or server enforcement exists.

### Slow or unavailable server

The UI preserves the draft, shows the last confirmed publication, and never claims a save or approval succeeded. Runtime clients must treat transport failure according to their configured fail-open or fail-closed policy; FetchLab recommends fail-closed for state-changing actions.

### Close, gate switching, and reload

An encrypted recovery copy preserves an unsaved draft across reload. Closing the gate or switching to another gate asks for confirmation while a draft is dirty.

### Two browser tabs

Both may edit drafts. Only the tab holding the latest published revision may publish. The stale tab must refresh and review the newer diff.

## Release acceptance path

The first slice is done only when these paths are exercised twice:

1. Publish a policy, submit an allowed action, and receive an executable decision tied to that revision.
2. Submit an approval action, approve it, consume it once, and prove the second consumption fails.
3. Submit an unknown state-changing action and prove it is denied.
4. Change a rule so a denied historical action becomes allowed, see the authority expansion, and block publication until review.
5. Attempt stale publication from a second revision and receive a conflict.
6. Repeat locally without a database and verify that the UI does not claim server enforcement.

## Success metric

The first product metric is not account creation or studies created. It is:

> Percentage of material agent changes that reach a reviewed release decision using real action evidence.

Secondary measures are time to decision, unreviewed authority expansions found before release, approval latency, and policy violations prevented.
