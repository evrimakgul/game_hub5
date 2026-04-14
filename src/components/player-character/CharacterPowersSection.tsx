import { useEffect, useState } from "react";

import { getPowerBenefitSections } from "../../config/characterTemplate";
import type { CharacterDraft } from "../../config/characterTemplate";
import { T1_POWER_XP_BY_LEVEL } from "../../rules/xpTables";
import { getIncrementCost } from "../../lib/progressionCosts";
import type { CharacterRecord } from "../../types/character.ts";
import type { SharedItemRecord } from "../../types/items.ts";
import type { WorldCastRequestPayload } from "../../lib/powerCasting.ts";
import { isCastPowerVariantSupportedInEnvironment } from "../../lib/powerCasting.ts";
import { useWorldPowerCastState } from "../../hooks/useWorldPowerCastState.ts";

type CharacterPowersSectionProps = {
  activeCharacter: CharacterRecord;
  sheetState: CharacterDraft;
  characters: CharacterRecord[];
  itemsById: Record<string, SharedItemRecord>;
  availablePowerOptions: Array<{ id: string; name: string }>;
  pendingPowerId: string;
  xpLeftOver: number;
  isProgressionEditMode: boolean;
  adminOverrideMode: boolean;
  onPendingPowerIdChange: (value: string) => void;
  onAddPower: () => void;
  onAddPowerOverride: () => void;
  onAdjustPower: (powerId: string, direction: 1 | -1) => void;
  onAdjustPowerOverride: (powerId: string, direction: 1 | -1) => void;
  onRequestWorldCast: (payload: WorldCastRequestPayload) => string | null;
};

