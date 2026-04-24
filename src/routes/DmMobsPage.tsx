import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import {
  applyCodexImportPayload,
  buildCodexRequestPacketText,
  createEmptyMobTemplate,
  duplicateMobTemplate,
  getMobTemplatePromptSummary,
  parseCodexImportPayload,
  validateMobTemplate,
} from "../lib/authoring.ts";
import { buildCharacterDerivedValues } from "../config/characterRuntime.ts";
import {
  CHARACTER_APPAREL_MODES,
  PLAYER_CHARACTER_TEMPLATE,
  type EncounterStatusTag,
  type PowerEntry,
} from "../config/characterTemplate.ts";
import { buildItemIndex } from "../lib/items.ts";
import { DAMAGE_TYPES, RESISTANCE_LEVELS, type ResistanceLevel } from "../rules/resistances.ts";
import { STAT_IDS, type StatId } from "../types/character.ts";
import { useAppFlow } from "../state/appFlow";

function parseCommaSeparatedList(value: string): string[] {
  return [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))];
}

function formatCommaSeparatedList(values: string[]): string {
  return values.join(", ");
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function formatStatusTags(tags: EncounterStatusTag[]): string {
  return tags
    .map((tag) => (tag.id === tag.label ? tag.label : `${tag.id}: ${tag.label}`))
    .join("\n");
}

function parseStatusTags(value: string): EncounterStatusTag[] {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separatorIndex = entry.indexOf(":");
      if (separatorIndex > 0) {
        const id = entry.slice(0, separatorIndex).trim();
        const label = entry.slice(separatorIndex + 1).trim();
        return {
          id: id || slugify(label),
          label: label || id,
        };
      }

      return {
        id: slugify(entry),
        label: entry,
      };
    })
    .filter((tag) => tag.id.length > 0 && tag.label.length > 0);
}

function createBlankPower(): PowerEntry {
  return {
    id: "awareness",
    name: "Awareness",
    level: 1,
    governingStat: "PER",
  };
}

