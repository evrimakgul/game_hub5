import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { dispatchCombatCommand } from "../config/combatReducer";
import {
  selectActionBar,
  selectCombatantInspector,
  selectCombatantSummaries,
  selectEventLog,
  selectInitiativeView,
  selectReactionPrompt,
  selectWorkflowPanel,
} from "../selectors/combatUi";
import type {
  CombatCommand,
  CombatEngineState,
  CombatTargetDescriptor,
} from "../types/combatEngine";
import { useAppFlow } from "../state/appFlow";

function rollD10Pool(poolSize: number): number[] {
  return Array.from({ length: poolSize }, () => Math.floor(Math.random() * 10) + 1);
}

function moveEntry<T>(entries: T[], fromIndex: number, direction: -1 | 1): T[] {
  const nextIndex = fromIndex + direction;

  if (nextIndex < 0 || nextIndex >= entries.length) {
    return entries;
  }

  const nextEntries = entries.slice();
  const [entry] = nextEntries.splice(fromIndex, 1);
  nextEntries.splice(nextIndex, 0, entry);
  return nextEntries;
}

function normalizeParameterValue(rawValue: unknown, type: "number" | "select" | "boolean") {
  if (type === "number") {
    const numericValue = Number(rawValue);
    return Number.isFinite(numericValue) ? numericValue : 0;
  }

  if (type === "boolean") {
    return rawValue === true || rawValue === "true";
  }

  return String(rawValue ?? "");
}

