import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { KnowledgeCardView } from "../components/player-character/KnowledgeCardView.tsx";
import type { GameHistoryEntry } from "../config/characterTemplate.ts";
import { prependGameHistoryEntry } from "../lib/historyEntries.ts";
import { createTimestampedId } from "../lib/ids.ts";
import {
  applyKnowledgeBatch,
  buildKnowledgeRevisionLabel,
  createKnowledgeRevisionBatchWithoutOwnership,
  createKnowledgeShareResult,
  getKnowledgeEntityTypeLabel,
} from "../lib/knowledge.ts";
import { useAppFlow } from "../state/appFlow";
import {
  DM_KNOWLEDGE_ENTITY_TYPES,
  type DmKnowledgeEntityType,
  type KnowledgeEntity,
  type KnowledgeRevision,
  type KnowledgeRevisionSection,
  type KnowledgeRevisionSectionKind,
} from "../types/knowledge.ts";

type KnowledgeSectionDraft = {
  id: string;
  kind: KnowledgeRevisionSectionKind;
  title: string;
  text: string;
};

type KnowledgeEditorState = {
  targetEntityId: string | null;
  type: DmKnowledgeEntityType;
  displayName: string;
  title: string;
  summary: string;
  sections: KnowledgeSectionDraft[];
};

function sortCharacters<T extends { id: string; sheet: { name: string } }>(characters: T[]): T[] {
  return [...characters].sort((left, right) =>
    (left.sheet.name.trim() || left.id).localeCompare(right.sheet.name.trim() || right.id)
  );
}

function sortEntities(entities: KnowledgeEntity[]): KnowledgeEntity[] {
  return [...entities].sort((left, right) => {
    const typeCompare = getKnowledgeEntityTypeLabel(left.type).localeCompare(
      getKnowledgeEntityTypeLabel(right.type)
    );
    if (typeCompare !== 0) {
      return typeCompare;
    }

    return left.displayName.localeCompare(right.displayName) || left.id.localeCompare(right.id);
  });
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
    id: createTimestampedId(`knowledge-section-${kind}`),
    kind,
    title,
    entries: entries.map((entry, index) => ({
      id: createTimestampedId(`knowledge-entry-${kind}`, {
        timestamp: index + 1,
        randomSuffix: `${index + 1}`.padStart(2, "0"),
      }),
      label: entry.label?.trim() ?? "",
      value: entry.value.trim(),
    })),
  };
}

function buildKnowledgeSectionsFromDraft(sections: KnowledgeSectionDraft[]): KnowledgeRevisionSection[] {
  return sections
    .map((section) => buildSection(section.kind, section.title, section.text))
    .filter((section): section is KnowledgeRevisionSection => section !== null);
}

function createTemplateSections(type: DmKnowledgeEntityType): KnowledgeSectionDraft[] {
  const templates: Record<DmKnowledgeEntityType, Array<{ kind: KnowledgeRevisionSectionKind; title: string }>> = {
    place: [
      { kind: "summary", title: "Summary" },
      { kind: "custom", title: "Location Details" },
      { kind: "custom", title: "People / Factions" },
      { kind: "notes", title: "Notes" },
    ],
    faction: [
      { kind: "summary", title: "Summary" },
      { kind: "custom", title: "Identity / Goals" },
      { kind: "custom", title: "Allies / Enemies" },
      { kind: "notes", title: "Notes" },
    ],
    story: [
      { kind: "summary", title: "Summary" },
      { kind: "custom", title: "Discovered Facts" },
      { kind: "custom", title: "Open Threads" },
      { kind: "notes", title: "Notes" },
    ],
    custom: [
      { kind: "summary", title: "Summary" },
      { kind: "custom", title: "Details" },
      { kind: "notes", title: "Notes" },
    ],
  };

  return templates[type].map((section) => ({
    id: createTimestampedId(`knowledge-template-${section.kind}`),
    kind: section.kind,
    title: section.title,
    text: "",
  }));
}

function createNewEditorState(type: DmKnowledgeEntityType = "place"): KnowledgeEditorState {
  return {
    targetEntityId: null,
    type,
    displayName: "",
    title: "",
    summary: "",
    sections: createTemplateSections(type),
  };
}

