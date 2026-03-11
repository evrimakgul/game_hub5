import assert from "node:assert/strict";

import { createDmAuditEntry } from "../src/lib/dmAudit.ts";
import { rollD10Faces } from "../src/lib/dice.ts";
import { buildGameHistoryNoteEntry, prependGameHistoryEntry } from "../src/lib/historyEntries.ts";
import { createTimestampedId } from "../src/lib/ids.ts";
import { runTestSuite } from "./harness.ts";

export async function runLibHelpersTests(): Promise<void> {
  await runTestSuite("libHelpers", [
    {
      name: "createTimestampedId uses provided timestamp and suffix",
      run: () => {
        assert.equal(
          createTimestampedId("power-effect", {
            timestamp: 123,
            randomSuffix: "abc123",
          }),
          "power-effect-123-abc123"
        );
      },
    },
    {
      name: "rollD10Faces uses the provided random source and clamps negative pool sizes",
      run: () => {
        const values = [0, 0.49, 0.99];
        let index = 0;
        const faces = rollD10Faces(3, () => values[index++] ?? 0);

        assert.deepEqual(faces, [1, 5, 10]);
        assert.deepEqual(rollD10Faces(-2, () => 0.5), []);
      },
    },
    {
      name: "createDmAuditEntry preserves metadata and coerces values to strings",
      run: () => {
        const entry = createDmAuditEntry({
          characterId: "character-1",
          targetOwnerRole: "dm",
          editLayer: "runtime",
          fieldPath: "currentHp",
          beforeValue: null,
          afterValue: 12,
          reason: "sync",
          sourceScreen: "dm-combat-encounter",
        });

        assert.match(entry.id, /^dm-edit-\d+-[0-9a-f]+$/);
        assert.equal(entry.characterId, "character-1");
        assert.equal(entry.targetOwnerRole, "dm");
        assert.equal(entry.beforeValue, "");
        assert.equal(entry.afterValue, "12");
        assert.equal(entry.reason, "sync");
        assert.equal(entry.sourceScreen, "dm-combat-encounter");
      },
    },
    {
      name: "history note helpers build and prepend note entries",
      run: () => {
        const now = new Date(2026, 2, 11, 9, 7, 0, 0);
        const entry = buildGameHistoryNoteEntry("Observed anomaly", "17.09.2124 - 08:00", now);
        const prepended = prependGameHistoryEntry([{ ...entry, id: "older" }], entry);

        assert.match(entry.id, /^history-note-\d+-[0-9a-f]+$/);
        assert.equal(entry.type, "note");
        assert.equal(entry.actualDateTime, "11.03.2026 - 09:07");
        assert.equal(entry.gameDateTime, "17.09.2124 - 08:00");
        assert.equal(entry.note, "Observed anomaly");
        assert.equal(prepended[0], entry);
        assert.equal(prepended[1].id, "older");
      },
    },
  ]);
}
