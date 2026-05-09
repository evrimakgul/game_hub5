import { useEffect, useMemo, useState, startTransition } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { rollD10Faces } from "../lib/dice.ts";
import type { GameHistoryEntry } from "../config/characterTemplate.ts";
import {
  applyKnowledgeBatch,
  buildKnowledgeRevisionLabel,
  createKnowledgeShareResult,
  getKnowledgeGroupsForOwner,
} from "../lib/knowledge.ts";
import {
  createRollSessionEvent,
  createShareSessionEvent,
  filterSessionEventsForViewer,
} from "../lib/realtimeSession.ts";
import {
  insertSessionEvent,
  joinCampaign,
  listActiveSessions,
  listCampaignMembers,
  listJoinableCampaigns,
  listSessionAttendees,
  listSessionCharacters,
  listSessionEvents,
  subscribeToCampaignMembers,
  subscribeToSessionEvents,
  subscribeToSessionCharacters,
  upsertSessionAttendee,
  upsertCampaignCharacter,
  upsertKnowledgeRecords,
  upsertSessionCharacters,
} from "../lib/realtimeSessionRepository.ts";
import { getSupabaseClient } from "../lib/supabaseClient.ts";
import { useAppFlow } from "../state/appFlow";
import { useOnlineSession } from "../state/onlineSession.tsx";
import type { CharacterRecord } from "../types/character.ts";
import type {
  CampaignMemberRecord,
  CampaignRecord,
  GameSessionRecord,
  SessionAttendeeRecord,
  SessionCharacterRecord,
  SessionEvent,
} from "../types/realtimeSession.ts";

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

