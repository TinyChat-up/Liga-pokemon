import type { RealtimeChannel } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultPlayers } from "./data";
import type { Capture, Evolution, Player } from "./types";
import type { Database } from "../supabase-types";

type Client = SupabaseClient<Database>;

type GameSnapshot = {
  players: Player[];
  mode: "remote" | "local";
};

export async function loadGameSnapshot(client: Client | null): Promise<GameSnapshot> {
  if (!client) return { players: defaultPlayers, mode: "local" };

  const [profilesResult, progressResult, capturesResult] = await Promise.all([
    client.from("profiles").select("*"),
    client.from("game_progress").select("player_id,station_id"),
    client.from("captures").select("*").is("redeemed_at", null),
  ]);
  const questionHistoryResult = await client.from("question_history").select("player_id,question_key");

  if (profilesResult.error) {
    throw new Error(profilesResult.error.message);
  }
  if (questionHistoryResult.error) {
    throw new Error(questionHistoryResult.error.message);
  }

  const progress = progressResult.data ?? [];
  const captures = capturesResult.data ?? [];
  const questionHistory = questionHistoryResult.data ?? [];
  const remotePlayers = (profilesResult.data ?? []).map<Player>((row) => ({
    id: row.player_code,
    dbId: row.id,
    name: row.display_name,
    evolution: row.evolution ?? undefined,
    level: row.level,
    xp: row.xp,
    energy: row.energy,
    tokens: row.tokens,
    route: unique(progress.filter((item) => item.player_id === row.id).map((item) => item.station_id)),
    captures: captures
      .filter((item) => item.player_id === row.id)
      .map((item) => ({
        recordId: item.id,
        id: item.pokemon_id,
        name: item.pokemon_name,
        rarity: item.rarity,
        sprite: item.sprite_id,
        value: item.token_value,
      })),
    arenaEvents: [],
    questionHistory: unique(
      questionHistory.filter((item) => item.player_id === row.id).map((item) => item.question_key),
    ),
  }));

  return {
    players: defaultPlayers.map((seed) => remotePlayers.find((item) => item.id === seed.id) ?? seed),
    mode: "remote",
  };
}

export async function saveProfile(client: Client | null, player: Player): Promise<void> {
  if (!client || !player.dbId) return;

  const { error } = await client
    .from("profiles")
    .update({
      evolution: player.evolution ?? null,
      level: player.level,
      xp: player.xp,
      energy: player.energy,
      tokens: player.tokens,
      updated_at: new Date().toISOString(),
    })
    .eq("id", player.dbId);

  if (error) throw new Error(error.message);
}

export async function recordQuestionShown(
  client: Client | null,
  player: Player,
  stationId: string,
  key: string,
): Promise<void> {
  if (!client || !player.dbId) return;

  const { error } = await client.from("question_history").insert({
    player_id: player.dbId,
    station_id: stationId,
    question_key: key,
  });

  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }
}

