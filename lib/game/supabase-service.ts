import type { RealtimeChannel } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createDefaultPlayer, defaultPlayers } from "./data";
import type { ArenaMatchSummary, Capture, Evolution, MenuItem, Player, RedemptionSummary, TeamInviteSummary } from "./types";
import type { Database } from "../supabase-types";

type Client = SupabaseClient<Database>;
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProgressRow = Database["public"]["Tables"]["game_progress"]["Row"];
type CaptureRow = Database["public"]["Tables"]["captures"]["Row"];
type ArenaMatchRow = Database["public"]["Tables"]["arena_matches"]["Row"];
type RedemptionRow = Database["public"]["Tables"]["redemptions"]["Row"];
type QuestionHistoryRow = Database["public"]["Tables"]["question_history"]["Row"];
type TeamInviteRow = Database["public"]["Tables"]["team_invites"]["Row"];
type FinalRewardRow = Database["public"]["Tables"]["final_rewards"]["Row"];
export type GameSettings = {
  title: string;
  healingCost: number;
  wildDelaySeconds: number;
  rewardMenu: MenuItem[];
  finalRewards: string[];
};
type SnapshotRows = {
  profiles: ProfileRow[];
  game_progress: ProgressRow[];
  captures: CaptureRow[];
  arena_matches: ArenaMatchRow[];
  redemptions: RedemptionRow[];
  question_history: QuestionHistoryRow[];
  team_invites: TeamInviteRow[];
  final_rewards: FinalRewardRow[];
};

export type GameSnapshot = {
  players: Player[];
  teamInvites: TeamInviteSummary[];
  mode: "remote" | "local";
};

