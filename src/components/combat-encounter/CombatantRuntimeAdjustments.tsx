import { useEffect, useRef, useState } from "react";

import { buildCharacterDerivedValues } from "../../config/characterRuntime";
import {
  appendDmAuditEntry as appendDmAuditEntryToSheet,
  createDmAuditEntry as createDmAuditLogEntry,
} from "../../lib/dmAudit";
import { buildItemIndex } from "../../lib/items.ts";
import { useAppFlow } from "../../state/appFlow";
import type {
  CharacterSheetUpdater,
  EncounterParticipantView,
} from "../../types/combatEncounterView";

type CombatantRuntimeAdjustmentsProps = {
  view: EncounterParticipantView;
  updateCharacter: (characterId: string, updater: CharacterSheetUpdater) => void;
};

export function CombatantRuntimeAdjustments({
  view,
  updateCharacter,
}: CombatantRuntimeAdjustmentsProps) {
  const { items } = useAppFlow();
  const itemsById = buildItemIndex(items);
  const character = view.character;
  const derived = character ? buildCharacterDerivedValues(character.sheet, itemsById) : null;
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const popoverPanelRef = useRef<HTMLDivElement | null>(null);
  const [hpSet, setHpSet] = useState("");
  const [manaSet, setManaSet] = useState("");
  const [inspirationSet, setInspirationSet] = useState("");
  const [reason, setReason] = useState("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [popoverPlacement, setPopoverPlacement] = useState<"below" | "above">("below");

  useEffect(() => {
    if (!isPopoverOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent): void {
      if (!popoverRef.current?.contains(event.target as Node)) {
        setIsPopoverOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setIsPopoverOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isPopoverOpen]);

  useEffect(() => {
    if (!isPopoverOpen) {
      return;
    }

    function updatePlacement(): void {
      const anchor = popoverRef.current;
      const panel = popoverPanelRef.current;
      if (!anchor || !panel) {
        return;
      }

      const anchorRect = anchor.getBoundingClientRect();
      const panelHeight = panel.offsetHeight;
      const spaceBelow = window.innerHeight - anchorRect.bottom;
      const spaceAbove = anchorRect.top;

      setPopoverPlacement(
        spaceBelow < panelHeight + 16 && spaceAbove > spaceBelow ? "above" : "below"
      );
    }

    const frameId = window.requestAnimationFrame(updatePlacement);
    window.addEventListener("resize", updatePlacement);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePlacement);
    };
  }, [isPopoverOpen]);

  if (!character) {
    return null;
  }

  const runtimeCharacter = character;
  const runtimeDerived = derived;

  function appendRuntimeAuditEntry(
    sheet: typeof runtimeCharacter.sheet,
    fieldPath: string,
    beforeValue: number,
    afterValue: number
  ): typeof runtimeCharacter.sheet {
    const entry = createDmAuditLogEntry({
      characterId: runtimeCharacter.id,
      targetOwnerRole: view.participant.ownerRole,
      editLayer: "runtime",
      fieldPath,
      beforeValue,
      afterValue,
      reason: reason.trim(),
      sourceScreen: "dm-combat-encounter",
    });

    return appendDmAuditEntryToSheet(sheet, entry);
  }

  function applyRuntimeValue(
    field: "currentHp" | "currentMana" | "inspiration",
    value: number
  ): void {
    updateCharacter(runtimeCharacter.id, (currentSheet) => {
      const derivedSnapshot = buildCharacterDerivedValues(currentSheet, itemsById);
      const nextBaseValue =
        field === "currentHp" ? Math.trunc(value) : Math.max(0, Math.trunc(value));
      const before =
        field === "currentMana" ? derivedSnapshot.currentMana : currentSheet[field] ?? 0;
      const maxValue =
        field === "currentHp"
          ? null
          : field === "currentMana"
            ? derivedSnapshot.maxMana
            : null;
      const nextValue = maxValue === null ? nextBaseValue : Math.min(nextBaseValue, maxValue);
      if (before === nextValue) {
        return currentSheet;
      }

      return appendRuntimeAuditEntry(
        {
          ...currentSheet,
          [field]: nextValue,
          ...(field === "currentMana" ? { manaInitialized: true } : null),
        },
        field,
        before,
        nextValue
      );
    });
  }

  function adjustRuntimeValue(
    field: "currentHp" | "currentMana" | "inspiration",
    delta: number
  ): void {
    const currentValue =
      field === "currentMana" ? runtimeDerived?.currentMana ?? 0 : runtimeCharacter.sheet[field];
    applyRuntimeValue(field, currentValue + delta);
  }

  function handleSet(
    field: "currentHp" | "currentMana" | "inspiration",
    inputValue: string,
    clear: () => void
  ): void {
    const parsed = Number.parseInt(inputValue.trim(), 10);
    if (!Number.isFinite(parsed)) {
      return;
    }

    applyRuntimeValue(field, parsed);
    clear();
  }

  function renderRuntimeStepper(
    label: string,
    field: "currentHp" | "currentMana" | "inspiration",
    value: number
  ) {
    return (
      <div className="dm-runtime-stepper-row">
        <span>{label}</span>
        <div className="dm-runtime-stepper">
          <button type="button" onClick={() => adjustRuntimeValue(field, -1)}>
            -
          </button>
          <strong>{value}</strong>
          <button type="button" onClick={() => adjustRuntimeValue(field, 1)}>
            +
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dm-combatant-tool-subsection">
      <p className="section-kicker">Edit Character</p>
      <div className="dm-runtime-popover-anchor" ref={popoverRef}>
        <button
          type="button"
          className="flow-secondary"
          onClick={() => setIsPopoverOpen((current) => !current)}
        >
          Edit Character
        </button>
        {isPopoverOpen ? (
          <div
            ref={popoverPanelRef}
            className={`dm-runtime-popover ${
              popoverPlacement === "above" ? "is-above" : "is-below"
            }`}
          >
            <div className="dm-runtime-popover-head">
              <div>
                <p className="section-kicker">Runtime Adjustments</p>
                <strong>{character.sheet.name.trim() || "Unnamed Character"}</strong>
              </div>
            </div>

            <div className="dm-runtime-stepper-list">
              {renderRuntimeStepper("HP", "currentHp", character.sheet.currentHp)}
              {renderRuntimeStepper("Mana", "currentMana", derived?.currentMana ?? 0)}
              {renderRuntimeStepper("Inspiration", "inspiration", character.sheet.inspiration)}
            </div>
            <div className="dm-runtime-set-grid">
              <label>
                <span>Set HP</span>
                <input
                  type="number"
                  value={hpSet}
                  onChange={(event) => setHpSet(event.target.value)}
                  placeholder="HP"
                />
              </label>
              <button
                type="button"
                onClick={() => handleSet("currentHp", hpSet, () => setHpSet(""))}
              >
                Set
              </button>
            </div>
            <div className="dm-runtime-set-grid">
              <label>
                <span>Set Mana</span>
                <input
                  type="number"
                  value={manaSet}
                  onChange={(event) => setManaSet(event.target.value)}
                  placeholder="Mana"
                />
              </label>
              <button
                type="button"
                onClick={() => handleSet("currentMana", manaSet, () => setManaSet(""))}
              >
                Set
              </button>
            </div>
            <div className="dm-runtime-set-grid">
              <label>
                <span>Set Inspiration</span>
                <input
                  type="number"
                  value={inspirationSet}
                  onChange={(event) => setInspirationSet(event.target.value)}
                  placeholder="Inspiration"
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  handleSet("inspiration", inspirationSet, () => setInspirationSet(""))
                }
              >
                Set
              </button>
            </div>
            <label className="dm-field">
              <span>Reason (optional)</span>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why this change?"
              />
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
}
