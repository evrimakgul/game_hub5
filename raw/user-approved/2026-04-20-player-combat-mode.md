# User-Approved Direction: Player Combat Mode

Date: 2026-04-20

## Summary

The DM should initiate combat from the combat-encounter flow, but combat itself must also expose a player-facing interface so DM and players can view the same live fight together.

## Accepted Requirements

- Add or use a `Start Combat` trigger on the combat encounter setup surface.
- Starting combat should open the DM encounter runtime and make a player combat mode available from the player side.
- The player combat surface should show:
  - initiative / turn order
  - encounter parties
  - encounter activities
- Opponents should be hidden behind pseudo names such as `Opponent 1`, `Opponent 2`, and so on.
- The player combat surface should not expose raw opponent HP numbers or real opponent names unless that opponent has been `Assess Entity`-ed for the viewing character.
- Players should be able to expand/collapse `Assess Entity` knowledge on opponents from inside combat mode.

## Notes

- The accepted direction does not require a separate player-side action-execution runtime in this pass.
- The immediate need is a shared combat-viewing surface with identity masking and AE-based reveal rules.
