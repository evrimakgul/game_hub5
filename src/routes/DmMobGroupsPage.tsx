import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import {
  applyCodexImportPayload,
  buildCodexRequestPacketText,
  duplicateMobGroup,
  getMobGroupComputedChallengeRating,
  getMobGroupPromptSummary,
  mergeMobGroups,
  parseCodexImportPayload,
  validateMobGroup,
} from "../lib/authoring.ts";
import { createTimestampedId } from "../lib/ids.ts";
import { useAppFlow } from "../state/appFlow";

function parseCommaSeparatedList(value: string): string[] {
  return [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))];
}

function formatCommaSeparatedList(values: string[]): string {
  return values.join(", ");
}

export function DmMobGroupsPage() {
  const navigate = useNavigate();
  const {
    roleChoice,
    mobTemplates,
    mobGroups,
    createMobGroup,
    updateMobGroup,
    deleteMobGroup,
    updateAuthoringState,
  } = useAppFlow();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(mobGroups[0]?.id ?? null);
  const [mergeSourceGroupId, setMergeSourceGroupId] = useState("");
  const [requestIntent, setRequestIntent] = useState("Draft reusable mob groups for a portal theme.");
  const [requestTheme, setRequestTheme] = useState("");
  const [requestTargetChallengeRating, setRequestTargetChallengeRating] = useState("");
  const [requestPartyMeanChallengeRating, setRequestPartyMeanChallengeRating] = useState("");
  const [exportPacket, setExportPacket] = useState("");
  const [importPayload, setImportPayload] = useState("");
  const [panelMessage, setPanelMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedGroupId && mobGroups.length > 0) {
      setSelectedGroupId(mobGroups[0]?.id ?? null);
      return;
    }

    if (selectedGroupId && !mobGroups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(mobGroups[0]?.id ?? null);
    }
  }, [mobGroups, selectedGroupId]);

  const selectedGroup =
    mobGroups.find((group) => group.id === selectedGroupId) ?? mobGroups[0] ?? null;
  const mobTemplatesById = useMemo(
    () => new Map(mobTemplates.map((template) => [template.id, template])),
    [mobTemplates]
  );
  const selectedGroupComputedChallengeRating = selectedGroup
    ? getMobGroupComputedChallengeRating(selectedGroup, mobTemplatesById)
    : 0;
  const validationErrors = selectedGroup ? validateMobGroup(selectedGroup, mobTemplatesById) : [];
  const publishedExamples = selectedGroup
    ? mobGroups
        .filter((group) => group.id !== selectedGroup.id && group.status === "published")
        .slice(0, 3)
    : mobGroups.filter((group) => group.status === "published").slice(0, 3);

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  function createNewGroup(): void {
    const groupId = createMobGroup();
    setSelectedGroupId(groupId);
    setPanelMessage(null);
  }

  function createDuplicateGroup(): void {
    if (!selectedGroup) {
      return;
    }

    const groupId = createMobGroup(duplicateMobGroup(selectedGroup));
    setSelectedGroupId(groupId);
    setPanelMessage(null);
  }

  function deleteSelectedGroup(): void {
    if (!selectedGroup) {
      return;
    }

    deleteMobGroup(selectedGroup.id);
    setPanelMessage("Deleted the selected group if it was not referenced by a saved portal.");
  }

  function updateSelectedGroupStatus(nextStatus: "draft" | "playtest_ready" | "published"): void {
    if (!selectedGroup) {
      return;
    }

    if (nextStatus === "published" && validationErrors.length > 0) {
      setPanelMessage(validationErrors[0] ?? "Mob group validation failed.");
      return;
    }

    updateMobGroup(selectedGroup.id, (currentGroup) => ({
      ...currentGroup,
      status: nextStatus,
    }));
    setPanelMessage(null);
  }

  function addMember(): void {
    if (!selectedGroup) {
      return;
    }

    updateMobGroup(selectedGroup.id, (currentGroup) => ({
      ...currentGroup,
      members: [
        ...currentGroup.members,
        {
          id: createTimestampedId("mob-group-member"),
          mobTemplateId: mobTemplates[0]?.id ?? "",
          quantity: 1,
          displayNameOverride: "",
          notes: "",
          sheetOverrides: null,
        },
      ],
    }));
  }

  function mergeFromSelectedSource(): void {
    if (!selectedGroup || !mergeSourceGroupId || mergeSourceGroupId === selectedGroup.id) {
      return;
    }

    const sourceGroup = mobGroups.find((group) => group.id === mergeSourceGroupId) ?? null;
    if (!sourceGroup) {
      setPanelMessage("Select a valid source group before merging.");
      return;
    }

    updateMobGroup(selectedGroup.id, mergeMobGroups(selectedGroup, sourceGroup));
    setPanelMessage(`Merged ${sourceGroup.name} into ${selectedGroup.name}.`);
  }

  function buildGroupExportPacket(): void {
    const nextTheme =
      requestTheme.trim() ||
      selectedGroup?.themeTags[0] ||
      publishedExamples[0]?.themeTags[0] ||
      "";
    const nextTargetChallengeRating =
      requestTargetChallengeRating.trim().length > 0
        ? Math.max(0, Number.parseInt(requestTargetChallengeRating, 10) || 0)
        : selectedGroup?.targetChallengeRating ?? null;
    const nextPartyMeanChallengeRating =
      requestPartyMeanChallengeRating.trim().length > 0
        ? Math.max(0, Number.parseInt(requestPartyMeanChallengeRating, 10) || 0)
        : selectedGroup?.partyMeanChallengeRating ?? null;
    const shouldIncludeSelectedGroup =
      !!selectedGroup &&
      (selectedGroup.members.length > 0 ||
        selectedGroup.themeTags.length > 0 ||
        selectedGroup.tactics.trim().length > 0 ||
        selectedGroup.encounterNotes.trim().length > 0 ||
        selectedGroup.targetChallengeRating !== null ||
        selectedGroup.partyMeanChallengeRating !== null ||
        !selectedGroup.name.startsWith("New Group"));

    setExportPacket(
      buildCodexRequestPacketText({
        requestKind: "mob_group_batch",
        requestIntent,
        theme: nextTheme,
        difficulty: {
          computedGroupChallengeRating: selectedGroupComputedChallengeRating,
          targetGroupChallengeRating: nextTargetChallengeRating,
          partyMeanChallengeRating: nextPartyMeanChallengeRating,
        },
        currentObject: selectedGroup && shouldIncludeSelectedGroup
          ? getMobGroupPromptSummary(selectedGroup, mobTemplatesById)
          : null,
        exampleObjects: publishedExamples.map((group) =>
          getMobGroupPromptSummary(group, mobTemplatesById)
        ),
      })
    );
    setPanelMessage("Built a request packet for manual Codex mob group generation.");
  }

  function importGroupPayload(): void {
    const parsed = parseCodexImportPayload(importPayload);
    if ("error" in parsed) {
      setPanelMessage(parsed.error);
      return;
    }

    if (parsed.kind !== "mob_group_batch") {
      setPanelMessage("This import box expects a mob_group_batch payload.");
      return;
    }

    updateAuthoringState((currentState) =>
      applyCodexImportPayload({
        payload: parsed,
        rawPayload: importPayload,
        currentState,
      })
    );
    setSelectedGroupId(parsed.groups[0]?.id ?? null);
    setPanelMessage(`Imported ${parsed.groups.length} mob group(s).`);
    setImportPayload("");
  }

  return (
    <main className="dm-page">
      <section className="dm-shell">
        <header className="dm-topbar">
          <div>
            <p className="section-kicker">Dungeon Master</p>
            <h1>Mob Groups</h1>
          </div>
          <div className="dm-nav-actions">
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm")}>
              DM Dashboard
            </button>
          </div>
        </header>

        <section className="flow-card flow-card-wide">
          <div className="dm-item-edit-actions">
            <button type="button" className="flow-primary" onClick={createNewGroup}>
              Create New Group
            </button>
            <button type="button" className="flow-secondary" onClick={createDuplicateGroup}>
              Duplicate Selected Group
            </button>
            <button type="button" className="flow-danger" onClick={deleteSelectedGroup}>
              Delete Selected Group
            </button>
          </div>

          <div className="dm-item-edit-layout">
            <article className="sheet-card dm-item-picker-card">
              <p className="section-kicker">Saved Groups</p>
              <div className="dm-item-picker-list">
                {mobGroups.length === 0 ? (
                  <p className="empty-block-copy">No mob groups saved yet.</p>
                ) : (
                  mobGroups.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      className={`dm-item-picker-button${group.id === selectedGroup?.id ? " is-active" : ""}`}
                      onClick={() => setSelectedGroupId(group.id)}
                    >
                      <strong>{group.name}</strong>
                      <span>{group.status}</span>
                      <small>
                        {group.members.length} member slot(s) |{" "}
                        {group.themeTags.join(", ") || "No theme tags"}
                      </small>
                    </button>
                  ))
                )}
              </div>
            </article>

            <article className="sheet-card dm-item-editor-card">
              {!selectedGroup ? (
                <p className="empty-block-copy">Select or create a group to start editing.</p>
              ) : (
                <div className="dm-item-editor-stack">
                  <section className="dm-item-editor-section">
                      <div className="dm-item-summary-head">
                        <div>
                          <p className="section-kicker">Metadata</p>
                          <h2>{selectedGroup.name}</h2>
                        </div>
                      <div className="row-side">
                        <strong>{selectedGroup.status}</strong>
                        <p>Version {selectedGroup.version}</p>
                      </div>
                    </div>
                      <div className="dm-item-edit-grid">
                        <label className="dm-field">
                          <span>Group Name</span>
                          <input
                            value={selectedGroup.name}
                          onChange={(event) =>
                            updateMobGroup(selectedGroup.id, (currentGroup) => ({
                              ...currentGroup,
                              name: event.target.value,
                            }))
                          }
                          />
                        </label>
                        <label className="dm-field">
                          <span>Target Total CR</span>
                          <input
                            type="number"
                            min={0}
                            value={selectedGroup.targetChallengeRating ?? ""}
                            onChange={(event) =>
                              updateMobGroup(selectedGroup.id, (currentGroup) => ({
                                ...currentGroup,
                                targetChallengeRating:
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
                          <span>Party Mean CR</span>
                          <input
                            type="number"
                            min={0}
                            value={selectedGroup.partyMeanChallengeRating ?? ""}
                            onChange={(event) =>
                              updateMobGroup(selectedGroup.id, (currentGroup) => ({
                                ...currentGroup,
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
                      </div>
                      <div className="dm-item-edit-grid">
                        <label className="dm-field">
                          <span>Computed Total CR</span>
                          <input value={selectedGroupComputedChallengeRating} readOnly />
                        </label>
                        <label className="dm-field">
                          <span>Status</span>
                          <select
                            value={selectedGroup.status}
                            onChange={(event) =>
                            updateSelectedGroupStatus(event.target.value as typeof selectedGroup.status)
                          }
                        >
                          <option value="draft">draft</option>
                          <option value="playtest_ready">playtest_ready</option>
                          <option value="published">published</option>
                        </select>
                      </label>
                      <label className="dm-field">
                        <span>Theme Tags</span>
                        <input
                          value={formatCommaSeparatedList(selectedGroup.themeTags)}
                          onChange={(event) =>
                            updateMobGroup(selectedGroup.id, (currentGroup) => ({
                              ...currentGroup,
                              themeTags: parseCommaSeparatedList(event.target.value),
                            }))
                          }
                        />
                      </label>
                    </div>
                    <div className="dm-item-edit-grid dm-item-edit-grid-two-up">
                      <label className="dm-field">
                        <span>Tactics</span>
                        <textarea
                          className="notes-input"
                          value={selectedGroup.tactics}
                          onChange={(event) =>
                            updateMobGroup(selectedGroup.id, (currentGroup) => ({
                              ...currentGroup,
                              tactics: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Encounter Notes</span>
                        <textarea
                          className="notes-input"
                          value={selectedGroup.encounterNotes}
                          onChange={(event) =>
                            updateMobGroup(selectedGroup.id, (currentGroup) => ({
                              ...currentGroup,
                              encounterNotes: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  </section>

                  <section className="dm-item-editor-section">
                    <div className="dm-item-summary-head">
                      <div>
                        <p className="section-kicker">Members</p>
                        <h3>Group Composition</h3>
                      </div>
                      <div className="dm-entry-actions">
                        <button type="button" onClick={addMember}>
                          Add Member
                        </button>
                      </div>
                    </div>

                    <div className="dm-stack">
                      {selectedGroup.members.length === 0 ? (
                        <p className="empty-block-copy">No members added yet.</p>
                      ) : (
                        selectedGroup.members.map((member, memberIndex) => (
                          <div key={member.id} className="dm-item-custom-property">
                            <div className="dm-item-edit-grid">
                              <label className="dm-field">
                                <span>Mob Template</span>
                                <select
                                  value={member.mobTemplateId}
                                  onChange={(event) =>
                                    updateMobGroup(selectedGroup.id, (currentGroup) => ({
                                      ...currentGroup,
                                      members: currentGroup.members.map((currentMember, currentIndex) =>
                                        currentIndex === memberIndex
                                          ? {
                                              ...currentMember,
                                              mobTemplateId: event.target.value,
                                            }
                                          : currentMember
                                      ),
                                    }))
                                  }
                                >
                                  <option value="">Choose mob</option>
                                  {mobTemplates.map((template) => (
                                    <option key={template.id} value={template.id}>
                                      {template.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="dm-field">
                                <span>Quantity</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={member.quantity}
                                  onChange={(event) =>
                                    updateMobGroup(selectedGroup.id, (currentGroup) => ({
                                      ...currentGroup,
                                      members: currentGroup.members.map((currentMember, currentIndex) =>
                                        currentIndex === memberIndex
                                          ? {
                                              ...currentMember,
                                              quantity: Math.max(
                                                1,
                                                Number.parseInt(event.target.value || "1", 10) || 1
                                              ),
                                            }
                                          : currentMember
                                      ),
                                    }))
                                  }
                                />
                              </label>
                              <label className="dm-field">
                                <span>Name Override</span>
                                <input
                                  value={member.displayNameOverride}
                                  onChange={(event) =>
                                    updateMobGroup(selectedGroup.id, (currentGroup) => ({
                                      ...currentGroup,
                                      members: currentGroup.members.map((currentMember, currentIndex) =>
                                        currentIndex === memberIndex
                                          ? {
                                              ...currentMember,
                                              displayNameOverride: event.target.value,
                                            }
                                          : currentMember
                                      ),
                                    }))
                                  }
                                />
                              </label>
                            </div>
                            <div className="dm-item-edit-grid">
                              <label className="dm-field">
                                <span>Notes</span>
                                <textarea
                                  className="notes-input"
                                  value={member.notes}
                                  onChange={(event) =>
                                    updateMobGroup(selectedGroup.id, (currentGroup) => ({
                                      ...currentGroup,
                                      members: currentGroup.members.map((currentMember, currentIndex) =>
                                        currentIndex === memberIndex
                                          ? {
                                              ...currentMember,
                                              notes: event.target.value,
                                            }
                                          : currentMember
                                      ),
                                    }))
                                  }
                                />
                              </label>
                              <label className="dm-field">
                                <span>HP Override</span>
                                <input
                                  type="number"
                                  value={member.sheetOverrides?.currentHp ?? ""}
                                  onChange={(event) =>
                                    updateMobGroup(selectedGroup.id, (currentGroup) => ({
                                      ...currentGroup,
                                      members: currentGroup.members.map((currentMember, currentIndex) =>
                                        currentIndex === memberIndex
                                          ? {
                                              ...currentMember,
                                              sheetOverrides: {
                                                ...(currentMember.sheetOverrides ?? {}),
                                                currentHp:
                                                  event.target.value.trim().length > 0
                                                    ? Number.parseInt(event.target.value, 10) || 0
                                                    : undefined,
                                              },
                                            }
                                          : currentMember
                                      ),
                                    }))
                                  }
                                />
                              </label>
                              <label className="dm-field">
                                <span>Mana Override</span>
                                <input
                                  type="number"
                                  value={member.sheetOverrides?.currentMana ?? ""}
                                  onChange={(event) =>
                                    updateMobGroup(selectedGroup.id, (currentGroup) => ({
                                      ...currentGroup,
                                      members: currentGroup.members.map((currentMember, currentIndex) =>
                                        currentIndex === memberIndex
                                          ? {
                                              ...currentMember,
                                              sheetOverrides: {
                                                ...(currentMember.sheetOverrides ?? {}),
                                                currentMana:
                                                  event.target.value.trim().length > 0
                                                    ? Math.max(
                                                        0,
                                                        Number.parseInt(event.target.value, 10) || 0
                                                      )
                                                    : undefined,
                                              },
                                            }
                                          : currentMember
                                      ),
                                    }))
                                  }
                                />
                              </label>
                            </div>
                            <div className="dm-control-row">
                              <button
                                type="button"
                                className="flow-danger"
                                onClick={() =>
                                  updateMobGroup(selectedGroup.id, (currentGroup) => ({
                                    ...currentGroup,
                                    members: currentGroup.members.filter(
                                      (_currentMember, currentIndex) => currentIndex !== memberIndex
                                    ),
                                  }))
                                }
                              >
                                Remove Member
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="dm-item-editor-section">
                    <p className="section-kicker">Merge Groups</p>
                    <div className="dm-item-edit-grid dm-item-edit-grid-two-up">
                      <label className="dm-field">
                        <span>Source Group</span>
                        <select
                          value={mergeSourceGroupId}
                          onChange={(event) => setMergeSourceGroupId(event.target.value)}
                        >
                          <option value="">Choose group</option>
                          {mobGroups
                            .filter((group) => group.id !== selectedGroup.id)
                            .map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <div className="dm-control-row">
                        <button type="button" className="flow-secondary" onClick={mergeFromSelectedSource}>
                          Merge Into Selected Group
                        </button>
                      </div>
                    </div>
                  </section>

                  <section className="dm-item-editor-section">
                    <p className="section-kicker">Codex Manual Bridge</p>
                    <div className="dm-item-edit-grid dm-item-edit-grid-paired-stats">
                      <label className="dm-field">
                        <span>Request Intent</span>
                        <input
                          value={requestIntent}
                          onChange={(event) => setRequestIntent(event.target.value)}
                        />
                      </label>
                      <label className="dm-field">
                        <span>Theme</span>
                        <input
                          value={requestTheme}
                          onChange={(event) => setRequestTheme(event.target.value)}
                          placeholder={selectedGroup.themeTags[0] ?? ""}
                        />
                      </label>
                      <label className="dm-field">
                        <span>Requested Total CR</span>
                        <input
                          type="number"
                          min={0}
                          value={requestTargetChallengeRating}
                          onChange={(event) => setRequestTargetChallengeRating(event.target.value)}
                          placeholder={String(selectedGroup.targetChallengeRating ?? selectedGroupComputedChallengeRating)}
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
                          placeholder={String(selectedGroup.partyMeanChallengeRating ?? "")}
                        />
                      </label>
                    </div>
                    <div className="dm-control-row dm-control-row-wrap">
                      <button type="button" className="flow-secondary" onClick={buildGroupExportPacket}>
                        Build Request Packet
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
                      <button type="button" className="flow-primary" onClick={importGroupPayload}>
                        Import Group Payload
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