function createEditorStateFromRevision(
  entity: KnowledgeEntity,
  revision: KnowledgeRevision
): KnowledgeEditorState {
  const type = entity.type as DmKnowledgeEntityType;

  return {
    targetEntityId: entity.id,
    type,
    displayName: entity.displayName,
    title: revision.title,
    summary: revision.summary,
    sections: revision.content.map((section) => ({
      id: section.id,
      kind: section.kind,
      title: section.title,
      text: section.entries
        .map((entry) =>
          entry.label.trim().length > 0 ? `${entry.label}: ${entry.value}` : entry.value
        )
        .join("\n"),
    })),
  };
}

function getSourceTypeForKnowledgeType(type: DmKnowledgeEntityType): KnowledgeRevision["sourceType"] {
  return type === "story" ? "story_reward" : "dm_grant";
}

export function DmKnowledgePage() {
  const navigate = useNavigate();
  const {
    roleChoice,
    characters,
    knowledgeEntities,
    knowledgeRevisions,
    knowledgeOwnerships,
    updateCharacter,
    updateKnowledgeState,
  } = useAppFlow();
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<KnowledgeEditorState>(() => createNewEditorState());

  const sortedCharacters = useMemo(() => sortCharacters(characters), [characters]);
  const dmKnowledgeEntities = useMemo(
    () =>
      sortEntities(
        knowledgeEntities.filter((entity) =>
          DM_KNOWLEDGE_ENTITY_TYPES.includes(entity.type as DmKnowledgeEntityType)
        )
      ),
    [knowledgeEntities]
  );
  const selectedRecipients = useMemo(
    () => sortedCharacters.filter((character) => selectedRecipientIds.includes(character.id)),
    [selectedRecipientIds, sortedCharacters]
  );
  const selectedEntity =
    dmKnowledgeEntities.find((entity) => entity.id === selectedEntityId) ?? dmKnowledgeEntities[0] ?? null;
  const selectedEntityRevisions = useMemo(() => {
    if (!selectedEntity) {
      return [];
    }

    return knowledgeRevisions
      .filter((revision) => revision.entityId === selectedEntity.id)
      .sort((left, right) => right.revisionNumber - left.revisionNumber);
  }, [knowledgeRevisions, selectedEntity]);

  useEffect(() => {
    if (!selectedEntity) {
      setSelectedEntityId(null);
      setSelectedRevisionId(null);
      return;
    }

    if (selectedEntityId !== selectedEntity.id) {
      setSelectedEntityId(selectedEntity.id);
    }

    if (
      selectedRevisionId &&
      selectedEntityRevisions.some((revision) => revision.id === selectedRevisionId)
    ) {
      return;
    }

    setSelectedRevisionId(selectedEntityRevisions[0]?.id ?? null);
  }, [selectedEntity, selectedEntityId, selectedEntityRevisions, selectedRevisionId]);

  const selectedRevision =
    selectedEntityRevisions.find((revision) => revision.id === selectedRevisionId) ??
    selectedEntityRevisions[0] ??
    null;
  const knowledgeState = {
    knowledgeEntities,
    knowledgeRevisions,
    knowledgeOwnerships,
  };

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  function appendHistoryEntries(
    entries: Array<{ characterId: string; entry: GameHistoryEntry }>
  ): void {
    entries.forEach(({ characterId, entry }) => {
      updateCharacter(characterId, (currentSheet) => ({
        ...currentSheet,
        gameHistory: prependGameHistoryEntry(currentSheet.gameHistory ?? [], entry),
      }));
    });
  }

  function toggleRecipient(characterId: string, isChecked: boolean): void {
    setSelectedRecipientIds((currentIds) =>
      isChecked
        ? [...new Set([...currentIds, characterId])]
        : currentIds.filter((entryId) => entryId !== characterId)
    );
  }

  function handleCreateNewSubject(): void {
    setEditorState(createNewEditorState(selectedEntity?.type as DmKnowledgeEntityType ?? "place"));
  }

  function handleDraftSelectedRevision(): void {
    if (!selectedEntity || !selectedRevision) {
      return;
    }

    setEditorState(createEditorStateFromRevision(selectedEntity, selectedRevision));
  }

  function handleSaveKnowledgeRevision(): void {
    const displayName = editorState.displayName.trim();
    const title = editorState.title.trim() || (displayName.length > 0 ? `${displayName} Card` : "");
    if (!displayName || !title) {
      return;
    }

    const existingEntity =
      editorState.targetEntityId !== null
        ? knowledgeEntities.find((entity) => entity.id === editorState.targetEntityId) ?? null
        : null;
    const entity =
      existingEntity ?? {
        type: editorState.type,
        subjectKey: createTimestampedId(`knowledge-subject-${editorState.type}`),
        displayName,
      };
    const created = createKnowledgeRevisionBatchWithoutOwnership({
      state: knowledgeState,
      entity,
      createdByCharacterId: null,
      title,
      summary: editorState.summary,
      content: buildKnowledgeSectionsFromDraft(editorState.sections),
      tags: [editorState.type],
      sourceType: getSourceTypeForKnowledgeType(editorState.type),
      lineageMode: existingEntity ? "updated_scan" : "observed",
      isCanonical: true,
    });
    const withRevision = applyKnowledgeBatch(knowledgeState, created.batch);
    const shareResult =
      selectedRecipients.length > 0
        ? createKnowledgeShareResult({
            state: withRevision,
            entity: created.entity,
            revision: created.revision,
            sourceOwnerCharacterId: null,
            sourceOwnerName: "DM",
            recipientCharacters: selectedRecipients,
          })
        : {
            batch: { entities: [], revisions: [], ownerships: [] },
            historyEntries: [],
          };

    updateKnowledgeState(applyKnowledgeBatch(withRevision, shareResult.batch));
    appendHistoryEntries(shareResult.historyEntries);
    setSelectedEntityId(created.entity.id);
    setSelectedRevisionId(created.revision.id);
    setEditorState(createEditorStateFromRevision(created.entity, created.revision));
  }

  function handleShareSelectedRevision(): void {
    if (!selectedEntity || !selectedRevision || selectedRecipients.length === 0) {
      return;
    }

    const result = createKnowledgeShareResult({
      state: knowledgeState,
      entity: selectedEntity,
      revision: selectedRevision,
      sourceOwnerCharacterId: null,
      sourceOwnerName: "DM",
      recipientCharacters: selectedRecipients,
    });

    updateKnowledgeState(applyKnowledgeBatch(knowledgeState, result.batch));
    appendHistoryEntries(result.historyEntries);
  }

  return (
    <main className="sheet-page">
      <section className="sheet-frame">
        <header className="dm-topbar">
          <div>
            <p className="section-kicker">Dungeon Master</p>
            <h1>Knowledge Hub</h1>
            <p className="dm-summary-line">
              Author and share place, faction, story, and custom knowledge cards.
            </p>
          </div>
          <div className="dm-nav-actions dm-nav-actions-wrap">
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm")}>
              DM Dashboard
            </button>
          </div>
        </header>

        <section className="dm-hub-grid">
          <article className="sheet-card dm-hub-card">
            <p className="section-kicker">Recipients</p>
            <h2>Character Selection</h2>
            {sortedCharacters.length === 0 ? (
              <p className="empty-block-copy">No characters available.</p>
            ) : (
              <div className="knowledge-recipient-list">
                {sortedCharacters.map((character) => (
                  <label key={character.id} className="knowledge-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedRecipientIds.includes(character.id)}
                      onChange={(event) => toggleRecipient(character.id, event.target.checked)}
                    />
                    <span>{character.sheet.name.trim() || character.id}</span>
                  </label>
                ))}
              </div>
            )}
          </article>

          <article className="sheet-card dm-hub-card">
            <p className="section-kicker">Authoring</p>
            <h2>Canonical Revisions</h2>
            <p className="dm-summary-line">
              Saving with no recipients creates the revision only. Saving with recipients grants the same revision to those characters.
            </p>
            <div className="knowledge-section-actions">
              <button type="button" className="flow-primary" onClick={handleCreateNewSubject}>
                New Subject
              </button>
              <button
                type="button"
                className="flow-secondary"
                disabled={!selectedEntity || !selectedRevision}
                onClick={handleDraftSelectedRevision}
              >
                Draft New Revision
              </button>
              <button
                type="button"
                className="flow-secondary"
                disabled={!selectedEntity || !selectedRevision || selectedRecipients.length === 0}
                onClick={handleShareSelectedRevision}
              >
                Share Selected Revision
              </button>
            </div>
          </article>
        </section>

        <section className="dm-item-edit-layout">
          <article className="sheet-card dm-item-picker-card">
            <p className="section-kicker">Knowledge Subjects</p>
            <h2>Subject Picker</h2>
            {dmKnowledgeEntities.length === 0 ? (
              <p className="empty-block-copy">No DM-authored knowledge subjects yet.</p>
            ) : (
              <div className="dm-item-picker-list">
                {dmKnowledgeEntities.map((entity) => {
                  const revisions = knowledgeRevisions.filter((revision) => revision.entityId === entity.id);
                  const latestRevision = [...revisions].sort(
                    (left, right) => right.revisionNumber - left.revisionNumber
                  )[0] ?? null;

                  return (
                    <button
                      key={entity.id}
                      type="button"
                      className={`dm-item-picker-button${entity.id === selectedEntity?.id ? " is-active" : ""}`}
                      onClick={() => setSelectedEntityId(entity.id)}
                    >
                      <strong>{entity.displayName}</strong>
                      <span>{getKnowledgeEntityTypeLabel(entity.type)}</span>
                      <small>
                        {revisions.length} revision(s)
                        {latestRevision ? ` | Latest: ${buildKnowledgeRevisionLabel(latestRevision)}` : ""}
                      </small>
                    </button>
                  );
                })}
              </div>
            )}
          </article>

          <article className="sheet-card dm-item-editor-card">
            <p className="section-kicker">Knowledge Authoring</p>
            <h2>{editorState.targetEntityId ? "Revision Draft" : "New Subject Draft"}</h2>

            <div className="dm-item-editor-stack">
              <section className="dm-item-editor-section">
                <h3>Subject Identity</h3>
                <div className="dm-item-edit-grid dm-item-edit-grid-two-up">
                  <label className="dm-field">
                    <span>Subject Type</span>
                    <select
                      value={editorState.type}
                      onChange={(event) =>
                        setEditorState(createNewEditorState(event.target.value as DmKnowledgeEntityType))
                      }
                    >
                      {DM_KNOWLEDGE_ENTITY_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {getKnowledgeEntityTypeLabel(type)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="dm-field">
                    <span>Display Name</span>
                    <input
                      value={editorState.displayName}
                      onChange={(event) =>
                        setEditorState((currentState) => ({
                          ...currentState,
                          displayName: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="dm-field">
                    <span>Card Title</span>
                    <input
                      value={editorState.title}
                      onChange={(event) =>
                        setEditorState((currentState) => ({
                          ...currentState,
                          title: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="dm-field">
                    <span>Summary</span>
                    <input
                      value={editorState.summary}
                      onChange={(event) =>
                        setEditorState((currentState) => ({
                          ...currentState,
                          summary: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              </section>

              <section className="dm-item-editor-section">
                <h3>Sections</h3>
                <div className="knowledge-editor-grid">
                  {editorState.sections.map((section) => (
                    <label key={section.id} className="knowledge-editor-field">
                      <span>{section.title}</span>
                      <textarea
                        className="bio-edit-input"
                        value={section.text}
                        onChange={(event) =>
                          setEditorState((currentState) => ({
                            ...currentState,
                            sections: currentState.sections.map((entry) =>
                              entry.id === section.id
                                ? { ...entry, text: event.target.value }
                                : entry
                            ),
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              </section>

              <section className="dm-item-editor-section">
                <div className="knowledge-detail-actions">
                  <button type="button" className="flow-primary" onClick={handleSaveKnowledgeRevision}>
                    Save Canonical Revision
                  </button>
                  <button type="button" className="flow-secondary" onClick={handleCreateNewSubject}>
                    Reset Draft
                  </button>
                </div>
              </section>

              <section className="dm-item-editor-section">
                <h3>Selected Revision</h3>
                {selectedEntity && selectedRevision ? (
                  <>
                    <p className="dm-summary-line">
                      {getKnowledgeEntityTypeLabel(selectedEntity.type)} | {buildKnowledgeRevisionLabel(selectedRevision)}
                    </p>
                    <KnowledgeCardView entity={selectedEntity} revision={selectedRevision} />
                  </>
                ) : (
                  <p className="empty-block-copy">Select a subject to inspect one of its saved revisions.</p>
                )}

                {selectedEntityRevisions.length > 0 ? (
                  <label className="dm-field">
                    <span>Revision</span>
                    <select
                      value={selectedRevision?.id ?? ""}
                      onChange={(event) => setSelectedRevisionId(event.target.value || null)}
                    >
                      {selectedEntityRevisions.map((revision) => (
                        <option key={revision.id} value={revision.id}>
                          {buildKnowledgeRevisionLabel(revision)} - {revision.summary || revision.title}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </section>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
