# Project Risks

## Requirement Drift Risk
The biggest short-term risk is reintroducing stale assumptions from removed systems. Old combat-engine or backend ideas can easily leak back into code or docs unless the branch stays disciplined about its current local-only scope.

## Rules Capture Risk
Items, powers, and combat rules are still mostly reference-driven. If the next engine rebuild starts before the required mechanics are specified cleanly, implementation will drift toward guesswork or ad hoc behavior.

## Persistence Migration Risk
The current branch is local-only. When backend persistence returns later, the project will need a clean distinction between stored mutable state and derived values so migration from local storage to a server model does not corrupt character data.

## Document Drift Risk
Reference documents can become misleading faster than code. Any markdown that still describes removed backend or engine systems creates confusion and should either be rewritten to match the branch or removed.