export function CombatEncounterPage() {
  const navigate = useNavigate();
  const { roleChoice, activeCombat, updateCombatEncounter, selectCharacter } = useAppFlow();
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [selectedInspectorId, setSelectedInspectorId] = useState<string | null>(null);
  const [targetDraftIds, setTargetDraftIds] = useState<string[]>([]);
  const [parameterDraft, setParameterDraft] = useState<Record<string, unknown>>({});

  const combatState = activeCombat;
  const combatantSummaries = useMemo(
    () => (combatState ? selectCombatantSummaries(combatState) : []),
    [combatState]
  );
  const initiativeView = useMemo(
    () => (combatState ? selectInitiativeView(combatState) : null),
    [combatState]
  );
  const workflowPanel = useMemo(
    () => (combatState ? selectWorkflowPanel(combatState) : null),
    [combatState]
  );
  const reactionPrompt = useMemo(
    () => (combatState ? selectReactionPrompt(combatState) : null),
    [combatState]
  );
  const activeParticipantId = combatState?.turn.activeParticipantId ?? null;
  const actionBar = useMemo(
    () => (combatState && activeParticipantId ? selectActionBar(combatState, activeParticipantId) : []),
    [activeParticipantId, combatState]
  );
  const inspector = useMemo(() => {
    if (!combatState) {
      return null;
    }

    const fallbackId =
      selectedInspectorId ?? activeParticipantId ?? combatantSummaries[0]?.participantId ?? null;

    return fallbackId ? selectCombatantInspector(combatState, fallbackId) : null;
  }, [activeParticipantId, combatState, combatantSummaries, selectedInspectorId]);
  const eventLog = useMemo(
    () => (combatState ? [...selectEventLog(combatState, 16)].reverse() : []),
    [combatState]
  );

  useEffect(() => {
    if (!combatState) {
      return;
    }

    const preferredId =
      selectedInspectorId ?? activeParticipantId ?? combatantSummaries[0]?.participantId ?? null;

    if (!preferredId || !combatState.participants[preferredId]) {
      setSelectedInspectorId(activeParticipantId ?? combatantSummaries[0]?.participantId ?? null);
    }
  }, [activeParticipantId, combatState, combatantSummaries, selectedInspectorId]);

  useEffect(() => {
    if (!workflowPanel) {
      setTargetDraftIds([]);
      setParameterDraft({});
      return;
    }

    if (workflowPanel.step === "choose_targets") {
      setTargetDraftIds(workflowPanel.selectedTargetIds);
    } else {
      setTargetDraftIds([]);
    }

    if (workflowPanel.step === "choose_parameters" || workflowPanel.step === "confirm") {
      setParameterDraft(workflowPanel.parameters);
    } else {
      setParameterDraft({});
    }
  }, [
    workflowPanel?.actorParticipantId,
    workflowPanel?.selectedActionFamilyId,
    workflowPanel?.selectedSubtypeId,
    workflowPanel?.step,
  ]);

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  if (!combatState) {
    return <Navigate to="/dm/combat" replace />;
  }

  const currentCombat: CombatEngineState = combatState;
  const playerParticipants = Object.values(currentCombat.participants).filter(
    (participant) => participant.ownerRole === "player" && participant.characterId
  );

  function updateCombatState(updater: (state: CombatEngineState) => CombatEngineState): void {
    try {
      updateCombatEncounter((currentState) => updater(currentState));
      setDashboardError(null);
    } catch (error) {
      setDashboardError(
        error instanceof Error ? error.message : "Combat command could not be resolved."
      );
    }
  }

  function runCombatCommand(command: CombatCommand): void {
    updateCombatState((state) => dispatchCombatCommand(state, command));
  }

  function handleOpenCharacter(characterId: string): void {
    selectCharacter(characterId);
    navigate("/dm/character");
  }

  function handleRollInitiative(participantId: string): void {
    const participant = currentCombat.participants[participantId];

    if (!participant) {
      return;
    }

    runCombatCommand({
      kind: "submit_initiative_roll",
      actorParticipantId: participantId,
      dice: rollD10Pool(participant.derived.initiativePool),
      controllerRole: "dm",
      controllerParticipantId: null,
    });
  }

  function handleRollAllInitiative(): void {
    for (const summary of combatantSummaries) {
      if (!currentCombat.initiative.submittedRolls[summary.participantId]) {
        handleRollInitiative(summary.participantId);
      }
    }
  }

  function handleMoveInitiative(participantId: string, direction: -1 | 1): void {
    if (!initiativeView) {
      return;
    }

    const orderedIds = initiativeView.orderedEntries.map((entry) => entry.participantId);
    const currentIndex = orderedIds.indexOf(participantId);

    if (currentIndex === -1) {
      return;
    }

    runCombatCommand({
      kind: "apply_manual_initiative_order",
      orderedParticipantIds: moveEntry(orderedIds, currentIndex, direction),
      controllerRole: "dm",
      controllerParticipantId: null,
    });
  }

  function toggleParticipantFlag(
    kind: "set_surprise_participants" | "set_free_round_participants",
    participantId: string
  ): void {
    const currentIds =
      kind === "set_surprise_participants"
        ? currentCombat.initiative.surpriseParticipantIds
        : currentCombat.initiative.freeRoundParticipantIds;

    const nextIds = currentIds.includes(participantId)
      ? currentIds.filter((entryId) => entryId !== participantId)
      : [...currentIds, participantId];

    runCombatCommand({
      kind,
      participantIds: nextIds,
      controllerRole: "dm",
      controllerParticipantId: null,
    });
  }

  function handleSelectTarget(target: CombatTargetDescriptor): void {
    if (!workflowPanel || !target.enabled) {
      return;
    }

    if (workflowPanel.targetRule?.startsWith("multi")) {
      setTargetDraftIds((currentIds) =>
        currentIds.includes(target.participantId)
          ? currentIds.filter((entryId) => entryId !== target.participantId)
          : [...currentIds, target.participantId]
      );
      return;
    }

    runCombatCommand({
      kind: "select_targets",
      actorParticipantId: workflowPanel.actorParticipantId,
      targetIds: [target.participantId],
      controllerRole: "dm",
      controllerParticipantId: null,
    });
  }

  function handleConfirmTargets(): void {
    if (!workflowPanel) {
      return;
    }

    runCombatCommand({
      kind: "select_targets",
      actorParticipantId: workflowPanel.actorParticipantId,
      targetIds: targetDraftIds,
      controllerRole: "dm",
      controllerParticipantId: null,
    });
  }

  function handleConfirmParameters(): void {
    if (!workflowPanel) {
      return;
    }

    runCombatCommand({
      kind: "set_workflow_parameters",
      actorParticipantId: workflowPanel.actorParticipantId,
      parameters: parameterDraft,
      controllerRole: "dm",
      controllerParticipantId: null,
    });
  }

  return (
    <main className="dm-page">
      <section className="dm-shell">
        <header className="dm-topbar">
          <div>
            <p className="section-kicker">Dungeon Master</p>
            <h1>Combat Encounter</h1>
          </div>
          <div className="dm-nav-actions">
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm/combat")}>
              Combat Dashboard
            </button>
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm")}>
              DM Dashboard
            </button>
          </div>
        </header>

        <section className="dm-dashboard-grid dm-encounter-grid">
          <article className="sheet-card">
            <p className="section-kicker">Encounter Header</p>
            <h2>{currentCombat.label}</h2>
            <p className="dm-summary-line">Stage: {currentCombat.stage}</p>
            <p className="dm-summary-line">Round: {currentCombat.turn.roundNumber || "-"}</p>
            <p className="dm-summary-line">
              Active:{" "}
              {currentCombat.turn.activeParticipantId
                ? currentCombat.participants[currentCombat.turn.activeParticipantId]?.displayName ?? "-"
                : "-"}
            </p>
            <div className="dm-control-row dm-control-row-wrap">
              {currentCombat.stage === "draft" ? (
                <button
                  type="button"
                  className="flow-primary"
                  onClick={() =>
                    runCombatCommand({
                      kind: "begin_initiative",
                      controllerRole: "dm",
                      controllerParticipantId: null,
                    })
                  }
                >
                  Begin Initiative
                </button>
              ) : null}
              {currentCombat.stage === "turn_active" ? (
                <button
                  type="button"
                  className="flow-secondary"
                  onClick={() =>
                    runCombatCommand({
                      kind: "advance_turn",
                      controllerRole: "dm",
                      controllerParticipantId: null,
                    })
                  }
                >
                  Advance Turn
                </button>
              ) : null}
              <button
                type="button"
                className="flow-danger"
                onClick={() =>
                  runCombatCommand({
                    kind: "finalize_combat",
                    controllerRole: "dm",
                    controllerParticipantId: null,
                  })
                }
              >
                Finalize Combat
              </button>
            </div>
          </article>

          <article className="sheet-card">
            <p className="section-kicker">Player Character Block</p>
            <h2>Player Characters</h2>
            <div className="dm-list">
              {playerParticipants.length === 0 ? (
                <p className="empty-block-copy">No player characters are in this encounter.</p>
              ) : (
                playerParticipants.map((participant) => (
                  <div key={participant.participantId} className="dm-selection-row">
                    <span>{participant.displayName}</span>
                    <button
                      type="button"
                      onClick={() => handleOpenCharacter(participant.characterId!)}
                    >
                      Open Sheet
                    </button>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="sheet-card">
            <p className="section-kicker">Initiative Rail</p>
            <h2>Turn Order</h2>
            {currentCombat.stage === "initiative_roll" ? (
              <div className="dm-control-row">
                <button type="button" className="flow-secondary" onClick={handleRollAllInitiative}>
                  Roll All Pending
                </button>
              </div>
            ) : null}
            <div className="dm-order-list">
              {initiativeView?.orderedEntries.map((entry) => {
                const participant = currentCombat.participants[entry.participantId];
                const isRolled =
                  currentCombat.initiative.submittedRolls[entry.participantId] !== undefined;

                return (
                  <div
                    key={entry.participantId}
                    className={`dm-order-row${entry.active ? " is-active" : ""}`}
                  >
                    <button
                      type="button"
                      className="dm-order-select"
                      onClick={() => setSelectedInspectorId(entry.participantId)}
                    >
                      <strong>
                        {entry.rank}. {entry.displayName}
                      </strong>
                      <span>
                        Pool {entry.poolSize}
                        {entry.successes !== null ? ` | Successes ${entry.successes}` : ""}
                      </span>
                      <small>
                        {participant.ownerRole} | {participant.kind}
                        {entry.surprise ? " | surprise" : ""}
                        {entry.freeRound ? " | free round" : ""}
                      </small>
                    </button>
                    {currentCombat.stage === "initiative_roll" ? (
                      <div className="dm-entry-actions">
                        <button
                          type="button"
                          onClick={() => handleRollInitiative(entry.participantId)}
                          disabled={isRolled}
                        >
                          {isRolled ? "Rolled" : "Roll"}
                        </button>
                      </div>
                    ) : null}
                    {currentCombat.stage === "initiative_review" ? (
                      <div className="dm-entry-actions">
                        <button type="button" onClick={() => handleMoveInitiative(entry.participantId, -1)}>
                          Up
                        </button>
                        <button type="button" onClick={() => handleMoveInitiative(entry.participantId, 1)}>
                          Down
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {currentCombat.stage === "initiative_review" ? (
              <div className="dm-control-row">
                <button
                  type="button"
                  className="flow-primary"
                  onClick={() =>
                    runCombatCommand({
                      kind: "finalize_initiative",
                      controllerRole: "dm",
                      controllerParticipantId: null,
                    })
                  }
                >
                  Finalize Initiative
                </button>
              </div>
            ) : null}
          </article>

          <article className="sheet-card">
            <p className="section-kicker">Workflow Panel</p>
            <h2>
              {reactionPrompt
                ? "Reaction Prompt"
                : workflowPanel
                  ? "Action Workflow"
                  : "Awaiting Combat Trigger"}
            </h2>

            {reactionPrompt ? (
              <div className="dm-stack">
                <p className="dm-summary-line">
                  Reacting combatant:{" "}
                  {currentCombat.participants[reactionPrompt.participantId]?.displayName ??
                    reactionPrompt.participantId}
                </p>
                <div className="dm-option-grid">
                  {reactionPrompt.subtypeOptions.map((option) => (
                    <button
                      key={option.subtypeId}
                      type="button"
                      className="flow-secondary"
                      onClick={() =>
                        runCombatCommand({
                          kind: "select_reaction",
                          actorParticipantId: reactionPrompt.participantId,
                          reactionSubtypeId: option.subtypeId,
                          controllerRole: "dm",
                          controllerParticipantId: null,
                        })
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="flow-cancel"
                  onClick={() =>
                    runCombatCommand({
                      kind: "skip_reaction",
                      actorParticipantId: reactionPrompt.participantId,
                      controllerRole: "dm",
                      controllerParticipantId: null,
                    })
                  }
                >
                  Skip Reaction
                </button>
              </div>
            ) : !workflowPanel ? (
              <p className="empty-block-copy">No workflow is open yet.</p>
            ) : (
              <div className="dm-stack">
                <p className="dm-summary-line">
                  Actor:{" "}
                  {currentCombat.participants[workflowPanel.actorParticipantId]?.displayName ??
                    workflowPanel.actorParticipantId}
                </p>
                <p className="dm-summary-line">Step: {workflowPanel.step}</p>

                {workflowPanel.step === "choose_action" ? (
                  <div className="dm-option-grid">
                    {actionBar.map((option) => (
                      <button
                        key={option.actionFamilyId}
                        type="button"
                        className={option.enabled ? "flow-secondary" : "flow-cancel"}
                        disabled={!option.enabled}
                        title={option.disabledReason ?? undefined}
                        onClick={() =>
                          runCombatCommand({
                            kind: "select_action_family",
                            actorParticipantId: workflowPanel.actorParticipantId,
                            actionFamilyId: option.actionFamilyId,
                            controllerRole: "dm",
                            controllerParticipantId: null,
                          })
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {workflowPanel.step === "choose_subtype" ? (
                  <div className="dm-option-grid">
                    {workflowPanel.subtypeOptions.map((option) => (
                      <button
                        key={option.subtypeId}
                        type="button"
                        className="flow-secondary"
                        onClick={() =>
                          runCombatCommand({
                            kind: "select_action_subtype",
                            actorParticipantId: workflowPanel.actorParticipantId,
                            subtypeId: option.subtypeId,
                            controllerRole: "dm",
                            controllerParticipantId: null,
                          })
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {workflowPanel.step === "choose_targets" ? (
                  <>
                    <div className="dm-option-grid">
                      {workflowPanel.targetOptions.map((target) => {
                        const isMultiTarget =
                          workflowPanel.targetRule?.startsWith("multi") ?? false;
                        const isSelected = isMultiTarget
                          ? targetDraftIds.includes(target.participantId)
                          : target.selected;

                        return (
                          <button
                            key={target.participantId}
                            type="button"
                            className={
                              isSelected
                                ? "flow-primary dm-target-button"
                                : "flow-secondary dm-target-button"
                            }
                            disabled={!target.enabled}
                            title={target.disabledReason ?? undefined}
                            onClick={() => handleSelectTarget(target)}
                          >
                            {target.label} ({target.relation})
                          </button>
                        );
                      })}
                    </div>
                    {workflowPanel.targetRule?.startsWith("multi") ? (
                      <button
                        type="button"
                        className="flow-primary"
                        disabled={
                          targetDraftIds.length < workflowPanel.minTargets ||
                          targetDraftIds.length > workflowPanel.maxTargets
                        }
                        onClick={handleConfirmTargets}
                      >
                        Confirm Targets
                      </button>
                    ) : null}
                  </>
                ) : null}

                {workflowPanel.step === "choose_parameters" ? (
                  <>
                    <div className="dm-parameter-grid">
                      {workflowPanel.parameterDefinitions.map((parameterDefinition) => (
                        <label key={parameterDefinition.key} className="dm-field">
                          <span>{parameterDefinition.label}</span>
                          {parameterDefinition.type === "select" ? (
                            <select
                              value={String(parameterDraft[parameterDefinition.key] ?? "")}
                              onChange={(event) =>
                                setParameterDraft((currentDraft) => ({
                                  ...currentDraft,
                                  [parameterDefinition.key]: event.target.value,
                                }))
                              }
                            >
                              <option value="">Select</option>
                              {parameterDefinition.options?.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : parameterDefinition.type === "boolean" ? (
                            <select
                              value={String(parameterDraft[parameterDefinition.key] ?? "")}
                              onChange={(event) =>
                                setParameterDraft((currentDraft) => ({
                                  ...currentDraft,
                                  [parameterDefinition.key]: event.target.value === "true",
                                }))
                              }
                            >
                              <option value="">Select</option>
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          ) : (
                            <input
                              type="number"
                              min={parameterDefinition.min}
                              max={parameterDefinition.max}
                              value={String(parameterDraft[parameterDefinition.key] ?? "")}
                              onChange={(event) =>
                                setParameterDraft((currentDraft) => ({
                                  ...currentDraft,
                                  [parameterDefinition.key]: normalizeParameterValue(
                                    event.target.value,
                                    parameterDefinition.type
                                  ),
                                }))
                              }
                            />
                          )}
                        </label>
                      ))}
                    </div>
                    <button type="button" className="flow-primary" onClick={handleConfirmParameters}>
                      Continue
                    </button>
                  </>
                ) : null}

                {workflowPanel.step === "confirm" ? (
                  <div className="dm-stack">
                    <div className="dm-summary-box">
                      <strong>Action</strong>
                      <span>{workflowPanel.selectedActionFamilyId ?? "-"}</span>
                    </div>
                    <div className="dm-summary-box">
                      <strong>Subtype</strong>
                      <span>{workflowPanel.selectedSubtypeId ?? "-"}</span>
                    </div>
                    <div className="dm-summary-box">
                      <strong>Targets</strong>
                      <span>
                        {workflowPanel.selectedTargetIds.length > 0
                          ? workflowPanel.selectedTargetIds
                              .map(
                                (participantId) =>
                                  currentCombat.participants[participantId]?.displayName ?? participantId
                              )
                              .join(", ")
                          : "none"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="flow-primary"
                      onClick={() =>
                        runCombatCommand({
                          kind: "confirm_workflow",
                          controllerRole: "dm",
                          controllerParticipantId: null,
                        })
                      }
                    >
                      Resolve Action
                    </button>
                  </div>
                ) : null}

                <div className="dm-control-row">
                  {workflowPanel.canBack ? (
                    <button
                      type="button"
                      className="flow-secondary"
                      onClick={() =>
                        runCombatCommand({
                          kind: "workflow_back",
                          controllerRole: "dm",
                          controllerParticipantId: null,
                        })
                      }
                    >
                      Back
                    </button>
                  ) : null}
                  {workflowPanel.canCancel ? (
                    <button
                      type="button"
                      className="flow-cancel"
                      onClick={() =>
                        runCombatCommand({
                          kind: "workflow_cancel",
                          controllerRole: "dm",
                          controllerParticipantId: null,
                        })
                      }
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </article>

          <article className="sheet-card">
            <p className="section-kicker">Combatant Inspector</p>
            <h2>{inspector?.displayName ?? "No Combatant Selected"}</h2>
            {inspector ? (
              <>
                <p className="dm-summary-line">
                  {inspector.ownerRole} | team {inspector.teamId}
                </p>
                <div className="dm-action-grid">
                  <div>
                    <span>HP</span>
                    <strong>{inspector.hp}</strong>
                  </div>
                  <div>
                    <span>Mana</span>
                    <strong>{inspector.mana}</strong>
                  </div>
                  <div>
                    <span>Initiative Pool</span>
                    <strong>{inspector.derived.initiativePool}</strong>
                  </div>
                  <div>
                    <span>Movement</span>
                    <strong>{inspector.movement.remainingMeters}m</strong>
                  </div>
                  <div>
                    <span>AC</span>
                    <strong>{inspector.derived.armorClass}</strong>
                  </div>
                  <div>
                    <span>DR / Soak</span>
                    <strong>
                      {inspector.derived.damageReduction} / {inspector.derived.soak}
                    </strong>
                  </div>
                </div>
                <div className="dm-inline-controls dm-inline-controls-two-up">
                  <div className="dm-summary-box">
                    <strong>Actions</strong>
                    <span>
                      S {inspector.actionState.available.standard ?? "inf"} | B{" "}
                      {inspector.actionState.available.bonus ?? "inf"} | M{" "}
                      {inspector.actionState.available.move ?? "inf"} | R{" "}
                      {inspector.actionState.available.reaction ?? "inf"}
                    </span>
                  </div>
                  <div className="dm-summary-box">
                    <strong>Status</strong>
                    <span>
                      {inspector.statuses.length > 0 ? inspector.statuses.join(", ") : "none"}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="empty-block-copy">Select a combatant from initiative.</p>
            )}
          </article>

          <article className="sheet-card">
            <p className="section-kicker">DM Override Panel</p>
            <h2>Overrides</h2>
            {currentCombat.stage === "initiative_review" ? (
              <div className="dm-list">
                {initiativeView?.orderedEntries.map((entry) => (
                  <div key={entry.participantId} className="dm-selection-row">
                    <span>{entry.displayName}</span>
                    <div className="dm-entry-actions">
                      <button
                        type="button"
                        onClick={() =>
                          toggleParticipantFlag("set_surprise_participants", entry.participantId)
                        }
                      >
                        {entry.surprise ? "Unmark Surprise" : "Surprise"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          toggleParticipantFlag("set_free_round_participants", entry.participantId)
                        }
                      >
                        {entry.freeRound ? "Remove Free Round" : "Free Round"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-block-copy">
                Initiative overrides are available during initiative review.
              </p>
            )}
          </article>

          <article className="sheet-card dm-log-card">
            <p className="section-kicker">Event Log</p>
            <h2>Combat Event Stream</h2>
            <div className="dm-log-list">
              {eventLog.map((event) => (
                <div key={event.eventId} className="dm-log-row">
                  <strong>{event.name}</strong>
                  <span>{event.message}</span>
                  <small>
                    Round {event.roundNumber} | {new Date(event.createdAt).toLocaleTimeString()}
                  </small>
                </div>
              ))}
            </div>
          </article>
        </section>

        {dashboardError ? <p className="dm-error">{dashboardError}</p> : null}
      </section>
    </main>
  );
}
