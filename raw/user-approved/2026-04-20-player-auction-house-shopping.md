# User-Approved Direction: Player Auction House Shopping

Collected: 2026-04-20
Authority: latest user-approved conversation

## Request

- Auction house is for players.
- DM prepares items in the auction house, but its sole purpose is to provide an option to the players to shop from.
- Add a link or button in character sheets so players can access the auction house.
- Auction items should provide `buy` and `bid` options to characters.
- After a won bid or buyout, the related character sheet should show the item in the `Items` section.
- Item stock should decrease after each transaction.
- Players cannot buy more than the available quantity.
- If stock reaches `0`, no further transactions can occur unless stock is replenished.

## Implementation Assumption Accepted In This Pass

- The player-side `Bid` action resolves as an immediate completed winning bid instead of creating a delayed pending-bid lifecycle.
