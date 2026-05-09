import { useEffect, useMemo, useState, startTransition } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { rollD10Faces } from "../lib/dice.ts";
import type { GameHistoryEntry } from "../config/characterTemplate.ts";
import {
  applyKnowledgeBatch,
  buildKnowledgeRevisionLabel,
  createKnowledgeShareResult,
  getKnowledgeEntityById,
  getKnowledgeRevisionById,
} from "../lib/knowledge.ts";
import {
  applyRewardPacket,
  createDefaultRewardPacket,
  createRollSessionEvent,
  createShareSessionEvent,
} from "../lib/realtimeSession.ts";
import {
  addCampaignMember,
  createCampaign,
  deleteEmptyCampaign,
  endCurrentGameSession,
  insertSessionEvent,
  listCampaignCharacters,
  listCampaignMembers,
  listCampaignsForRole,
  listCampaignSessions,
  listSessionAttendees,
  listSessionCharacters,
  listSessionEvents,
  startCurrentGameSession,
  subscribeToCampaignMembers,
  subscribeToSessionEvents,
  subscribeToSessionCharacters,
  updateGameSessionNotes,
  upsertKnowledgeRecords,
  upsertSessionAttendee,
  upsertSessionCharacters,
} from "../lib/realtimeSessionRepository.ts";
import { getSupabaseClient } from "../lib/supabaseClient.ts";
import { useAppFlow } from "../state/appFlow";
import { useOnlineSession } from "../state/onlineSession.tsx";
import type { CharacterRecord } from "../types/character.ts";
import type {
  KnowledgeEntity,
  KnowledgeOwnership,
  KnowledgeRevision,
} from "../types/knowledge.ts";
import type {
  CampaignMemberRecord,
  CampaignRecord,
  CampaignCharacterRecord,
  GameSessionRecord,
  RewardPacket,
  SessionAttendeeRecord,
  SessionCharacterRecord,
  SessionEvent,
} from "../types/realtimeSession.ts";

type RewardDraft = Omit<RewardPacket, "characterIds" | "cardRevisionIds">;

const emptyRewardDraft: RewardDraft = {
  xpEarnedDelta: 0,
  inspirationDelta: 0,
  temporaryInspirationDelta: 0,
  moneyDelta: 0,
  positiveKarmaDelta: 0,
  negativeKarmaDelta: 0,
  note: "",
};

function getCharacterName(character: CharacterRecord): string {
  return character.sheet.name.trim() || character.id;
}

