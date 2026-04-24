import assert from "node:assert/strict";

import {
  applyCodexImportPayload,
  buildEncounterOwnedMobsFromGroup,
  buildEncounterOwnedMobsFromPortalStage,
  createEmptyAuthoringState,
  createEmptyMobGroup,
  createEmptyMobTemplate,
  createEmptyPortalTemplate,
  getMobGroupComputedChallengeRating,
  getPortalStageComputedChallengeRating,
  mergeMobGroups,
  normalizeMobTemplateSheet,
  parseCodexImportPayload,
  validatePortalTemplate,
} from "../src/lib/authoring.ts";
import { runTestSuite } from "./harness.ts";

export async function runAuthoringTests(): Promise<void> {
  await runTestSuite("authoring", [
    {
      name: "mob template normalization clamps current hp and mana to derived caps",
      run: () => {
        const normalized = normalizeMobTemplateSheet({
          ...createEmptyMobTemplate({ name: "Clamp Test" }).sheet,
          currentHp: 99,
          currentMana: 99,
          statState: {
            ...createEmptyMobTemplate({ name: "Clamp Test" }).sheet.statState,
            STAM: { base: 4, gearSources: [], buffSources: [] },
            MAN: { base: 2, gearSources: [], buffSources: [] },
          },
          powers: [],
        });

        assert.equal(normalized.currentHp, 10);
        assert.equal(normalized.currentMana, 0);
      },
    },
    {
      name: "parseCodexImportPayload rejects malformed payloads",
      run: () => {
        const result = parseCodexImportPayload(
          JSON.stringify({
            kind: "mob_template_batch",
            schemaVersion: "authoring-workshop-v1",
            mobs: [],
          })
        );

        assert.ok("error" in result);
      },
    },
    {
      name: "challenge rating helpers total mob groups and portal stages",
      run: () => {
        const wolf = createEmptyMobTemplate({ name: "Wolf", challengeRating: 4 });
        const mage = createEmptyMobTemplate({ name: "Swamp Mage", challengeRating: 8 });
        const group = createEmptyMobGroup({
          members: [
            {
              id: "member-a",
              mobTemplateId: wolf.id,
              quantity: 2,
              displayNameOverride: "",
              notes: "",
              sheetOverrides: null,
            },
            {
              id: "member-b",
              mobTemplateId: mage.id,
              quantity: 1,
              displayNameOverride: "",
              notes: "",
              sheetOverrides: null,
            },
          ],
        });
        const portal = createEmptyPortalTemplate({
          stages: [
            {
              ...createEmptyPortalTemplate().stages[0]!,
              groupReferences: [
                {
                  id: "stage-group-1",
                  mobGroupId: group.id,
                  quantityMultiplier: 2,
                  notes: "",
                },
              ],
            },
            {
              ...createEmptyPortalTemplate().stages[1]!,
              isBossStage: true,
            },
          ],
        });
        const mobTemplatesById = new Map([
          [wolf.id, wolf],
          [mage.id, mage],
        ]);
        const mobGroupsById = new Map([[group.id, group]]);

        assert.equal(getMobGroupComputedChallengeRating(group, mobTemplatesById), 16);
        assert.equal(
          getPortalStageComputedChallengeRating(
            portal.stages[0]!,
            mobGroupsById,
            mobTemplatesById
          ),
          32
        );
      },
    },
    {
      name: "mergeMobGroups appends copied members without mutating the source group",
      run: () => {
        const template = createEmptyMobTemplate({ name: "Rat" });
        const target = createEmptyMobGroup({
          name: "Front Pack",
          members: [
            {
              id: "member-a",
              mobTemplateId: template.id,
              quantity: 1,
              displayNameOverride: "",
              notes: "",
              sheetOverrides: null,
            },
          ],
        });
        const source = createEmptyMobGroup({
          name: "Rear Pack",
          members: [
            {
              id: "member-b",
              mobTemplateId: template.id,
              quantity: 2,
              displayNameOverride: "Ratling",
              notes: "",
              sheetOverrides: null,
            },
          ],
        });

        const merged = mergeMobGroups(target, source);

        assert.equal(target.members.length, 1);
        assert.equal(source.members.length, 1);
        assert.equal(merged.members.length, 2);
        assert.notEqual(merged.members[1]?.id, source.members[0]?.id);
      },
    },
    {
      name: "portal bundle import rekeys linked mobs groups and portal references",
      run: () => {
        const mob = createEmptyMobTemplate({ id: "mob-a", name: "Bog Hound", challengeRating: 4 });
        const group = createEmptyMobGroup({
          id: "group-a",
          name: "Bog Pack",
          members: [
            {
              id: "member-a",
              mobTemplateId: "mob-a",
              quantity: 2,
              displayNameOverride: "",
              notes: "",
              sheetOverrides: null,
            },
          ],
        });
        const portal = createEmptyPortalTemplate({
          id: "portal-a",
          name: "Mire Gate",
          stages: [
            {
              ...createEmptyPortalTemplate().stages[0]!,
              groupReferences: [
                {
                  id: "stage-group-1",
                  mobGroupId: "group-a",
                  quantityMultiplier: 1,
                  notes: "",
                },
              ],
            },
            {
              ...createEmptyPortalTemplate().stages[1]!,
              isBossStage: true,
            },
          ],
        });

        const payload = parseCodexImportPayload(
          JSON.stringify({
            kind: "portal_bundle",
            schemaVersion: "authoring-workshop-v1",
            producedAt: "2026-04-19T12:00:00.000Z",
            requestIntent: "Draft portal bundle",
            theme: "swamp",
            mobs: [mob],
            groups: [group],
            portal,
          })
        );

        assert.ok(!("error" in payload));
        if ("error" in payload) {
          return;
        }

        assert.equal(payload.kind, "portal_bundle");
        assert.equal(payload.mobs.length, 1);
        assert.equal(payload.groups.length, 1);
        assert.notEqual(payload.mobs[0]?.id, "mob-a");
        assert.equal(payload.groups[0]?.members[0]?.mobTemplateId, payload.mobs[0]?.id);
        assert.equal(
          payload.portal.stages[0]?.groupReferences[0]?.mobGroupId,
          payload.groups[0]?.id
        );
      },
    },
    {
      name: "portal validation requires a 2-5 stage structure with the final stage marked boss",
      run: () => {
        const portal = createEmptyPortalTemplate({
          name: "Test Portal",
          theme: "sewer",
          stages: [
            {
              ...createEmptyPortalTemplate().stages[0]!,
              isBossStage: true,
            },
          ],
          status: "published",
        });

        const errors = validatePortalTemplate(portal);

        assert.ok(errors.some((error) => error.includes("between 2 and 5 stages")));
        assert.ok(errors.some((error) => error.includes("closing reward")));
      },
    },
    {
      name: "group and portal stage compilation create encounter-owned mob instances",
      run: () => {
        const mobTemplate = createEmptyMobTemplate({ name: "Grey Wolf" });
        const mobGroup = createEmptyMobGroup({
          name: "Grey Wolves",
          themeTags: ["forest"],
          members: [
            {
              id: "group-member-1",
              mobTemplateId: mobTemplate.id,
              quantity: 2,
              displayNameOverride: "",
              notes: "Ambush",
              sheetOverrides: null,
            },
          ],
        });
        const portal = createEmptyPortalTemplate({
          name: "Forest Gate",
          theme: "forest",
          stages: [
            {
              ...createEmptyPortalTemplate().stages[0]!,
              groupReferences: [
                {
                  id: "stage-group-1",
                  mobGroupId: mobGroup.id,
                  quantityMultiplier: 2,
                  notes: "Wave one",
                },
              ],
            },
            {
              ...createEmptyPortalTemplate().stages[1]!,
              isBossStage: true,
            },
          ],
        });
        const mobTemplatesById = new Map([[mobTemplate.id, mobTemplate]]);
        const mobGroupsById = new Map([[mobGroup.id, mobGroup]]);

        const groupInstances = buildEncounterOwnedMobsFromGroup({
          group: mobGroup,
          mobTemplatesById,
        });
        const stageInstances = buildEncounterOwnedMobsFromPortalStage({
          portal,
          stage: portal.stages[0]!,
          mobGroupsById,
          mobTemplatesById,
        });

        assert.equal(groupInstances.length, 2);
        assert.equal(groupInstances[0]?.sourceGroupId, mobGroup.id);
        assert.equal(stageInstances.length, 4);
        assert.equal(stageInstances[0]?.sourcePortalId, portal.id);
        assert.equal(stageInstances[0]?.sourcePortalStageId, portal.stages[0]?.id);
      },
    },
    {
      name: "applyCodexImportPayload stamps imported objects with provenance",
      run: () => {
        const mobTemplate = createEmptyMobTemplate({ name: "Imported Mob" });
        const payload = parseCodexImportPayload(
          JSON.stringify({
            kind: "mob_template_batch",
            schemaVersion: "authoring-workshop-v1",
            producedAt: "2026-04-19T12:00:00.000Z",
            requestIntent: "Draft mobs",
            theme: "shadow",
            mobs: [mobTemplate],
          })
        );

        assert.ok(!("error" in payload));
        if ("error" in payload) {
          return;
        }

        const nextState = applyCodexImportPayload({
          payload,
          rawPayload: JSON.stringify(payload),
          currentState: createEmptyAuthoringState(),
        });

        assert.equal(nextState.mobTemplates.length, 1);
        assert.equal(nextState.mobTemplates[0]?.sourceKind, "codex_import");
        assert.ok(nextState.mobTemplates[0]?.importProvenance?.rawPayload);
      },
    },
  ]);
}
