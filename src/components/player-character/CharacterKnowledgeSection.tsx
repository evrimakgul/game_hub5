import { useEffect, useMemo, useState } from "react";

import type { GameHistoryEntry } from "../../config/characterTemplate.ts";
import {
  applyKnowledgeBatch,
  buildKnowledgeAcquiredHistoryEntry,
  buildKnowledgeHistoryLink,
  buildKnowledgeRevisionLabel,
  buildCharacterKnowledgeDraftFromSheet,
  createDuplicateKnowledgeBatch,
  createKnowledgeOwnership,
  createKnowledgeRevisionBatch,
  createKnowledgeShareResult,
  findKnowledgeEntityBySubjectKey,
  getKnowledgeGroupsForOwner,
  getKnowledgeOwnershipDisplayLabel,
  type ResolvedKnowledgeOwnership,
} from "../../lib/knowledge.ts";
import type { CharacterRecord } from "../../types/character.ts";
import type { SharedItemRecord } from "../../types/items.ts";
import type {
  KnowledgeRevisionEntry,
  KnowledgeRevisionSection,
  KnowledgeRevisionSectionKind,
  KnowledgeState,
} from "../../types/knowledge.ts";
import { KnowledgeCardView } from "./KnowledgeCardView.tsx";

type CharacterKnowledgeSectionProps = {
  activeCharacter: CharacterRecord;
  characters: CharacterRecord[];
  itemsById: Record<string, SharedItemRecord>;
  knowledgeState: KnowledgeState;
  isReadOnlyView: boolean;
  isDmEditableView: boolean;
  onUpdateKnowledgeState: (
    updater: KnowledgeState | ((current: KnowledgeState) => KnowledgeState)
  ) => void;
  onAppendHistoryEntries: (
    entries: Array<{ characterId: string; entry: GameHistoryEntry }>
  ) => void;
  onOpenKnowledgeRevision: (revisionId: string) => void;
};

type KnowledgeEditorMode = "edited-copy" | "dm-snapshot" | "dm-manual";

type KnowledgeEditorState = {
  title: string;
  summary: string;
  summaryLines: string;
  biography: string;
  resistances: string;
  combatSummary: string;
  stats: string;
  skills: string;
  powers: string;
  specials: string;
  notes: string;
  recipientIds: string[];
};

function sectionEntriesToText(entries: KnowledgeRevisionEntry[]): string {
  return entries
    .map((entry) =>
      entry.label.trim().length > 0 ? `${entry.label}: ${entry.value}` : entry.value
    )
    .join("\n");
}

function getSectionText(
  sections: KnowledgeRevisionSection[],
  kind: KnowledgeRevisionSectionKind
): string {
  return sectionEntriesToText(
    sections.find((section) => section.kind === kind)?.entries ?? []
  );
}

function createEditorStateFromRevision(revision: ResolvedKnowledgeOwnership): KnowledgeEditorState {
  return {
    title: revision.revision.title,
    summary: revision.revision.summary,
    summaryLines: getSectionText(revision.revision.content, "summary"),
    biography: getSectionText(revision.revision.content, "biography"),
    resistances: getSectionText(revision.revision.content, "resistances"),
    combatSummary: getSectionText(revision.revision.content, "combat_summary"),
    stats: getSectionText(revision.revision.content, "stats"),
    skills: getSectionText(revision.revision.content, "skills"),
    powers: getSectionText(revision.revision.content, "powers"),
    specials: getSectionText(revision.revision.content, "specials"),
    notes: getSectionText(revision.revision.content, "notes"),
    recipientIds: [],
  };
}

function createEditorStateFromDraft(draft: ReturnType<typeof buildCharacterKnowledgeDraftFromSheet>): KnowledgeEditorState {
  return {
    title: draft.title,
    summary: draft.summary,
    summaryLines: getSectionText(draft.content, "summary"),
    biography: getSectionText(draft.content, "biography"),
    resistances: getSectionText(draft.content, "resistances"),
    combatSummary: getSectionText(draft.content, "combat_summary"),
    stats: getSectionText(draft.content, "stats"),
    skills: getSectionText(draft.content, "skills"),
    powers: getSectionText(draft.content, "powers"),
    specials: getSectionText(draft.content, "specials"),
    notes: getSectionText(draft.content, "notes"),
    recipientIds: [],
  };
}

