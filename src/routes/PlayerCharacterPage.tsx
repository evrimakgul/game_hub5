import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { CharacterHistorySection } from "../components/player-character/CharacterHistorySection";
import { CharacterInventorySection } from "../components/player-character/CharacterInventorySection";
import { CharacterKnowledgeSection } from "../components/player-character/CharacterKnowledgeSection.tsx";
import { CharacterPowersSection } from "../components/player-character/CharacterPowersSection";
import { CharacterSkillsSection } from "../components/player-character/CharacterSkillsSection";
import { CharacterStatsSection } from "../components/player-character/CharacterStatsSection";
import { KnowledgeRevisionDialog } from "../components/player-character/KnowledgeRevisionDialog.tsx";
import { RollHelperPopover } from "../components/player-character/RollHelperPopover";
import {
  PLAYER_CHARACTER_TEMPLATE,
  statGroups,
  type CharacterDraft,
} from "../config/characterTemplate";
import {
  getCurrentStatValue,
  getCurrentSkillValue,
  getResolvedResistanceLevel,
} from "../config/characterRuntime.ts";
import { formatDateDayMonthYear } from "../lib/dateTime";
import { rollD10Faces } from "../lib/dice";
import { getSupabaseClient } from "../lib/supabaseClient.ts";
import {
  attachPlayerCharacterMetadata,
  isCharacterPlayableByUser,
  mergeVisibleCampaignCharacters,
} from "../lib/onlineCharacterSync.ts";
import {
  listVisibleCampaignCharacters,
  subscribeToVisibleCampaignCharacters,
  updateCampaignCharacterSheet,
  updatePlayerCharacterSheet,
} from "../lib/realtimeSessionRepository.ts";
import {
  characterOwnsCurrentItemKnowledgeCard,
  getKnowledgeEntityById,
  getKnowledgeGroupsForOwner,
  getKnowledgeRevisionById,
} from "../lib/knowledge.ts";
import { prependGameHistoryEntry } from "../lib/historyEntries.ts";
import { usePlayerCharacterMutations } from "../hooks/usePlayerCharacterMutations";
import { useOnlineSession } from "../state/onlineSession.tsx";
import {
  buildItemIndex,
  canViewerSeeItemBonusDetails,
  getCharacterArtifactAppraisalLevel,
  getEquipmentSlotLabel,
  getEquipmentSlotOccupancy,
  getItemAllowedEquipSlots,
  getItemCompactHeaderSummary,
  getViewerFacingItemRecord,
} from "../lib/items.ts";
import { type WorldCastRequestPayload } from "../lib/powerCasting.ts";
import { buildPowerUsageSummary } from "../lib/powerUsage";
import { resolveDicePool } from "../rules/combat";
import {
  buildEditSessionStatFloor,
  buildPlayerCharacterViewModel,
  type PlayerRollTarget,
} from "../selectors/playerCharacterViewModel";
import { useAppFlow } from "../state/appFlow";
import type { CharacterRecord, StatId } from "../types/character";
import {
  CHARACTER_LOADOUT_SLOT_IDS,
  isMainEquipmentSlotId,
  isSupplementaryEquipmentSlotId,
  isWeaponHandSlotId,
  type CanonicalEquipmentSlotId,
  type SharedItemRecord,
} from "../types/items.ts";
import {
  DAMAGE_TYPES,
  RESISTANCE_LEVELS,
} from "../rules/resistances.ts";

type RollResult = {
  labels: string[];
  poolSize: number;
  faces: number[];
  successes: number;
  isBotch: boolean;
};

type CustomRollModifier = {
  id: number;
  value: number;
};

type CharacterSheetUpdater =
  | CharacterDraft
  | ((current: CharacterDraft) => CharacterDraft);

export type PlayerCharacterPageViewMode = "player" | "dm-readonly" | "dm-editable";

type CharacterDetailTabId =
  | "stats"
  | "skills"
  | "powers"
  | "inventory"
  | "knowledge"
  | "history"
  | "notes";

const CHARACTER_DETAIL_TABS: Array<{ id: CharacterDetailTabId; label: string }> = [
  { id: "stats", label: "Stats" },
  { id: "skills", label: "Skills" },
  { id: "powers", label: "Powers" },
  { id: "inventory", label: "Inventory" },
  { id: "knowledge", label: "Knowledge" },
  { id: "history", label: "History" },
  { id: "notes", label: "Notes" },
];

function getInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "CS";
}

function formatFirstOrFallback(values: string[], fallback: string): string {
  return values.find((value) => value.trim().length > 0) ?? fallback;
}