export function CharacterPowersSection({
  activeCharacter,
  sheetState,
  characters,
  itemsById,
  availablePowerOptions,
  pendingPowerId,
  xpLeftOver,
  isProgressionEditMode,
  adminOverrideMode,
  onPendingPowerIdChange,
  onAddPower,
  onAddPowerOverride,
  onAdjustPower,
  onAdjustPowerOverride,
  onRequestWorldCast,
}: CharacterPowersSectionProps) {
  const [openPowerId, setOpenPowerId] = useState<string | null>(null);
  const castState = useWorldPowerCastState({
    casterCharacter: activeCharacter,
    characters,
    itemsById,
    requestCast: onRequestWorldCast,
  });

  useEffect(() => {
    if (!openPowerId) {
      return;
    }

    if (!castState.castablePowers.some((power) => power.id === openPowerId)) {
      setOpenPowerId(null);
      return;
    }

    castState.selectPower(openPowerId);
  }, [castState, openPowerId]);

  function toggleUsePower(powerId: string): void {
    castState.clearCastError();
    if (openPowerId === powerId) {
      setOpenPowerId(null);
      return;
    }

    castState.selectPower(powerId);
    setOpenPowerId(powerId);
  }

  return (
    <article className="sheet-card power-card">
      <p className="section-kicker">T1 Powers</p>
      <h2>Known Powers</h2>
      {isProgressionEditMode || adminOverrideMode ? (
        <div className="power-add-row">
          <select value={pendingPowerId} onChange={(event) => onPendingPowerIdChange(event.target.value)}>
            <option value="">Add Level 1 Power</option>
            {availablePowerOptions.map((power) => (
              <option key={power.id} value={power.id}>
                {power.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={adminOverrideMode ? onAddPowerOverride : onAddPower}
            disabled={
              !pendingPowerId ||
              (!adminOverrideMode && xpLeftOver < getIncrementCost(T1_POWER_XP_BY_LEVEL, 0))
            }
          >
            Add
          </button>
        </div>
      ) : null}
      <div className="power-list">
        {sheetState.powers.length === 0 ? (
          <p className="empty-block-copy">No powers learned yet.</p>
        ) : (
          sheetState.powers.map((power) => {
            const incrementCost = getIncrementCost(T1_POWER_XP_BY_LEVEL, power.level);
            const canIncrease = adminOverrideMode
              ? power.level < T1_POWER_XP_BY_LEVEL.length - 1
              : isProgressionEditMode &&
                power.level < T1_POWER_XP_BY_LEVEL.length - 1 &&
                xpLeftOver >= incrementCost;
            const canDecrease = adminOverrideMode
              ? power.level > 0
              : isProgressionEditMode && power.level > 0;
            const benefitSections = getPowerBenefitSections(power.id, power.level);
            const canUsePower = castState.castablePowers.some(
              (castablePower) => castablePower.id === power.id
            );
            const isUsePanelOpen = openPowerId === power.id && castState.selectedPower?.id === power.id;
            const selectedVariantSupported =
              isUsePanelOpen && castState.selectedPower
                ? isCastPowerVariantSupportedInEnvironment(
                    castState.selectedPower,
                    castState.resolvedVariantId,
                    "world"
                  )
                : false;

            return (
              <div key={power.id}>
                <div className="power-row">
                  <div className="row-main">
                    <strong>
                      {power.name} Lv {power.level}
                    </strong>
                    <div className="power-benefit-groups">
                      {benefitSections.map((section) => (
                        <section key={`${power.id}:${section.title}`} className="power-benefit-group">
                          <strong className="power-benefit-title">{section.title}</strong>
                          <ul className="power-benefits">
                            {section.bullets.map((benefit) => (
                              <li key={`${section.title}:${benefit}`}>{benefit}</li>
                            ))}
                          </ul>
                        </section>
                      ))}
                    </div>
                  </div>
                  {isProgressionEditMode || adminOverrideMode || canUsePower ? (
                    <div className="row-actions">
                      {isProgressionEditMode || adminOverrideMode ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              adminOverrideMode
                                ? onAdjustPowerOverride(power.id, -1)
                                : onAdjustPower(power.id, -1)
                            }
                            disabled={!canDecrease}
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              adminOverrideMode
                                ? onAdjustPowerOverride(power.id, 1)
                                : onAdjustPower(power.id, 1)
                            }
                            disabled={!canIncrease}
                          >
                            +
                          </button>
                        </>
                      ) : null}
                      {canUsePower ? (
                        <button
                          type="button"
                          className={`power-action-button${isUsePanelOpen ? " is-secondary" : ""}`}
                          onClick={() => toggleUsePower(power.id)}
                        >
                          {isUsePanelOpen ? "Close" : "Use"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="row-side">
                    <span>Base {power.level}</span>
                    <em>{power.governingStat}</em>
                  </div>
                </div>
                {isUsePanelOpen ? (
                  <div className="power-benefit-groups" style={{ marginTop: "0.75rem" }}>
                    <section className="power-benefit-group">
                      <strong className="power-benefit-title">Use Power</strong>
                      {castState.shouldShowVariantField ? (
                        <label className="dm-field">
                          <span>Variant</span>
                          <select
                            value={castState.resolvedVariantId}
                            onChange={(event) =>
                              castState.selectVariant(event.target.value as typeof castState.resolvedVariantId)
                            }
                          >
                            {castState.variantOptions.map((option) => {
                              const isSupported = isCastPowerVariantSupportedInEnvironment(
                                power,
                                option.id,
                                "world"
                              );
                              return (
                                <option key={option.id} value={option.id} disabled={!isSupported}>
                                  {option.label}
                                  {!isSupported ? " (Combat only for now)" : ""}
                                </option>
                              );
                            })}
                          </select>
                        </label>
                      ) : null}

                      {!selectedVariantSupported ? (
                        <p className="dm-summary-line">Combat only for now.</p>
                      ) : (
                        <>
                          {castState.shouldShowTargetField ? (
                            <label className="dm-field">
                              <span>
                                {castState.targetMode === "multiple" ? "Targets" : "Target"}
                              </span>
                              {castState.targetMode === "multiple" ? (
                                <>
                                  <div className="dm-target-multi-grid">
                                    {castState.targetOptions.map((option) => {
                                      const isSelected = castState.selectedTargetIds.includes(option.id);
                                      return (
                                        <button
                                          key={option.id}
                                          type="button"
                                          className={`dm-target-chip${isSelected ? " is-selected" : ""}`}
                                          onClick={() => castState.toggleTarget(option.id)}
                                        >
                                          {option.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <small className="dm-field-hint">
                                    {castState.targetLimit >= castState.targetOptions.length
                                      ? "Select affected targets."
                                      : `Up to ${castState.targetLimit} target${castState.targetLimit === 1 ? "" : "s"}.`}
                                  </small>
                                </>
                              ) : (
                                <select
                                  value={castState.resolvedSingleTargetId}
                                  onChange={(event) =>
                                    castState.selectSingleTarget(event.target.value)
                                  }
                                >
                                  {castState.targetOptions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </label>
                          ) : null}

                          {castState.allowedStats.length > 0 ? (
                            <label className="dm-field">
                              <span>Stat</span>
                              <select
                                value={castState.resolvedSelectedStatId}
                                onChange={(event) => castState.selectStat(event.target.value)}
                              >
                                {castState.allowedStats.map((statId) => (
                                  <option key={statId} value={statId}>
                                    {statId}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : null}

                          {castState.healingTotal !== null ? (
                            <p className="dm-summary-line">Heal Pool: {castState.healingTotal}</p>
                          ) : null}

                          <div className="row-actions" style={{ marginTop: "0.5rem" }}>
                            <button
                              type="button"
                              className="power-action-button"
                              onClick={castState.handleCast}
                            >
                              Cast
                            </button>
                          </div>
                        </>
                      )}

                      {castState.castError ? <p className="dm-error">{castState.castError}</p> : null}
                    </section>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </article>
  );
}