function parseSectionEntries(text: string): Array<{ label?: string; value: string }> {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const splitIndex = line.indexOf(":");
      if (splitIndex <= 0) {
        return { value: line };
      }

      return {
        label: line.slice(0, splitIndex).trim(),
        value: line.slice(splitIndex + 1).trim(),
      };
    })
    .filter((entry) => entry.value.trim().length > 0);
}

function buildSection(
  kind: KnowledgeRevisionSectionKind,
  title: string,
  text: string
): KnowledgeRevisionSection | null {
  const entries = parseSectionEntries(text);
  if (entries.length === 0) {
    return null;
  }

  return {
    id: `${kind}-${Date.now()}-${entries.length}`,
    kind,
    title,
    entries: entries.map((entry, index) => ({
      id: `${kind}-entry-${Date.now()}-${index}`,
      label: entry.label?.trim() ?? "",
      value: entry.value.trim(),
    })),
  };
}

function buildSectionsFromEditorState(editorState: KnowledgeEditorState): KnowledgeRevisionSection[] {
  return [
    buildSection("summary", "Summary", editorState.summaryLines),
    buildSection("biography", "Biography", editorState.biography),
    buildSection("resistances", "Resistances", editorState.resistances),
    buildSection("combat_summary", "Combat Summary", editorState.combatSummary),
    buildSection("stats", "Stats", editorState.stats),
    buildSection("skills", "Skills", editorState.skills),
    buildSection("powers", "Powers", editorState.powers),
    buildSection("specials", "Specials", editorState.specials),
    buildSection("notes", "Notes", editorState.notes),
  ].filter((section): section is KnowledgeRevisionSection => section !== null);
}