function appendUniqueEvent(events: SessionEvent[], event: SessionEvent): SessionEvent[] {
  if (events.some((entry) => entry.id === event.id)) {
    return events;
  }

  return [...events, event].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function parseIntegerInput(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getEventVisibilityLabel(event: SessionEvent): string {
  switch (event.visibility) {
    case "dm_only":
      return "DM only";
    case "dm_and_actor":
      return "DM + roller";
    case "limited":
      return "Limited";
    default:
      return "Public";
  }
}

export function DmScreenPage() {
  const navigate = useNavigate();
  const client = useMemo(() => getSupabaseClient(), []);
  const online = useOnlineSession();
  const {
    roleChoice,
    characters,
    knowledgeEntities,
    knowledgeRevisions,
    knowledgeOwnerships,
    replaceCharacters,
    updateKnowledgeState,
    activeCombatEncounter,
  } = useAppFlow();
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [sessions, setSessions] = useState<GameSessionRecord[]>([]);
  const [members, setMembers] = useState<CampaignMemberRecord[]>([]);
  const [campaignCharacters, setCampaignCharacters] = useState<CampaignCharacterRecord[]>([]);
  const [sessionAttendees, setSessionAttendees] = useState<SessionAttendeeRecord[]>([]);
  const [sessionCharacters, setSessionCharacters] = useState<SessionCharacterRecord[]>([]);
  const [selectedCampaignCharacterId, setSelectedCampaignCharacterId] = useState("");
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [gameName, setGameName] = useState("Convergence Game");
  const [campaignName, setCampaignName] = useState("Convergence Campaign");
  const [memberUserId, setMemberUserId] = useState("");
  const [memberDisplayName, setMemberDisplayName] = useState("");
  const [memberCharacterId, setMemberCharacterId] = useState("");
  const [panelMessage, setPanelMessage] = useState("");
  const [rollPool, setRollPool] = useState("3");
  const [rollLabel, setRollLabel] = useState("Secret resolution");
  const [rollMode, setRollMode] = useState<"public" | "dm_private">("dm_private");
  const [shareText, setShareText] = useState("");
  const [shareCardRevisionId, setShareCardRevisionId] = useState("");
  const [shareVisibility, setShareVisibility] = useState<"public" | "limited">("public");
  const [shareTargetIds, setShareTargetIds] = useState<string[]>([]);
  const [rewardCharacterIds, setRewardCharacterIds] = useState<string[]>([]);
  const [rewardCardRevisionIds, setRewardCardRevisionIds] = useState<string[]>([]);
  const [rewardDraft, setRewardDraft] = useState<RewardDraft>(emptyRewardDraft);
  const [pinLabel, setPinLabel] = useState("");
  const [pinKind, setPinKind] = useState<"npc" | "card" | "location" | "note">("note");
  const [sessionNotes, setSessionNotes] = useState("");

  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null;
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? null;
  const activeSession = sessions.find((session) => session.status === "active") ?? null;
  const canUseLiveSession = selectedSession?.status === "active";
  const selectedCampaignCharacter =
    campaignCharacters.find((character) => character.characterId === selectedCampaignCharacterId) ??
    campaignCharacters[0] ??
    null;
  const playerCharacters = characters.filter((character) => character.ownerRole === "player");
  const dmCharacters = characters.filter((character) => character.ownerRole === "dm");
  const visiblePins = events.filter((event) => event.kind === "pin");
  const knowledgeState = {
    knowledgeEntities,
    knowledgeRevisions,
    knowledgeOwnerships,
  };
  const knowledgeCardOptions = knowledgeRevisions
    .map((revision) => {
      const entity = getKnowledgeEntityById(knowledgeState, revision.entityId);
      return entity
        ? {
            revision,
            entity,
            label: `${entity.displayName} ${buildKnowledgeRevisionLabel(revision)}`,
          }
        : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  useEffect(() => {
    if (!client || online.status !== "authenticated" || !online.user) {
      return;
    }
    const supabase = client;
    const userId = online.user.id;

    async function loadCampaigns(): Promise<void> {
      const result = await listCampaignsForRole({
        client: supabase,
        userId,
        role: "dm",
      });
      if ("error" in result) {
        setPanelMessage(result.error);
        return;
      }

      setCampaigns(result);
      setSelectedCampaignId((current) => current || result[0]?.id || "");
    }

    void loadCampaigns();
  }, [client, online.status, online.user]);

  useEffect(() => {
    if (!client || !selectedCampaignId) {
      setSessions([]);
      setMembers([]);
      setCampaignCharacters([]);
      setSelectedSessionId("");
      return;
    }
    const supabase = client;

    async function loadCampaignDetails(): Promise<void> {
      const [sessionResult, memberResult, characterResult] = await Promise.all([
        listCampaignSessions({ client: supabase, campaignId: selectedCampaignId }),
        listCampaignMembers({ client: supabase, campaignId: selectedCampaignId }),
        listCampaignCharacters({ client: supabase, campaignId: selectedCampaignId }),
      ]);

      if ("error" in sessionResult) {
        setPanelMessage(sessionResult.error);
      } else {
        setSessions(sessionResult);
        setSelectedSessionId(sessionResult.find((session) => session.status === "active")?.id || "");
      }

      if ("error" in memberResult) {
        setPanelMessage(memberResult.error);
      } else {
        setMembers(memberResult);
      }

      if ("error" in characterResult) {
        setPanelMessage(characterResult.error);
      } else {
        setCampaignCharacters(characterResult);
        setSelectedCampaignCharacterId((current) => current || characterResult[0]?.characterId || "");
      }
    }

    void loadCampaignDetails();
    const memberChannel = subscribeToCampaignMembers({
      client: supabase,
      campaignId: selectedCampaignId,
      onRecord: (member) => {
        startTransition(() => {
          setMembers((current) => [
            ...current.filter((entry) => entry.userId !== member.userId),
            member,
          ]);
        });
      },
    });

    return () => {
      void memberChannel.unsubscribe();
    };
  }, [client, selectedCampaignId]);

  useEffect(() => {
    if (!client || !selectedSessionId) {
      setEvents([]);
      setSessionAttendees([]);
      setSessionCharacters([]);
      return;
    }
    const supabase = client;

    async function loadSessionDetails(): Promise<void> {
      const [eventResult, characterResult, attendeeResult] = await Promise.all([
        listSessionEvents({ client: supabase, sessionId: selectedSessionId }),
        listSessionCharacters({ client: supabase, sessionId: selectedSessionId }),
        listSessionAttendees({ client: supabase, sessionId: selectedSessionId }),
      ]);

      if ("error" in eventResult) {
        setPanelMessage(eventResult.error);
      } else {
        setEvents(eventResult);
      }

      if ("error" in characterResult) {
        setPanelMessage(characterResult.error);
      } else {
        setSessionCharacters(characterResult);
      }

      if ("error" in attendeeResult) {
        setPanelMessage(attendeeResult.error);
      } else {
        setSessionAttendees(attendeeResult);
      }
    }

    void loadSessionDetails();
    const channel = subscribeToSessionEvents({
      client: supabase,
      sessionId: selectedSessionId,
      onEvent: (event) => {
        startTransition(() => {
          setEvents((currentEvents) => appendUniqueEvent(currentEvents, event));
        });
      },
    });
    const characterChannel = subscribeToSessionCharacters({
      client: supabase,
      sessionId: selectedSessionId,
      onRecord: (record) => {
        startTransition(() => {
          setSessionCharacters((current) => [
            ...current.filter((entry) => entry.characterId !== record.characterId),
            record,
          ]);
        });
      },
    });

    return () => {
      void channel.unsubscribe();
      void characterChannel.unsubscribe();
    };
  }, [client, selectedSessionId]);

  useEffect(() => {
    setSessionNotes(selectedSession?.sessionNotes ?? "");
  }, [selectedSession?.id, selectedSession?.sessionNotes]);

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  async function handleCreateCampaign(): Promise<void> {
    if (!client || !online.user) {
      return;
    }

    const result = await createCampaign({
      client,
      gameName: gameName.trim() || "Convergence Game",
      name: campaignName.trim() || "Convergence Campaign",
      ownerUserId: online.user.id,
      ownerDisplayName: online.profile?.displayName ?? online.user.email ?? "DM",
    });

    if ("error" in result) {
      setPanelMessage(result.error);
      return;
    }

    setCampaigns((current) => [result.campaign, ...current]);
    setMembers([result.member]);
    setSelectedCampaignId(result.campaign.id);
    setPanelMessage("Campaign created.");
  }

  async function handleDeleteCampaign(): Promise<void> {
    if (!client || !selectedCampaign) {
      return;
    }

    const confirmed = window.confirm(
      `Delete campaign "${selectedCampaign.name}"? This only works for campaigns with no sessions.`
    );
    if (!confirmed) {
      return;
    }

    const result = await deleteEmptyCampaign({
      client,
      campaignId: selectedCampaign.id,
    });

    if (typeof result !== "string") {
      setPanelMessage(result.error);
      return;
    }

    setCampaigns((current) => current.filter((campaign) => campaign.id !== result));
    setSelectedCampaignId((current) => {
      if (current !== result) {
        return current;
      }
      return campaigns.find((campaign) => campaign.id !== result)?.id ?? "";
    });
    setSelectedSessionId("");
    setSessions([]);
    setMembers([]);
    setPanelMessage("Campaign deleted.");
  }

  async function handleAddMember(): Promise<void> {
    if (!client || !selectedCampaignId || !memberUserId.trim()) {
      return;
    }

    const result = await addCampaignMember({
      client,
      campaignId: selectedCampaignId,
      userId: memberUserId.trim(),
      role: "player",
      displayName: memberDisplayName.trim() || memberUserId.trim(),
      selectedCharacterId: memberCharacterId || null,
    });

    if ("error" in result) {
      setPanelMessage(result.error);
      return;
    }

    setMembers((current) => [...current.filter((member) => member.userId !== result.userId), result]);
    setMemberUserId("");
    setMemberDisplayName("");
    setMemberCharacterId("");
    setPanelMessage("Player account added.");
  }

  async function handleStartSession(): Promise<void> {
    if (!client || !online.user || !selectedCampaignId) {
      return;
    }

    const result = await startCurrentGameSession({
      client,
      campaignId: selectedCampaignId,
    });

    if ("error" in result) {
      setPanelMessage(result.error);
      return;
    }

    setSessions((current) => [result, ...current.filter((session) => session.id !== result.id)]);
    setSelectedSessionId(result.id);
    setPanelMessage("Current session started.");
  }

  async function handleEndSession(): Promise<void> {
    if (!client || !selectedCampaignId || !activeSession) {
      return;
    }

    const result = await endCurrentGameSession({
      client,
      campaignId: selectedCampaignId,
    });

    if ("error" in result) {
      setPanelMessage(result.error);
      return;
    }

    setSessions((current) =>
      current.map((session) => (session.id === result.id ? result : session))
    );
    setSelectedSessionId("");
    setEvents([]);
    setSessionAttendees([]);
    setSessionCharacters([]);
    setPanelMessage(`${result.label} ended.`);
  }

  async function handleAddMemberToSession(member: CampaignMemberRecord): Promise<void> {
    if (!client || !online.user || !activeSession) {
      return;
    }

    const result = await upsertSessionAttendee({
      client,
      sessionId: activeSession.id,
      userId: member.userId,
      role: member.role,
      displayName: member.displayName || member.userId,
      selectedCharacterId: member.selectedCharacterId,
      addedByUserId: online.user.id,
    });

    if ("error" in result) {
      setPanelMessage(result.error);
      return;
    }

    setSessionAttendees((current) => [
      ...current.filter((attendee) => attendee.userId !== result.userId),
      result,
    ]);

    const memberCharacters = campaignCharacters.filter(
      (character) => character.ownerUserId === member.userId
    );
    if (memberCharacters.length === 0) {
      setPanelMessage("Player added to session, but no campaign character sheet is synced for that account yet.");
      return;
    }

    const characterResult = await upsertSessionCharacters({
      client,
      records: memberCharacters.map((character) => ({
        sessionId: activeSession.id,
        characterId: character.characterId,
        ownerUserId: character.ownerUserId,
        ownerRole: "player",
        displayName: character.displayName,
        sheetPayload: character.sheetPayload,
      })),
    });

    if ("error" in characterResult) {
      setPanelMessage(characterResult.error);
      return;
    }

    setSessionCharacters((current) => [
      ...current.filter(
        (entry) => !characterResult.some((updated) => updated.characterId === entry.characterId)
      ),
      ...characterResult,
    ]);
    setPanelMessage(`Added ${memberCharacters.length} character sheet(s) to the current session.`);
  }

  async function handleSyncCharacters(): Promise<void> {
    if (!client || !activeSession) {
      return;
    }

    const ownerByCharacterId = new Map(
      members
        .filter((member) => member.selectedCharacterId)
        .map((member) => [member.selectedCharacterId, member.userId])
    );
    const syncableCharacters = characters.filter((character) => character.ownerRole === "dm");
    if (syncableCharacters.length === 0) {
      setPanelMessage("No local DM/NPC characters to sync.");
      return;
    }

    const result = await upsertSessionCharacters({
      client,
      records: syncableCharacters.map((character) => ({
        sessionId: activeSession.id,
        characterId: character.id,
        ownerUserId: ownerByCharacterId.get(character.id) ?? null,
        ownerRole: character.ownerRole === "dm" ? "dm" : "player",
        displayName: getCharacterName(character),
        sheetPayload: character.sheet,
      })),
    });

    if ("error" in result) {
      setPanelMessage(result.error);
      return;
    }

    setSessionCharacters(result);
    setPanelMessage("Characters synced to session.");
  }

  async function publishEvent(event: SessionEvent): Promise<boolean> {
    if (!client) {
      return false;
    }

    const result = await insertSessionEvent({ client, event });
    if ("error" in result) {
      setPanelMessage(result.error);
      return false;
    }

    setEvents((current) => appendUniqueEvent(current, result));
    return true;
  }

  function buildOwnerUserIdByCharacterId(): Record<string, string | null> {
    const entries = new Map<string, string | null>();

    members.forEach((member) => {
      if (member.selectedCharacterId) {
        entries.set(member.selectedCharacterId, member.userId);
      }
    });
    sessionCharacters.forEach((character) => {
      entries.set(character.characterId, character.ownerUserId);
    });

    return Object.fromEntries(entries);
  }

  function getCardOption(revisionId: string) {
    return knowledgeCardOptions.find((option) => option.revision.id === revisionId) ?? null;
  }

  function appendHistoryEntriesToCharacters(
    baseCharacters: CharacterRecord[],
    historyEntries: Array<{ characterId: string; entry: GameHistoryEntry }>
  ): CharacterRecord[] {
    if (historyEntries.length === 0) {
      return baseCharacters;
    }

    return baseCharacters.map((character) => {
      const entries = historyEntries
        .filter((history) => history.characterId === character.id)
        .map((history) => history.entry);

      return entries.length > 0
        ? {
            ...character,
            sheet: {
              ...character.sheet,
              gameHistory: [...entries, ...(character.sheet.gameHistory ?? [])],
            },
          }
        : character;
    });
  }

  async function handleRoll(): Promise<void> {
    if (!online.user || !selectedSessionId) {
      return;
    }

    const poolSize = Math.max(0, parseIntegerInput(rollPool));
    if (poolSize <= 0) {
      setPanelMessage("Roll pool must be greater than 0.");
      return;
    }

    await publishEvent(
      createRollSessionEvent({
        sessionId: selectedSessionId,
        actorUserId: online.user.id,
        actorCharacterId: null,
        actorDisplayName: online.profile?.displayName ?? "DM",
        labels: [rollLabel.trim() || "DM roll"],
        poolSize,
        faces: rollD10Faces(poolSize),
        mode: rollMode,
      })
    );
  }

  async function handleShare(): Promise<void> {
    if (!client || !online.user || !selectedSessionId || (!shareText.trim() && !shareCardRevisionId)) {
      return;
    }

    const cardOption = shareCardRevisionId ? getCardOption(shareCardRevisionId) : null;
    const targetCharacterIds =
      shareVisibility === "limited" ? shareTargetIds : playerCharacters.map((character) => character.id);
    const cardLabel = cardOption?.label ?? "";
    const summary =
      shareText.trim() && cardLabel
        ? `${shareText.trim()} (${cardLabel})`
        : shareText.trim() || `Shared card: ${cardLabel}`;

    if (cardOption) {
      const recipientCharacters = playerCharacters.filter((character) =>
        targetCharacterIds.includes(character.id)
      );
      const shareResult = createKnowledgeShareResult({
        state: knowledgeState,
        entity: cardOption.entity,
        revision: cardOption.revision,
        sourceOwnerCharacterId: null,
        sourceOwnerName: online.profile?.displayName ?? "DM",
        recipientCharacters,
      });

      updateKnowledgeState(applyKnowledgeBatch(knowledgeState, shareResult.batch));
      replaceCharacters(appendHistoryEntriesToCharacters(characters, shareResult.historyEntries));

      const knowledgeResult = await upsertKnowledgeRecords({
        client,
        sessionId: selectedSessionId,
        entities: [cardOption.entity],
        revisions: [cardOption.revision],
        ownerships: shareResult.batch.ownerships,
        ownerUserIdByCharacterId: buildOwnerUserIdByCharacterId(),
        createdByUserId: online.user.id,
        acquiredFromUserId: online.user.id,
      });
      if ("error" in knowledgeResult) {
        setPanelMessage(knowledgeResult.error);
        return;
      }
    }

    await publishEvent(
      createShareSessionEvent({
        sessionId: selectedSessionId,
        actorUserId: online.user.id,
        actorCharacterId: null,
        actorDisplayName: online.profile?.displayName ?? "DM",
        summary,
        text: shareText.trim(),
        visibility: shareVisibility,
        targetCharacterIds: shareVisibility === "limited" ? shareTargetIds : [],
        cardRevisionId: cardOption?.revision.id ?? null,
        cardEntityId: cardOption?.entity.id ?? null,
      })
    );
    setShareText("");
    setShareCardRevisionId("");
  }

  async function handleReward(): Promise<void> {
    if (!client || !online.user || !selectedSessionId || rewardCharacterIds.length === 0) {
      return;
    }

    const packet: RewardPacket = {
      ...createDefaultRewardPacket(rewardCharacterIds),
      ...rewardDraft,
      characterIds: rewardCharacterIds,
      cardRevisionIds: rewardCardRevisionIds,
    };
    const result = applyRewardPacket({
      sessionId: selectedSessionId,
      characters,
      packet,
      actorUserId: online.user.id,
      actorDisplayName: online.profile?.displayName ?? "DM",
    });

    let nextCharacters = result.characters;
    let nextKnowledgeState = knowledgeState;
    const grantedOwnerships: KnowledgeOwnership[] = [];
    const grantedEntities: KnowledgeEntity[] = [];
    const grantedRevisions: KnowledgeRevision[] = [];

    for (const revisionId of rewardCardRevisionIds) {
      const revision = getKnowledgeRevisionById(nextKnowledgeState, revisionId);
      const entity = revision ? getKnowledgeEntityById(nextKnowledgeState, revision.entityId) : null;
      if (!revision || !entity) {
        continue;
      }

      const shareResult = createKnowledgeShareResult({
        state: nextKnowledgeState,
        entity,
        revision,
        sourceOwnerCharacterId: null,
        sourceOwnerName: online.profile?.displayName ?? "DM",
        recipientCharacters: playerCharacters.filter((character) =>
          rewardCharacterIds.includes(character.id)
        ),
      });
      nextKnowledgeState = applyKnowledgeBatch(nextKnowledgeState, shareResult.batch);
      nextCharacters = appendHistoryEntriesToCharacters(nextCharacters, shareResult.historyEntries);
      grantedEntities.push(entity);
      grantedRevisions.push(revision);
      grantedOwnerships.push(...shareResult.batch.ownerships);
    }

    updateKnowledgeState(nextKnowledgeState);
    replaceCharacters(nextCharacters);

    const updatedRewardCharacters = nextCharacters.filter((character) =>
      rewardCharacterIds.includes(character.id)
    );
    const sessionCharacterResult = await upsertSessionCharacters({
      client,
      records: updatedRewardCharacters.map((character) => ({
        sessionId: selectedSessionId,
        characterId: character.id,
        ownerUserId: buildOwnerUserIdByCharacterId()[character.id] ?? null,
        ownerRole: character.ownerRole === "dm" ? "dm" : "player",
        displayName: getCharacterName(character),
        sheetPayload: character.sheet,
      })),
    });

    if ("error" in sessionCharacterResult) {
      setPanelMessage(sessionCharacterResult.error);
      return;
    }
    setSessionCharacters((current) => [
      ...current.filter(
        (entry) =>
          !sessionCharacterResult.some(
            (updated) => updated.characterId === entry.characterId
          )
      ),
      ...sessionCharacterResult,
    ]);

    if (grantedEntities.length > 0 || grantedRevisions.length > 0 || grantedOwnerships.length > 0) {
      const knowledgeResult = await upsertKnowledgeRecords({
        client,
        sessionId: selectedSessionId,
        entities: grantedEntities,
        revisions: grantedRevisions,
        ownerships: grantedOwnerships,
        ownerUserIdByCharacterId: buildOwnerUserIdByCharacterId(),
        createdByUserId: online.user.id,
        acquiredFromUserId: online.user.id,
      });
      if ("error" in knowledgeResult) {
        setPanelMessage(knowledgeResult.error);
        return;
      }
    }

    await publishEvent(result.event);
    setRewardDraft(emptyRewardDraft);
    setRewardCharacterIds([]);
    setRewardCardRevisionIds([]);
  }

  async function handlePin(): Promise<void> {
    if (!online.user || !selectedSessionId || !pinLabel.trim()) {
      return;
    }

    await publishEvent({
      id: `session-pin-${Date.now()}`,
      sessionId: selectedSessionId,
      kind: "pin",
      visibility: "public",
      actorUserId: online.user.id,
      actorCharacterId: null,
      actorDisplayName: online.profile?.displayName ?? "DM",
      targetUserIds: [],
      targetCharacterIds: [],
      summary: `Pinned ${pinKind}: ${pinLabel.trim()}`,
      payload: { kind: pinKind, label: pinLabel.trim() },
      createdAt: new Date().toISOString(),
    });
    setPinLabel("");
  }

  async function handleSaveNotes(): Promise<void> {
    if (!client || !selectedSessionId) {
      return;
    }

    const result = await updateGameSessionNotes({
      client,
      sessionId: selectedSessionId,
      sessionNotes,
    });

    if ("error" in result) {
      setPanelMessage(result.error);
      return;
    }

    setSessions((current) =>
      current.map((session) => (session.id === result.id ? result : session))
    );
    setPanelMessage("Session notes saved.");
  }

  function toggleRewardCharacter(characterId: string): void {
    setRewardCharacterIds((current) =>
      current.includes(characterId)
        ? current.filter((entry) => entry !== characterId)
        : [...current, characterId]
    );
  }

  function toggleRewardCard(revisionId: string): void {
    setRewardCardRevisionIds((current) =>
      current.includes(revisionId)
        ? current.filter((entry) => entry !== revisionId)
        : [...current, revisionId]
    );
  }

  function toggleShareTarget(characterId: string): void {
    setShareTargetIds((current) =>
      current.includes(characterId)
        ? current.filter((entry) => entry !== characterId)
        : [...current, characterId]
    );
  }

  if (!online.isConfigured) {
    return (
      <main className="dm-page">
        <section className="flow-card">
          <p className="section-kicker">Realtime DM Screen</p>
          <h1>Supabase Required</h1>
          <p className="dm-summary-line">
            Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to enable live sessions.
          </p>
          <button type="button" className="flow-secondary" onClick={() => navigate("/dm")}>
            DM Dashboard
          </button>
        </section>
      </main>
    );
  }

  if (online.status !== "authenticated") {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="dm-page">
      <section className="dm-shell">
        <header className="dm-topbar">
          <div>
            <p className="section-kicker">Dungeon Master</p>
            <h1>DM Screen</h1>
            <p className="dm-summary-line">
              Live session operations, secret rolls, sharing, rewards, and session notes.
            </p>
          </div>
          <div className="dm-nav-actions dm-nav-actions-wrap">
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm")}>
              DM Dashboard
            </button>
            <button
              type="button"
              className="sheet-nav-button"
              onClick={() => navigate("/dm/combat")}
            >
              Combat Setup
            </button>
          </div>
        </header>

        {panelMessage ? <p className="dm-status-line">{panelMessage}</p> : null}

        <section className="dm-screen-grid">
          <article className="sheet-card dm-screen-panel">
            <p className="section-kicker">Session Setup</p>
            <h2>Campaign</h2>
            <label className="dm-field">
              <span>Campaign</span>
              <select
                value={selectedCampaignId}
                onChange={(event) => {
                  setSelectedCampaignId(event.target.value);
                  setSelectedSessionId("");
                }}
              >
                <option value="">Select campaign</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="dm-inline-controls">
              <input
                value={gameName}
                onChange={(event) => setGameName(event.target.value)}
                placeholder="Game name"
              />
              <input
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
                placeholder="Campaign name"
              />
              <button type="button" className="flow-secondary" onClick={handleCreateCampaign}>
                Create
              </button>
              <button
                type="button"
                className="flow-secondary"
                disabled={!selectedCampaign}
                onClick={handleDeleteCampaign}
              >
                Delete Selected
              </button>
            </div>
            <div className="dm-screen-row">
              <strong>Current Session</strong>
              <span>
                {activeSession
                  ? `${activeSession.label} | ${new Date(activeSession.startedAt).toLocaleString()}`
                  : "No active session"}
              </span>
            </div>
            <div className="dm-inline-controls">
              <button
                type="button"
                className="flow-secondary"
                onClick={handleStartSession}
                disabled={!selectedCampaign || Boolean(activeSession)}
              >
                Start Session
              </button>
              <button
                type="button"
                className="flow-secondary"
                onClick={handleEndSession}
                disabled={!activeSession}
              >
                End Session
              </button>
            </div>
          </article>

          <article className="sheet-card dm-screen-panel">
            <p className="section-kicker">Participants</p>
            <h2>Accounts</h2>
            <p className="dm-summary-line">Your account id: {online.user?.id}</p>
            <div className="dm-screen-list">
              {members.map((member) => (
                <div key={member.userId} className="dm-screen-row">
                  <strong>{member.displayName || member.userId}</strong>
                  <span>
                    {sessionAttendees.some((attendee) => attendee.userId === member.userId)
                      ? "in session"
                      : member.role}
                  </span>
                  {member.role === "player" ? (
                    <button
                      type="button"
                      className="flow-secondary"
                    disabled={!activeSession}
                      onClick={() => handleAddMemberToSession(member)}
                    >
                      Add To Session
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="dm-inline-controls">
              <input
                value={memberUserId}
                onChange={(event) => setMemberUserId(event.target.value)}
                placeholder="Player account UUID"
              />
              <input
                value={memberDisplayName}
                onChange={(event) => setMemberDisplayName(event.target.value)}
                placeholder="Display name"
              />
              <select
                value={memberCharacterId}
                onChange={(event) => setMemberCharacterId(event.target.value)}
              >
                <option value="">No character link</option>
                {playerCharacters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {getCharacterName(character)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="flow-secondary"
                disabled={!selectedCampaignId}
                onClick={handleAddMember}
              >
                Add
              </button>
            </div>
          </article>

          <article className="sheet-card dm-screen-panel dm-screen-wide">
            <p className="section-kicker">Characters</p>
            <h2>Campaign Character Sheets</h2>
            <button
              type="button"
              className="flow-secondary"
              disabled={!activeSession}
              onClick={handleSyncCharacters}
            >
              Sync Local DM/NPC Characters To Session
            </button>
            <div className="dm-screen-table">
              {campaignCharacters.map((character) => (
                <div key={character.id} className="dm-screen-table-row">
                  <strong>{character.displayName}</strong>
                  <span>campaign</span>
                  <span>{character.ownerUserId}</span>
                  <span>{new Date(character.updatedAt).toLocaleString()}</span>
                  <button
                    type="button"
                    className="flow-secondary"
                    onClick={() => setSelectedCampaignCharacterId(character.characterId)}
                  >
                    View
                  </button>
                  <button
                    type="button"
                    className="flow-secondary"
                    disabled={!activeSession}
                    onClick={() => {
                      const member = members.find((entry) => entry.userId === character.ownerUserId);
                      if (member) {
                        void handleAddMemberToSession(member);
                      }
                    }}
                  >
                    Add To Session
                  </button>
                </div>
              ))}
              {dmCharacters.map((character) => (
                <div key={character.id} className="dm-screen-table-row">
                  <strong>{getCharacterName(character)}</strong>
                  <span>NPC</span>
                  <span>HP {character.sheet.currentHp}</span>
                  <span>Mana {character.sheet.currentMana}</span>
                </div>
              ))}
            </div>
            <p className="dm-summary-line">
              {campaignCharacters.length} player character sheet(s) in this campaign. {sessionCharacters.length} live session character snapshot(s).
            </p>
            {selectedCampaignCharacter ? (
              <div className="dm-screen-table">
                <div className="dm-screen-table-row">
                  <strong>{selectedCampaignCharacter.displayName}</strong>
                  <span>HP {String((selectedCampaignCharacter.sheetPayload as { currentHp?: unknown }).currentHp ?? "-")}</span>
                  <span>Mana {String((selectedCampaignCharacter.sheetPayload as { currentMana?: unknown }).currentMana ?? "-")}</span>
                  <span>XP {String((selectedCampaignCharacter.sheetPayload as { xpEarned?: unknown }).xpEarned ?? "-")}</span>
                  <span>Money {String((selectedCampaignCharacter.sheetPayload as { money?: unknown }).money ?? "-")}</span>
                </div>
              </div>
            ) : null}
          </article>

          <article className="sheet-card dm-screen-panel">
            <p className="section-kicker">Secret Dice</p>
            <h2>Roll</h2>
            <label className="dm-field">
              <span>Label</span>
              <input value={rollLabel} onChange={(event) => setRollLabel(event.target.value)} />
            </label>
            <label className="dm-field">
              <span>Pool</span>
              <input type="number" value={rollPool} onChange={(event) => setRollPool(event.target.value)} />
            </label>
            <label className="dm-field">
              <span>Visibility</span>
              <select value={rollMode} onChange={(event) => setRollMode(event.target.value as typeof rollMode)}>
                <option value="dm_private">DM only</option>
                <option value="public">Public</option>
              </select>
            </label>
            <button type="button" className="flow-primary" disabled={!canUseLiveSession} onClick={handleRoll}>
              Roll
            </button>
          </article>

          <article className="sheet-card dm-screen-panel">
            <p className="section-kicker">Share</p>
            <h2>Info / Cards</h2>
            <textarea
              className="notes-input"
              value={shareText}
              onChange={(event) => setShareText(event.target.value)}
              placeholder="Share information, card context, or a table note."
            />
            <label className="dm-field">
              <span>Knowledge Card</span>
              <select
                value={shareCardRevisionId}
                onChange={(event) => setShareCardRevisionId(event.target.value)}
              >
                <option value="">No card</option>
                {knowledgeCardOptions.map((option) => (
                  <option key={option.revision.id} value={option.revision.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="dm-field">
              <span>Audience</span>
              <select value={shareVisibility} onChange={(event) => setShareVisibility(event.target.value as typeof shareVisibility)}>
                <option value="public">Open to all</option>
                <option value="limited">Limited participants</option>
              </select>
            </label>
            {shareVisibility === "limited" ? (
              <div className="knowledge-recipient-list">
                {playerCharacters.map((character) => (
                  <label key={character.id} className="knowledge-checkbox">
                    <input
                      type="checkbox"
                      checked={shareTargetIds.includes(character.id)}
                      onChange={() => toggleShareTarget(character.id)}
                    />
                    <span>{getCharacterName(character)}</span>
                  </label>
                ))}
              </div>
            ) : null}
            <button type="button" className="flow-primary" disabled={!canUseLiveSession} onClick={handleShare}>
              Share
            </button>
          </article>

          <article className="sheet-card dm-screen-panel dm-screen-wide">
            <p className="section-kicker">Rewards</p>
            <h2>Core Reward Packet</h2>
            <div className="knowledge-recipient-list dm-screen-recipient-grid">
              {playerCharacters.map((character) => (
                <label key={character.id} className="knowledge-checkbox">
                  <input
                    type="checkbox"
                    checked={rewardCharacterIds.includes(character.id)}
                    onChange={() => toggleRewardCharacter(character.id)}
                  />
                  <span>{getCharacterName(character)}</span>
                </label>
              ))}
            </div>
            {knowledgeCardOptions.length > 0 ? (
              <>
                <p className="dm-summary-line">Optional card grants</p>
                <div className="knowledge-recipient-list dm-screen-recipient-grid">
                  {knowledgeCardOptions.map((option) => (
                    <label key={option.revision.id} className="knowledge-checkbox">
                      <input
                        type="checkbox"
                        checked={rewardCardRevisionIds.includes(option.revision.id)}
                        onChange={() => toggleRewardCard(option.revision.id)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </>
            ) : null}
            <div className="dm-screen-reward-grid">
              {(["xpEarnedDelta", "inspirationDelta", "temporaryInspirationDelta", "moneyDelta", "positiveKarmaDelta", "negativeKarmaDelta"] as const).map((field) => (
                <label key={field} className="dm-field">
                  <span>{field.replace("Delta", "")}</span>
                  <input
                    type="number"
                    value={rewardDraft[field]}
                    onChange={(event) =>
                      setRewardDraft((current) => ({
                        ...current,
                        [field]: parseIntegerInput(event.target.value),
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            <textarea
              className="notes-input"
              value={rewardDraft.note}
              onChange={(event) =>
                setRewardDraft((current) => ({ ...current, note: event.target.value }))
              }
              placeholder="Reward note"
            />
            <button type="button" className="flow-primary" disabled={!canUseLiveSession} onClick={handleReward}>
              Apply Rewards
            </button>
          </article>

          <article className="sheet-card dm-screen-panel">
            <p className="section-kicker">Pins</p>
            <h2>NPCs / Cards / Locations</h2>
            <label className="dm-field">
              <span>Type</span>
              <select value={pinKind} onChange={(event) => setPinKind(event.target.value as typeof pinKind)}>
                <option value="npc">NPC</option>
                <option value="card">Card</option>
                <option value="location">Location</option>
                <option value="note">Note</option>
              </select>
            </label>
            <div className="dm-inline-controls">
              <input value={pinLabel} onChange={(event) => setPinLabel(event.target.value)} placeholder="Pin label" />
              <button type="button" className="flow-secondary" disabled={!canUseLiveSession} onClick={handlePin}>
                Pin
              </button>
            </div>
            <div className="dm-screen-list">
              {visiblePins.map((event) => (
                <div key={event.id} className="dm-screen-row">
                  <strong>{String(event.payload.label ?? event.summary)}</strong>
                  <span>{String(event.payload.kind ?? "pin")}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="sheet-card dm-screen-panel">
            <p className="section-kicker">Session Notes</p>
            <h2>Notes</h2>
            <textarea
              className="notes-input"
              value={sessionNotes}
              onChange={(event) => setSessionNotes(event.target.value)}
              placeholder="Session notes"
            />
            <button type="button" className="flow-secondary" disabled={!selectedSessionId} onClick={handleSaveNotes}>
              Save Notes
            </button>
            <p className="dm-summary-line">
              Active combat: {activeCombatEncounter ? activeCombatEncounter.label : "None"}
            </p>
          </article>

          <article className="sheet-card dm-screen-panel dm-screen-wide">
            <p className="section-kicker">Session History</p>
            <h2>Campaign Sessions</h2>
            <div className="dm-screen-table">
              {sessions.map((session) => (
                <div key={session.id} className="dm-screen-table-row">
                  <strong>{session.label}</strong>
                  <span>{session.status}</span>
                  <span>{new Date(session.startedAt).toLocaleString()}</span>
                  <span>{session.endedAt ? new Date(session.endedAt).toLocaleString() : "active"}</span>
                  <button
                    type="button"
                    className="flow-secondary"
                    onClick={() => setSelectedSessionId(session.id)}
                  >
                    View Log
                  </button>
                </div>
              ))}
            </div>
          </article>

          <article className="sheet-card dm-screen-panel dm-screen-wide">
            <p className="section-kicker">Persistent Log</p>
            <h2>{selectedSession ? `${selectedSession.label} Events` : "Session Events"}</h2>
            <div className="dm-session-event-list">
              {events.map((event) => (
                <div key={event.id} className="dm-session-event">
                  <span>{getEventVisibilityLabel(event)}</span>
                  <strong>{event.summary}</strong>
                  <small>{event.actorDisplayName} | {new Date(event.createdAt).toLocaleString()}</small>
                </div>
              ))}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
