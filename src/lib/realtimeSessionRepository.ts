import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import type {
  CampaignMemberRecord,
  CampaignRecord,
  GameSessionRecord,
  OnlineSessionRole,
  SessionCharacterRecord,
  SessionEvent,
} from "../types/realtimeSession.ts";
import type {
  KnowledgeEntity,
  KnowledgeOwnership,
  KnowledgeRevision,
} from "../types/knowledge.ts";

type CampaignRow = {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
};

type CampaignMemberRow = {
  campaign_id: string;
  user_id: string;
  role: OnlineSessionRole;
  display_name: string;
  selected_character_id: string | null;
  joined_at: string;
};

type CampaignMemberWithCampaignRow = CampaignMemberRow & {
  campaigns: CampaignRow | CampaignRow[] | null;
};

type GameSessionRow = {
  id: string;
  campaign_id: string;
  label: string;
  status: "active" | "closed";
  created_by: string;
  started_at: string;
  ended_at: string | null;
  session_notes: string;
};

type SessionCharacterRow = {
  id: string;
  session_id: string;
  character_id: string;
  owner_user_id: string | null;
  owner_role: OnlineSessionRole;
  display_name: string;
  sheet_payload: unknown;
  updated_at: string;
};

type SessionEventRow = {
  id: string;
  session_id: string;
  kind: SessionEvent["kind"];
  visibility: SessionEvent["visibility"];
  actor_user_id: string | null;
  actor_character_id: string | null;
  actor_display_name: string;
  target_user_ids: string[];
  target_character_ids: string[];
  summary: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type KnowledgeOwnershipRow = {
  id: string;
  revision_id: string;
  owner_user_id: string | null;
  owner_character_id: string;
  acquired_from_user_id: string | null;
  local_label: string;
  is_pinned: boolean;
  is_archived: boolean;
  acquired_at: string;
};

const LIVE_SESSION_SCHEMA_HELP =
  "Live session database schema is not installed or Supabase schema cache is stale. " +
  "Run supabase/migrations/202604240001_realtime_dm_screen.sql, then " +
  "supabase/migrations/202604240002_account_access_hardening.sql in the Supabase SQL Editor.";

export function formatRealtimeSessionError(
  error: { code?: string; message?: string } | null | undefined,
  fallback: string
): string {
  const message = error?.message ?? fallback;
  const code = error?.code ?? "";
  const lowerMessage = message.toLowerCase();
  const schemaMissing =
    code === "PGRST204" ||
    code === "PGRST205" ||
    lowerMessage.includes("schema cache") ||
    lowerMessage.includes("could not find the table") ||
    lowerMessage.includes("could not find the column");

  return schemaMissing ? `${LIVE_SESSION_SCHEMA_HELP} Original error: ${message}` : message;
}

function mapCampaign(row: CampaignRow): CampaignRecord {
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    createdAt: row.created_at,
  };
}

function mapCampaignMember(row: CampaignMemberRow): CampaignMemberRecord {
  return {
    campaignId: row.campaign_id,
    userId: row.user_id,
    role: row.role,
    displayName: row.display_name,
    selectedCharacterId: row.selected_character_id,
    joinedAt: row.joined_at,
  };
}

function mapGameSession(row: GameSessionRow): GameSessionRecord {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    label: row.label,
    status: row.status,
    createdBy: row.created_by,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    sessionNotes: row.session_notes,
  };
}

function mapSessionCharacter(row: SessionCharacterRow): SessionCharacterRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    characterId: row.character_id,
    ownerUserId: row.owner_user_id,
    ownerRole: row.owner_role,
    displayName: row.display_name,
    sheetPayload: row.sheet_payload,
    updatedAt: row.updated_at,
  };
}

export function mapSessionEvent(row: SessionEventRow): SessionEvent {
  return {
    id: row.id,
    sessionId: row.session_id,
    kind: row.kind,
    visibility: row.visibility,
    actorUserId: row.actor_user_id,
    actorCharacterId: row.actor_character_id,
    actorDisplayName: row.actor_display_name,
    targetUserIds: row.target_user_ids ?? [],
    targetCharacterIds: row.target_character_ids ?? [],
    summary: row.summary,
    payload: row.payload ?? {},
    createdAt: row.created_at,
  };
}

