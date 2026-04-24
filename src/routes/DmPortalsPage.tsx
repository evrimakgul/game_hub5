import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import {
  applyCodexImportPayload,
  buildCodexRequestPacketText,
  duplicatePortalTemplate,
  getPortalStageComputedChallengeRating,
  getPortalTemplatePromptSummary,
  parseCodexImportPayload,
  validatePortalTemplate,
} from "../lib/authoring.ts";
import { createTimestampedId } from "../lib/ids.ts";
import { useAppFlow } from "../state/appFlow";
import type { PortalStage } from "../types/authoring.ts";

type PortalRequestStageDraft = {
  id: string;
  title: string;
  targetChallengeRating: string;
  environmentTags: string;
  objective: string;
};

function parseCommaSeparatedList(value: string): string[] {
  return [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))];
}

function normalizeStages(stages: PortalStage[]): PortalStage[] {
  return stages.map((stage, index) => ({
    ...stage,
    index: index + 1,
    title: stage.title.trim() || `Stage ${index + 1}`,
    isBossStage: index === stages.length - 1,
  }));
}

function createRequestStageDraft(index: number): PortalRequestStageDraft {
  return {
    id: createTimestampedId("portal-request-stage"),
    title: `Stage ${index}`,
    targetChallengeRating: "",
    environmentTags: "",
    objective: "",
  };
}

function syncRequestStageDrafts(
  currentDrafts: PortalRequestStageDraft[],
  nextStageCount: number
): PortalRequestStageDraft[] {
  const clampedStageCount = Math.max(2, Math.min(5, nextStageCount));
  if (currentDrafts.length === clampedStageCount) {
    return currentDrafts.map((draft, index) => ({
      ...draft,
      title: draft.title.trim() || `Stage ${index + 1}`,
    }));
  }

  if (currentDrafts.length > clampedStageCount) {
    return currentDrafts.slice(0, clampedStageCount).map((draft, index) => ({
      ...draft,
      title: draft.title.trim() || `Stage ${index + 1}`,
    }));
  }

  return [
    ...currentDrafts.map((draft, index) => ({
      ...draft,
      title: draft.title.trim() || `Stage ${index + 1}`,
    })),
    ...Array.from({ length: clampedStageCount - currentDrafts.length }, (_value, offset) =>
      createRequestStageDraft(currentDrafts.length + offset + 1)
    ),
  ];
}