export function PlayerCharacterPage({
  viewMode,
}: {
  viewMode: PlayerCharacterPageViewMode;
}) {
  const {
    characters,
    itemCategoryDefinitions,
    itemSubcategoryDefinitions,
    itemBlueprints,
    items,
    knowledgeEntities,
    knowledgeRevisions,
    knowledgeOwnerships,
    activePlayerCharacter,
    activeDmCharacter,
    activeCombatEncounter,
    updateCharacter,
    replaceCharacters,
    updateKnowledgeState,
    executeWorldCast,
    executeArtifactAppraisal,
    createItem,
    updateItem,
    deleteItem,
  } = useAppFlow();
  const navigate = useNavigate();
  const location = useLocation();
  const client = useMemo(() => getSupabaseClient(), []);
  const online = useOnlineSession();
  const [isEditMode, setIsEditMode] = useState(false);
  const [dmEditMode, setDmEditMode] = useState(false);
  const [adminOverrideMode, setAdminOverrideMode] = useState(false);
  const [dmEditReason, setDmEditReason] = useState("");
  const [adminOverrideReason, setAdminOverrideReason] = useState("");
  const [adminOverrideError, setAdminOverrideError] = useState<string | null>(null);
  const [editSessionStatFloor, setEditSessionStatFloor] = useState<Record<StatId, number> | null>(
    null
  );
  const [pendingPowerId, setPendingPowerId] = useState("");
  const [isDiceOpen, setIsDiceOpen] = useState(false);
  const [dicePosition, setDicePosition] = useState({ x: 24, y: 24 });
  const [selectedRollIds, setSelectedRollIds] = useState<string[]>([]);
  const [customRollInput, setCustomRollInput] = useState("");
  const [customRollModifiers, setCustomRollModifiers] = useState<CustomRollModifier[]>([]);
  const [lastRoll, setLastRoll] = useState<RollResult | null>(null);
  const [sessionNotes, setSessionNotes] = useState("");
  const [activeDetailTab, setActiveDetailTab] = useState<CharacterDetailTabId>("inventory");
  const [activeLoadoutSlotId, setActiveLoadoutSlotId] = useState<CanonicalEquipmentSlotId | null>(null);
  const [openKnowledgeRevisionId, setOpenKnowledgeRevisionId] = useState<string | null>(null);
  const [sheetSyncMessage, setSheetSyncMessage] = useState("");
  const lastPersistedSheetKeyRef = useRef("");
  const lastPersistedAccountSheetKeyRef = useRef("");
  const dragRef = useRef<{ active: boolean; moved: boolean; offsetX: number; offsetY: number }>(
    {
      active: false,
      moved: false,
      offsetX: 0,
      offsetY: 0,
    }
  );
  const isDmReadOnlyView = viewMode === "dm-readonly";
  const isDmEditableView = viewMode === "dm-editable";
  const isDmView = viewMode !== "player";
  const currentUserId = online.status === "authenticated" ? online.user?.id ?? null : null;
  const queryParams = new URLSearchParams(location.search);
  const characterIdFromQuery = queryParams.get("characterId");
  const campaignIdFromQuery = queryParams.get("campaignId");
  const queriedCharacter =
    characterIdFromQuery
      ? characters.find((character) => character.id === characterIdFromQuery) ?? null
      : null;
  const isReadOnlyView = isDmReadOnlyView;
  const activeCharacter =
    queriedCharacter ?? (isDmEditableView ? activeDmCharacter : activePlayerCharacter);
  const activeSheet = activeCharacter?.sheet ?? null;
  const activeOnlineCampaignId =
    activeCharacter?.onlineCampaignId ?? campaignIdFromQuery ?? null;
  const sheetState = activeSheet ?? PLAYER_CHARACTER_TEMPLATE.createInstance();
  const isPlayerCombatant =
    !isDmView &&
    activeCharacter !== null &&
    (activeCombatEncounter?.participants.some(
      (participant) => participant.characterId === activeCharacter.id
    ) ?? false);

  useEffect(() => {
    const supabase = client;
    const userId = online.user?.id ?? null;
    if (!supabase || !userId) {
      return;
    }

    let cancelled = false;

    function shouldUseRemoteSheet(record: { characterId: string; campaignId: string; ownerUserId: string }): boolean {
      const isOwnedPlayerSheet = record.ownerUserId === userId;
      const isViewedCampaignSheet =
        isDmView &&
        record.characterId === characterIdFromQuery &&
        record.campaignId === activeOnlineCampaignId;

      return isOwnedPlayerSheet || isViewedCampaignSheet;
    }

    function mergeCampaignRows(rows: Parameters<typeof mergeVisibleCampaignCharacters>[0]["campaignCharacters"]): void {
      const nextCharacters = mergeVisibleCampaignCharacters({
        localCharacters: characters,
        campaignCharacters: rows,
        currentUserId: userId!,
        canUseRemoteSheet: shouldUseRemoteSheet,
      });

      if (nextCharacters !== characters) {
        replaceCharacters(nextCharacters);
        setSheetSyncMessage("Character sheet synced.");
      }
    }

    async function syncVisibleCharacters(): Promise<void> {
      const result = await listVisibleCampaignCharacters({ client: supabase! });
      if (cancelled || "error" in result) {
        if (!cancelled && "error" in result) {
          setSheetSyncMessage(result.error);
        }
        return;
      }

      mergeCampaignRows(result.filter(shouldUseRemoteSheet));
    }

    void syncVisibleCharacters();
    const channel = subscribeToVisibleCampaignCharacters({
      client: supabase,
      onRecord: (record) => {
        if (cancelled || !shouldUseRemoteSheet(record)) {
          return;
        }

        mergeCampaignRows([record]);
      },
    });

    return () => {
      cancelled = true;
      void channel.unsubscribe();
    };
  }, [
    activeOnlineCampaignId,
    characterIdFromQuery,
    characters,
    client,
    isDmView,
    online.user?.id,
    replaceCharacters,
  ]);

  useEffect(() => {
    if (!activeCharacter || !activeOnlineCampaignId || !activeCharacter.onlineSheetUpdatedAt) {
      return;
    }

    lastPersistedSheetKeyRef.current = `${activeOnlineCampaignId}|${activeCharacter.id}|${JSON.stringify(activeCharacter.sheet)}`;
  }, [activeCharacter?.id, activeCharacter?.onlineSheetUpdatedAt, activeOnlineCampaignId]);

  useEffect(() => {
    if (
      !activeCharacter ||
      activeCharacter.ownerRole !== "player" ||
      activeCharacter.ownerUserId !== online.user?.id ||
      !activeCharacter.onlineSheetUpdatedAt
    ) {
      return;
    }

    lastPersistedAccountSheetKeyRef.current = `account|${activeCharacter.id}|${JSON.stringify(activeCharacter.sheet)}`;
  }, [activeCharacter?.id, activeCharacter?.onlineSheetUpdatedAt, online.user?.id]);

  useEffect(() => {
    if (
      !activeCharacter ||
      !activeSheet ||
      !activeOnlineCampaignId ||
      !client ||
      !online.user
    ) {
      return;
    }

    const canSaveCurrentSheet =
      !isReadOnlyView || dmEditMode || adminOverrideMode || isDmEditableView;
    if (!canSaveCurrentSheet) {
      return;
    }

    const ownerUserId = activeCharacter.ownerUserId ?? online.user.id;
    const canWriteSheet = isDmView || ownerUserId === online.user.id;
    if (!canWriteSheet) {
      return;
    }

    const sheetKey = `${activeOnlineCampaignId}|${activeCharacter.id}|${JSON.stringify(activeSheet)}`;
    if (sheetKey === lastPersistedSheetKeyRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      const result = await updateCampaignCharacterSheet({
        client,
        campaignId: activeOnlineCampaignId,
        characterId: activeCharacter.id,
        ownerUserId,
        displayName: activeSheet.name.trim() || activeCharacter.id,
        sheetPayload: activeSheet,
      });

      if ("error" in result) {
        setSheetSyncMessage(result.error);
        return;
      }

      lastPersistedSheetKeyRef.current = sheetKey;
      setSheetSyncMessage("Character sheet saved.");
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [
    activeCharacter,
    activeOnlineCampaignId,
    activeSheet,
    characters,
    client,
    adminOverrideMode,
    dmEditMode,
    isDmEditableView,
    isDmView,
    isReadOnlyView,
    online.user,
    replaceCharacters,
  ]);

  useEffect(() => {
    if (
      !activeCharacter ||
      !activeSheet ||
      !client ||
      !online.user ||
      isDmView ||
      activeCharacter.ownerRole !== "player" ||
      activeCharacter.ownerUserId !== online.user.id
    ) {
      return;
    }

    const sheetKey = `account|${activeCharacter.id}|${JSON.stringify(activeSheet)}`;
    if (sheetKey === lastPersistedAccountSheetKeyRef.current) {
      return;
    }

    const userId = online.user.id;
    const timeoutId = window.setTimeout(async () => {
      const result = await updatePlayerCharacterSheet({
        client,
        characterId: activeCharacter.id,
        ownerUserId: userId,
        displayName: activeSheet.name.trim() || activeCharacter.id,
        sheetPayload: activeSheet,
      });

      if ("error" in result) {
        setSheetSyncMessage(result.error);
        return;
      }

      lastPersistedAccountSheetKeyRef.current = sheetKey;
      replaceCharacters(
        characters.map((character) =>
          character.id === activeCharacter.id
            ? attachPlayerCharacterMetadata(character, result)
            : character
        )
      );
      setSheetSyncMessage("Character sheet saved.");
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [
    activeCharacter,
    activeSheet,
    characters,
    client,
    isDmView,
    online.user,
    replaceCharacters,
  ]);

  useEffect(() => {
    function handleMouseMove(event: globalThis.MouseEvent): void {
      if (!dragRef.current.active) {
        return;
      }

      dragRef.current.moved = true;
      setDicePosition({
        x: Math.max(24, window.innerWidth - event.clientX - dragRef.current.offsetX),
        y: Math.max(24, window.innerHeight - event.clientY - dragRef.current.offsetY),
      });
    }

    function handleMouseUp(): void {
      dragRef.current.active = false;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    if (!activeSheet || !activeCharacter) {
      return;
    }

    setSessionNotes(activeSheet.effects.join("\n"));
  }, [activeCharacter?.id]);

  useEffect(() => {
    if (!activeCharacter) {
      return;
    }

    setIsEditMode(false);
    setDmEditMode(isDmEditableView);
    setAdminOverrideMode(false);
    setDmEditReason("");
    setAdminOverrideReason("");
    setAdminOverrideError(null);
    setEditSessionStatFloor(
      isDmEditableView ? buildEditSessionStatFloor(activeCharacter.sheet) : null
    );
  }, [activeCharacter?.id, isDmEditableView, isDmReadOnlyView]);

  const isSheetEditMode = isEditMode || dmEditMode;
  const isDmRuntimeEditMode = isDmView && dmEditMode;
  const isProgressionEditMode = isEditMode || (isDmEditableView && dmEditMode);
  const actualDate = formatDateDayMonthYear(new Date());
  const itemsById = buildItemIndex(items);
  const {
    derived,
    progression,
    xpLeftOver,
    rollTargets,
    statRollTargets,
    skillRollTargets,
    availablePowerOptions,
  } = buildPlayerCharacterViewModel(sheetState, itemsById);
  const powerUsageSummary = buildPowerUsageSummary(sheetState);
  const artifactAppraisalLevel = getCharacterArtifactAppraisalLevel(sheetState);
  const knowledgeState = {
    knowledgeEntities,
    knowledgeRevisions,
    knowledgeOwnerships,
  };
  const ownedCurrentItemCardIds = useMemo(
    () =>
      activeCharacter
        ? new Set(
            items
              .filter((item) =>
                characterOwnsCurrentItemKnowledgeCard({
                  state: knowledgeState,
                  ownerCharacterId: activeCharacter.id,
                  item,
                  context: {
                    itemBlueprints,
                    itemCategoryDefinitions,
                    itemSubcategoryDefinitions,
                  },
                })
              )
              .map((item) => item.id)
          )
        : new Set<string>(),
    [
      activeCharacter,
      itemBlueprints,
      itemCategoryDefinitions,
      itemSubcategoryDefinitions,
      items,
      knowledgeEntities,
      knowledgeOwnerships,
      knowledgeRevisions,
    ]
  );
  const activeKnowledgeOwnerships =
    activeCharacter
      ? getKnowledgeGroupsForOwner(knowledgeState, activeCharacter.id).flatMap(
          (group) => group.revisions
        )
      : [];
  const openKnowledgeRevision =
    openKnowledgeRevisionId !== null
      ? getKnowledgeRevisionById(knowledgeState, openKnowledgeRevisionId)
      : null;
  const openKnowledgeEntity =
    openKnowledgeRevision !== null
      ? getKnowledgeEntityById(knowledgeState, openKnowledgeRevision.entityId)
      : null;
  const openKnowledgeOwnership =
    openKnowledgeRevision !== null
      ? activeKnowledgeOwnerships.find(
          (entry) => entry.revision.id === openKnowledgeRevision.id
        )?.ownership ?? null
      : null;
  const selectedRollTargets = selectedRollIds
    .map((targetId) => rollTargets.find((target) => target.id === targetId))
    .filter((target): target is PlayerRollTarget => target !== undefined);
  const customRollPool = customRollModifiers.reduce((total, modifier) => total + modifier.value, 0);
  const selectedRollPool =
    selectedRollTargets.reduce((total, target) => total + target.value, 0) + customRollPool;

  function canPersistOnlineSheet(character: CharacterRecord | null): character is CharacterRecord {
    if (!character || !activeOnlineCampaignId || !client || !online.user) {
      return false;
    }

    const canSaveCurrentSheet =
      !isReadOnlyView || dmEditMode || adminOverrideMode || isDmEditableView;
    if (!canSaveCurrentSheet) {
      return false;
    }

    const ownerUserId = character.ownerUserId ?? online.user.id;
    return isDmView || ownerUserId === online.user.id;
  }

  async function persistOnlineCharacterSheet(
    character: CharacterRecord,
    sheet: CharacterDraft
  ): Promise<void> {
    if (!canPersistOnlineSheet(character) || !activeOnlineCampaignId || !client || !online.user) {
      return;
    }

    const ownerUserId = character.ownerUserId ?? online.user.id;
    const sheetKey = `${activeOnlineCampaignId}|${character.id}|${JSON.stringify(sheet)}`;
    const result = await updateCampaignCharacterSheet({
      client,
      campaignId: activeOnlineCampaignId,
      characterId: character.id,
      ownerUserId,
      displayName: sheet.name.trim() || character.id,
      sheetPayload: sheet,
    });

    if ("error" in result) {
      setSheetSyncMessage(result.error);
      return;
    }

    lastPersistedSheetKeyRef.current = sheetKey;
    setSheetSyncMessage("Character sheet saved.");
  }

  function updateCharacterAndPersist(
    characterId: string,
    updater: CharacterSheetUpdater
  ): void {
    const character = characters.find((entry) => entry.id === characterId) ?? null;
    if (!character) {
      updateCharacter(characterId, updater);
      return;
    }

    const nextSheet = typeof updater === "function" ? updater(character.sheet) : updater;
    updateCharacter(characterId, updater);
    void persistOnlineCharacterSheet(character, nextSheet);
  }

  const mutations = usePlayerCharacterMutations({
    activeCharacter,
    sheetState,
    items,
    xpLeftOver,
    isReadOnlyView,
    isDmView,
    isDmEditableView,
    dmEditMode,
    adminOverrideMode,
    dmEditReason,
    adminOverrideReason,
    editSessionStatFloor,
    pendingPowerId,
    sessionNotes,
    updateCharacter: updateCharacterAndPersist,
    executeArtifactAppraisal,
    itemBlueprints,
    itemCategoryDefinitions,
    itemSubcategoryDefinitions,
    createItem,
    updateItem,
    deleteItem,
    setPendingPowerId,
    setSessionNotes,
    setAdminOverrideError,
  });

  function handleDiceMouseDown(event: ReactMouseEvent<HTMLButtonElement>): void {
    dragRef.current.active = true;
    dragRef.current.moved = false;
    dragRef.current.offsetX = window.innerWidth - event.clientX - dicePosition.x;
    dragRef.current.offsetY = window.innerHeight - event.clientY - dicePosition.y;
  }

  function handleDiceClick(): void {
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }

    setIsDiceOpen((open) => !open);
  }

  function toggleRollTarget(targetId: string): void {
    setSelectedRollIds((currentIds) => {
      if (currentIds.includes(targetId)) {
        return currentIds.filter((entryId) => entryId !== targetId);
      }

      if (currentIds.length >= 9) {
        return currentIds;
      }

      return [...currentIds, targetId];
    });
  }

  function handleAddCustomRollModifier(): void {
    const value = Number.parseInt(customRollInput.trim(), 10);
    if (!Number.isFinite(value) || value === 0) {
      return;
    }

    setCustomRollModifiers((currentModifiers) => [
      ...currentModifiers,
      {
        id: currentModifiers.length + 1,
        value,
      },
    ]);
    setCustomRollInput("");
  }

  function removeCustomRollModifier(modifierId: number): void {
    setCustomRollModifiers((currentModifiers) =>
      currentModifiers.filter((modifier) => modifier.id !== modifierId)
    );
  }

  function handleRoll(): void {
    if (selectedRollPool <= 0) {
      return;
    }

    const faces = rollD10Faces(selectedRollPool);
    const resolution = resolveDicePool(faces, selectedRollPool);
    setLastRoll({
      labels: [
        ...selectedRollTargets.map((target) => `${target.label} +${target.value}`),
        ...customRollModifiers.map(
          (modifier) => `Custom ${modifier.value >= 0 ? "+" : ""}${modifier.value}`
        ),
      ],
      poolSize: selectedRollPool,
      faces,
      successes: resolution.successes,
      isBotch: resolution.isBotch,
    });
  }

  function clearRollHelper(): void {
    setSelectedRollIds([]);
    setCustomRollModifiers([]);
    setCustomRollInput("");
    setLastRoll(null);
  }

  function handleToggleEditMode(): void {
    if (isReadOnlyView) {
      return;
    }

    if (isEditMode) {
      setIsEditMode(false);
      setEditSessionStatFloor(null);
      return;
    }

    setEditSessionStatFloor(buildEditSessionStatFloor(sheetState));
    setIsEditMode(true);
  }

  function handleToggleDmEditMode(): void {
    if (!isDmView) {
      return;
    }

    setAdminOverrideMode(false);
    setAdminOverrideError(null);
    setDmEditMode((current) => {
      const next = !current;
      setEditSessionStatFloor(next ? buildEditSessionStatFloor(sheetState) : null);
      return next;
    });
  }

  function handleToggleAdminOverrideMode(): void {
    if (!isDmView) {
      return;
    }

    setDmEditMode(false);
    setAdminOverrideMode((current) => !current);
    setAdminOverrideError(null);
  }

  function appendHistoryEntries(entries: Array<{ characterId: string; entry: CharacterRecord["sheet"]["gameHistory"][number] }>): void {
    entries.forEach(({ characterId, entry }) => {
      updateCharacterAndPersist(characterId, (currentSheet) => ({
        ...currentSheet,
        gameHistory: prependGameHistoryEntry(currentSheet.gameHistory ?? [], entry),
      }));
    });
  }

  function requestWorldCast(payload: WorldCastRequestPayload): string | null {
    return executeWorldCast(payload);
  }

  if (!activeCharacter || !activeSheet) {
    return (
      <Navigate
        to={isDmEditableView ? "/dm/npc-creator" : isDmReadOnlyView ? "/dm/characters" : "/player"}
        replace
      />
    );
  }

  if (!isDmView && currentUserId && !isCharacterPlayableByUser(activeCharacter, currentUserId)) {
    return <Navigate to="/player" replace />;
  }

  const selectedCharacter = activeCharacter;
  const characterName = sheetState.name.trim() || "Unnamed Character";
  const activeEffectLabels = [
    ...sheetState.effects,
    ...derived.activePowerEffects.map((effect) => `${effect.label}: ${effect.summary}`),
  ];
  const primaryEffect = formatFirstOrFallback(activeEffectLabels, "No active effects");
  const primaryUtility = formatFirstOrFallback(derived.utilityTraits, "No utility traits");
  const primaryPowerUsage = formatFirstOrFallback(
    powerUsageSummary.map((entry) => `${entry.label}: ${entry.resetLabel} / ${entry.detail}`),
    "No tracked power usage"
  );
  const resistanceRows = DAMAGE_TYPES.map((damageType) => {
    const level = getResolvedResistanceLevel(sheetState, damageType.id, itemsById);
    const rule = RESISTANCE_LEVELS[level];
    const tone =
      level < 0 ? "vulnerable" : level > 0 ? "resistant" : "normal";

    return {
      id: damageType.id,
      label: damageType.label,
      levelLabel: rule.label,
      multiplierLabel: `x${rule.damageMultiplier}`,
      tone,
    };
  });
  const compactSkills = [...sheetState.skills]
    .map((skill) => ({
      id: skill.id,
      label: skill.label,
      value: getCurrentSkillValue(sheetState, skill.id, itemsById),
    }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
    .slice(0, 8);
  const itemRulesContext = {
    itemBlueprints,
    itemCategoryDefinitions,
    itemSubcategoryDefinitions,
  };
  const carriedItems = items
    .filter((item) => (sheetState.inventoryItemIds ?? []).includes(item.id))
    .sort((left, right) => left.name.localeCompare(right.name));

  function canEquipItemIntoSlot(item: SharedItemRecord, slotId: CanonicalEquipmentSlotId): boolean {
    return getItemAllowedEquipSlots(item, itemRulesContext).includes(slotId);
  }

  function canMeetItemStrengthRequirement(item: SharedItemRecord): boolean {
    const minimumStrength = item.combatSpec?.minimumStrength;
    return (
      typeof minimumStrength !== "number" ||
      getCurrentStatValue(sheetState, "STR", itemsById) >= minimumStrength
    );
  }

  function updateLoadoutSlotItem(slotId: CanonicalEquipmentSlotId, itemId: string): void {
    setActiveDetailTab("inventory");

    if (isWeaponHandSlotId(slotId)) {
      mutations.updateWeaponHandSlotItem(slotId, itemId);
      return;
    }

    if (isMainEquipmentSlotId(slotId)) {
      mutations.updateMainEquipmentSlotItem(slotId, itemId);
      return;
    }

    if (isSupplementaryEquipmentSlotId(slotId)) {
      mutations.updateSupplementaryEquipmentSlotItem(slotId, itemId);
    }
  }

  function getLoadoutSlotOptions(
    slotId: CanonicalEquipmentSlotId,
    currentItem: SharedItemRecord | null
  ): SharedItemRecord[] {
    const options = carriedItems.filter((item) => canEquipItemIntoSlot(item, slotId));
    const withCurrent =
      currentItem && !options.some((item) => item.id === currentItem.id)
        ? [currentItem, ...options]
        : options;

    return [...withCurrent].sort((left, right) => {
      if (currentItem?.id === left.id) return -1;
      if (currentItem?.id === right.id) return 1;
      return left.name.localeCompare(right.name);
    });
  }

  const loadoutSummary = CHARACTER_LOADOUT_SLOT_IDS.map((slotId: CanonicalEquipmentSlotId) => {
    const occupancy = getEquipmentSlotOccupancy(sheetState, slotId, itemsById, itemRulesContext);
    const item = occupancy?.item ?? null;
    const hasOwnedCurrentItemCard = item ? ownedCurrentItemCardIds.has(item.id) : false;
    const visibleItem = item
      ? getViewerFacingItemRecord(item, {
          itemBlueprints,
          itemCategoryDefinitions,
          itemSubcategoryDefinitions,
          hasOwnedItemCard: hasOwnedCurrentItemCard,
          revealAll: isDmView,
        })
      : null;
    const summary =
      item && visibleItem
        ? getItemCompactHeaderSummary(visibleItem, {
            itemBlueprints,
            itemCategoryDefinitions,
            itemSubcategoryDefinitions,
            includeBonus: canViewerSeeItemBonusDetails(
              item,
              selectedCharacter.id,
              hasOwnedCurrentItemCard,
              isDmView
            ),
          })
        : "Open";

    return {
      slotId,
      label: getEquipmentSlotLabel(slotId),
      itemId: item?.id ?? "",
      itemName: visibleItem?.name ?? null,
      summary,
      isFollower: occupancy !== null && !occupancy.isAnchorSlot,
      canUpdateSlot: !occupancy || occupancy.isAnchorSlot,
      options: getLoadoutSlotOptions(slotId, item),
    };
  });
  const activeLoadoutSlot =
    activeLoadoutSlotId !== null
      ? loadoutSummary.find((slot) => slot.slotId === activeLoadoutSlotId) ?? null
      : null;

  function handleEquipLoadoutItem(slotId: CanonicalEquipmentSlotId, itemId: string): void {
    updateLoadoutSlotItem(slotId, itemId);
    setActiveLoadoutSlotId(null);
  }

  function renderInventorySection() {
    return (
      <CharacterInventorySection
        characterId={selectedCharacter.id}
        sheetState={sheetState}
        itemsById={itemsById}
        itemBlueprints={itemBlueprints}
        itemCategoryDefinitions={itemCategoryDefinitions}
        itemSubcategoryDefinitions={itemSubcategoryDefinitions}
        ownedCurrentItemCardIds={ownedCurrentItemCardIds}
        revealAllItemBonusDetails={isDmView}
        artifactAppraisalLevel={artifactAppraisalLevel}
        isSheetEditMode={isSheetEditMode}
        onIdentifySharedItem={mutations.identifySharedItem}
        onEquipSharedItem={mutations.equipSharedItem}
        onUnequipSharedItem={mutations.unequipSharedItem}
        onUpdateWeaponHandSlotItem={mutations.updateWeaponHandSlotItem}
        onUpdateMainEquipmentSlotItem={mutations.updateMainEquipmentSlotItem}
        onUpdateSupplementaryEquipmentSlotItem={mutations.updateSupplementaryEquipmentSlotItem}
        onUpdateSharedItemActiveState={mutations.updateSharedItemActiveState}
        onUpdateMoney={(value) => mutations.updateSheetField("money", value)}
        onOpenAuctionHouse={
          !isDmView
            ? () =>
                navigate(
                  `/player/auction-house?characterId=${encodeURIComponent(selectedCharacter.id)}`
                )
            : null
        }
      />
    );
  }

  function renderDetailTab() {
    switch (activeDetailTab) {
      case "stats":
        return (
          <CharacterStatsSection
            sheetState={sheetState}
            itemsById={itemsById}
            isProgressionEditMode={isProgressionEditMode}
            adminOverrideMode={adminOverrideMode}
            editSessionStatFloor={editSessionStatFloor}
            xpLeftOver={xpLeftOver}
            onAdjustStat={mutations.adjustStat}
            onAdjustStatOverride={mutations.adjustStatOverride}
          />
        );
      case "skills":
        return (
          <CharacterSkillsSection
            sheetState={sheetState}
            itemsById={itemsById}
            isProgressionEditMode={isProgressionEditMode}
            adminOverrideMode={adminOverrideMode}
            xpLeftOver={xpLeftOver}
            onAdjustSkill={mutations.adjustSkill}
            onAdjustSkillOverride={mutations.adjustSkillOverride}
          />
        );
      case "powers":
        return (
          <CharacterPowersSection
            activeCharacter={selectedCharacter}
            sheetState={sheetState}
            characters={characters}
            itemsById={itemsById}
            availablePowerOptions={availablePowerOptions}
            pendingPowerId={pendingPowerId}
            xpLeftOver={xpLeftOver}
            isProgressionEditMode={isProgressionEditMode}
            adminOverrideMode={adminOverrideMode}
            onPendingPowerIdChange={setPendingPowerId}
            onAddPower={mutations.handleAddPower}
            onAddPowerOverride={mutations.handleAddPowerOverride}
            onAdjustPower={mutations.adjustPower}
            onAdjustPowerOverride={mutations.adjustPowerOverride}
            onRequestWorldCast={requestWorldCast}
          />
        );
      case "inventory":
        return renderInventorySection();
      case "knowledge":
        return (
          <CharacterKnowledgeSection
            activeCharacter={selectedCharacter}
            characters={characters}
            itemsById={itemsById}
            knowledgeState={knowledgeState}
            isReadOnlyView={isReadOnlyView}
            isDmEditableView={isDmEditableView}
            onUpdateKnowledgeState={updateKnowledgeState}
            onAppendHistoryEntries={appendHistoryEntries}
            onOpenKnowledgeRevision={setOpenKnowledgeRevisionId}
          />
        );
      case "history":
        return (
          <CharacterHistorySection
            mode="history"
            sessionNotes={sessionNotes}
            isReadOnlyView={isReadOnlyView}
            gameHistory={sheetState.gameHistory}
            knowledgeState={knowledgeState}
            onSessionNotesChange={setSessionNotes}
            onAppendHistory={mutations.handleAppendHistory}
            onOpenKnowledgeRevision={setOpenKnowledgeRevisionId}
          />
        );
      case "notes":
        return (
          <CharacterHistorySection
            mode="notes"
            sessionNotes={sessionNotes}
            isReadOnlyView={isReadOnlyView}
            gameHistory={sheetState.gameHistory}
            knowledgeState={knowledgeState}
            onSessionNotesChange={setSessionNotes}
            onAppendHistory={mutations.handleAppendHistory}
            onOpenKnowledgeRevision={setOpenKnowledgeRevisionId}
          />
        );
    }
  }

  return (
    <main className="sheet-page character-dashboard-page">
      <RollHelperPopover
        isDiceOpen={isDiceOpen}
        dicePosition={dicePosition}
        statRollTargets={statRollTargets}
        skillRollTargets={skillRollTargets}
        selectedRollIds={selectedRollIds}
        selectedRollTargets={selectedRollTargets}
        customRollInput={customRollInput}
        customRollModifiers={customRollModifiers}
        selectedRollPool={selectedRollPool}
        lastRoll={lastRoll}
        onDiceMouseDown={handleDiceMouseDown}
        onDiceClick={handleDiceClick}
        onToggleRollTarget={toggleRollTarget}
        onCustomRollInputChange={setCustomRollInput}
        onAddCustomRollModifier={handleAddCustomRollModifier}
        onRemoveCustomRollModifier={removeCustomRollModifier}
        onRoll={handleRoll}
        onClear={clearRollHelper}
      />

      <section className="sheet-frame character-dashboard-frame">
        <header className="cs-chrome">
          <div className="cs-brand">
            <strong>PORTALS</strong>
            <span>game_hub5</span>
          </div>
          <nav className="cs-nav-actions" aria-label="Character sheet navigation">
            <button type="button" onClick={() => navigate("/")}>Main</button>
            <button type="button" onClick={() => navigate(isDmView ? "/dm/screen" : "/player/session")}>
              Live Session
            </button>
            {isPlayerCombatant ? (
              <button
                type="button"
                onClick={() =>
                  navigate(`/player/combat?characterId=${encodeURIComponent(selectedCharacter.id)}`)
                }
              >
                Combat
              </button>
            ) : null}
            <button
              type="button"
              onClick={() =>
                navigate(
                  isDmEditableView ? "/dm/npc-creator" : isDmReadOnlyView ? "/dm/characters" : "/player"
                )
              }
            >
              {isDmEditableView ? "NPC Creator" : isDmReadOnlyView ? "Player Characters" : "Player"}
            </button>
          </nav>
          <div className="cs-title-mark">Convergence Character Sheet</div>
          <div className="cs-mode-actions">
            {isDmView ? (
              <>
                <button
                  type="button"
                  className={dmEditMode ? "is-active" : ""}
                  onClick={handleToggleDmEditMode}
                >
                  DM Edit
                </button>
                <button
                  type="button"
                  className={adminOverrideMode ? "is-caution" : ""}
                  onClick={handleToggleAdminOverrideMode}
                >
                  Override
                </button>
              </>
            ) : (
              <button
                type="button"
                className={isEditMode ? "is-active" : ""}
                onClick={handleToggleEditMode}
              >
                {isEditMode ? "Lock" : "Edit"}
              </button>
            )}
          </div>
        </header>

        {(dmEditMode || adminOverrideMode || adminOverrideError) && isDmView ? (
          <section className="cs-admin-strip">
            {dmEditMode ? (
              <input
                value={dmEditReason}
                onChange={(event) => setDmEditReason(event.target.value)}
                placeholder="DM reason (optional)"
              />
            ) : null}
            {adminOverrideMode ? (
              <input
                value={adminOverrideReason}
                onChange={(event) => setAdminOverrideReason(event.target.value)}
                placeholder="Admin reason (required)"
              />
            ) : null}
            {adminOverrideError ? <strong>{adminOverrideError}</strong> : null}
          </section>
        ) : null}
        {sheetSyncMessage ? (
          <section className="cs-admin-strip">
            <strong>{sheetSyncMessage}</strong>
          </section>
        ) : null}

        <section className="cs-top-zone" aria-label="Read-only character overview">
          <article className="cs-panel cs-identity-panel">
            <div className="cs-portrait" aria-hidden="true">{getInitials(characterName)}</div>
            <div className="cs-identity-copy">
              {isSheetEditMode ? (
                <div className="cs-inline-edit-grid">
                  <input
                    value={sheetState.name}
                    onChange={(event) => mutations.updateSheetField("name", event.target.value)}
                    placeholder="Character Name"
                  />
                  <input
                    value={sheetState.concept}
                    onChange={(event) => mutations.updateSheetField("concept", event.target.value)}
                    placeholder="Concept"
                  />
                  <input
                    value={sheetState.faction}
                    onChange={(event) => mutations.updateSheetField("faction", event.target.value)}
                    placeholder="Faction"
                  />
                  <input
                    type="number"
                    min="0"
                    value={sheetState.age ?? ""}
                    onChange={(event) =>
                      mutations.updateSheetField(
                        "age",
                        event.target.value === "" ? null : Number.parseInt(event.target.value, 10)
                      )
                    }
                    placeholder="Age"
                  />
                  {isDmView ? (
                    <select
                      value={sheetState.apparelMode}
                      onChange={(event) =>
                        mutations.updateSheetField(
                          "apparelMode",
                          event.target.value as typeof sheetState.apparelMode
                        )
                      }
                    >
                      <option value="humanoid">Humanoid</option>
                      <option value="none">None</option>
                    </select>
                  ) : null}
                </div>
              ) : (
                <>
                  <h1>{characterName}</h1>
                  <p>{sheetState.concept || "No concept"} <span>|</span> {sheetState.faction || "No faction"}</p>
                </>
              )}
              <div className="cs-badge-row">
                <span>Rank {progression.rank}</span>
                <span>CR {progression.cr}</span>
                <span>Age {sheetState.age ?? "-"}</span>
              </div>
              {isSheetEditMode ? (
                <div className="cs-bio-edit-grid">
                  <textarea
                    value={sheetState.biographyPrimary}
                    onChange={(event) => mutations.updateSheetField("biographyPrimary", event.target.value)}
                    placeholder="Primary bio"
                  />
                  <textarea
                    value={sheetState.biographySecondary}
                    onChange={(event) => mutations.updateSheetField("biographySecondary", event.target.value)}
                    placeholder="Secondary bio"
                  />
                </div>
              ) : (
                <div className="cs-bio-lines">
                  <p>{sheetState.biographyPrimary || "No primary biography yet."}</p>
                  <p>{sheetState.biographySecondary || "No secondary biography yet."}</p>
                </div>
              )}
            </div>
          </article>

          <article className="cs-panel cs-chronicle-panel">
            <div>
              <span>Actual Date</span>
              <strong>{actualDate}</strong>
            </div>
            <div>
              <span>Game Date-Time</span>
              <strong>{sheetState.gameDateTime}</strong>
            </div>
            <div className="cs-xp-grid">
              <span>XP</span>
              <small>Earned</small>
              <small>Used</small>
              <small>Left</small>
              <strong>{sheetState.xpEarned}</strong>
              <strong>{sheetState.xpUsed}</strong>
              <strong>{xpLeftOver}</strong>
            </div>
          </article>

          <article className="cs-panel cs-status-panel">
            <div><span>Active Effect</span><strong>{primaryEffect}</strong></div>
            <div><span>Utility Trait</span><strong>{primaryUtility}</strong></div>
            <div><span>Power Tracking</span><strong>{primaryPowerUsage}</strong></div>
            {powerUsageSummary.length > 0 && !isReadOnlyView ? (
              <div className="cs-reset-actions">
                <button type="button" onClick={() => mutations.resetPowerUsage("daily")}>Reset Daily</button>
                <button type="button" onClick={() => mutations.resetPowerUsage("longRest")}>Reset Long Rest</button>
              </div>
            ) : null}
          </article>

          <section className="cs-resource-strip">
            <article className="cs-resource-tile hp">
              <span>HP</span>
              {isDmRuntimeEditMode ? (
                <input
                  type="number"
                  value={sheetState.currentHp}
                  onChange={(event) => mutations.handleRuntimeInput("currentHp", event.target.value)}
                />
              ) : (
                <strong>{sheetState.currentHp} / {derived.maxHp}</strong>
              )}
            </article>
            <article className="cs-resource-tile mana">
              <span>Mana</span>
              {isDmRuntimeEditMode ? (
                <input
                  type="number"
                  min="0"
                  max={derived.maxMana}
                  value={derived.currentMana}
                  onChange={(event) => mutations.handleRuntimeInput("currentMana", event.target.value)}
                />
              ) : (
                <strong>{derived.currentMana} / {derived.maxMana}</strong>
              )}
            </article>
            <article className="cs-resource-tile inspiration">
              <span>Inspiration</span>
              {isDmRuntimeEditMode ? (
                <input
                  type="number"
                  min="0"
                  value={sheetState.inspiration}
                  onChange={(event) => mutations.handleRuntimeInput("inspiration", event.target.value)}
                />
              ) : (
                <strong>{derived.totalInspiration}</strong>
              )}
            </article>
            <article className="cs-resource-tile karma">
              <span>Karma</span>
              {isDmRuntimeEditMode ? (
                <div className="cs-split-inputs">
                  <input
                    type="number"
                    min="0"
                    value={sheetState.negativeKarma}
                    onChange={(event) => mutations.handleRuntimeInput("negativeKarma", event.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    value={sheetState.positiveKarma}
                    onChange={(event) => mutations.handleRuntimeInput("positiveKarma", event.target.value)}
                  />
                </div>
              ) : (
                <strong>-{sheetState.negativeKarma} / +{sheetState.positiveKarma}</strong>
              )}
            </article>
            <article className="cs-resource-tile money">
              <span>Money</span>
              <strong>{sheetState.money}</strong>
            </article>
          </section>

          <section className="cs-combat-strip">
            {[
              ["Init", derived.initiative, "DEX + WITS"],
              ["Move", derived.movement, "Base + dash"],
              ["AC", derived.armorClass, "DEX + Athletics"],
              ["DR", derived.damageReduction, "Armor"],
              ["Soak", derived.soak, "STAM"],
              ["Melee Atk", derived.meleeAttack, "Derived"],
              ["Ranged Atk", derived.rangedAttack, "Derived"],
              ["Melee Dmg", derived.meleeDamage, "STR + Gear"],
              ["Ranged Dmg", derived.rangedDamage, ""],
            ].map(([label, value, detail]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </div>
            ))}
          </section>

          <article className="cs-panel cs-resistance-panel">
            <header>
              <h2>Resistances</h2>
              <span>Type / Tier / Multiplier</span>
            </header>
            <div className="cs-resistance-grid">
              {resistanceRows.map((row) => (
                <div key={row.id} className={`cs-resistance-row ${row.tone}`}>
                  <span>{row.label}</span>
                  <strong>{row.levelLabel}</strong>
                  <small>{row.multiplierLabel}</small>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="cs-mid-zone" aria-label="Character controls overview">
          <button type="button" className="cs-summary-card stats" onClick={() => setActiveDetailTab("stats")}>
            <header><h2>Stats</h2><span>Base + gear + buffs</span></header>
            {statGroups.map((group) => (
              <div key={group.title} className="cs-summary-group">
                <span>{group.title}</span>
                <div>
                  {group.ids.map((statId) => (
                    <strong key={statId}>{statId}<em>{derived.currentStats[statId]}</em></strong>
                  ))}
                </div>
              </div>
            ))}
          </button>
          <button type="button" className="cs-summary-card skills" onClick={() => setActiveDetailTab("skills")}>
            <header><h2>Skills</h2><span>Top values</span></header>
            <div className="cs-summary-list two-column">
              {compactSkills.map((skill) => (
                <span key={skill.id}>{skill.label}<strong>{skill.value}</strong></span>
              ))}
            </div>
          </button>
          <button type="button" className="cs-summary-card powers" onClick={() => setActiveDetailTab("powers")}>
            <header><h2>Powers</h2><span>Known powers: {sheetState.powers.length}</span></header>
            <div className="cs-summary-list">
              {sheetState.powers.length > 0 ? sheetState.powers.map((power) => (
                <span key={power.id}>{power.name}<strong>Lv {power.level}</strong></span>
              )) : <em>No powers learned.</em>}
            </div>
          </button>
          <article className="cs-summary-card loadout" onClick={() => setActiveDetailTab("inventory")}>
            <header><h2>Loadout</h2><span>Click a slot to equip</span></header>
            <div className="cs-loadout-summary-grid">
              {loadoutSummary.map((slot) => (
                <button
                  type="button"
                  key={slot.slotId}
                  className={`cs-loadout-slot-picker ${slot.itemName ? "equipped" : "open"}`}
                  title={`${slot.label}: ${slot.itemName ?? "Open"}${slot.isFollower ? " (occupied)" : ""}`}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  onFocus={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  onClickCapture={(event) => {
                    event.stopPropagation();
                    setActiveDetailTab("inventory");
                    setActiveLoadoutSlotId(slot.slotId);
                  }}
                >
                  <small>{slot.label}</small>
                  <strong>{slot.itemName ?? "-"}</strong>
                  <em>{slot.isFollower ? "Occupied" : slot.summary}</em>
                </button>
              ))}
            </div>
          </article>
        </section>

        <section className="cs-detail-workspace" aria-label="Character detail workspace">
          <nav className="cs-detail-tabs" aria-label="Character detail tabs">
            {CHARACTER_DETAIL_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={tab.id === activeDetailTab ? "is-active" : ""}
                aria-pressed={tab.id === activeDetailTab}
                onClick={() => setActiveDetailTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="cs-detail-panel">{renderDetailTab()}</div>
        </section>
      </section>

      <KnowledgeRevisionDialog
        entity={openKnowledgeEntity}
        revision={openKnowledgeRevision}
        ownership={openKnowledgeOwnership}
        onClose={() => setOpenKnowledgeRevisionId(null)}
      />

      {activeLoadoutSlot ? (
        <div
          className="cs-loadout-modal-backdrop"
          role="presentation"
          onClick={() => setActiveLoadoutSlotId(null)}
        >
          <section
            className="cs-loadout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cs-loadout-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="section-kicker">Equip Slot</p>
                <h2 id="cs-loadout-modal-title">{activeLoadoutSlot.label}</h2>
              </div>
              <button type="button" onClick={() => setActiveLoadoutSlotId(null)}>
                Close
              </button>
            </header>
            {activeLoadoutSlot.canUpdateSlot ? (
              <>
                {activeLoadoutSlot.itemId ? (
                  <button
                    type="button"
                    className="cs-loadout-option clear"
                    onClick={() => handleEquipLoadoutItem(activeLoadoutSlot.slotId, "")}
                  >
                    <strong>Open Slot</strong>
                    <span>Unequip current item from this slot.</span>
                  </button>
                ) : null}
                <div className="cs-loadout-options">
                  {activeLoadoutSlot.options.length > 0 ? (
                    activeLoadoutSlot.options.map((optionItem) => {
                      const optionKnown = ownedCurrentItemCardIds.has(optionItem.id);
                      const visibleOption = getViewerFacingItemRecord(optionItem, {
                        ...itemRulesContext,
                        hasOwnedItemCard: optionKnown,
                        revealAll: isDmView,
                      });
                      const canMeetRequirement = canMeetItemStrengthRequirement(optionItem);
                      const isEquipped = optionItem.id === activeLoadoutSlot.itemId;

                      return (
                        <button
                          key={optionItem.id}
                          type="button"
                          className={`cs-loadout-option ${isEquipped ? "equipped" : ""}`}
                          disabled={!canMeetRequirement}
                          onClick={() => handleEquipLoadoutItem(activeLoadoutSlot.slotId, optionItem.id)}
                        >
                          <strong>{visibleOption.name}</strong>
                          <span>
                            {getItemCompactHeaderSummary(visibleOption, {
                              ...itemRulesContext,
                              includeBonus: canViewerSeeItemBonusDetails(
                                optionItem,
                                selectedCharacter.id,
                                optionKnown,
                                isDmView
                              ),
                            })}
                          </span>
                          {isEquipped ? <em>Equipped</em> : null}
                          {!canMeetRequirement && typeof optionItem.combatSpec?.minimumStrength === "number" ? (
                            <em>Requires STR {optionItem.combatSpec.minimumStrength}</em>
                          ) : null}
                        </button>
                      );
                    })
                  ) : (
                    <p className="empty-block-copy">No carried inventory items can equip to this slot.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="empty-block-copy">
                This slot is occupied by a multi-slot item. Change the anchor slot instead.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}