export function DmMobsPage() {
  const navigate = useNavigate();
  const {
    roleChoice,
    mobTemplates,
    activeDmCharacter,
    items,
    createMobTemplate,
    updateMobTemplate,
    deleteMobTemplate,
    updateAuthoringState,
  } = useAppFlow();
  const [selectedMobId, setSelectedMobId] = useState<string | null>(mobTemplates[0]?.id ?? null);
  const [requestIntent, setRequestIntent] = useState("Draft a portal-themed mob batch.");
  const [requestTheme, setRequestTheme] = useState("");
  const [requestChallengeRating, setRequestChallengeRating] = useState("");
  const [exportPacket, setExportPacket] = useState("");
  const [importPayload, setImportPayload] = useState("");
  const [panelMessage, setPanelMessage] = useState<string | null>(null);
  const itemsById = useMemo(() => buildItemIndex(items), [items]);

  useEffect(() => {
    if (!selectedMobId && mobTemplates.length > 0) {
      setSelectedMobId(mobTemplates[0]?.id ?? null);
      return;
    }

    if (selectedMobId && !mobTemplates.some((template) => template.id === selectedMobId)) {
      setSelectedMobId(mobTemplates[0]?.id ?? null);
    }
  }, [mobTemplates, selectedMobId]);

  const selectedMob =
    mobTemplates.find((template) => template.id === selectedMobId) ?? mobTemplates[0] ?? null;
  const selectedMobDerived = useMemo(
    () => (selectedMob ? buildCharacterDerivedValues(selectedMob.sheet, itemsById) : null),
    [itemsById, selectedMob]
  );
  const selectedMobValidationErrors = selectedMob ? validateMobTemplate(selectedMob) : [];
  const publishedMobExamples = selectedMob
    ? mobTemplates
        .filter((template) => template.id !== selectedMob.id && template.status === "published")
        .slice(0, 3)
    : mobTemplates.filter((template) => template.status === "published").slice(0, 3);

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  function createNewMobFromBlank(): void {
    const mobTemplateId = createMobTemplate();
    setSelectedMobId(mobTemplateId);
    setPanelMessage(null);
  }

  function createMobFromActiveNpc(): void {
    if (!activeDmCharacter) {
      setPanelMessage("Open an NPC sheet first if you want to snapshot it into the Mob Library.");
      return;
    }

    const mobTemplateId = createMobTemplate({
      ...createEmptyMobTemplate({
        name: activeDmCharacter.sheet.name.trim() || "NPC Snapshot",
        sheet: activeDmCharacter.sheet,
      }),
      sourceKind: "manual",
    });
    setSelectedMobId(mobTemplateId);
    setPanelMessage("Saved the active DM character sheet as a new mob template.");
  }

  function createDuplicateMob(): void {
    if (!selectedMob) {
      return;
    }

    const duplicateId = createMobTemplate(duplicateMobTemplate(selectedMob));
    setSelectedMobId(duplicateId);
    setPanelMessage(null);
  }

  function handleDeleteSelectedMob(): void {
    if (!selectedMob) {
      return;
    }

    deleteMobTemplate(selectedMob.id);
    setPanelMessage("Deleted the selected mob if it was not referenced by a saved mob group.");
  }

  function updateSelectedMobStatus(nextStatus: "draft" | "playtest_ready" | "published"): void {
    if (!selectedMob) {
      return;
    }

    if (nextStatus === "published" && selectedMobValidationErrors.length > 0) {
      setPanelMessage(selectedMobValidationErrors[0] ?? "Mob validation failed.");
      return;
    }

    updateMobTemplate(selectedMob.id, (currentMob) => ({
      ...currentMob,
      status: nextStatus,
    }));
    setPanelMessage(null);
  }

  function buildMobExportPacket(): void {
    const nextTheme =
      requestTheme.trim() ||
      selectedMob?.themeTags[0] ||
      publishedMobExamples[0]?.themeTags[0] ||
      "";
    const nextChallengeRating =
      requestChallengeRating.trim().length > 0
        ? Math.max(0, Number.parseInt(requestChallengeRating, 10) || 0)
        : selectedMob?.challengeRating ?? null;
    const shouldIncludeSelectedMob =
      !!selectedMob &&
      (selectedMob.themeTags.length > 0 ||
        selectedMob.behaviorTags.length > 0 ||
        selectedMob.loot.trim().length > 0 ||
        selectedMob.designerNotes.trim().length > 0 ||
        selectedMob.sheet.concept.trim().length > 0 ||
        selectedMob.sheet.faction.trim().length > 0 ||
        selectedMob.sheet.powers.length > 0 ||
        selectedMob.challengeRating !== 1 ||
        !selectedMob.name.startsWith("New Mob"));

    setExportPacket(
      buildCodexRequestPacketText({
        requestKind: "mob_template_batch",
        requestIntent,
        theme: nextTheme,
        difficulty: {
          mobChallengeRating: nextChallengeRating,
        },
        currentObject:
          selectedMob && shouldIncludeSelectedMob
            ? getMobTemplatePromptSummary(selectedMob)
            : null,
        exampleObjects: publishedMobExamples.map((template) =>
          getMobTemplatePromptSummary(template)
        ),
      })
    );
    setPanelMessage("Built a request packet for manual Codex mob generation.");
  }

  function importMobPayload(): void {
    const parsed = parseCodexImportPayload(importPayload);
    if ("error" in parsed) {
      setPanelMessage(parsed.error);
      return;
    }

    if (parsed.kind !== "mob_template_batch") {
      setPanelMessage("This import box expects a mob_template_batch payload.");
      return;
    }

    updateAuthoringState((currentState) =>
      applyCodexImportPayload({
        payload: parsed,
        rawPayload: importPayload,
        currentState,
      })
    );
    setSelectedMobId(parsed.mobs[0]?.id ?? null);
    setPanelMessage(`Imported ${parsed.mobs.length} mob template(s).`);
    setImportPayload("");
  }

  return (
    <main className="dm-page">
      <section className="dm-shell">
        <header className="dm-topbar">
          <div>
            <p className="section-kicker">Dungeon Master</p>
            <h1>Mob Library</h1>
          </div>
          <div className="dm-nav-actions">
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm")}>
              DM Dashboard
            </button>
          </div>
        </header>

        <section className="flow-card flow-card-wide">
          <div className="dm-item-edit-actions">
            <button type="button" className="flow-primary" onClick={createNewMobFromBlank}>
              Create New Mob
            </button>
            <button type="button" className="flow-secondary" onClick={createMobFromActiveNpc}>
              Snapshot Active NPC
            </button>
            <button type="button" className="flow-secondary" onClick={createDuplicateMob}>
              Duplicate Selected Mob
            </button>
            <button type="button" className="flow-danger" onClick={handleDeleteSelectedMob}>
              Delete Selected Mob
            </button>
          </div>

          <div className="dm-item-edit-layout">
            <article className="sheet-card dm-item-picker-card">
              <p className="section-kicker">Saved Mob Templates</p>
              <div className="dm-item-picker-list">
                {mobTemplates.length === 0 ? (
                  <p className="empty-block-copy">No mob templates saved yet.</p>
                ) : (
                  mobTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className={`dm-item-picker-button${template.id === selectedMob?.id ? " is-active" : ""}`}
                      onClick={() => setSelectedMobId(template.id)}
                    >
                      <strong>{template.name}</strong>
                      <span>{template.role}</span>
                      <small>
                        {template.status} | {template.themeTags.join(", ") || "No theme tags"}
                      </small>
                    </button>
                  ))
                )}
              </div>
            </article>

            <article className="sheet-card dm-item-editor-card">
              {!selectedMob ? (
                <p className="empty-block-copy">Select or create a mob template to start editing.</p>
              ) : (
                <div className="dm-item-editor-stack">
                  <section className="dm-item-editor-section">
                    <div className="dm-item-summary-head">
                      <div>
                        <p className="section-kicker">Metadata</p>
                        <h2>{selectedMob.name}</h2>
                      </div>
                      <div className="row-side">
                        <strong>{selectedMob.status}</strong>
                        <p>Version {selectedMob.version}</p>
                      </div>
                    </div>
                    <div className="dm-item-edit-grid">
                      <label className="dm-field">
                        <span>Mob Name</span>
                        <input
                          value={selectedMob.name}
                          onChange={(event) =>
                            updateMobTemplate(selectedMob.id, (currentMob) => ({
                              ...currentMob,
                              name: event.target.value,
                              sheet: {
                                ...currentMob.sheet,
                                name: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Challenge Rating</span>
                        <input
                          type="number"
                          min={0}
                          value={selectedMob.challengeRating}
                          onChange={(event) =>
                            updateMobTemplate(selectedMob.id, (currentMob) => ({
                              ...currentMob,
                              challengeRating: Math.max(
                                0,
                                Number.parseInt(event.target.value || "0", 10) || 0
                              ),
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Role</span>
                        <select
                          value={selectedMob.role}
                          onChange={(event) =>
                            updateMobTemplate(selectedMob.id, (currentMob) => ({
                              ...currentMob,
                              role: event.target.value as typeof currentMob.role,
                            }))
                          }
                        >
                          {["brute", "skirmisher", "ranged", "support", "controller", "boss", "custom"].map(
                            (role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            )
                          )}
                        </select>
                      </label>
                      <label className="dm-field">
                        <span>Status</span>
                        <select
                          value={selectedMob.status}
                          onChange={(event) =>
                            updateSelectedMobStatus(event.target.value as typeof selectedMob.status)
                          }
                        >
                          <option value="draft">draft</option>
                          <option value="playtest_ready">playtest_ready</option>
                          <option value="published">published</option>
                        </select>
                      </label>
                    </div>
                    <div className="dm-item-edit-grid dm-item-edit-grid-two-up">
                      <label className="dm-field">
                        <span>Theme Tags</span>
                        <input
                          value={formatCommaSeparatedList(selectedMob.themeTags)}
                          onChange={(event) =>
                            updateMobTemplate(selectedMob.id, (currentMob) => ({
                              ...currentMob,
                              themeTags: parseCommaSeparatedList(event.target.value),
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Behavior Tags</span>
                        <input
                          value={formatCommaSeparatedList(selectedMob.behaviorTags)}
                          onChange={(event) =>
                            updateMobTemplate(selectedMob.id, (currentMob) => ({
                              ...currentMob,
                              behaviorTags: parseCommaSeparatedList(event.target.value),
                            }))
                          }
                        />
                      </label>
                    </div>
                    <div className="dm-item-edit-grid dm-item-edit-grid-two-up">
                      <label className="dm-field">
                        <span>Loot</span>
                        <textarea
                          className="notes-input"
                          value={selectedMob.loot}
                          onChange={(event) =>
                            updateMobTemplate(selectedMob.id, (currentMob) => ({
                              ...currentMob,
                              loot: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Designer Notes</span>
                        <textarea
                          className="notes-input"
                          value={selectedMob.designerNotes}
                          onChange={(event) =>
                            updateMobTemplate(selectedMob.id, (currentMob) => ({
                              ...currentMob,
                              designerNotes: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  </section>

                  {selectedMobDerived ? (
                    <section className="dm-item-editor-section">
                      <p className="section-kicker">Derived Combat</p>
                      <div className="combat-grid">
                        <div>
                          <span>Max HP</span>
                          <strong>{selectedMobDerived.maxHp}</strong>
                        </div>
                        <div>
                          <span>Max Mana</span>
                          <strong>{selectedMobDerived.maxMana}</strong>
                        </div>
                        <div>
                          <span>Initiative</span>
                          <strong>{selectedMobDerived.initiative}</strong>
                        </div>
                        <div>
                          <span>AC</span>
                          <strong>{selectedMobDerived.armorClass}</strong>
                        </div>
                        <div>
                          <span>DR</span>
                          <strong>{selectedMobDerived.damageReduction}</strong>
                        </div>
                        <div>
                          <span>Soak</span>
                          <strong>{selectedMobDerived.soak}</strong>
                        </div>
                        <div>
                          <span>Melee Attack</span>
                          <strong>{selectedMobDerived.meleeAttack}</strong>
                        </div>
                        <div>
                          <span>Ranged Attack</span>
                          <strong>{selectedMobDerived.rangedAttack}</strong>
                        </div>
                        <div>
                          <span>Melee Damage</span>
                          <strong>{selectedMobDerived.meleeDamage}</strong>
                        </div>
                      </div>
                    </section>
                  ) : null}

                  <section className="dm-item-editor-section">
                    <p className="section-kicker">Sheet Core</p>
                    <div className="dm-item-edit-grid">
                      <label className="dm-field">
                        <span>Concept</span>
                        <input
                          value={selectedMob.sheet.concept}
                          onChange={(event) =>
                            updateMobTemplate(selectedMob.id, (currentMob) => ({
                              ...currentMob,
                              sheet: {
                                ...currentMob.sheet,
                                concept: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Faction</span>
                        <input
                          value={selectedMob.sheet.faction}
                          onChange={(event) =>
                            updateMobTemplate(selectedMob.id, (currentMob) => ({
                              ...currentMob,
                              sheet: {
                                ...currentMob.sheet,
                                faction: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Apparel Mode</span>
                        <select
                          value={selectedMob.sheet.apparelMode}
                          onChange={(event) =>
                            updateMobTemplate(selectedMob.id, (currentMob) => ({
                              ...currentMob,
                              sheet: {
                                ...currentMob.sheet,
                                apparelMode: event.target.value as (typeof CHARACTER_APPAREL_MODES)[number],
                              },
                            }))
                          }
                        >
                          {CHARACTER_APPAREL_MODES.map((mode) => (
                            <option key={mode} value={mode}>
                              {mode}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="dm-item-edit-grid dm-item-edit-grid-two-up">
                      <label className="dm-field">
                        <span>Biography Primary</span>
                        <textarea
                          className="notes-input"
                          value={selectedMob.sheet.biographyPrimary}
                          onChange={(event) =>
                            updateMobTemplate(selectedMob.id, (currentMob) => ({
                              ...currentMob,
                              sheet: {
                                ...currentMob.sheet,
                                biographyPrimary: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Biography Secondary</span>
                        <textarea
                          className="notes-input"
                          value={selectedMob.sheet.biographySecondary}
                          onChange={(event) =>
                            updateMobTemplate(selectedMob.id, (currentMob) => ({
                              ...currentMob,
                              sheet: {
                                ...currentMob.sheet,
                                biographySecondary: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                    </div>
                  </section>

                  <section className="dm-item-editor-section">
                    <p className="section-kicker">Resources</p>
                    <div className="dm-item-edit-grid">
                      <label className="dm-field">
                        <span>Current HP</span>
                        <input
                          type="number"
                          value={selectedMob.sheet.currentHp}
                          onChange={(event) =>
                            updateMobTemplate(selectedMob.id, (currentMob) => ({
                              ...currentMob,
                              sheet: {
                                ...currentMob.sheet,
                                currentHp: Number.parseInt(event.target.value || "0", 10) || 0,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Current Mana</span>
                        <input
                          type="number"
                          value={selectedMob.sheet.currentMana}
                          onChange={(event) =>
                            updateMobTemplate(selectedMob.id, (currentMob) => ({
                              ...currentMob,
                              sheet: {
                                ...currentMob.sheet,
                                currentMana: Math.max(0, Number.parseInt(event.target.value || "0", 10) || 0),
                                manaInitialized: true,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Age</span>
                        <input
                          type="number"
                          value={selectedMob.sheet.age ?? ""}
                          onChange={(event) =>
                            updateMobTemplate(selectedMob.id, (currentMob) => ({
                              ...currentMob,
                              sheet: {
                                ...currentMob.sheet,
                                age:
                                  event.target.value.trim().length > 0
                                    ? Number.parseInt(event.target.value, 10) || 0
                                    : null,
                              },
                            }))
                          }
                        />
                      </label>
                    </div>
                  </section>

                  <section className="dm-item-editor-section">
                    <p className="section-kicker">Stats</p>
                    <div className="dm-item-edit-grid dm-item-edit-grid-paired-stats">
                      {STAT_IDS.map((statId) => (
                        <label key={statId} className="dm-field">
                          <span>{statId}</span>
                          <input
                            type="number"
                            value={selectedMob.sheet.statState[statId].base}
                            onChange={(event) =>
                              updateMobTemplate(selectedMob.id, (currentMob) => ({
                                ...currentMob,
                                sheet: {
                                  ...currentMob.sheet,
                                  statState: {
                                    ...currentMob.sheet.statState,
                                    [statId]: {
                                      ...currentMob.sheet.statState[statId],
                                      base: Number.parseInt(event.target.value || "0", 10) || 0,
                                    },
                                  },
                                },
                              }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className="dm-item-editor-section">
                    <p className="section-kicker">Skills</p>
                    <div className="dm-item-edit-grid dm-item-edit-grid-paired-stats">
                      {selectedMob.sheet.skills.map((skill) => (
                        <label key={skill.id} className="dm-field">
                          <span>{skill.label}</span>
                          <input
                            type="number"
                            value={skill.base}
                            onChange={(event) =>
                              updateMobTemplate(selectedMob.id, (currentMob) => ({
                                ...currentMob,
                                sheet: {
                                  ...currentMob.sheet,
                                  skills: currentMob.sheet.skills.map((currentSkill) =>
                                    currentSkill.id === skill.id
                                      ? {
                                          ...currentSkill,
                                          base: Number.parseInt(event.target.value || "0", 10) || 0,
                                        }
                                      : currentSkill
                                  ),
                                },
                              }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className="dm-item-editor-section">
                    <div className="dm-item-summary-head">
                      <div>
                        <p className="section-kicker">Powers</p>
                        <h3>Power List</h3>
                      </div>
                      <div className="dm-entry-actions">
                        <button
                          type="button"
                          onClick={() =>
                            updateMobTemplate(selectedMob.id, (currentMob) => ({
                              ...currentMob,
                              sheet: {
                                ...currentMob.sheet,
                                powers: [...currentMob.sheet.powers, createBlankPower()],
                              },
                            }))
                          }
                        >
                          Add Power
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateMobTemplate(selectedMob.id, (currentMob) => ({
                              ...currentMob,
                              sheet: {
                                ...currentMob.sheet,
                                powers: PLAYER_CHARACTER_TEMPLATE.createInstance().powers,
                              },
                            }))
                          }
                        >
                          Clear Powers
                        </button>
                      </div>
                    </div>
                    <div className="dm-stack">
                      {selectedMob.sheet.powers.length === 0 ? (
                        <p className="empty-block-copy">No powers assigned.</p>
                      ) : (
                        selectedMob.sheet.powers.map((power, powerIndex) => (
                          <div key={`${power.id}-${powerIndex}`} className="dm-item-custom-property">
                            <div className="dm-item-edit-grid">
                              <label className="dm-field">
                                <span>Power Id</span>
                                <input
                                  value={power.id}
                                  onChange={(event) =>
                                    updateMobTemplate(selectedMob.id, (currentMob) => ({
                                      ...currentMob,
                                      sheet: {
                                        ...currentMob.sheet,
                                        powers: currentMob.sheet.powers.map((currentPower, currentIndex) =>
                                          currentIndex === powerIndex
                                            ? {
                                                ...currentPower,
                                                id: event.target.value,
                                              }
                                            : currentPower
                                        ),
                                      },
                                    }))
                                  }
                                />
                              </label>
                              <label className="dm-field">
                                <span>Name</span>
                                <input
                                  value={power.name}
                                  onChange={(event) =>
                                    updateMobTemplate(selectedMob.id, (currentMob) => ({
                                      ...currentMob,
                                      sheet: {
                                        ...currentMob.sheet,
                                        powers: currentMob.sheet.powers.map((currentPower, currentIndex) =>
                                          currentIndex === powerIndex
                                            ? {
                                                ...currentPower,
                                                name: event.target.value,
                                              }
                                            : currentPower
                                        ),
                                      },
                                    }))
                                  }
                                />
                              </label>
                              <label className="dm-field">
                                <span>Level</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={5}
                                  value={power.level}
                                  onChange={(event) =>
                                    updateMobTemplate(selectedMob.id, (currentMob) => ({
                                      ...currentMob,
                                      sheet: {
                                        ...currentMob.sheet,
                                        powers: currentMob.sheet.powers.map((currentPower, currentIndex) =>
                                          currentIndex === powerIndex
                                            ? {
                                                ...currentPower,
                                                level: Math.max(
                                                  1,
                                                  Math.min(
                                                    5,
                                                    Number.parseInt(event.target.value || "1", 10) || 1
                                                  )
                                                ),
                                              }
                                            : currentPower
                                        ),
                                      },
                                    }))
                                  }
                                />
                              </label>
                            </div>
                            <div className="dm-item-edit-grid dm-item-edit-grid-two-up">
                              <label className="dm-field">
                                <span>Governing Stat</span>
                                <select
                                  value={power.governingStat}
                                  onChange={(event) =>
                                    updateMobTemplate(selectedMob.id, (currentMob) => ({
                                      ...currentMob,
                                      sheet: {
                                        ...currentMob.sheet,
                                        powers: currentMob.sheet.powers.map((currentPower, currentIndex) =>
                                          currentIndex === powerIndex
                                            ? {
                                                ...currentPower,
                                                governingStat: event.target.value as StatId,
                                              }
                                            : currentPower
                                        ),
                                      },
                                    }))
                                  }
                                >
                                  {STAT_IDS.map((statId) => (
                                    <option key={statId} value={statId}>
                                      {statId}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <div className="dm-control-row">
                                <button
                                  type="button"
                                  className="flow-danger"
                                  onClick={() =>
                                    updateMobTemplate(selectedMob.id, (currentMob) => ({
                                      ...currentMob,
                                      sheet: {
                                        ...currentMob.sheet,
                                        powers: currentMob.sheet.powers.filter(
                                          (_entry, currentIndex) => currentIndex !== powerIndex
                                        ),
                                      },
                                    }))
                                  }
                                >
                                  Remove Power
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="dm-item-editor-section">
                    <p className="section-kicker">Resistances</p>
                    <div className="dm-item-edit-grid">
                      {DAMAGE_TYPES.map((damageType) => (
                        <label key={damageType.id} className="dm-field">
                          <span>{damageType.label}</span>
                          <select
                            value={selectedMob.sheet.resistances[damageType.id]}
                            onChange={(event) =>
                              updateMobTemplate(selectedMob.id, (currentMob) => ({
                                ...currentMob,
                                sheet: {
                                  ...currentMob.sheet,
                                  resistances: {
                                    ...currentMob.sheet.resistances,
                                    [damageType.id]: Number.parseInt(
                                      event.target.value,
                                      10
                                    ) as ResistanceLevel,
                                  },
                                },
                              }))
                            }
                          >
                            {Object.entries(RESISTANCE_LEVELS).map(([level, info]) => (
                              <option key={level} value={level}>
                                {level}: {info.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className="dm-item-editor-section">
                    <p className="section-kicker">Status and Effects</p>
                    <div className="dm-item-edit-grid dm-item-edit-grid-two-up">
                      <label className="dm-field">
                        <span>Status Tags</span>
                        <textarea
                          className="notes-input"
                          value={formatStatusTags(selectedMob.sheet.statusTags)}
                          onChange={(event) =>
                            updateMobTemplate(selectedMob.id, (currentMob) => ({
                              ...currentMob,
                              sheet: {
                                ...currentMob.sheet,
                                statusTags: parseStatusTags(event.target.value),
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="dm-field">
                        <span>Effects</span>
                        <textarea
                          className="notes-input"
                          value={selectedMob.sheet.effects.join("\n")}
                          onChange={(event) =>
                            updateMobTemplate(selectedMob.id, (currentMob) => ({
                              ...currentMob,
                              sheet: {
                                ...currentMob.sheet,
                                effects: event.target.value
                                  .split("\n")
                                  .map((entry) => entry.trim())
                                  .filter(Boolean),
                              },
                            }))
                          }
                        />
                      </label>
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
                          placeholder={selectedMob.themeTags[0] ?? ""}
                        />
                      </label>
                      <label className="dm-field">
                        <span>Requested CR</span>
                        <input
                          type="number"
                          min={0}
                          value={requestChallengeRating}
                          onChange={(event) => setRequestChallengeRating(event.target.value)}
                          placeholder={String(selectedMob.challengeRating)}
                        />
                      </label>
                    </div>
                    <div className="dm-control-row dm-control-row-wrap">
                      <button type="button" className="flow-secondary" onClick={buildMobExportPacket}>
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
                      <button type="button" className="flow-primary" onClick={importMobPayload}>
                        Import Mob Payload
                      </button>
                    </div>
                  </section>

                  {selectedMobValidationErrors.length > 0 ? (
                    <section className="dm-item-editor-section">
                      <p className="section-kicker">Validation</p>
                      <div className="dm-stack">
                        {selectedMobValidationErrors.map((error) => (
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