function toSessionEventRow(event: SessionEvent): Omit<SessionEventRow, "created_at"> & {
  created_at?: string;
} {
  return {
    id: event.id,
    session_id: event.sessionId,
    kind: event.kind,
    visibility: event.visibility,
    actor_user_id: event.actorUserId,
    actor_character_id: event.actorCharacterId,
    actor_display_name: event.actorDisplayName,
    target_user_ids: event.targetUserIds,
    target_character_ids: event.targetCharacterIds,
    summary: event.summary,
    payload: event.payload,
    created_at: event.createdAt,
  };
}

export async function createCampaign(args: {
  client: SupabaseClient;
  name: string;
  ownerUserId: string;
  ownerDisplayName: string;
}): Promise<{ campaign: CampaignRecord; member: CampaignMemberRecord } | { error: string }> {
  const { data: campaignRow, error: campaignError } = await args.client
    .from("campaigns")
    .insert({ name: args.name, owner_user_id: args.ownerUserId })
    .select("id, name, owner_user_id, created_at")
    .single();

  if (campaignError || !campaignRow) {
    return { error: formatRealtimeSessionError(campaignError, "Failed to create campaign.") };
  }

  const { data: memberRow, error: memberError } = await args.client
    .from("campaign_members")
    .insert({
      campaign_id: campaignRow.id,
      user_id: args.ownerUserId,
      role: "dm",
      display_name: args.ownerDisplayName,
      selected_character_id: null,
    })
    .select("campaign_id, user_id, role, display_name, selected_character_id, joined_at")
    .single();

  if (memberError || !memberRow) {
    return {
      error: formatRealtimeSessionError(memberError, "Failed to create campaign membership."),
    };
  }

  return {
    campaign: mapCampaign(campaignRow),
    member: mapCampaignMember(memberRow),
  };
}

export async function addCampaignMember(args: {
  client: SupabaseClient;
  campaignId: string;
  userId: string;
  role: OnlineSessionRole;
  displayName: string;
  selectedCharacterId?: string | null;
}): Promise<CampaignMemberRecord | { error: string }> {
  const { data, error } = await args.client
    .from("campaign_members")
    .upsert(
      {
        campaign_id: args.campaignId,
        user_id: args.userId,
        role: args.role,
        display_name: args.displayName,
        selected_character_id: args.selectedCharacterId ?? null,
      },
      { onConflict: "campaign_id,user_id" }
    )
    .select("campaign_id, user_id, role, display_name, selected_character_id, joined_at")
    .single();

  if (error || !data) {
    return { error: formatRealtimeSessionError(error, "Failed to add campaign member.") };
  }

  return mapCampaignMember(data);
}

export async function listCampaigns(
  client: SupabaseClient
): Promise<CampaignRecord[] | { error: string }> {
  const { data, error } = await client
    .from("campaigns")
    .select("id, name, owner_user_id, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return { error: formatRealtimeSessionError(error, "Failed to load campaigns.") };
  }

  return (data ?? []).map(mapCampaign);
}

export async function listCampaignsForRole(args: {
  client: SupabaseClient;
  userId: string;
  role: OnlineSessionRole;
}): Promise<CampaignRecord[] | { error: string }> {
  const { data, error } = await args.client
    .from("campaign_members")
    .select(
      "campaign_id, user_id, role, display_name, selected_character_id, joined_at, campaigns(id, name, owner_user_id, created_at)"
    )
    .eq("user_id", args.userId)
    .eq("role", args.role)
    .order("joined_at", { ascending: false });

  if (error) {
    return { error: formatRealtimeSessionError(error, "Failed to load campaigns.") };
  }

  return ((data ?? []) as CampaignMemberWithCampaignRow[]).flatMap((row) => {
    const campaign = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns;
    return campaign ? [mapCampaign(campaign)] : [];
  });
}

export async function createGameSession(args: {
  client: SupabaseClient;
  campaignId: string;
  label: string;
  createdBy: string;
}): Promise<GameSessionRecord | { error: string }> {
  const { data, error } = await args.client
    .from("game_sessions")
    .insert({
      campaign_id: args.campaignId,
      label: args.label,
      created_by: args.createdBy,
      status: "active",
    })
    .select("id, campaign_id, label, status, created_by, started_at, ended_at, session_notes")
    .single();

  if (error || !data) {
    return { error: formatRealtimeSessionError(error, "Failed to create session.") };
  }

  return mapGameSession(data);
}