export function CharacterKnowledgeSection({
  activeCharacter,
  characters,
  itemsById,
  knowledgeState,
  isReadOnlyView,
  isDmEditableView,
  onUpdateKnowledgeState,
  onAppendHistoryEntries,
  onOpenKnowledgeRevision,
}: CharacterKnowledgeSectionProps) {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const [compareRevisionId, setCompareRevisionId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareRecipientIds, setShareRecipientIds] = useState<string[]>([]);
  const [editorMode, setEditorMode] = useState<KnowledgeEditorMode | null>(null);
  const [editorState, setEditorState] = useState<KnowledgeEditorState | null>(null);

  const knowledgeGroups = useMemo(() => {
    const groups = getKnowledgeGroupsForOwner(knowledgeState, activeCharacter.id);
    return groups
      .map((group) => ({
        ...group,
        revisions: group.revisions.filter(
          (entry) => showArchived || !entry.ownership.isArchived
        ),
      }))
      .filter((group) => group.revisions.length > 0);
  }, [activeCharacter.id, knowledgeState, showArchived]);

  const selectedGroup =
    knowledgeGroups.find((group) => group.entity.id === selectedEntityId) ?? knowledgeGroups[0] ?? null;
  const selectedRevision =
    selectedGroup?.revisions.find((entry) => entry.revision.id === selectedRevisionId) ??
    selectedGroup?.revisions[0] ??
    null;
  const compareRevision =
    selectedGroup?.revisions.find((entry) => entry.revision.id === compareRevisionId) ?? null;

  const shareCandidates = useMemo(
    () => characters.filter((character) => character.id !== activeCharacter.id),
    [activeCharacter.id, characters]
  );

  useEffect(() => {
    if (!selectedGroup) {
      setSelectedEntityId(null);
      setSelectedRevisionId(null);
      setCompareRevisionId(null);
      return;
    }

    if (selectedEntityId !== selectedGroup.entity.id) {
      setSelectedEntityId(selectedGroup.entity.id);
    }

    if (!selectedRevision || selectedRevisionId !== selectedRevision.revision.id) {
      setSelectedRevisionId(selectedRevision?.revision.id ?? null);
    }

    if (
      compareRevisionId &&
      !selectedGroup.revisions.some((entry) => entry.revision.id === compareRevisionId)
    ) {
      setCompareRevisionId(null);
    }
  }, [compareRevisionId, selectedEntityId, selectedGroup, selectedRevision, selectedRevisionId]);

  useEffect(() => {
    setLabelDraft(selectedRevision?.ownership.localLabel ?? "");
  }, [selectedRevision?.ownership.id]);

  function applyBatchAndHistory(args: {
    batch: ReturnType<typeof applyKnowledgeBatch>;
    historyEntries?: Array<{ characterId: string; entry: GameHistoryEntry }>;
  }) {
    onUpdateKnowledgeState(args.batch);
    if (args.historyEntries && args.historyEntries.length > 0) {
      onAppendHistoryEntries(args.historyEntries);
    }
  }

  function handleDuplicate(): void {
    if (!selectedRevision || isReadOnlyView) {
      return;
    }

    const batch = createDuplicateKnowledgeBatch({
      state: knowledgeState,
      entity: selectedRevision.entity,
      revision: selectedRevision.revision,
      ownerCharacterId: activeCharacter.id,
      acquiredFromCharacterId: activeCharacter.id,
    });
    const nextState = applyKnowledgeBatch(knowledgeState, batch);
    const createdRevision = batch.revisions[0];
    const knowledgeLink = buildKnowledgeHistoryLink(selectedRevision.entity, createdRevision);

    applyBatchAndHistory({
      batch: nextState,
      historyEntries: [
        {
          characterId: activeCharacter.id,
          entry: buildKnowledgeAcquiredHistoryEntry({
            note: `Created a copied card for ${selectedRevision.entity.displayName}.`,
            knowledgeLink,
            gameDateTime: activeCharacter.sheet.gameDateTime,
          }),
        },
      ],
    });
    setSelectedEntityId(selectedRevision.entity.id);
    setSelectedRevisionId(createdRevision.id);
  }

  function handleTogglePinned(): void {
    if (!selectedRevision || isReadOnlyView) {
      return;
    }

    onUpdateKnowledgeState((currentState) => ({
      ...currentState,
      knowledgeOwnerships: currentState.knowledgeOwnerships.map((ownership) =>
        ownership.id === selectedRevision.ownership.id
          ? { ...ownership, isPinned: !ownership.isPinned }
          : ownership
      ),
    }));
  }

  function handleToggleArchived(): void {
    if (!selectedRevision || isReadOnlyView) {
      return;
    }

    onUpdateKnowledgeState((currentState) => ({
      ...currentState,
      knowledgeOwnerships: currentState.knowledgeOwnerships.map((ownership) =>
        ownership.id === selectedRevision.ownership.id
          ? { ...ownership, isArchived: !ownership.isArchived }
          : ownership
      ),
    }));
  }

  function handleSaveLabel(): void {
    if (!selectedRevision || isReadOnlyView) {
      return;
    }

    onUpdateKnowledgeState((currentState) => ({
      ...currentState,
      knowledgeOwnerships: currentState.knowledgeOwnerships.map((ownership) =>
        ownership.id === selectedRevision.ownership.id
          ? { ...ownership, localLabel: labelDraft.trim() }
          : ownership
      ),
    }));
  }

  function openEditedCopyEditor(): void {
    if (!selectedRevision || isReadOnlyView) {
      return;
    }

    setEditorMode("edited-copy");
    setEditorState(createEditorStateFromRevision(selectedRevision));
    setShareOpen(false);
  }

  function openDmSnapshotEditor(): void {
    const draft = buildCharacterKnowledgeDraftFromSheet(activeCharacter, itemsById);
    setEditorMode("dm-snapshot");
    setEditorState(createEditorStateFromDraft(draft));
    setShareOpen(false);
  }

  function openDmManualEditor(): void {
    setEditorMode("dm-manual");
    setEditorState({
      title: `${activeCharacter.sheet.name.trim() || activeCharacter.id} Card`,
      summary: "",
      summaryLines: "",
      biography: "",
      resistances: "",
      combatSummary: "",
      stats: "",
      skills: "",
      powers: "",
      specials: "",
      notes: "",
      recipientIds: [],
    });
    setShareOpen(false);
  }

  function handleSaveEditor(): void {
    if (!editorMode || !editorState) {
      return;
    }

    const sections = buildSectionsFromEditorState(editorState);
    const recipientIds =
      editorMode === "edited-copy" ? [activeCharacter.id] : editorState.recipientIds;
    if (recipientIds.length === 0) {
      return;
    }

    const activeSubjectEntity =
      findKnowledgeEntityBySubjectKey(knowledgeState, "character", activeCharacter.id) ?? {
        type: "character" as const,
        subjectKey: activeCharacter.id,
        displayName: activeCharacter.sheet.name.trim() || activeCharacter.id,
      };
    const subjectEntity =
      editorMode === "edited-copy" ? selectedRevision?.entity ?? activeSubjectEntity : activeSubjectEntity;
    const lineageMode =
      editorMode === "edited-copy"
        ? "edited_copy"
        : editorMode === "dm-snapshot"
          ? "id" in subjectEntity
            ? "updated_scan"
            : "observed"
          : "edited_copy";
    const primaryBatch = createKnowledgeRevisionBatch({
      state: knowledgeState,
      entity: subjectEntity,
      ownerCharacterId: recipientIds[0],
      createdByCharacterId: editorMode === "edited-copy" ? activeCharacter.id : null,
      title: editorState.title,
      summary: editorState.summary,
      content: sections,
      tags: ["character"],
      sourceType: editorMode === "edited-copy" ? "manual_edit" : "dm_grant",
      parentRevisionId: editorMode === "edited-copy" ? selectedRevision?.revision.id ?? null : null,
      lineageMode,
      isCanonical: editorMode === "dm-snapshot",
    });

    const extraOwnerships = recipientIds.slice(1).map((recipientId) =>
      createKnowledgeOwnership({
        ownerCharacterId: recipientId,
        revisionId: primaryBatch.revision.id,
        acquiredFromCharacterId: null,
      })
    );

    const nextState = applyKnowledgeBatch(knowledgeState, {
      entities: primaryBatch.batch.entities,
      revisions: primaryBatch.batch.revisions,
      ownerships: [...primaryBatch.batch.ownerships, ...extraOwnerships],
    });
    const knowledgeLink = buildKnowledgeHistoryLink(primaryBatch.entity, primaryBatch.revision);
    const historyEntries = recipientIds.map((recipientId) => ({
      characterId: recipientId,
      entry: buildKnowledgeAcquiredHistoryEntry({
        note:
          editorMode === "edited-copy"
            ? `Created an edited card for ${primaryBatch.entity.displayName}.`
            : `Received character card ${primaryBatch.entity.displayName} from DM.`,
        knowledgeLink,
        gameDateTime:
          characters.find((character) => character.id === recipientId)?.sheet.gameDateTime ??
          activeCharacter.sheet.gameDateTime,
      }),
    }));

    applyBatchAndHistory({
      batch: nextState,
      historyEntries,
    });
    setEditorMode(null);
    setEditorState(null);
    setSelectedEntityId(primaryBatch.entity.id);
    setSelectedRevisionId(primaryBatch.revision.id);
  }

  function handleShare(): void {
    if (!selectedRevision || shareRecipientIds.length === 0) {
      return;
    }

    const result = createKnowledgeShareResult({
      state: knowledgeState,
      entity: selectedRevision.entity,
      revision: selectedRevision.revision,
      sourceOwnerCharacterId: activeCharacter.id,
      sourceOwnerName: activeCharacter.sheet.name.trim() || activeCharacter.id,
      recipientCharacters: shareCandidates.filter((character) =>
        shareRecipientIds.includes(character.id)
      ),
    });

    applyBatchAndHistory({
      batch: applyKnowledgeBatch(knowledgeState, result.batch),
      historyEntries: result.historyEntries,
    });
    setShareOpen(false);
    setShareRecipientIds([]);
  }

  return (
    <article className="sheet-card knowledge-section-card">
      <div className="knowledge-section-head">
        <div>
          <p className="section-kicker">Knowledge</p>
          <h2>Knowledge Library</h2>
        </div>
        <div className="knowledge-section-actions">
          <button type="button" className="knowledge-plain-button" onClick={() => setShowArchived((value) => !value)}>
            {showArchived ? "Hide Archived" : "Show Archived"}
          </button>
          {isDmEditableView ? (
            <>
              <button type="button" className="knowledge-plain-button" onClick={openDmSnapshotEditor}>
                Snapshot Card
              </button>
              <button type="button" className="knowledge-plain-button" onClick={openDmManualEditor}>
                Manual Card
              </button>
            </>
          ) : null}
        </div>
      </div>

      {knowledgeGroups.length === 0 ? (
        <p className="history-empty">No owned knowledge cards yet.</p>
      ) : (
        <div className="knowledge-layout">
          <section className="knowledge-column knowledge-entities-column">
            {knowledgeGroups.map((group) => (
              <button
                key={group.entity.id}
                type="button"
                className={`knowledge-entity-button ${
                  group.entity.id === selectedGroup?.entity.id ? "is-active" : ""
                }`}
                onClick={() => {
                  setSelectedEntityId(group.entity.id);
                  setSelectedRevisionId(group.revisions[0]?.revision.id ?? null);
                  setCompareRevisionId(null);
                }}
              >
                <strong>{group.entity.displayName}</strong>
                <span>{group.revisions.length} revision(s)</span>
              </button>
            ))}
          </section>

          <section className="knowledge-column knowledge-revisions-column">
            {selectedGroup?.revisions.map((entry) => (
              <div
                key={entry.ownership.id}
                className={`knowledge-revision-row ${
                  entry.revision.id === selectedRevision?.revision.id ? "is-active" : ""
                }`}
              >
                <button
                  type="button"
                  className="knowledge-revision-button"
                  onClick={() => {
                    setSelectedRevisionId(entry.revision.id);
                    if (compareRevisionId === entry.revision.id) {
                      setCompareRevisionId(null);
                    }
                  }}
                >
                  <strong>{getKnowledgeOwnershipDisplayLabel(entry.ownership, entry.entity, entry.revision)}</strong>
                  <span>{buildKnowledgeRevisionLabel(entry.revision)}</span>
                </button>
                {selectedRevision && entry.revision.id !== selectedRevision.revision.id ? (
                  <button
                    type="button"
                    className="knowledge-mini-button"
                    onClick={() =>
                      setCompareRevisionId((currentId) =>
                        currentId === entry.revision.id ? null : entry.revision.id
                      )
                    }
                  >
                    {compareRevisionId === entry.revision.id ? "Clear" : "Compare"}
                  </button>
                ) : null}
              </div>
            ))}
          </section>

          <section className="knowledge-column knowledge-detail-column">
            {selectedRevision ? (
              <>
                <div className="knowledge-detail-actions">
                  <button
                    type="button"
                    className="knowledge-plain-button"
                    onClick={() => onOpenKnowledgeRevision(selectedRevision.revision.id)}
                  >
                    Open
                  </button>
                  {!isReadOnlyView ? (
                    <>
                      <button type="button" className="knowledge-plain-button" onClick={handleDuplicate}>
                        Duplicate
                      </button>
                      <button type="button" className="knowledge-plain-button" onClick={openEditedCopyEditor}>
                        Edited Copy
                      </button>
                      <button
                        type="button"
                        className="knowledge-plain-button"
                        onClick={() => setShareOpen((value) => !value)}
                      >
                        Share
                      </button>
                      <button type="button" className="knowledge-plain-button" onClick={handleTogglePinned}>
                        {selectedRevision.ownership.isPinned ? "Unpin" : "Pin"}
                      </button>
                      <button type="button" className="knowledge-plain-button" onClick={handleToggleArchived}>
                        {selectedRevision.ownership.isArchived ? "Unarchive" : "Archive"}
                      </button>
                    </>
                  ) : null}
                </div>

                {!isReadOnlyView ? (
                  <div className="knowledge-label-row">
                    <input
                      className="sheet-meta-input"
                      value={labelDraft}
                      onChange={(event) => setLabelDraft(event.target.value)}
                      placeholder="Local label"
                    />
                    <button type="button" className="knowledge-plain-button" onClick={handleSaveLabel}>
                      Save Label
                    </button>
                  </div>
                ) : null}

                {shareOpen && !isReadOnlyView ? (
                  <div className="knowledge-share-panel">
                    <p className="section-kicker">Share</p>
                    <div className="knowledge-recipient-list">
                      {shareCandidates.map((character) => (
                        <label key={character.id} className="knowledge-checkbox">
                          <input
                            type="checkbox"
                            checked={shareRecipientIds.includes(character.id)}
                            onChange={(event) =>
                              setShareRecipientIds((currentIds) =>
                                event.target.checked
                                  ? [...currentIds, character.id]
                                  : currentIds.filter((entryId) => entryId !== character.id)
                              )
                            }
                          />
                          <span>{character.sheet.name.trim() || character.id}</span>
                        </label>
                      ))}
                    </div>
                    <button type="button" className="knowledge-plain-button" onClick={handleShare}>
                      Send Card
                    </button>
                  </div>
                ) : null}

                {editorMode && editorState ? (
                  <div className="knowledge-editor">
                    <p className="section-kicker">
                      {editorMode === "edited-copy" ? "Edited Copy" : "Knowledge Authoring"}
                    </p>
                    <div className="knowledge-editor-grid">
                      <input
                        className="sheet-name-input"
                        value={editorState.title}
                        onChange={(event) =>
                          setEditorState((currentState) =>
                            currentState
                              ? { ...currentState, title: event.target.value }
                              : currentState
                          )
                        }
                        placeholder="Card title"
                      />
                      <input
                        className="sheet-meta-input"
                        value={editorState.summary}
                        onChange={(event) =>
                          setEditorState((currentState) =>
                            currentState
                              ? { ...currentState, summary: event.target.value }
                              : currentState
                          )
                        }
                        placeholder="Summary"
                      />
                      {[
                        ["summaryLines", "Summary"],
                        ["biography", "Biography"],
                        ["resistances", "Resistances"],
                        ["combatSummary", "Combat Summary"],
                        ["stats", "Stats"],
                        ["skills", "Skills"],
                        ["powers", "Powers"],
                        ["specials", "Specials"],
                        ["notes", "Notes"],
                      ].map(([field, label]) => (
                        <label key={field} className="knowledge-editor-field">
                          <span>{label}</span>
                          <textarea
                            className="bio-edit-input"
                            value={editorState[field as keyof KnowledgeEditorState] as string}
                            onChange={(event) =>
                              setEditorState((currentState) =>
                                currentState
                                  ? {
                                      ...currentState,
                                      [field]: event.target.value,
                                    }
                                  : currentState
                              )
                            }
                          />
                        </label>
                      ))}
                      {editorMode !== "edited-copy" ? (
                        <div className="knowledge-recipient-list">
                          {characters.map((character) => (
                            <label key={character.id} className="knowledge-checkbox">
                              <input
                                type="checkbox"
                                checked={editorState.recipientIds.includes(character.id)}
                                onChange={(event) =>
                                  setEditorState((currentState) =>
                                    currentState
                                      ? {
                                          ...currentState,
                                          recipientIds: event.target.checked
                                            ? [...currentState.recipientIds, character.id]
                                            : currentState.recipientIds.filter(
                                                (entryId) => entryId !== character.id
                                              ),
                                        }
                                      : currentState
                                  )
                                }
                              />
                              <span>{character.sheet.name.trim() || character.id}</span>
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="knowledge-detail-actions">
                      <button type="button" className="knowledge-plain-button" onClick={handleSaveEditor}>
                        Save Card
                      </button>
                      <button
                        type="button"
                        className="knowledge-plain-button"
                        onClick={() => {
                          setEditorMode(null);
                          setEditorState(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : compareRevision ? (
                  <div className="knowledge-compare-grid">
                    <KnowledgeCardView
                      entity={selectedRevision.entity}
                      revision={selectedRevision.revision}
                      ownership={selectedRevision.ownership}
                    />
                    <KnowledgeCardView
                      entity={compareRevision.entity}
                      revision={compareRevision.revision}
                      ownership={compareRevision.ownership}
                    />
                  </div>
                ) : (
                  <KnowledgeCardView
                    entity={selectedRevision.entity}
                    revision={selectedRevision.revision}
                    ownership={selectedRevision.ownership}
                  />
                )}
              </>
            ) : (
              <p className="history-empty">Select a knowledge card to inspect it.</p>
            )}
          </section>
        </div>
      )}
    </article>
  );
}