export function DmPortalsPage() {
  const navigate = useNavigate();
  const {
    roleChoice,
    mobTemplates,
    mobGroups,
    portalTemplates,
    createPortalTemplate,
    updatePortalTemplate,
    deletePortalTemplate,
    updateAuthoringState,
  } = useAppFlow();
  const [selectedPortalId, setSelectedPortalId] = useState<string | null>(
    portalTemplates[0]?.id ?? null
  );
  const [requestIntent, setRequestIntent] = useState(
    "Draft a portal bundle with linked groups and mobs."
  );
  const [requestPortalName, setRequestPortalName] = useState("");
  const [requestTheme, setRequestTheme] = useState("");
  const [requestDepth, setRequestDepth] = useState("1");
  const [requestStageCount, setRequestStageCount] = useState("3");
  const [requestPartyMeanChallengeRating, setRequestPartyMeanChallengeRating] = useState("");
  const [requestStageDrafts, setRequestStageDrafts] = useState<PortalRequestStageDraft[]>([
    createRequestStageDraft(1),
    createRequestStageDraft(2),
    createRequestStageDraft(3),
  ]);
  const [exportPacket, setExportPacket] = useState("");
  const [importPayload, setImportPayload] = useState("");
  const [panelMessage, setPanelMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPortalId && portalTemplates.length > 0) {
      setSelectedPortalId(portalTemplates[0]?.id ?? null);
      return;
    }

    if (selectedPortalId && !portalTemplates.some((portal) => portal.id === selectedPortalId)) {
      setSelectedPortalId(portalTemplates[0]?.id ?? null);
    }
  }, [portalTemplates, selectedPortalId]);

  useEffect(() => {
    const nextStageCount = Math.max(2, Math.min(5, Number.parseInt(requestStageCount || "3", 10) || 3));
    setRequestStageDrafts((currentDrafts) => syncRequestStageDrafts(currentDrafts, nextStageCount));
  }, [requestStageCount]);

  const selectedPortal =
    portalTemplates.find((portal) => portal.id === selectedPortalId) ??
    portalTemplates[0] ??
    null;
  const mobTemplatesById = useMemo(
    () => new Map(mobTemplates.map((mobTemplate) => [mobTemplate.id, mobTemplate])),
    [mobTemplates]
  );
  const mobGroupsById = useMemo(
    () => new Map(mobGroups.map((group) => [group.id, group])),
    [mobGroups]
  );
  const validationErrors = selectedPortal
    ? validatePortalTemplate(selectedPortal, mobGroupsById)
    : [];
  const publishedExamples = selectedPortal
    ? portalTemplates
        .filter((portal) => portal.id !== selectedPortal.id && portal.status === "published")
        .slice(0, 3)
    : portalTemplates.filter((portal) => portal.status === "published").slice(0, 3);

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  function createNewPortal(): void {
    const portalId = createPortalTemplate();
    setSelectedPortalId(portalId);
    setPanelMessage(null);
  }

  function duplicateSelectedPortal(): void {
    if (!selectedPortal) {
      return;
    }

    const portalId = createPortalTemplate(duplicatePortalTemplate(selectedPortal));
    setSelectedPortalId(portalId);
    setPanelMessage(null);
  }

  function deleteSelectedPortal(): void {
    if (!selectedPortal) {
      return;
    }

    deletePortalTemplate(selectedPortal.id);
    setPanelMessage("Deleted the selected portal template.");
  }

  function updateSelectedPortalStatus(nextStatus: "draft" | "playtest_ready" | "published"): void {
    if (!selectedPortal) {
      return;
    }

    if (nextStatus === "published" && validationErrors.length > 0) {
      setPanelMessage(validationErrors[0] ?? "Portal validation failed.");
      return;
    }

    updatePortalTemplate(selectedPortal.id, (currentPortal) => ({
      ...currentPortal,
      status: nextStatus,
      stages: normalizeStages(currentPortal.stages),
    }));
    setPanelMessage(null);
  }

  function addStage(): void {
    if (!selectedPortal || selectedPortal.stages.length >= 5) {
      return;
    }

    updatePortalTemplate(selectedPortal.id, (currentPortal) => ({
      ...currentPortal,
      stages: normalizeStages([
        ...currentPortal.stages,
        {
          id: createTimestampedId("portal-stage"),
          index: currentPortal.stages.length + 1,
          title: `Stage ${currentPortal.stages.length + 1}`,
          sceneText: "",
          environmentTags: [],
          groupReferences: [],
          targetChallengeRating: null,
          traps: "",
          chest: "",
          objective: "",
          isBossStage: false,
        },
      ]),
    }));
  }

  function removeStage(stageIndex: number): void {
    if (!selectedPortal) {
      return;
    }

    updatePortalTemplate(selectedPortal.id, (currentPortal) => ({
      ...currentPortal,
      stages: normalizeStages(
        currentPortal.stages.filter((_stage, currentIndex) => currentIndex !== stageIndex)
      ),
    }));
  }

  function addGroupReference(stageIndex: number): void {
    if (!selectedPortal) {
      return;
    }

    updatePortalTemplate(selectedPortal.id, (currentPortal) => ({
      ...currentPortal,
      stages: normalizeStages(
        currentPortal.stages.map((stage, currentIndex) =>
          currentIndex === stageIndex
            ? {
                ...stage,
                groupReferences: [
                  ...stage.groupReferences,
                  {
                    id: createTimestampedId("portal-stage-group"),
                    mobGroupId: mobGroups[0]?.id ?? "",
                    quantityMultiplier: 1,
                    notes: "",
                  },
                ],
              }
            : stage
        )
      ),
    }));
  }

  function buildPortalExportPacket(): void {
    const nextTheme =
      requestTheme.trim() || selectedPortal?.theme || publishedExamples[0]?.theme || "";
    const nextDepth =
      Number.parseInt(requestDepth || String(selectedPortal?.depth ?? 1), 10) ||
      selectedPortal?.depth ||
      1;
    const nextStageCount = Math.max(
      2,
      Math.min(5, Number.parseInt(requestStageCount || String(selectedPortal?.stages.length ?? 3), 10) || selectedPortal?.stages.length || 3)
    );
    const nextPartyMeanChallengeRating =
      requestPartyMeanChallengeRating.trim().length > 0
        ? Math.max(0, Number.parseInt(requestPartyMeanChallengeRating, 10) || 0)
        : selectedPortal?.partyMeanChallengeRating ?? null;
    const requestStageSummaries = syncRequestStageDrafts(requestStageDrafts, nextStageCount).map(
      (stageDraft, index) => ({
        index: index + 1,
        title: stageDraft.title.trim() || `Stage ${index + 1}`,
        isBossStage: index === nextStageCount - 1,
        targetChallengeRating:
          stageDraft.targetChallengeRating.trim().length > 0
            ? Math.max(0, Number.parseInt(stageDraft.targetChallengeRating, 10) || 0)
            : null,
        environmentTags: parseCommaSeparatedList(stageDraft.environmentTags),
        objective: stageDraft.objective.trim(),
      })
    );
    const shouldUseRequestBrief =
      requestPortalName.trim().length > 0 ||
      requestPartyMeanChallengeRating.trim().length > 0 ||
      requestStageCount.trim().length > 0 ||
      requestStageSummaries.some(
        (stage) =>
          stage.targetChallengeRating !== null ||
          stage.environmentTags.length > 0 ||
          stage.objective.length > 0 ||
          stage.title !== `Stage ${stage.index}`
      );
    const currentObject =
      selectedPortal && selectedPortal.stages.length > 0 && !shouldUseRequestBrief
        ? getPortalTemplatePromptSummary(selectedPortal, mobGroupsById, mobTemplatesById)
        : {
            portal: {
              name: requestPortalName.trim(),
              theme: nextTheme,
              depth: nextDepth,
              partyMeanChallengeRating: nextPartyMeanChallengeRating,
              stageCount: nextStageCount,
              stages: requestStageSummaries,
            },
            generationOrder: ["portal", "groups", "mobs"],
          };

    setExportPacket(
      buildCodexRequestPacketText({
        requestKind: "portal_bundle",
        requestIntent,
        theme: nextTheme,
        depth: nextDepth,
        stageCount: nextStageCount,
        difficulty: {
          partyMeanChallengeRating: nextPartyMeanChallengeRating,
          stageChallengeRatings: requestStageSummaries.map((stage) => ({
            index: stage.index,
            title: stage.title,
            isBossStage: stage.isBossStage,
            targetChallengeRating: stage.targetChallengeRating,
          })),
        },
        currentObject,
        exampleObjects: publishedExamples.map((portal) =>
          getPortalTemplatePromptSummary(portal, mobGroupsById, mobTemplatesById)
        ),
      })
    );
    setPanelMessage("Built a request packet for manual Codex portal-bundle generation.");
  }

  function importPortalPayload(): void {
    const parsed = parseCodexImportPayload(importPayload);
    if ("error" in parsed) {
      setPanelMessage(parsed.error);
      return;
    }

    if (parsed.kind !== "portal_template" && parsed.kind !== "portal_bundle") {
      setPanelMessage("This import box expects a portal_template or portal_bundle payload.");
      return;
    }

    updateAuthoringState((currentState) =>
      applyCodexImportPayload({
        payload: parsed,
        rawPayload: importPayload,
        currentState,
      })
    );
    setSelectedPortalId(parsed.portal.id);
    setPanelMessage(
      parsed.kind === "portal_bundle"
        ? `Imported portal bundle ${parsed.portal.name} with ${parsed.mobs.length} mob(s) and ${parsed.groups.length} group(s).`
        : `Imported portal template ${parsed.portal.name}.`
    );
    setImportPayload("");
  }

  return (
    <main className="dm-page">
      <section className="dm-shell">
        <header className="dm-topbar">
          <div>
            <p className="section-kicker">Dungeon Master</p>
            <h1>Portal Workshop</h1>
          </div>
          <div className="dm-nav-actions">
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm")}>
              DM Dashboard
            </button>
          </div>
        </header>

        <section className="flow-card flow-card-wide">
          <div className="dm-item-edit-actions">
            <button type="button" className="flow-primary" onClick={createNewPortal}>
              Create New Portal
            </button>
            <button type="button" className="flow-secondary" onClick={duplicateSelectedPortal}>
              Duplicate Selected Portal
            </button>
            <button type="button" className="flow-secondary" onClick={addStage}>
              Add Stage
            </button>
            <button type="button" className="flow-danger" onClick={deleteSelectedPortal}>
              Delete Selected Portal
            </button>
          </div>

          <div className="dm-item-edit-layout">
            <article className="sheet-card dm-item-picker-card">
              <p className="section-kicker">Saved Portals</p>
              <div className="dm-item-picker-list">
                {portalTemplates.length === 0 ? (
                  <p className="empty-block-copy">No portal templates saved yet.</p>
                ) : (
                  portalTemplates.map((portal) => (
                    <button
                      key={portal.id}
                      type="button"
                      className={`dm-item-picker-button${portal.id === selectedPortal?.id ? " is-active" : ""}`}
                      onClick={() => setSelectedPortalId(portal.id)}
                    >
                      <strong>{portal.name}</strong>
                      <span>{portal.theme || "No theme"}</span>
                      <small>
                        Depth {portal.depth} | {portal.stages.length} stage(s) | {portal.status}
                      </small>
                    </button>
                  ))
                )}
              </div>
            </article>

            <article className="sheet-card dm-item-editor-card">
              {!selectedPortal ? (
                <p className="empty-block-copy">Select or create a portal to start editing.</p>
              ) : (
                <div className="dm-item-editor-stack">
                  <section className="dm-item-editor-section">
                    <div className="dm-item-summary-head">
                      <div>
                        <p className="section-kicker">Metadata</p>
                        <h2>{selectedPortal.name}</h2>
                      </div>
                      <div className="row-side">
                        <strong>{selectedPortal.status}</strong>
                        <p>Version {selectedPortal.version}</p>
                      </div>
                    </div>
                    <div className="dm-item-edit-grid">
                      <label className="dm-field">
                        <span>Portal Name</span>
                        <input
                          value={selectedPortal.name}
                          onChange={(event) =>
                            updatePortalTemplate(selectedPortal.id, (currentPortal) => ({
                              ...currentPortal,
                              name: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Theme</span>
                        <input
                          value={selectedPortal.theme}
                          onChange={(event) =>
                            updatePortalTemplate(selectedPortal.id, (currentPortal) => ({
                              ...currentPortal,
                              theme: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Status</span>
                        <select
                          value={selectedPortal.status}
                          onChange={(event) =>
                            updateSelectedPortalStatus(event.target.value as typeof selectedPortal.status)
                          }
                        >
                          <option value="draft">draft</option>
                          <option value="playtest_ready">playtest_ready</option>
                          <option value="published">published</option>
                        </select>
                      </label>
                    </div>
                    <div className="dm-item-edit-grid">
                      <label className="dm-field">
                        <span>Depth</span>
                        <input
                          type="number"
                          min={1}
                          value={selectedPortal.depth}
                          onChange={(event) =>
                            updatePortalTemplate(selectedPortal.id, (currentPortal) => ({
                              ...currentPortal,
                              depth: Math.max(
                                1,
                                Number.parseInt(event.target.value || "1", 10) || 1
                              ),
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Party Mean CR</span>
                        <input
                          type="number"
                          min={0}
                          value={selectedPortal.partyMeanChallengeRating ?? ""}
                          onChange={(event) =>
                            updatePortalTemplate(selectedPortal.id, (currentPortal) => ({
                              ...currentPortal,
                              partyMeanChallengeRating:
                                event.target.value.trim().length > 0
                                  ? Math.max(
                                      0,
                                      Number.parseInt(event.target.value, 10) || 0
                                    )
                                  : null,
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Closing Reward</span>
                        <textarea
                          className="notes-input"
                          value={selectedPortal.closingReward}
                          onChange={(event) =>
                            updatePortalTemplate(selectedPortal.id, (currentPortal) => ({
                              ...currentPortal,
                              closingReward: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Exit Summary</span>
                        <textarea
                          className="notes-input"
                          value={selectedPortal.exitSummary}
                          onChange={(event) =>
                            updatePortalTemplate(selectedPortal.id, (currentPortal) => ({
                              ...currentPortal,
                              exitSummary: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                    <label className="dm-field">
                      <span>Intro</span>
                      <textarea
                        className="notes-input"
                        value={selectedPortal.intro}
                        onChange={(event) =>
                          updatePortalTemplate(selectedPortal.id, (currentPortal) => ({
                            ...currentPortal,
                            intro: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </section>

                  <section className="dm-item-editor-section">
                    <div className="dm-item-summary-head">
                      <div>
                        <p className="section-kicker">Stages</p>
                        <h3>2-5 Ordered Portal Stages</h3>
                      </div>
                    </div>

                    <div className="dm-stack">
                      {selectedPortal.stages.map((stage, stageIndex) => (
                        <div key={stage.id} className="dm-item-custom-property">
                          <div className="dm-item-summary-head">
                            <div>
                              <strong>{stage.title || `Stage ${stageIndex + 1}`}</strong>
                              <p>{stage.isBossStage ? "Boss Stage" : "Progression Stage"}</p>
                            </div>
                            <div className="dm-entry-actions">
                              <button type="button" onClick={() => addGroupReference(stageIndex)}>
                                Add Group
                              </button>
                              <button
                                type="button"
                                className="flow-danger"
                                onClick={() => removeStage(stageIndex)}
                              >
                                Remove Stage
                              </button>
                            </div>
                          </div>

                          <div className="dm-item-edit-grid">
                            <label className="dm-field">
                              <span>Stage Title</span>
                              <input
                                value={stage.title}
                                onChange={(event) =>
                                  updatePortalTemplate(selectedPortal.id, (currentPortal) => ({
                                    ...currentPortal,
                                    stages: normalizeStages(
                                      currentPortal.stages.map((currentStage, currentIndex) =>
                                        currentIndex === stageIndex
                                          ? {
                                              ...currentStage,
                                              title: event.target.value,
                                            }
                                          : currentStage
                                      )
                                    ),
                                  }))
                                }
                              />
                            </label>
                            <label className="dm-field">
                              <span>Target Total CR</span>
                              <input
                                type="number"
                                min={0}
                                value={stage.targetChallengeRating ?? ""}
                                onChange={(event) =>
                                  updatePortalTemplate(selectedPortal.id, (currentPortal) => ({
                                    ...currentPortal,
                                    stages: normalizeStages(
                                      currentPortal.stages.map((currentStage, currentIndex) =>
                                        currentIndex === stageIndex
                                          ? {
                                              ...currentStage,
                                              targetChallengeRating:
                                                event.target.value.trim().length > 0
                                                  ? Math.max(
                                                      0,
                                                      Number.parseInt(
                                                        event.target.value,
                                                        10
                                                      ) || 0
                                                    )
                                                  : null,
                                            }
                                          : currentStage
                                      )
                                    ),
                                  }))
                                }
                              />
                            </label>
                            <label className="dm-field">
                              <span>Environment Tags</span>
                              <input
                                value={stage.environmentTags.join(", ")}
                                onChange={(event) =>
                                  updatePortalTemplate(selectedPortal.id, (currentPortal) => ({
                                    ...currentPortal,
                                    stages: normalizeStages(
                                      currentPortal.stages.map((currentStage, currentIndex) =>
                                        currentIndex === stageIndex
                                          ? {
                                              ...currentStage,
                                              environmentTags: parseCommaSeparatedList(
                                                event.target.value
                                              ),
                                            }
                                          : currentStage
                                      )
                                    ),
                                  }))
                                }
                              />
                            </label>
                            <label className="dm-field">
                              <span>Computed Total CR</span>
                              <input
                                readOnly
                                value={getPortalStageComputedChallengeRating(
                                  stage,
                                  mobGroupsById,
                                  mobTemplatesById
                                )}
                              />
                            </label>
                            <label className="dm-field">
                              <span>Objective</span>
                              <input
                                value={stage.objective}
                                onChange={(event) =>
                                  updatePortalTemplate(selectedPortal.id, (currentPortal) => ({
                                    ...currentPortal,
                                    stages: normalizeStages(
                                      currentPortal.stages.map((currentStage, currentIndex) =>
                                        currentIndex === stageIndex
                                          ? {
                                              ...currentStage,
                                              objective: event.target.value,
                                            }
                                          : currentStage
                                      )
                                    ),
                                  }))
                                }
                              />
                            </label>
                          </div>

                          <div className="dm-item-edit-grid dm-item-edit-grid-two-up">
                            <label className="dm-field">
                              <span>Scene Text</span>
                              <textarea
                                className="notes-input"
                                value={stage.sceneText}
                                onChange={(event) =>
                                  updatePortalTemplate(selectedPortal.id, (currentPortal) => ({
                                    ...currentPortal,
                                    stages: normalizeStages(
                                      currentPortal.stages.map((currentStage, currentIndex) =>
                                        currentIndex === stageIndex
                                          ? {
                                              ...currentStage,
                                              sceneText: event.target.value,
                                            }
                                          : currentStage
                                      )
                                    ),
                                  }))
                                }
                              />
                            </label>
                            <div className="dm-stack">
                              <label className="dm-field">
                                <span>Traps</span>
                                <textarea
                                  className="notes-input"
                                  value={stage.traps}
                                  onChange={(event) =>
                                    updatePortalTemplate(selectedPortal.id, (currentPortal) => ({
                                      ...currentPortal,
                                      stages: normalizeStages(
                                        currentPortal.stages.map((currentStage, currentIndex) =>
                                          currentIndex === stageIndex
                                            ? {
                                                ...currentStage,
                                                traps: event.target.value,
                                              }
                                            : currentStage
                                        )
                                      ),
                                    }))
                                  }
                                />
                              </label>
                              <label className="dm-field">
                                <span>Chest</span>
                                <textarea
                                  className="notes-input"
                                  value={stage.chest}
                                  onChange={(event) =>
                                    updatePortalTemplate(selectedPortal.id, (currentPortal) => ({
                                      ...currentPortal,
                                      stages: normalizeStages(
                                        currentPortal.stages.map((currentStage, currentIndex) =>
                                          currentIndex === stageIndex
                                            ? {
                                                ...currentStage,
                                                chest: event.target.value,
                                              }
                                            : currentStage
                                        )
                                      ),
                                    }))
                                  }
                                />
                              </label>
                            </div>
                          </div>

                          <div className="dm-stack">
                            {stage.groupReferences.map((reference, referenceIndex) => (
                              <div key={reference.id} className="dm-item-custom-property">
                                <div className="dm-item-edit-grid">
                                  <label className="dm-field">
                                    <span>Mob Group</span>
                                    <select
                                      value={reference.mobGroupId}
                                      onChange={(event) =>
                                        updatePortalTemplate(selectedPortal.id, (currentPortal) => ({
                                          ...currentPortal,
                                          stages: normalizeStages(
                                            currentPortal.stages.map((currentStage, currentStageIndex) =>
                                              currentStageIndex === stageIndex
                                                ? {
                                                    ...currentStage,
                                                    groupReferences: currentStage.groupReferences.map(
                                                      (currentReference, currentReferenceIndex) =>
                                                        currentReferenceIndex === referenceIndex
                                                          ? {
                                                              ...currentReference,
                                                              mobGroupId: event.target.value,
                                                            }
                                                          : currentReference
                                                    ),
                                                  }
                                                : currentStage
                                            )
                                          ),
                                        }))
                                      }
                                    >
                                      <option value="">Choose group</option>
                                      {mobGroups.map((group) => (
                                        <option key={group.id} value={group.id}>
                                          {group.name}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="dm-field">
                                    <span>Quantity Multiplier</span>
                                    <input
                                      type="number"
                                      min={1}
                                      value={reference.quantityMultiplier}
                                      onChange={(event) =>
                                        updatePortalTemplate(selectedPortal.id, (currentPortal) => ({
                                          ...currentPortal,
                                          stages: normalizeStages(
                                            currentPortal.stages.map((currentStage, currentStageIndex) =>
                                              currentStageIndex === stageIndex
                                                ? {
                                                    ...currentStage,
                                                    groupReferences: currentStage.groupReferences.map(
                                                      (currentReference, currentReferenceIndex) =>
                                                        currentReferenceIndex === referenceIndex
                                                          ? {
                                                              ...currentReference,
                                                              quantityMultiplier: Math.max(
                                                                1,
                                                                Number.parseInt(
                                                                  event.target.value || "1",
                                                                  10
                                                                ) || 1
                                                              ),
                                                            }
                                                          : currentReference
                                                    ),
                                                  }
                                                : currentStage
                                            )
                                          ),
                                        }))
                                      }
                                    />
                                  </label>
                                  <div className="dm-control-row">
                                    <button
                                      type="button"
                                      className="flow-danger"
                                      onClick={() =>
                                        updatePortalTemplate(selectedPortal.id, (currentPortal) => ({
                                          ...currentPortal,
                                          stages: normalizeStages(
                                            currentPortal.stages.map((currentStage, currentStageIndex) =>
                                              currentStageIndex === stageIndex
                                                ? {
                                                    ...currentStage,
                                                    groupReferences: currentStage.groupReferences.filter(
                                                      (_currentReference, currentReferenceIndex) =>
                                                        currentReferenceIndex !== referenceIndex
                                                    ),
                                                  }
                                                : currentStage
                                            )
                                          ),
                                        }))
                                      }
                                    >
                                      Remove Group
                                    </button>
                                  </div>
                                </div>
                                <label className="dm-field">
                                  <span>Notes</span>
                                  <textarea
                                    className="notes-input"
                                    value={reference.notes}
                                    onChange={(event) =>
                                      updatePortalTemplate(selectedPortal.id, (currentPortal) => ({
                                        ...currentPortal,
                                        stages: normalizeStages(
                                          currentPortal.stages.map((currentStage, currentStageIndex) =>
                                            currentStageIndex === stageIndex
                                              ? {
                                                  ...currentStage,
                                                  groupReferences: currentStage.groupReferences.map(
                                                    (currentReference, currentReferenceIndex) =>
                                                      currentReferenceIndex === referenceIndex
                                                        ? {
                                                            ...currentReference,
                                                            notes: event.target.value,
                                                          }
                                                        : currentReference
                                                  ),
                                                }
                                              : currentStage
                                          )
                                        ),
                                      }))
                                    }
                                  />
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="dm-item-editor-section">
                    <p className="section-kicker">Codex Portal Bundle Bridge</p>
                    <div className="dm-item-edit-grid dm-item-edit-grid-paired-stats">
                      <label className="dm-field">
                        <span>Request Intent</span>
                        <input
                          value={requestIntent}
                          onChange={(event) => setRequestIntent(event.target.value)}
                        />
                      </label>
                      <label className="dm-field">
                        <span>Portal Name</span>
                        <input
                          value={requestPortalName}
                          onChange={(event) => setRequestPortalName(event.target.value)}
                          placeholder={selectedPortal?.name ?? ""}
                        />
                      </label>
                      <label className="dm-field">
                        <span>Theme</span>
                        <input
                          value={requestTheme}
                          onChange={(event) => setRequestTheme(event.target.value)}
                          placeholder={selectedPortal?.theme ?? ""}
                        />
                      </label>
                      <label className="dm-field">
                        <span>Depth</span>
                        <input
                          type="number"
                          min={1}
                          value={requestDepth}
                          onChange={(event) => setRequestDepth(event.target.value)}
                        />
                      </label>
                      <label className="dm-field">
                        <span>Stage Count</span>
                        <input
                          type="number"
                          min={2}
                          max={5}
                          value={requestStageCount}
                          onChange={(event) => setRequestStageCount(event.target.value)}
                        />
                      </label>
                      <label className="dm-field">
                        <span>Party Mean CR</span>
                        <input
                          type="number"
                          min={0}
                          value={requestPartyMeanChallengeRating}
                          onChange={(event) =>
                            setRequestPartyMeanChallengeRating(event.target.value)
                          }
                          placeholder={String(selectedPortal?.partyMeanChallengeRating ?? "")}
                        />
                      </label>
                    </div>
                    <div className="dm-stack">
                      {requestStageDrafts.map((stageDraft, index) => (
                        <div key={stageDraft.id} className="dm-item-custom-property">
                          <div className="dm-item-summary-head">
                            <div>
                              <strong>{stageDraft.title || `Stage ${index + 1}`}</strong>
                              <p>{index === requestStageDrafts.length - 1 ? "Boss stage" : "Stage"}</p>
                            </div>
                          </div>
                          <div className="dm-item-edit-grid">
                            <label className="dm-field">
                              <span>Title</span>
                              <input
                                value={stageDraft.title}
                                onChange={(event) =>
                                  setRequestStageDrafts((currentDrafts) =>
                                    currentDrafts.map((currentDraft, currentIndex) =>
                                      currentIndex === index
                                        ? { ...currentDraft, title: event.target.value }
                                        : currentDraft
                                    )
                                  )
                                }
                              />
                            </label>
                            <label className="dm-field">
                              <span>Target Total CR</span>
                              <input
                                type="number"
                                min={0}
                                value={stageDraft.targetChallengeRating}
                                onChange={(event) =>
                                  setRequestStageDrafts((currentDrafts) =>
                                    currentDrafts.map((currentDraft, currentIndex) =>
                                      currentIndex === index
                                        ? {
                                            ...currentDraft,
                                            targetChallengeRating: event.target.value,
                                          }
                                        : currentDraft
                                    )
                                  )
                                }
                              />
                            </label>
                            <label className="dm-field">
                              <span>Environment Tags</span>
                              <input
                                value={stageDraft.environmentTags}
                                onChange={(event) =>
                                  setRequestStageDrafts((currentDrafts) =>
                                    currentDrafts.map((currentDraft, currentIndex) =>
                                      currentIndex === index
                                        ? { ...currentDraft, environmentTags: event.target.value }
                                        : currentDraft
                                    )
                                  )
                                }
                              />
                            </label>
                            <label className="dm-field">
                              <span>Objective</span>
                              <input
                                value={stageDraft.objective}
                                onChange={(event) =>
                                  setRequestStageDrafts((currentDrafts) =>
                                    currentDrafts.map((currentDraft, currentIndex) =>
                                      currentIndex === index
                                        ? { ...currentDraft, objective: event.target.value }
                                        : currentDraft
                                    )
                                  )
                                }
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="dm-control-row dm-control-row-wrap">
                      <button type="button" className="flow-secondary" onClick={buildPortalExportPacket}>
                        Build Portal Bundle Packet
                      </button>
                    </div>
                    <label className="dm-field">
                      <span>Request Packet</span>
                      <textarea className="notes-input" value={exportPacket} readOnly />
                    </label>
                    <label className="dm-field">
                      <span>Import Payload</span>
                      <textarea
                        className="notes-input"
                        value={importPayload}
                        onChange={(event) => setImportPayload(event.target.value)}
                      />
                    </label>
                    <div className="dm-control-row">
                      <button type="button" className="flow-primary" onClick={importPortalPayload}>
                        Import Portal / Bundle Payload
                      </button>
                    </div>
                  </section>

                  {validationErrors.length > 0 ? (
                    <section className="dm-item-editor-section">
                      <p className="section-kicker">Validation</p>
                      <div className="dm-stack">
                        {validationErrors.map((error) => (
                          <p key={error} className="dm-error">
                            {error}
                          </p>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              )}
            </article>
          </div>

          {panelMessage ? <p className="dm-summary-line">{panelMessage}</p> : null}
        </section>
      </section>
    </main>
  );
}