export async function loadGameSnapshot(client: Client | null, gameCode: string): Promise<GameSnapshot> {
  if (!client) return { players: defaultPlayers, teamInvites: [], mode: "local" };
  if (!gameCode) return { players: [], teamInvites: [], mode: "remote" };

  let rows = await loadSnapshotViaRpc(client, gameCode);

  if (!rows) {
    const profilesResult = await client.from("profiles").select("*").eq("game_code", gameCode);

    if (profilesResult.error) {
      throw new Error(profilesResult.error.message);
    }

    const profileRows = profilesResult.data ?? [];
    const playerDbIds = profileRows.map((row) => row.id);

    if (!playerDbIds.length) {
      return { players: [], teamInvites: [], mode: "remote" };
    }

    const [progressResult, capturesResult, arenaResult, redemptionsResult, questionHistoryResult, teamInvitesResult, finalRewardsResult] =
      await Promise.all([
        client.from("game_progress").select("*").in("player_id", playerDbIds),
        client.from("captures").select("*").in("player_id", playerDbIds).is("redeemed_at", null),
        client
          .from("arena_matches")
          .select("*")
          .or(`player_one_id.in.(${playerDbIds.join(",")}),player_two_id.in.(${playerDbIds.join(",")})`),
        client.from("redemptions").select("*").in("player_id", playerDbIds),
        client.from("question_history").select("*").in("player_id", playerDbIds),
        client
          .from("team_invites")
          .select("*")
          .or(`from_player_id.in.(${playerDbIds.join(",")}),to_player_id.in.(${playerDbIds.join(",")})`),
        client.from("final_rewards").select("*").in("player_id", playerDbIds),
      ]);

    if (arenaResult.error) {
      throw new Error(arenaResult.error.message);
    }
    if (redemptionsResult.error) {
      throw new Error(redemptionsResult.error.message);
    }
    if (questionHistoryResult.error) {
      throw new Error(questionHistoryResult.error.message);
    }
    if (teamInvitesResult.error) {
      throw new Error(teamInvitesResult.error.message);
    }
    if (finalRewardsResult.error && !isMissingRelationError(finalRewardsResult.error)) {
      throw new Error(finalRewardsResult.error.message);
    }

    rows = {
      profiles: profileRows,
      game_progress: progressResult.data ?? [],
      captures: capturesResult.data ?? [],
      arena_matches: arenaResult.data ?? [],
      redemptions: redemptionsResult.data ?? [],
      question_history: questionHistoryResult.data ?? [],
      team_invites: teamInvitesResult.data ?? [],
      final_rewards: finalRewardsResult.data ?? [],
    };
  }

  const remotePlayers = rows.profiles
    .map<Player>((row) => ({
      id: row.player_code,
      dbId: row.id,
      gameCode: row.game_code,
      name: row.display_name,
      evolution: row.evolution ?? undefined,
      level: row.level,
      xp: row.xp,
      energy: row.energy,
      tokens: row.tokens,
      route: unique(rows.game_progress.filter((item) => item.player_id === row.id).map((item) => item.station_id)),
      captures: rows.captures
        .filter((item) => item.player_id === row.id)
        .map((item) => ({
          recordId: item.id,
          id: item.pokemon_id,
          name: item.pokemon_name,
          rarity: item.rarity,
          sprite: item.sprite_id,
          value: item.token_value,
        })),
      arenaEvents: unique(
        rows.arena_matches
          .filter((item) => item.player_one_id === row.id && item.station_id)
          .map((item) => item.station_id!)
      ),
      arenaHistory: rows.arena_matches
        .filter((item) => item.player_one_id === row.id || item.player_two_id === row.id)
        .map<ArenaMatchSummary>((item) => ({
          id: item.id,
          stationId: item.station_id ?? undefined,
          opponentId: item.player_one_id === row.id ? item.player_two_id : item.player_one_id,
          challenge: item.challenge,
          winnerId: item.winner_player_id ?? undefined,
          loserId: item.loser_player_id ?? undefined,
          rewardTokens: item.reward_tokens,
          createdAt: item.created_at,
        })),
      redemptions: rows.redemptions
        .filter((item) => item.player_id === row.id)
        .map<RedemptionSummary>((item) => ({
          id: item.id,
          itemName: item.item_name,
          tokenCost: item.token_cost,
          createdAt: item.created_at,
        })),
      questionHistory: unique(
        rows.question_history.filter((item) => item.player_id === row.id).map((item) => item.question_key),
      ),
      correctAnswers: rows.question_history.filter((item) => item.player_id === row.id && item.is_correct === true).length,
      wrongAnswers: rows.question_history.filter((item) => item.player_id === row.id && item.is_correct === false).length,
      finalReward: rows.final_rewards.find((item) => item.player_id === row.id)?.reward_name,
      finalCompletedAt: rows.final_rewards.find((item) => item.player_id === row.id)?.completed_at,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "es"));

  return {
    players: remotePlayers,
    teamInvites: rows.team_invites.map((invite) => ({
      id: invite.id,
      fromPlayerId: invite.from_player_id,
      toPlayerId: invite.to_player_id,
      stationId: invite.station_id,
      status: invite.status,
      createdAt: invite.created_at,
    })),
    mode: "remote",
  };
}

export async function loadGameSettingsRemotely(client: Client | null, gameCode: string): Promise<GameSettings | null> {
  if (!client || !gameCode) return null;
  const { data, error } = await client.rpc("get_game_settings", { p_game_code: gameCode });
  if (error) {
    if (isMissingRpcError(error)) return null;
    throw new Error(error.message);
  }
  if (!isRecord(data)) return null;
  return {
    title: typeof data.title === "string" ? data.title : "QR Quest",
    healingCost: typeof data.healingCost === "number" ? data.healingCost : 0,
    wildDelaySeconds: typeof data.wildDelaySeconds === "number" ? data.wildDelaySeconds : 240,
    rewardMenu: Array.isArray(data.rewardMenu) ? data.rewardMenu.filter(isMenuItem) : [],
    finalRewards: Array.isArray(data.finalRewards) ? data.finalRewards.filter((item): item is string => typeof item === "string") : [],
  };
}

export async function updateGameSettingsRemotely(
  client: Client | null,
  gameCode: string,
  masterToken: string,
  settings: GameSettings,
): Promise<void> {
  if (!client) return;
  const { error } = await client.rpc("update_game_settings", {
    p_game_code: gameCode,
    p_master_token: masterToken,
    p_public_title: settings.title,
    p_healing_cost: settings.healingCost,
    p_wild_delay_seconds: settings.wildDelaySeconds,
    p_reward_menu: settings.rewardMenu,
    p_final_rewards: settings.finalRewards,
  });
  if (error) throw new Error(error.message);
}

export async function createPlayerProfile(
  client: Client | null,
  gameCode: string,
  displayName: string,
): Promise<Player> {
  const cleanName = displayName.trim().replace(/\s+/g, " ");
  if (!cleanName) throw new Error("El nombre no puede estar vacío.");
  if (!gameCode) throw new Error("El código de partida es obligatorio.");
  const playerCode = `player-${crypto.randomUUID().slice(0, 8)}`;

  if (!client) return createDefaultPlayer(cleanName, playerCode, undefined, gameCode);

  const sessionToken = crypto.randomUUID();
  const rpc = await client.rpc("register_player", {
    p_game_code: gameCode,
    p_display_name: cleanName,
    p_player_code: playerCode,
    p_session_token: sessionToken,
  });

  if (!isMissingRpcError(rpc.error)) {
    if (rpc.error) throw new Error(rpc.error.message);
    if (isProfileRow(rpc.data)) return createDefaultPlayer(rpc.data.display_name, rpc.data.player_code, rpc.data.id, gameCode);
    throw new Error("No se pudo crear el perfil de jugador.");
  }

  const { data, error } = await client
    .from("profiles")
    .insert({
      game_code: gameCode,
      player_code: playerCode,
      display_name: cleanName,
      level: 1,
      xp: 0,
      energy: 100,
      tokens: 0,
    })
    .select("id, player_code, display_name")
    .single();

  if (error) throw new Error(error.message);
  return createDefaultPlayer(data.display_name, data.player_code, data.id, gameCode);
}

export async function claimGameMaster(client: Client | null, gameCode: string, requestedToken?: string): Promise<string> {
  if (!requestedToken) throw new Error("Falta la credencial privada del master.");
  const masterToken = requestedToken;
  if (!client) return masterToken;

  const { data, error } = await client.rpc("verify_game_master", {
    p_game_code: gameCode,
    p_master_token: masterToken,
  });

  if (error) throw new Error(error.message);
  if (isMasterClaimResult(data) && data.claimed && data.masterToken) return data.masterToken;
  throw new Error("El enlace master no es válido para esta partida.");
}

export async function loginGameMaster(client: Client | null, username: string, password: string): Promise<{ gameCode: string; masterToken: string }> {
  if (!client) throw new Error("Supabase no está configurado.");
  const { data, error } = await client.rpc("login_game_master", {
    p_master_username: username.trim().toLowerCase(),
    p_master_password: password.trim(),
  });
  if (error) throw new Error(error.message);
  if (isMasterLoginResult(data)) return data;
  throw new Error("El usuario o la contraseña no son válidos.");
}

export async function completeEliteFourRemotely(
  client: Client | null,
  player: Player,
  rewardName: string,
): Promise<{ awarded: boolean; reward: string }> {
  if (!client || !player.dbId) return { awarded: !player.finalReward, reward: player.finalReward ?? rewardName };

  const rpc = await client.rpc("complete_elite_four", {
    p_player_id: player.dbId,
    p_reward_name: rewardName,
  });
  if (!isMissingRpcError(rpc.error)) {
    if (rpc.error) throw new Error(rpc.error.message);
    if (isFinalResult(rpc.data)) return rpc.data;
    return { awarded: true, reward: rewardName };
  }

  const { data, error } = await client
    .from("final_rewards")
    .upsert({ player_id: player.dbId, reward_name: rewardName }, { onConflict: "player_id", ignoreDuplicates: true })
    .select("reward_name")
    .maybeSingle();
  if (error) {
    if (isMissingRelationError(error)) return { awarded: !player.finalReward, reward: player.finalReward ?? rewardName };
    throw new Error(error.message);
  }
  return { awarded: Boolean(data), reward: data?.reward_name ?? player.finalReward ?? rewardName };
}

export async function respondToTeamInvite(
  client: Client | null,
  inviteId: string,
  status: "accepted" | "declined",
): Promise<void> {
  if (!client) return;
  const rpc = await client.rpc("respond_team_invite", {
    p_invite_id: inviteId,
    p_status: status,
  });

  if (!isMissingRpcError(rpc.error)) {
    if (rpc.error) throw new Error(rpc.error.message);
    return;
  }

  const { error } = await client.from("team_invites").update({ status }).eq("id", inviteId).eq("status", "pending");
  if (error) throw new Error(error.message);
}

export async function recoverPlayerRemotely(
  client: Client | null,
  gameCode: string,
  masterToken: string,
  player: Player,
  action: "heal" | "tokens" | "unstick",
  reason: string,
  tokenDelta = 0,
  stationId: string | null = null,
): Promise<void> {
  if (!client || !player.dbId) return;
  const rpc = await client.rpc("admin_recover_player", {
    p_admin_code: "master-panel",
    p_game_code: gameCode,
    p_master_token: masterToken,
    p_player_id: player.dbId,
    p_action: action,
    p_reason: reason,
    p_token_delta: tokenDelta,
    p_station_id: stationId,
  });
  if (!isMissingRpcError(rpc.error)) {
    if (rpc.error) throw new Error(rpc.error.message);
    return;
  }

  if (action === "heal") await saveProfile(client, { ...player, energy: 100 });
  if (action === "tokens") await saveProfile(client, { ...player, tokens: Math.max(0, player.tokens + tokenDelta) });
  if (action === "unstick") {
    await client.from("team_invites").update({ status: "cancelled" }).eq("status", "pending").or(`from_player_id.eq.${player.dbId},to_player_id.eq.${player.dbId}`);
    if (stationId) await client.from("question_history").delete().eq("player_id", player.dbId).eq("station_id", stationId);
  }
}

export async function deletePlayerProfileRemotely(
  client: Client | null,
  gameCode: string,
  masterToken: string,
  player: Player,
): Promise<void> {
  if (!client || !player.dbId) return;

  const { error } = await client.rpc("delete_player_profile", {
    p_game_code: gameCode,
    p_master_token: masterToken,
    p_player_id: player.dbId,
  });

  if (error) throw new Error(error.message);
}

export async function resetGameSessionRemotely(
  client: Client | null,
  gameCode: string,
  masterToken: string,
): Promise<void> {
  if (!client) return;

  const { error } = await client.rpc("reset_game_session", {
    p_game_code: gameCode,
    p_master_token: masterToken,
  });

  if (error) throw new Error(error.message);
}

export async function saveProfile(client: Client | null, player: Player): Promise<void> {
  if (!client || !player.dbId) return;

  if (player.evolution) {
    const rpc = await client.rpc("set_player_evolution", {
      p_player_id: player.dbId,
      p_evolution: player.evolution,
    });

    if (!isMissingRpcError(rpc.error)) {
      if (rpc.error) throw new Error(rpc.error.message);
      return;
    }
  }

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
): Promise<boolean> {
  if (!client || !player.dbId) return true;

  const rpc = await client.rpc("record_question_shown", {
    p_player_id: player.dbId,
    p_station_id: stationId,
    p_question_key: key,
  });

  if (!isMissingRpcError(rpc.error)) {
    if (rpc.error?.code === "23505") return false;
    if (rpc.error) throw new Error(rpc.error.message);
    return true;
  }

  const { error } = await client.from("question_history").insert({
    player_id: player.dbId,
    station_id: stationId,
    question_key: key,
  });

  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }

  if (error?.code === "23505") return false;
  return true;
}