export async function listActiveSessions(args: {
  client: SupabaseClient;
  campaignId: string;
}): Promise<GameSessionRecord[] | { error: string }> {
  const { data, error } = await args.client
    .from("game_sessions")
    .select("id, campaign_id, label, status, created_by, started_at, ended_at, session_notes")
    .eq("campaign_id", args.campaignId)
    .eq("status", "active")
    .order("started_at", { ascending: false });

  if (error) {
    return { error: formatRealtimeSessionError(error, "Failed to load sessions.") };
  }

  return (data ?? []).map(mapGameSession);
}

export async function updateGameSessionNotes(args: {
  client: SupabaseClient;
  sessionId: string;
  sessionNotes: string;
}): Promise<GameSessionRecord | { error: string }> {
  const { data, error } = await args.client
    .from("game_sessions")
    .update({ session_notes: args.sessionNotes })
    .eq("id", args.sessionId)
    .select("id, campaign_id, label, status, created_by, started_at, ended_at, session_notes")
    .single();

  if (error || !data) {
    return { error: formatRealtimeSessionError(error, "Failed to update session notes.") };
  }

  return mapGameSession(data);
}

export async function listCampaignMembers(args: {
  client: SupabaseClient;
  campaignId: string;
}): Promise<CampaignMemberRecord[] | { error: string }> {
  const { data, error } = await args.client
    .from("campaign_members")
    .select("campaign_id, user_id, role, display_name, selected_character_id, joined_at")
    .eq("campaign_id", args.campaignId)
    .order("joined_at", { ascending: true });

  if (error) {
    return { error: formatRealtimeSessionError(error, "Failed to load campaign members.") };
  }

  return (data ?? []).map(mapCampaignMember);
}

