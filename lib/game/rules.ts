export const TEST_MODE = false;

export const ACCESS_CODE = "8128";

export const GAME_OPENS_AT = new Date("2026-08-29T17:00:00+02:00").getTime();

export const REWARDS = {
  trainer: 2,
  rocket: 3,
  arena: 2,
} as const;

export const STORAGE_KEYS = {
  activePlayer: "liga27-active-player",
  localPlayers: "liga27-players-local",
} as const;

export const REQUIRED_QR_COUNT = 12;