export function PlayerSessionPage() {
  const navigate = useNavigate();
  const client = useMemo(() => getSupabaseClient(), []);
  const online = useOnlineSession();
  const {
    roleChoice,
    activePlayerCharacter,
    characters,
    knowledgeEntities,
    knowledgeRevisions,
    knowledgeOwnerships,
    replaceCharacters,
    updateKnowledgeState,
  } = useAppFlow();
  const [campaigns, setCampaigns] = useState<Array<CampaignRecord & { isMember?: boolean }>>([]);
  const [sessions, setSessions] = useState<GameSessionRecord[]>([]);
  const [members, setMembers] = useState<CampaignMemberRecord[]>([]);
  const [sessionAttendees, setSessionAttendees] = useState<SessionAttendeeRecord[]>([]);
  const [sessionCharacters, setSessionCharacters] = useState<SessionCharacterRecord[]>([]);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [panelMessage, setPanelMessage] = useState("");
  const [rollPool, setRollPool] = useState("3");
  const [rollLabel, setRollLabel] = useState("Player hidden roll");
  const [shareText, setShareText] = useState("");
  const [shareCardRevisionId, setShareCardRevisionId] = useState("");
  const [shareVisibility, setShareVisibility] = useState<"public" | "limited">("public");
  const [shareTargetIds, setShareTargetIds] = useState<string[]>([]);

  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? null;
  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null;
  const activeCharacterName =
    activePlayerCharacter?.sheet.name.trim() || activePlayerCharacter?.id || "No character selected";
  const visibleEvents = filterSessionEventsForViewer(events, {
    role: "player",
    userId: online.user?.id ?? null,
    characterId: activePlayerCharacter?.id ?? null,
  });
  const knowledgeState = {
    knowledgeEntities,
    knowledgeRevisions,
    knowledgeOwnerships,
  };
  const ownedCardOptions = activePlayerCharacter
    ? getKnowledgeGroupsForOwner(knowledgeState, activePlayerCharacter.id).flatMap((group) =>
        group.revisions.map((entry) => ({
          entity: entry.entity,
          revision: entry.revision,
          label: `${entry.entity.displayName} ${buildKnowledgeRevisionLabel(entry.revision)}`,
        }))
      )
    : [];

  useEffect(() => {
    if (!client || online.status !== "authenticated") {
      return;
    }
    const supabase = client;

    async function loadCampaigns(): Promise<void> {
      const result = await listJoinableCampaigns(supabase);
      if ("error" in result) {
        setPanelMessage(result.error);
        return;
      }

      setCampaigns(result);
      setSelectedCampaignId((current) => current || result[0]?.id || "");
    }

    void loadCampaigns();
  }, [client, online.status]);

  useEffect(() => {
    if (!client || !selectedCampaignId) {
      setSessions([]);
      setMembers([]);
      setSelectedSessionId("");
      return;
    }
    if (selectedCampaign && selectedCampaign.isMember === false) {
      setSessions([]);
      setMembers([]);
      setSelectedSessionId("");
      return;
    }
    const supabase = client;

    async function loadCampaignDetails(): Promise<void> {
      const [sessionResult, memberResult] = await Promise.all([
        listActiveSessions({ client: supabase, campaignId: selectedCampaignId }),
        listCampaignMembers({ client: supabase, campaignId: selectedCampaignId }),
      ]);

      if ("error" in sessionResult) {
        setPanelMessage(sessionResult.error);
      } else {
        setSessions(sessionResult);
        setSelectedSessionId(sessionResult[0]?.id || "");
      }

      if ("error" in memberResult) {
        setPanelMessage(memberResult.error);
      } else {
        setMembers(memberResult);
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
  }, [client, selectedCampaign, selectedCampaignId]);

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

  if (roleChoice !== "player") {
    return <Navigate to="/role" replace />;
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
    return Object.fromEntries(
      sessionCharacters.map((character) => [character.characterId, character.ownerUserId])
    );
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

  async function handleJoinCampaign(): Promise<void> {
    if (!client || !online.user || !selectedCampaignId) {
      return;
    }

    const result = await joinCampaign({
      client,
      campaignId: selectedCampaignId,
      displayName: online.profile?.displayName ?? online.user.email ?? "Player",
    });

    if ("error" in result) {
      setPanelMessage(result.error);
      return;
    }

    setCampaigns((current) =>
      current.map((campaign) =>
        campaign.id === result.campaignId ? { ...campaign, isMember: true } : campaign
      )
    );
    setMembers((current) => [...current.filter((member) => member.userId !== result.userId), result]);
    setPanelMessage("Joined campaign.");
  }

  async function syncActiveCharacterToCampaign(): Promise<boolean> {
    if (!client || !online.user || !selectedCampaignId || !activePlayerCharacter) {
      return false;
    }

    const result = await upsertCampaignCharacter({
      client,
      campaignId: selectedCampaignId,
      characterId: activePlayerCharacter.id,
      ownerUserId: online.user.id,
      displayName: activeCharacterName,
      sheetPayload: activePlayerCharacter.sheet,
    });

    if ("error" in result) {
      setPanelMessage(result.error);
      return false;
    }

    return true;
  }

  async function handlePublishCharacter(): Promise<void> {
    if (!client || !online.user || !selectedCampaignId || !activePlayerCharacter) {
      return;
    }

    const synced = await syncActiveCharacterToCampaign();
    if (!synced) {
      return;
    }

    if (!selectedSessionId) {
      setPanelMessage("Character sheet synced to campaign. No active session to join.");
      return;
    }

    const attendeeResult = await upsertSessionAttendee({
      client,
      sessionId: selectedSessionId,
      userId: online.user.id,
      role: "player",
      displayName: online.profile?.displayName ?? activeCharacterName,
      selectedCharacterId: activePlayerCharacter.id,
      addedByUserId: online.user.id,
    });

    if ("error" in attendeeResult) {
      setPanelMessage(attendeeResult.error);
      return;
    }

    const result = await upsertSessionCharacters({
      client,
      records: [
        {
          sessionId: selectedSessionId,
          characterId: activePlayerCharacter.id,
          ownerUserId: online.user.id,
          ownerRole: "player",
          displayName: activeCharacterName,
          sheetPayload: activePlayerCharacter.sheet,
        },
      ],
    });

    if ("error" in result) {
      setPanelMessage(result.error);
      return;
    }

    setSessionCharacters((current) => [
      ...current.filter((entry) => entry.characterId !== activePlayerCharacter.id),
      ...result,
    ]);
    setSessionAttendees((current) => [
      ...current.filter((attendee) => attendee.userId !== attendeeResult.userId),
      attendeeResult,
    ]);
    setPanelMessage("Character sheet synced to campaign and current session.");
  }

  async function handleJoinSession(): Promise<void> {
    if (!client || !online.user || !selectedSessionId) {
      return;
    }

    const result = await upsertSessionAttendee({
      client,
      sessionId: selectedSessionId,
      userId: online.user.id,
      role: "player",
      displayName: online.profile?.displayName ?? online.user.email ?? "Player",
      selectedCharacterId: activePlayerCharacter?.id ?? null,
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
    if (activePlayerCharacter) {
      await syncActiveCharacterToCampaign();
    }
    setPanelMessage("Joined current session.");
  }

  async function handleHiddenRoll(): Promise<void> {
    if (!online.user || !selectedSessionId || !activePlayerCharacter) {
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
        actorCharacterId: activePlayerCharacter.id,
        actorDisplayName: activeCharacterName,
        labels: [rollLabel.trim() || "Player hidden roll"],
        poolSize,
        faces: rollD10Faces(poolSize),
        mode: "player_hidden",
      })
    );
  }

  async function handleShare(): Promise<void> {
    if (
      !client ||
      !online.user ||
      !selectedSessionId ||
      !activePlayerCharacter ||
      (!shareText.trim() && !shareCardRevisionId)
    ) {
      return;
    }

    const cardOption =
      ownedCardOptions.find((option) => option.revision.id === shareCardRevisionId) ?? null;
    const targetCharacterIds =
      shareVisibility === "limited"
        ? shareTargetIds
        : characters
            .filter((character) => character.id !== activePlayerCharacter.id)
            .map((character) => character.id);
    const cardLabel = cardOption?.label ?? "";
    const summary =
      shareText.trim() && cardLabel
        ? `${shareText.trim()} (${cardLabel})`
        : shareText.trim() || `Shared card: ${cardLabel}`;

    if (cardOption) {
      const shareResult = createKnowledgeShareResult({
        state: knowledgeState,
        entity: cardOption.entity,
        revision: cardOption.revision,
        sourceOwnerCharacterId: activePlayerCharacter.id,
        sourceOwnerName: activeCharacterName,
        recipientCharacters: characters.filter((character) =>
          targetCharacterIds.includes(character.id)
        ),
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
        actorCharacterId: activePlayerCharacter.id,
        actorDisplayName: activeCharacterName,
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

  function toggleShareTarget(characterId: string): void {
    setShareTargetIds((current) =>
      current.includes(characterId)
        ? current.filter((entry) => entry !== characterId)
        : [...current, characterId]
    );
  }

  if (!online.isConfigured) {
    return (
      <main className="flow-page">
        <section className="flow-card">
          <p className="section-kicker">Live Session</p>
          <h1>Supabase Required</h1>
          <p className="dm-summary-line">
            Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to join realtime sessions.
          </p>
          <button type="button" className="flow-secondary" onClick={() => navigate("/player")}>
            Player Hub
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
            <p className="section-kicker">Player</p>
            <h1>Live Session</h1>
            <p className="dm-summary-line">
              Share information, send hidden rolls to the DM, and follow session events.
            </p>
          </div>
          <div className="dm-nav-actions dm-nav-actions-wrap">
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/player")}>
              Player Hub
            </button>
            <button
              type="button"
              className="sheet-nav-button"
              onClick={() => navigate("/player/character")}
            >
              Character Sheet
            </button>
          </div>
        </header>

        {panelMessage ? <p className="dm-status-line">{panelMessage}</p> : null}

        <section className="dm-screen-grid">
          <article className="sheet-card dm-screen-panel">
            <p className="section-kicker">Account</p>
            <h2>Presence</h2>
            <p className="dm-summary-line">Account id: {online.user?.id}</p>
            <p className="dm-summary-line">Active character: {activeCharacterName}</p>
            <button
              type="button"
              className="flow-secondary"
              disabled={!selectedCampaign || selectedCampaign.isMember !== false}
              onClick={handleJoinCampaign}
            >
              Join Campaign
            </button>
            <button
              type="button"
              className="flow-secondary"
              disabled={!selectedSessionId || selectedCampaign?.isMember === false}
              onClick={handleJoinSession}
            >
              Join Current Session
            </button>
            <button
              type="button"
              className="flow-secondary"
              disabled={!selectedCampaignId || selectedCampaign?.isMember === false || !activePlayerCharacter}
              onClick={handlePublishCharacter}
            >
              Sync Character Sheet
            </button>
          </article>

          <article className="sheet-card dm-screen-panel">
            <p className="section-kicker">Session</p>
            <h2>Join Live Table</h2>
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
                    {campaign.gameName ? `${campaign.gameName} / ${campaign.name}` : campaign.name}
                    {campaign.isMember === false ? " (joinable)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="dm-screen-row">
              <strong>Current Session</strong>
              <span>
                {selectedSession
                  ? `${selectedSession.label} | ${new Date(selectedSession.startedAt).toLocaleString()}`
                  : "No active session"}
              </span>
            </div>
            <p className="dm-summary-line">
              {selectedSession ? selectedSession.sessionNotes || "No session notes yet." : "Ask the DM to start the session."}
            </p>
          </article>

          <article className="sheet-card dm-screen-panel">
            <p className="section-kicker">Hidden Roll</p>
            <h2>For DM Eyes</h2>
            <label className="dm-field">
              <span>Label</span>
              <input value={rollLabel} onChange={(event) => setRollLabel(event.target.value)} />
            </label>
            <label className="dm-field">
              <span>Pool</span>
              <input type="number" value={rollPool} onChange={(event) => setRollPool(event.target.value)} />
            </label>
            <button
              type="button"
              className="flow-primary"
              disabled={!selectedSessionId || !activePlayerCharacter}
              onClick={handleHiddenRoll}
            >
              Roll For DM
            </button>
          </article>

          <article className="sheet-card dm-screen-panel">
            <p className="section-kicker">Share</p>
            <h2>Info / Cards</h2>
            <textarea
              className="notes-input"
              value={shareText}
              onChange={(event) => setShareText(event.target.value)}
              placeholder="Share information with the table or selected characters."
            />
            <label className="dm-field">
              <span>Owned Card</span>
              <select
                value={shareCardRevisionId}
                onChange={(event) => setShareCardRevisionId(event.target.value)}
              >
                <option value="">No card</option>
                {ownedCardOptions.map((option) => (
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
                {characters
                  .filter((character) => character.id !== activePlayerCharacter?.id)
                  .map((character) => (
                    <label key={character.id} className="knowledge-checkbox">
                      <input
                        type="checkbox"
                        checked={shareTargetIds.includes(character.id)}
                        onChange={() => toggleShareTarget(character.id)}
                      />
                      <span>{character.sheet.name.trim() || character.id}</span>
                    </label>
                  ))}
              </div>
            ) : null}
            <button
              type="button"
              className="flow-primary"
              disabled={!selectedSessionId || !activePlayerCharacter}
              onClick={handleShare}
            >
              Share
            </button>
          </article>

          <article className="sheet-card dm-screen-panel dm-screen-wide">
            <p className="section-kicker">Participants</p>
            <h2>Live Characters</h2>
            <div className="dm-screen-table">
              {sessionCharacters.map((character) => (
                <div key={character.id} className="dm-screen-table-row">
                  <strong>{character.displayName}</strong>
                  <span>{character.ownerRole}</span>
                  <span>{character.ownerUserId === online.user?.id ? "You" : "Connected"}</span>
                </div>
              ))}
            </div>
            <p className="dm-summary-line">
              {sessionAttendees.length} attendee(s) in this session. {members.length} account(s) in this campaign.
            </p>
          </article>

          <article className="sheet-card dm-screen-panel dm-screen-wide">
            <p className="section-kicker">Persistent Log</p>
            <h2>Session Events</h2>
            <div className="dm-session-event-list">
              {visibleEvents.map((event) => (
                <div key={event.id} className="dm-session-event">
                  <span>{event.kind}</span>
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