export async function upsertSessionCharacters(args: {
  client: SupabaseClient;
  records: Array<{
    sessionId: string;
    characterId: string;
    ownerUserId: string | null;
    ownerRole: OnlineSessionRole;
    displayName: string;
    sheetPayload: unknown;
  }>;
}): Promise<SessionCharacterRecord[] | { error: string }> {
  const { data, error } = await args.client
    .from("session_characters")
    .upsert(
      args.records.map((record) => ({
        session_id: record.sessionId,
        character_id: record.characterId,
        owner_user_id: record.ownerUserId,
        owner_role: record.ownerRole,
        display_name: record.displayName,
        sheet_payload: record.sheetPayload,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "session_id,character_id" }
    )
    .select("id, session_id, character_id, owner_user_id, owner_role, display_name, sheet_payload, updated_at");

  if (error) {
    return { error: formatRealtimeSessionError(error, "Failed to update session characters.") };
  }

  return (data ?? []).map(mapSessionCharacter);
}

export async function listSessionCharacters(args: {
  client: SupabaseClient;
  sessionId: string;
}): Promise<SessionCharacterRecord[] | { error: string }> {
  const { data, error } = await args.client
    .from("session_characters")
    .select("id, session_id, character_id, owner_user_id, owner_role, display_name, sheet_payload, updated_at")
    .eq("session_id", args.sessionId)
    .order("display_name", { ascending: true });

  if (error) {
    return { error: formatRealtimeSessionError(error, "Failed to load session characters.") };
  }

  return (data ?? []).map(mapSessionCharacter);
}

export async function insertSessionEvent(args: {
  client: SupabaseClient;
  event: SessionEvent;
}): Promise<SessionEvent | { error: string }> {
  const { data, error } = await args.client
    .from("session_events")
    .insert(toSessionEventRow(args.event))
    .select(
      "id, session_id, kind, visibility, actor_user_id, actor_character_id, actor_display_name, target_user_ids, target_character_ids, summary, payload, created_at"
    )
    .single();

  if (error || !data) {
    return { error: formatRealtimeSessionError(error, "Failed to insert session event.") };
  }

  return mapSessionEvent(data);
}

export async function listSessionEvents(args: {
  client: SupabaseClient;
  sessionId: string;
}): Promise<SessionEvent[] | { error: string }> {
  const { data, error } = await args.client
    .from("session_events")
    .select(
      "id, session_id, kind, visibility, actor_user_id, actor_character_id, actor_display_name, target_user_ids, target_character_ids, summary, payload, created_at"
    )
    .eq("session_id", args.sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    return { error: formatRealtimeSessionError(error, "Failed to load session events.") };
  }

  return (data ?? []).map(mapSessionEvent);
}

export function subscribeToSessionEvents(args: {
  client: SupabaseClient;
  sessionId: string;
  onEvent: (event: SessionEvent) => void;
}): RealtimeChannel {
  return args.client
    .channel(`session-events:${args.sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "session_events",
        filter: `session_id=eq.${args.sessionId}`,
      },
      (payload) => {
        args.onEvent(mapSessionEvent(payload.new as SessionEventRow));
      }
    )
    .subscribe();
}

export async function upsertKnowledgeRecords(args: {
  client: SupabaseClient;
  sessionId: string;
  entities: KnowledgeEntity[];
  revisions: KnowledgeRevision[];
  ownerships: KnowledgeOwnership[];
  ownerUserIdByCharacterId: Record<string, string | null>;
  createdByUserId: string | null;
  acquiredFromUserId: string | null;
}): Promise<{ ok: true } | { error: string }> {
  if (args.entities.length > 0) {
    const { error } = await args.client.from("knowledge_entities").upsert(
      args.entities.map((entity) => ({
        id: entity.id,
        session_id: args.sessionId,
        type: entity.type,
        subject_key: entity.subjectKey,
        display_name: entity.displayName,
        created_at: entity.createdAt,
      })),
      { onConflict: "id", ignoreDuplicates: true }
    );

    if (error) {
      return { error: formatRealtimeSessionError(error, "Failed to update knowledge entities.") };
    }
  }

  if (args.revisions.length > 0) {
    const { error } = await args.client.from("knowledge_revisions").upsert(
      args.revisions.map((revision) => ({
        id: revision.id,
        entity_id: revision.entityId,
        revision_number: revision.revisionNumber,
        title: revision.title,
        summary: revision.summary,
        content: revision.content,
        tags: revision.tags,
        source_type: revision.sourceType,
        parent_revision_id: revision.parentRevisionId,
        lineage_mode: revision.lineageMode,
        is_canonical: revision.isCanonical,
        created_by_user_id: args.createdByUserId,
        created_at: revision.createdAt,
      })),
      { onConflict: "id", ignoreDuplicates: true }
    );

    if (error) {
      return { error: formatRealtimeSessionError(error, "Failed to update knowledge revisions.") };
    }
  }

  if (args.ownerships.length > 0) {
    const { error } = await args.client.from("knowledge_ownerships").upsert(
      args.ownerships.map((ownership) => ({
        id: ownership.id,
        revision_id: ownership.revisionId,
        owner_user_id: args.ownerUserIdByCharacterId[ownership.ownerCharacterId] ?? null,
        owner_character_id: ownership.ownerCharacterId,
        acquired_from_user_id: args.acquiredFromUserId,
        local_label: ownership.localLabel,
        is_pinned: ownership.isPinned,
        is_archived: ownership.isArchived,
        acquired_at: ownership.acquiredAt,
      })),
      { onConflict: "revision_id,owner_character_id", ignoreDuplicates: true }
    );

    if (error) {
      return { error: formatRealtimeSessionError(error, "Failed to update knowledge ownerships.") };
    }
  }

  return { ok: true };
}

export function subscribeToSessionCharacters(args: {
  client: SupabaseClient;
  sessionId: string;
  onRecord: (record: SessionCharacterRecord) => void;
}): RealtimeChannel {
  return args.client
    .channel(`session-characters:${args.sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "session_characters",
        filter: `session_id=eq.${args.sessionId}`,
      },
      (payload) => {
        if (payload.new && Object.keys(payload.new).length > 0) {
          args.onRecord(mapSessionCharacter(payload.new as SessionCharacterRow));
        }
      }
    )
    .subscribe();
}

export function subscribeToCampaignMembers(args: {
  client: SupabaseClient;
  campaignId: string;
  onRecord: (record: CampaignMemberRecord) => void;
}): RealtimeChannel {
  return args.client
    .channel(`campaign-members:${args.campaignId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "campaign_members",
        filter: `campaign_id=eq.${args.campaignId}`,
      },
      (payload) => {
        if (payload.new && Object.keys(payload.new).length > 0) {
          args.onRecord(mapCampaignMember(payload.new as CampaignMemberRow));
        }
      }
    )
    .subscribe();
}

export function subscribeToKnowledgeOwnerships(args: {
  client: SupabaseClient;
  onRecord: (record: KnowledgeOwnershipRow) => void;
}): RealtimeChannel {
  return args.client
    .channel("knowledge-ownerships")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "knowledge_ownerships",
      },
      (payload) => {
        if (payload.new && Object.keys(payload.new).length > 0) {
          args.onRecord(payload.new as KnowledgeOwnershipRow);
        }
      }
    )
    .subscribe();
}
