import { useEffect, useState } from "react";

import {
  getPhysicalAttackOptions,
  type PhysicalAttackProfileId,
} from "../../lib/combatEncounterPhysicalAttacks";
import type { EncounterParticipantView } from "../../types/combatEncounterView";

type CombatantPhysicalAttackFormProps = {
  view: EncounterParticipantView;
  encounterParticipants: EncounterParticipantView[];
  requestPhysicalAttack: (payload: {
    casterView: EncounterParticipantView;
    targetView: EncounterParticipantView;
    profileId: PhysicalAttackProfileId;
    landedHits: number;
  }) => string | null;
};

export function CombatantPhysicalAttackForm({
  view,
  encounterParticipants,
  requestPhysicalAttack,
}: CombatantPhysicalAttackFormProps) {
  const [selectedProfileId, setSelectedProfileId] = useState<PhysicalAttackProfileId>("brawl");
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [landedHits, setLandedHits] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (!view.character) {
    return null;
  }

  const attackOptions = getPhysicalAttackOptions(view.character.sheet);
  const selectedOption =
    attackOptions.find((option) => option.id === selectedProfileId) ?? attackOptions[0] ?? null;
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
    if (!selectedOption && attackOptions[0]) {
      setSelectedProfileId(attackOptions[0].id);
    }
  }, [attackOptions, selectedOption]);

  useEffect(() => {
    if (resolvedTargetId !== selectedTargetId) {
      setSelectedTargetId(resolvedTargetId);
    }
  }, [resolvedTargetId, selectedTargetId]);

  useEffect(() => {
    if (!selectedOption) {
      return;
    }

    setLandedHits((currentHits) =>
      Math.max(0, Math.min(currentHits, selectedOption.attacksPerAction))
    );
  }, [selectedOption]);

  function handleResolve(): void {
    if (!selectedOption) {
      setError("No physical attack option is available.");
      return;
    }

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
        profileId: selectedOption.id,
        landedHits,
      })
    );
  }

  return (
    <div className="dm-combatant-tool-section">
      <p className="section-kicker">Physical Attacks</p>
      {targetOptions.length === 0 || !selectedOption ? (
        <p className="dm-summary-line">No valid enemy target is available for a physical attack.</p>
      ) : (
        <>
          <div className="dm-power-form">
            <label className="dm-field">
              <span>Attack Style</span>
              <select
                value={selectedOption.id}
                onChange={(event) => setSelectedProfileId(event.target.value as PhysicalAttackProfileId)}
              >
                {attackOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

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

            <label className="dm-field">
              <span>Hits Landed</span>
              <select
                value={String(landedHits)}
                onChange={(event) => setLandedHits(Number.parseInt(event.target.value, 10) || 0)}
              >
                {Array.from({ length: selectedOption.attacksPerAction + 1 }, (_, index) => (
                  <option key={index} value={String(index)}>
                    {index}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="dm-action-grid">
            <div>
              <span>Attack Pool</span>
              <strong>{selectedOption.attackPool}</strong>
            </div>
            <div>
              <span>Success DC</span>
              <strong>{selectedOption.successDc}</strong>
            </div>
            <div>
              <span>Damage / Hit</span>
              <strong>{selectedOption.damagePerHit}</strong>
            </div>
          </div>

          <div className="dm-control-row">
            <button type="button" className="flow-secondary" onClick={handleResolve}>
              Resolve Physical Attack
            </button>
          </div>

          {error ? <p className="dm-error">{error}</p> : null}
        </>
      )}
    </div>
  );
}
