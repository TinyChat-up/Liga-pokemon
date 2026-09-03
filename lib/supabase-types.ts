import type { Evolution, Rarity } from "./game/types";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          game_code: string;
          player_code: string;
          display_name: string;
          evolution: Evolution | null;
          level: number;
          xp: number;
          energy: number;
          tokens: number;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          game_code: string;
          player_code: string;
          display_name: string;
          evolution?: Evolution | null;
          level?: number;
          xp?: number;
          energy?: number;
          tokens?: number;
          updated_at?: string | null;
        };
        Update: {
          game_code?: string;
          evolution?: Evolution | null;
          level?: number;
          xp?: number;
          energy?: number;
          tokens?: number;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      game_sessions: {
        Row: {
          game_code: string;
          master_token: string;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          game_code: string;
          master_token: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          master_token?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      game_progress: {
        Row: {
          id: string;
          player_id: string;
          station_id: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          player_id: string;
          station_id: string;
          completed_at?: string | null;
        };
        Update: {
          completed_at?: string | null;
        };
        Relationships: [];
      };
      captures: {
        Row: {
          id: string;
          player_id: string;
          pokemon_id: number;
          pokemon_name: string;
          rarity: Rarity;
          sprite_id: string;
          token_value: number;
          redeemed_at: string | null;
        };
        Insert: {
          id?: string;
          player_id: string;
          pokemon_id: number;
          pokemon_name: string;
          rarity: Rarity;
          sprite_id: string;
          token_value: number;
          redeemed_at?: string | null;
        };
        Update: {
          redeemed_at?: string | null;
        };
        Relationships: [];
      };
      team_invites: {
        Row: {
          id: string;
          from_player_id: string;
          to_player_id: string;
          station_id: string | null;
          status: "pending" | "accepted" | "declined" | "cancelled";
          created_at: string | null;
        };
        Insert: {
          id?: string;
          from_player_id: string;
          to_player_id: string;
          station_id?: string | null;
          status?: "pending" | "accepted" | "declined" | "cancelled";
          created_at?: string | null;
        };
        Update: {
          status?: "pending" | "accepted" | "declined" | "cancelled";
        };
        Relationships: [];
      };
      arena_matches: {
        Row: {
          id: string;
          player_one_id: string;
          player_two_id: string;
          station_id: string | null;
          challenge: string;
          reward_tokens: number;
          winner_player_id: string | null;
          loser_player_id: string | null;
          created_at: string | null;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          player_one_id: string;
          player_two_id: string;
          station_id?: string | null;
          challenge: string;
          reward_tokens: number;
          winner_player_id?: string | null;
          loser_player_id?: string | null;
          created_at?: string | null;
          resolved_at?: string | null;
        };
        Update: {
          station_id?: string | null;
          winner_player_id?: string | null;
          loser_player_id?: string | null;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      redemptions: {
        Row: {
          id: string;
          player_id: string;
          item_name: string;
          token_cost: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          player_id: string;
          item_name: string;
          token_cost: number;
          created_at?: string | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      question_history: {
        Row: {
          id: string;
          player_id: string;
          station_id: string;
          question_key: string;
          selected_answer: number | null;
          is_correct: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          player_id: string;
          station_id: string;
          question_key: string;
          selected_answer?: number | null;
          is_correct?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          selected_answer?: number | null;
          is_correct?: boolean | null;
        };
        Relationships: [];
      };
      final_rewards: {
        Row: {
          id: string;
          player_id: string;
          reward_name: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          player_id: string;
          reward_name: string;
          completed_at?: string | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      admin_adjustments: {
        Row: {
          id: string;
          player_id: string;
          action: string;
          reason: string;
          token_delta: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          player_id: string;
          action: string;
          reason: string;
          token_delta?: number;
          created_at?: string | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      complete_station: {
        Args: {
          p_player_id: string;
          p_station_id: string;
          p_reward_tokens: number;
          p_xp: number;
          p_level: number;
          p_capture_id: string;
          p_pokemon_id: number;
          p_pokemon_name: string;
          p_rarity: Rarity;
          p_sprite_id: string;
          p_token_value: number;
        };
        Returns: Json;
      };
      redeem_capture_for_tokens: {
        Args: {
          p_capture_id: string;
        };
        Returns: Json;
      };
      spend_tokens_for_redemption: {
        Args: {
          p_player_id: string;
          p_item_name: string;
          p_token_cost: number;
        };
        Returns: Json;
      };
      resolve_arena_match: {
        Args: {
          p_player_one_id: string;
          p_player_two_id: string;
          p_station_id: string | null;
          p_challenge: string;
          p_winner_player_id: string;
          p_loser_player_id: string;
          p_reward_tokens: number;
        };
        Returns: Json;
      };
      complete_elite_four: {
        Args: {
          p_player_id: string;
          p_reward_name: string;
        };
        Returns: Json;
      };
      admin_recover_player: {
        Args: {
          p_admin_code: string;
          p_game_code?: string;
          p_master_token?: string;
          p_player_id: string;
          p_action: string;
          p_reason: string;
          p_token_delta: number;
          p_station_id: string | null;
        };
        Returns: Json;
      };
      claim_game_master: {
        Args: {
          p_game_code: string;
          p_master_token: string;
        };
        Returns: Json;
      };
      verify_game_master: {
        Args: {
          p_game_code: string;
          p_master_token: string;
        };
        Returns: Json;
      };
      delete_player_profile: {
        Args: {
          p_game_code: string;
          p_master_token: string;
          p_player_id: string;
        };
        Returns: Json;
      };
      reset_game_session: {
        Args: {
          p_game_code: string;
          p_master_token: string;
        };
        Returns: Json;
      };
      create_game_after_purchase: {
        Args: {
          p_stripe_checkout_session_id: string;
          p_stripe_payment_intent_id: string | null;
          p_amount: number;
          p_currency: string;
          p_status: string;
          p_game_code: string;
          p_join_code: string;
          p_master_token: string;
          p_buyer_email?: string | null;
        };
        Returns: Json;
      };
      get_game_snapshot: {
        Args: {
          p_game_code: string;
        };
        Returns: Json;
      };
      register_player: {
        Args: {
          p_game_code: string;
          p_display_name: string;
          p_player_code: string;
          p_session_token: string;
        };
        Returns: Json;
      };
      set_player_evolution: {
        Args: {
          p_player_id: string;
          p_evolution: string;
        };
        Returns: Json;
      };
      record_question_shown: {
        Args: {
          p_player_id: string;
          p_station_id: string;
          p_question_key: string;
        };
        Returns: Json;
      };
      record_question_answer: {
        Args: {
          p_player_id: string;
          p_question_key: string;
          p_selected_answer: number;
          p_is_correct: boolean;
        };
        Returns: Json;
      };
      create_team_invite: {
        Args: {
          p_from_player_id: string;
          p_to_player_id: string;
          p_station_id: string | null;
        };
        Returns: Json;
      };
      respond_team_invite: {
        Args: {
          p_invite_id: string;
          p_status: "accepted" | "declined" | "cancelled";
        };
        Returns: Json;
      };
      complete_team_station: {
        Args: {
          p_player_one_id: string;
          p_player_two_id: string;
          p_station_id: string;
          p_reward_tokens: number;
          p_player_one_capture: Json;
          p_player_two_capture: Json;
        };
        Returns: Json;
      };
      record_wild_capture: {
        Args: {
          p_player_id: string;
          p_xp: number;
          p_level: number;
          p_capture_id: string;
          p_pokemon_id: number;
          p_pokemon_name: string;
          p_rarity: Rarity;
          p_sprite_id: string;
          p_token_value: number;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
