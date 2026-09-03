export const TEST_MODE = false;

export const GAME_OPENS_AT = new Date("2026-08-29T17:00:00+02:00").getTime();

export const REWARDS = {
  trainer: 2,
  rocket: 3,
  arena: 2,
} as const;

export const STORAGE_KEYS = {
  activePlayer: "qrquest-active-player",
  activeGameCode: "qrquest-active-game-code",
  masterTokenPrefix: "qrquest-master-token:",
  localPlayers: "qrquest-players-local",
  lastWildEncounter: "qrquest-last-wild-encounter",
} as const;

export const REQUIRED_QR_COUNT = 12;

export const WILD_ENCOUNTER_DELAY_MS = 4 * 60 * 1000;

export const GAME_CODE_MIN_LENGTH = 4;

export function normalizeGameCode(value: string): string {
  return value.trim().replace(/\s+/g, "-").toLowerCase();
}