export async function recordQuestionAnswer(
  client: Client | null,
  player: Player,
  key: string,
  selectedAnswer: number,
  isCorrect: boolean,
): Promise<void> {
  if (!client || !player.dbId) return;

  const rpc = await client.rpc("record_question_answer", {
    p_player_id: player.dbId,
    p_question_key: key,
    p_selected_answer: selectedAnswer,
    p_is_correct: isCorrect,
  });

  if (!isMissingRpcError(rpc.error)) {
    if (rpc.error) throw new Error(rpc.error.message);
    return;
  }

  const { error } = await client
    .from("question_history")
    .update({
      selected_answer: selectedAnswer,
      is_correct: isCorrect,
    })
    .eq("player_id", player.dbId)
    .eq("question_key", key);

  if (error) throw new Error(error.message);
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

export async function completeTeamStationRemotely(
  client: Client | null,
  playerOne: Player,
  playerTwo: Player,
  stationId: string,
  rewardTokens: number,
  playerOneCapture: Capture,
  playerTwoCapture: Capture,
): Promise<void> {
  if (!playerOneCapture.recordId || !playerTwoCapture.recordId) return;
  if (!client || !playerOne.dbId || !playerTwo.dbId) return;

  const rpc = await client.rpc("complete_team_station", {
    p_player_one_id: playerOne.dbId,
    p_player_two_id: playerTwo.dbId,
    p_station_id: stationId,
    p_reward_tokens: rewardTokens,
    p_player_one_capture: capturePayload(playerOneCapture),
    p_player_two_capture: capturePayload(playerTwoCapture),
  });
  if (!isMissingRpcError(rpc.error)) {
    if (rpc.error) throw new Error(rpc.error.message);
    return;
  }

  const playerOneXp = playerOne.xp + 25;
  const playerTwoXp = playerTwo.xp + 25;
  await completeStationRemotely(client, playerOne, stationId, rewardTokens, playerOneCapture, playerOneXp, Math.floor(playerOneXp / 100) + 1);
  await completeStationRemotely(client, playerTwo, stationId, rewardTokens, playerTwoCapture, playerTwoXp, Math.floor(playerTwoXp / 100) + 1);
}

export async function recordWildCaptureRemotely(
  client: Client | null,
  player: Player,
  capture: Capture,
  xp: number,
  level: number,
): Promise<void> {
  if (!client || !player.dbId || !capture.recordId) return;

  const rpc = await client.rpc("record_wild_capture", {
    p_player_id: player.dbId,
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

  const [{ error: profileError }, captureResult] = await Promise.all([
    client
      .from("profiles")
      .update({
        xp,
        level,
        updated_at: new Date().toISOString(),
      })
      .eq("id", player.dbId),
    client
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
      ),
  ]);

  if (profileError) throw new Error(profileError.message);
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
    if (isAwardResult(rpc.data) && rpc.data.awarded === false) return false;
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

export async function resolveArenaMatchRemotely(
  client: Client | null,
  playerOne: Player,
  playerTwo: Player,
  stationId: string | null,
  challenge: string,
  winner: Player,
  loser: Player,
  rewardTokens: number,
): Promise<boolean> {
  if (!client || !playerOne.dbId || !playerTwo.dbId || !winner.dbId || !loser.dbId) return true;

  const rpc = await client.rpc("resolve_arena_match", {
    p_player_one_id: playerOne.dbId,
    p_player_two_id: playerTwo.dbId,
    p_station_id: stationId,
    p_challenge: challenge,
    p_winner_player_id: winner.dbId,
    p_loser_player_id: loser.dbId,
    p_reward_tokens: rewardTokens,
  });

  if (!rpc.error) {
    if (isAwardResult(rpc.data) && rpc.data.awarded === false) return false;
    return true;
  }

  const payload = {
    player_one_id: playerOne.dbId,
    player_two_id: playerTwo.dbId,
    station_id: stationId,
    challenge,
    reward_tokens: rewardTokens,
    winner_player_id: winner.dbId,
    loser_player_id: loser.dbId,
    resolved_at: new Date().toISOString(),
  };

  const matchResult = stationId
    ? await client
        .from("arena_matches")
        .upsert(payload, { onConflict: "player_one_id,station_id", ignoreDuplicates: true })
        .select("id")
        .maybeSingle()
    : await client.from("arena_matches").insert(payload).select("id").maybeSingle();

  if (matchResult.error) {
    if (!isSchemaMismatchError(matchResult.error)) throw new Error(matchResult.error.message);
    const legacyResult = await client
      .from("arena_matches")
      .insert({
        player_one_id: playerOne.dbId,
        player_two_id: playerTwo.dbId,
        challenge,
        reward_tokens: rewardTokens,
      })
      .select("id")
      .maybeSingle();
    if (legacyResult.error) throw new Error(legacyResult.error.message);
    if (!legacyResult.data) return false;
  } else if (!matchResult.data) {
    return false;
  }

  const [{ error: winnerError }, { error: loserError }] = await Promise.all([
    client
      .from("profiles")
      .update({ tokens: winner.tokens + rewardTokens, updated_at: new Date().toISOString() })
      .eq("id", winner.dbId),
    client
      .from("profiles")
      .update({ energy: 0, updated_at: new Date().toISOString() })
      .eq("id", loser.dbId),
  ]);

  if (winnerError) throw new Error(winnerError.message);
  if (loserError) throw new Error(loserError.message);
  return true;
}

export async function createTeamInvite(
  client: Client | null,
  fromPlayerId: string | undefined,
  toPlayerId: string | undefined,
  stationId: string | null,
): Promise<void> {
  if (!client || !fromPlayerId || !toPlayerId) return;

  const rpc = await client.rpc("create_team_invite", {
    p_from_player_id: fromPlayerId,
    p_to_player_id: toPlayerId,
    p_station_id: stationId,
  });

  if (!isMissingRpcError(rpc.error)) {
    if (rpc.error) throw new Error(rpc.error.message);
    return;
  }

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

async function loadSnapshotViaRpc(client: Client, gameCode: string): Promise<SnapshotRows | null> {
  const { data, error } = await client.rpc("get_game_snapshot", {
    p_game_code: gameCode,
  });

  if (isMissingRpcError(error)) return null;
  if (error) throw new Error(error.message);

  return {
    profiles: jsonArray<ProfileRow>(data, "profiles"),
    game_progress: jsonArray<ProgressRow>(data, "game_progress"),
    captures: jsonArray<CaptureRow>(data, "captures"),
    arena_matches: jsonArray<ArenaMatchRow>(data, "arena_matches"),
    redemptions: jsonArray<RedemptionRow>(data, "redemptions"),
    question_history: jsonArray<QuestionHistoryRow>(data, "question_history"),
    team_invites: jsonArray<TeamInviteRow>(data, "team_invites"),
    final_rewards: jsonArray<FinalRewardRow>(data, "final_rewards"),
  };
}

function jsonArray<T>(payload: unknown, key: string): T[] {
  if (!isRecord(payload)) return [];
  const value = payload[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

function isProfileRow(value: unknown): value is ProfileRow {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.player_code === "string" &&
    typeof value.display_name === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isMenuItem(value: unknown): value is MenuItem {
  return isRecord(value) && typeof value.label === "string" && typeof value.cost === "number" && value.cost >= 0;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function capturePayload(capture: Capture): Database["public"]["Functions"]["complete_team_station"]["Args"]["p_player_one_capture"] {
  return {
    id: capture.recordId!,
    pokemon_id: capture.id,
    pokemon_name: capture.name,
    rarity: capture.rarity,
    sprite_id: capture.sprite,
    token_value: capture.value,
  };
}

function isMissingRpcError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  return error.code === "PGRST202" || Boolean(error.message?.toLowerCase().includes("could not find the function"));
}

function isAwardResult(value: unknown): value is { awarded: boolean } {
  return Boolean(value && typeof value === "object" && "awarded" in value);
}

function isFinalResult(value: unknown): value is { awarded: boolean; reward: string } {
  return Boolean(
    value && typeof value === "object" && "awarded" in value && "reward" in value,
  );
}

function isMasterClaimResult(value: unknown): value is { claimed: boolean; masterToken?: string } {
  return Boolean(value && typeof value === "object" && "claimed" in value);
}

function isMasterLoginResult(value: unknown): value is { gameCode: string; masterToken: string } {
  return isRecord(value) && typeof value.gameCode === "string" && typeof value.masterToken === "string";
}

function isMissingRelationError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "42P01" || error.code === "PGRST205" || message.includes("final_rewards");
}

function isSchemaMismatchError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST204" ||
    error.code === "42P10" ||
    message.includes("station_id") ||
    message.includes("loser_player_id") ||
    message.includes("resolved_at") ||
    message.includes("on conflict") ||
    message.includes("unique or exclusion constraint")
  );
}
