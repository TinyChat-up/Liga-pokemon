export type Evolution =
  | "Flareon"
  | "Vaporeon"
  | "Jolteon"
  | "Espeon"
  | "Umbreon"
  | "Leafeon"
  | "Glaceon"
  | "Sylveon";

export type Rarity = "Normal" | "Especial" | "Legendario";

export type Capture = {
  id: number;
  name: string;
  rarity: Rarity;
  sprite: string;
  value: number;
  recordId?: string;
};

export type Player = {
  id: string;
  dbId?: string;
  name: string;
  evolution?: Evolution;
  level: number;
  xp: number;
  energy: number;
  tokens: number;
  route: string[];
  captures: Capture[];
  arenaEvents: string[];
  questionHistory?: string[];
  evolvedShown?: boolean;
};

export type StationKind = "trainer" | "rocket";

export type Station = {
  id: string;
  title: string;
  kind: StationKind;
  area: string;
  reward: number;
  color: string;
};

export type Question = {
  tier: 1 | 2 | 3 | 4;
  prompt: string;
  options: [string, string, string, string];
  answer: number;
  label: string;
};

export type Eeveelution = {
  name: Evolution;
  type: string;
  perk: string;
  image: string;
};

export type MenuItem = {
  label: string;
  cost: number;
};

export type GameScreen =
  | "select"
  | "partner"
  | "waiting"
  | "evolution"
  | "home"
  | "pokedex"
  | "route"
  | "scan"
  | "arena"
  | "team"
  | "admin";
