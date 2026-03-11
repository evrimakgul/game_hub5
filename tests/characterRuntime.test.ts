import assert from "node:assert/strict";

import { buildCharacterDerivedValues } from "../src/config/characterRuntime.ts";
import {
  normalizeCharacterDraft,
  PLAYER_CHARACTER_TEMPLATE,
} from "../src/config/characterTemplate.ts";
import { runTestSuite } from "./harness.ts";

export async function runCharacterRuntimeTests(): Promise<void> {
  await runTestSuite("characterRuntime", [
    {
      name: "awareness insight grants temporary inspiration only once per session state",
      run: () => {
        const sheet = PLAYER_CHARACTER_TEMPLATE.createInstance();
        sheet.powers = [
          {
            id: "awareness",
            name: "Awareness",
            level: 1,
            governingStat: "PER",
          },
        ];

        const normalizedOnce = normalizeCharacterDraft(sheet);
        const normalizedTwice = normalizeCharacterDraft(normalizedOnce);
        const derived = buildCharacterDerivedValues(normalizedTwice);

        assert.equal(normalizedOnce.temporaryInspiration, 1);
        assert.equal(normalizedOnce.awarenessInsightGranted, true);
        assert.equal(normalizedTwice.temporaryInspiration, 1);
        assert.equal(derived.temporaryInspiration, 1);
        assert.equal(derived.totalInspiration, 1);
      },
    },
    {
      name: "removing awareness clears the granted temporary inspiration slot",
      run: () => {
        const sheet = normalizeCharacterDraft({
          ...PLAYER_CHARACTER_TEMPLATE.createInstance(),
          temporaryInspiration: 0,
          powers: [
            {
              id: "awareness",
              name: "Awareness",
              level: 1,
              governingStat: "PER",
            },
          ],
        });

        const withoutAwareness = normalizeCharacterDraft({
          ...sheet,
          powers: [],
        });

        assert.equal(withoutAwareness.awarenessInsightGranted, false);
        assert.equal(withoutAwareness.temporaryInspiration, 0);
      },
    },
  ]);
}
