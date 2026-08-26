import type { Evolution, Rarity } from "./game/types";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
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
          evolution?: Evolution | null;
          level?: number;
          xp?: number;
          energy?: number;
          tokens?: number;
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
          challenge: string;
          reward_tokens: number;
          winner_player_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          player_one_id: string;
          player_two_id: string;
          challenge: string;
          reward_tokens: number;
          winner_player_id?: string | null;
          created_at?: string | null;
        };
        Update: {
          winner_player_id?: string | null;
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
          created_at: string | null;
        };
        Insert: {
          id?: string;
          player_id: string;
          station_id: string;
          question_key: string;
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
