# FetchLab Product Contract

## Product definition

- **Primary user:** A product engineer, engineering lead, or technical founder responsible for an AI-enabled software product.
- **Moment of use:** A customer reports a problem, production behavior looks wrong, or a repeated request deserves a product change.
- **Job:** Turn real product evidence into a reviewable code change and prove whether the proposed change passed the repository's own checks.
- **Current alternative:** Manually join support tickets, analytics, error reports, a coding agent, GitHub, CI, and release review. Context is repeatedly rewritten and generated code is often presented before anyone has proved that it addresses the original problem.
- **Reason to return:** Every important product problem becomes a durable mission with evidence, an exact proposed change, human approval, and validation status in one place.
- **Counterfactual:** If FetchLab only summarizes issues or suggests code, a team can replace it with chat and a ticket. It becomes useful only when it closes the path from evidence to an approved, traceable, CI-verified pull request.

## First working slice

FetchLab is the product-engineering operator that turns one real customer issue into one reviewable pull request.

One complete path:

1. A workspace member creates a mission from a real customer problem and states the desired outcome.
2. The member identifies the repository and may provide a live or staging URL.
3. FetchLab records the evidence and performs a safe availability probe of the supplied URL. A successful probe is not described as reproducing the reported problem.
4. FetchLab reads a bounded repository tree, selects relevant source files, and prepares an exact file-level proposal.
5. The proposal includes the likely cause, acceptance criteria, risks, changed file contents, repository base commit, and a deterministic proposal fingerprint.
6. A member reviews the proposal and approves that exact fingerprint.
7. FetchLab refuses approval if the repository base branch changed after investigation.
8. FetchLab creates a new commit on a mission branch and opens a draft pull request. It never merges or deploys.
9. FetchLab reads the pull request's checks. It calls the mission verified only when at least one check exists and every required reported check has completed successfully.
10. Every mission transition is append-only evidence and every external action is written to the audit log.

## Deliberate exclusions

- FetchLab does not decide what product to build from anonymous market data in this slice.
- FetchLab does not continuously watch support, analytics, or error tools yet; evidence starts with a real issue supplied by a user.
- FetchLab does not execute customer repository code on the FetchLab server.
- FetchLab does not merge pull requests or deploy changes.
- FetchLab does not call a healthy URL a reproduced bug.
- FetchLab does not claim a code change is verified when a repository has no CI checks.
- The API client, agent authority gate, model tools, and protocol testers remain advanced instruments, not the primary product experience.

## Core objects

### Mission

A mission records:

- workspace and creator
- problem title and raw evidence
- desired user or business outcome
- repository and optional environment URL
- current status
- investigation, exact proposal, pull request, and validation result
- created and updated timestamps

### Investigation

An investigation records:

- repository and immutable base commit
- bounded repository paths considered
- files read for context
- optional environment availability result
- likely cause and uncertainties
- questions when the evidence is insufficient

### Proposal

A proposal records:

- concise summary and user impact
- likely root cause
- measurable acceptance criteria
- risks and manual review notes
- every file path and exact proposed content
- base commit and deterministic fingerprint

The fingerprint changes when any reviewed proposal content changes.

### Mission event

Mission events are append-only records of capture, investigation, proposal, approval, pull-request creation, validation, failure, or rejection. Event summaries never contain repository credentials or full proposed source files.

## System guarantees

### Capture and storage

- Invalid mission input returns a field-specific error and creates nothing.
- Workspace viewers can read missions but cannot create, investigate, approve, or reject them.
- Sensitive-looking values in persisted mission evidence are encrypted with the existing server encryption layer.
- A user can never read or mutate a mission from another workspace.
- Local mode stores mission drafts on the device and clearly states that repository investigation and pull-request execution require a signed-in server workspace.

### Investigation

- Repository credentials remain server-side and are never returned to the browser or sent to the model.
- Environment URLs are checked against the server's SSRF policy before a request is made.
- Repository context excludes secrets files, generated dependencies, binaries, and oversized files.
- Source sent to a configured model is bounded and obvious credential patterns are redacted.
- A missing model, inaccessible repository, insufficient evidence, invalid model response, or oversized proposal produces a visible blocked state instead of a fabricated result.

### Approval and GitHub

- Approval must include the exact current proposal fingerprint.
- A stale or altered fingerprint returns `409 Conflict`.
- The repository base branch must still point to the investigated commit. If it changed, approval returns `409 Conflict` and requires reinvestigation.
- Only paths shown in the approved proposal are written.
- Absolute paths, parent traversal, secret files, and CI workflow changes are rejected.
- FetchLab creates a dedicated branch and draft pull request. It never pushes to the default branch.
- Repeating approval cannot create a second change for the same mission.

### Validation

- Pending checks remain pending.
- Failed or cancelled checks mark validation failed.
- Zero checks means unverified, never passed.
- A mission becomes ready for human review only after one or more reported checks complete successfully.
- FetchLab reports GitHub's result; it does not claim those checks prove the business outcome by themselves.

## Experience states

### Empty workspace

Show one large mission composer with four concrete starting outcomes. Do not show fake missions, metrics, or activity.

### Missing configuration

The mission can be saved. The UI names the missing model or GitHub connection and does not enable an action that cannot succeed.

### Wrong or incomplete evidence

Keep the original evidence, show the questions FetchLab still needs answered, and allow reinvestigation after the mission is updated.

### Slow investigation

Persist the mission before starting model or GitHub work, show the active stage, and retain the mission if the request times out. Never claim the proposal was created until the server confirms it.

### Changed repository

Block approval, retain the old proposal as evidence, and ask the user to investigate again against the new base commit.

### Two browser tabs

Approval is bound to the server's current fingerprint. A stale tab receives a conflict and must reload the mission.

## Release acceptance path

The first slice is done only when these paths are exercised twice:

1. Create a mission, investigate a mocked repository, review an exact proposal, and open a draft pull request from the approved content.
2. Submit a stale proposal fingerprint and prove no GitHub write occurs.
3. Move the repository base after investigation and prove approval is blocked.
4. Return zero CI checks and prove the UI says unverified.
5. Return successful checks and prove the mission becomes ready for review.
6. Use a second workspace and prove it cannot read or mutate the first workspace's mission.
7. Use local mode and prove it saves the mission without claiming repository execution.

## Success metric

The first product metric is:

> Percentage of accepted customer problems that reach a human-reviewed pull request with traceable evidence and completed repository checks.

Secondary measures are time to first proposal, proposal acceptance rate, stale proposals prevented, validation pass rate, and missions returned for more evidence.
