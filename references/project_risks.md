# Project Risks

## Effect Modeling Risk
Items and powers are the highest-risk area. If `powers.json` and item property definitions remain too text-like, the frontend will drift toward ad hoc logic per power or item, and the engine boundary will become inconsistent.

## Combat State Authority and Concurrency Risk
Client-side deterministic math is acceptable for this project, but combat state still needs one clear write model. Initiative advancement, action consumption, HP updates, and simultaneous client actions must have predictable ownership and conflict behavior.

## Module Boundary Risk
If executable engine logic, constants, schemas, and UI-facing helpers are all placed together without a clear boundary, the codebase will become harder to scale. The split between reference data, pure engine logic, and application state should stay explicit as the system grows.