export async function completeStationRemotely(
  client: Client | null,
  player: Player,
  stationId: string,
  rewardTokens: number,
  capture: Capture,
  xp: number,
  level: number,
): Promise<void> {
  if (!client || !player.dbId || !capture.recordId) return;

  const rpc = await client.rpc("complete_station", {
    p_player_id: player.dbId,
    p_station_id: stationId,
    p_reward_tokens: rewardTokens,
    p_xp: xp,
    p_level: level,
    p_capture_id: capture.recordId,
    p_pokemon_id: capture.id,
    p_pokemon_name: capture.name,
    p_rarity: capture.rarity,
    p_sprite_id: capture.sprite,
    p_token_value: capture.value,
  });

  if (!isMissingRpcError(rpc.error)) {
    if (rpc.error) throw new Error(rpc.error.message);
    return;
  }

  const { error: profileError } = await client
    .from("profiles")
    .update({
      tokens: player.tokens + rewardTokens,
      xp,
      level,
      updated_at: new Date().toISOString(),
    })
    .eq("id", player.dbId);

  if (profileError) throw new Error(profileError.message);

  const progressResult = await client
    .from("game_progress")
    .upsert(
      { player_id: player.dbId, station_id: stationId, completed_at: new Date().toISOString() },
      { onConflict: "player_id,station_id", ignoreDuplicates: true },
    );

  if (progressResult.error) {
    await client.from("game_progress").insert({ player_id: player.dbId, station_id: stationId });
  }

  const captureResult = await client
    .from("captures")
    .upsert(
      {
        id: capture.recordId,
        player_id: player.dbId,
        pokemon_id: capture.id,
        pokemon_name: capture.name,
        rarity: capture.rarity,
        sprite_id: capture.sprite,
        token_value: capture.value,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );

  if (captureResult.error) throw new Error(captureResult.error.message);
}

export async function redeemCaptureRemotely(
  client: Client | null,
  player: Player,
  capture: Capture,
): Promise<boolean> {
  if (!client || !player.dbId || !capture.recordId) return true;

  const rpc = await client.rpc("redeem_capture_for_tokens", { p_capture_id: capture.recordId });
  if (!isMissingRpcError(rpc.error)) {
    if (rpc.error) throw new Error(rpc.error.message);
    return true;
  }

  const { data, error } = await client
    .from("captures")
    .update({ redeemed_at: new Date().toISOString() })
    .eq("id", capture.recordId)
    .eq("player_id", player.dbId)
    .is("redeemed_at", null)
    .select("id")
    .single();

  if (error || !data) return false;

  await saveProfile(client, { ...player, tokens: player.tokens + capture.value });
  return true;
}

export async function createArenaMatch(
  client: Client | null,
  playerOneId: string | undefined,
  playerTwoId: string | undefined,
  challenge: string,
): Promise<void> {
  if (!client || !playerOneId || !playerTwoId) return;

  const { error } = await client.from("arena_matches").insert({
    player_one_id: playerOneId,
    player_two_id: playerTwoId,
    challenge,
    reward_tokens: 2,
  });

  if (error) throw new Error(error.message);
}

export async function createTeamInvite(
  client: Client | null,
  fromPlayerId: string | undefined,
  toPlayerId: string | undefined,
  stationId: string | null,
): Promise<void> {
  if (!client || !fromPlayerId || !toPlayerId) return;

  const existingQuery = client
    .from("team_invites")
    .select("id")
    .eq("from_player_id", fromPlayerId)
    .eq("to_player_id", toPlayerId);

  const { data: existing, error: existingError } = await (stationId
    ? existingQuery.eq("station_id", stationId)
    : existingQuery.is("station_id", null)
  )
    .eq("status", "pending")
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) return;

  const { error } = await client.from("team_invites").insert({
    from_player_id: fromPlayerId,
    to_player_id: toPlayerId,
    station_id: stationId,
    status: "pending",
  });

  if (error) throw new Error(error.message);
}

export async function spendTokensRemotely(
  client: Client | null,
  player: Player,
  itemName: string,
  tokenCost: number,
): Promise<boolean> {
  if (!client || !player.dbId) return true;

  const rpc = await client.rpc("spend_tokens_for_redemption", {
    p_player_id: player.dbId,
    p_item_name: itemName,
    p_token_cost: tokenCost,
  });
  if (!isMissingRpcError(rpc.error)) {
    if (rpc.error) throw new Error(rpc.error.message);
    return true;
  }

  if (player.tokens < tokenCost) return false;
  await saveProfile(client, { ...player, tokens: player.tokens - tokenCost });

  const { error } = await client.from("redemptions").insert({
    player_id: player.dbId,
    item_name: itemName,
    token_cost: tokenCost,
  });

  if (error) throw new Error(error.message);
  return true;
}

export function subscribeToGameChanges(
  client: Client | null,
  onChange: () => void,
): RealtimeChannel | null {
  if (!client) return null;

  return client
    .channel("liga-27-live")
    .on("postgres_changes", { event: "*", schema: "public" }, onChange)
    .subscribe();
}

export function normalizeEvolution(value: string | undefined): Evolution | undefined {
  const allowed: Evolution[] = [
    "Flareon",
    "Vaporeon",
    "Jolteon",
    "Espeon",
    "Umbreon",
    "Leafeon",
    "Glaceon",
    "Sylveon",
  ];

  return allowed.find((item) => item === value);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isMissingRpcError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  return error.code === "PGRST202" || Boolean(error.message?.toLowerCase().includes("could not find the function"));
}
