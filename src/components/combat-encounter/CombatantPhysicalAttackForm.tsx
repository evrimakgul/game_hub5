import { useEffect, useState } from "react";

import {
  getResolvedPhysicalAttackProfile,
} from "../../lib/combatEncounterPhysicalAttacks";
import type { EncounterParticipantView } from "../../types/combatEncounterView";
import type {
  ItemBlueprintRecord,
  ItemCategoryDefinition,
  ItemSubcategoryDefinition,
  SharedItemRecord,
} from "../../types/items";

type CombatantPhysicalAttackFormProps = {
  view: EncounterParticipantView;
  encounterParticipants: EncounterParticipantView[];
  itemsById: Record<string, SharedItemRecord>;
  itemBlueprints: ItemBlueprintRecord[];
  itemCategoryDefinitions: ItemCategoryDefinition[];
  itemSubcategoryDefinitions: ItemSubcategoryDefinition[];
  requestPhysicalAttack: (payload: {
    casterView: EncounterParticipantView;
    targetView: EncounterParticipantView;
  }) => string | null;
  embedded?: boolean;
};

export function CombatantPhysicalAttackForm({
  view,
  encounterParticipants,
  itemsById,
  itemBlueprints,
  itemCategoryDefinitions,
  itemSubcategoryDefinitions,
  requestPhysicalAttack,
  embedded = false,
}: CombatantPhysicalAttackFormProps) {
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!view.character) {
    return null;
  }

  const resolvedProfile = getResolvedPhysicalAttackProfile(view.character.sheet, itemsById, {
    itemBlueprints,
    itemCategoryDefinitions,
    itemSubcategoryDefinitions,
  });
  const targetOptions = encounterParticipants.filter(
    (candidate) =>
      candidate.character !== null &&
      candidate.participant.characterId !== view.participant.characterId &&
      (view.participant.partyId === null ||
        (candidate.participant.partyId !== null &&
          candidate.participant.partyId !== view.participant.partyId))
  );
  const resolvedTargetId = targetOptions.some(
    (candidate) => candidate.participant.characterId === selectedTargetId
  )
    ? selectedTargetId
    : (targetOptions[0]?.participant.characterId ?? "");

  useEffect(() => {
    if (resolvedTargetId !== selectedTargetId) {
      setSelectedTargetId(resolvedTargetId);
    }
  }, [resolvedTargetId, selectedTargetId]);

  function handleResolve(): void {
    const targetView =
      targetOptions.find((candidate) => candidate.participant.characterId === resolvedTargetId) ?? null;
    if (!targetView) {
      setError("Choose a valid attack target first.");
      return;
    }

    setError(
      requestPhysicalAttack({
        casterView: view,
        targetView,
      })
    );
  }

  const content =
    targetOptions.length === 0 ? (
      <p className="dm-summary-line">No valid enemy target is available for a physical attack.</p>
    ) : (
      <>
        <div className="dm-power-form">
          <label className="dm-field">
            <span>Target</span>
            <select
              value={resolvedTargetId}
              onChange={(event) => setSelectedTargetId(event.target.value)}
            >
              {targetOptions.map((candidate) => (
                <option
                  key={candidate.participant.characterId}
                  value={candidate.participant.characterId}
                >
                  {candidate.participant.displayName}
                </option>
              ))}
            </select>
          </label>

        </div>

        <div className="dm-action-grid">
          <div>
            <span>Weapon Profile</span>
            <strong>{resolvedProfile.label}</strong>
          </div>
          <div>
            <span>Attacks / Action</span>
            <strong>{resolvedProfile.attacksPerAction}</strong>
          </div>
          <div>
            <span>Attack Pool</span>
            <strong>{resolvedProfile.attackPool}</strong>
          </div>
          <div>
            <span>Hit DC</span>
            <strong>{resolvedProfile.successDc}</strong>
          </div>
          <div>
            <span>Base Damage Pool</span>
            <strong>{resolvedProfile.baseDamagePool}</strong>
          </div>
        </div>

        <div className="dm-control-row">
          <button type="button" className="flow-secondary" onClick={handleResolve}>
            Resolve Physical Attack
          </button>
        </div>

        {error ? <p className="dm-error">{error}</p> : null}
      </>
    );

  if (embedded) {
    return content;
  }

  return (
    <div className="dm-combatant-tool-section">
      <p className="section-kicker">Physical Attacks</p>
      {content}
    </div>
  );
}
