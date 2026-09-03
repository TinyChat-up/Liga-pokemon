import type { Capture, Eeveelution, MenuItem, Player, Station } from "./types";
import { REWARDS } from "./rules";
export { QUESTION_BANK as questions } from "./question-bank";

export const defaultPlayers: Player[] = [];

export function createDefaultPlayer(name: string, id: string, dbId?: string, gameCode?: string): Player {
  return {
    id,
    dbId,
    gameCode,
    name,
    level: 1,
    xp: 0,
    energy: 100,
    tokens: 0,
    route: [],
    captures: [],
    arenaEvents: [],
    questionHistory: [],
  };
}

export const stations: Station[] = [
  ...[
    ["trainer-1", "Ciudad Plateada", "Gimnasio de Roca", "violet"],
    ["trainer-2", "Ciudad Celeste", "Gimnasio de Agua", "orange"],
    ["trainer-3", "Ciudad Carmín", "Gimnasio Eléctrico", "mint"],
    ["trainer-4", "Ciudad Azulona", "Gimnasio de Planta", "blue"],
    ["trainer-5", "Ciudad Fucsia", "Gimnasio de Veneno", "pink"],
    ["trainer-6", "Ciudad Azafrán", "Gimnasio Psíquico", "yellow"],
    ["trainer-7", "Isla Canela", "Gimnasio de Fuego", "violet"],
    ["trainer-8", "Ciudad Verde", "Gimnasio de Tierra", "orange"],
  ].map(([id, title, area, color]) => ({
    id,
    title,
    kind: "trainer" as const,
    area,
    reward: REWARDS.trainer,
    color,
  })),
  ...[
    ["rocket-1", "Monte Moon", "Guarida Team Rocket"],
    ["rocket-2", "Casino Rocket", "Guarida Team Rocket"],
    ["rocket-3", "Silph S.A.", "Guarida Team Rocket"],
    ["rocket-4", "Ruta Victoria", "Guarida Team Rocket"],
  ].map(([id, title, area]) => ({
    id,
    title,
    kind: "rocket" as const,
    area,
    reward: REWARDS.rocket,
    color: "red",
  })),
];

export const eeveelutions: Eeveelution[] = [
  { name: "Flareon", type: "Fuego", perk: "El primer fallo de cada combate no quita energía", image: "136" },
  { name: "Vaporeon", type: "Agua", perk: "El Centro Pokémon cuesta 1 token menos", image: "134" },
  { name: "Jolteon", type: "Eléctrico", perk: "+1 token al vencer a un entrenador", image: "135" },
  { name: "Espeon", type: "Psíquico", perk: "Comprueba una respuesta por combate antes de atacar", image: "196" },
  { name: "Umbreon", type: "Siniestro", perk: "Cada fallo quita 25% de energía en vez de 50%", image: "197" },
  { name: "Leafeon", type: "Planta", perk: "Más probabilidad de capturas especiales y legendarias", image: "470" },
  { name: "Glaceon", type: "Hielo", perk: "Bloquea una respuesta incorrecta en cada combate", image: "471" },
  { name: "Sylveon", type: "Hada", perk: "+1 token al vencer al Team Rocket", image: "700" },
];

export const menu: MenuItem[] = [
  { label: "Cerveza", cost: 2 },
  { label: "Cubata", cost: 4 },
  { label: "Agua", cost: 1 },
  { label: "Chupito", cost: 2 },
  { label: "Ruleta sorpresa", cost: 5 },
];

export const journeyIds = [
  "trainer-1",
  "rocket-1",
  "trainer-2",
  "trainer-3",
  "trainer-4",
  "rocket-2",
  "trainer-5",
  "trainer-6",
  "rocket-3",
  "trainer-7",
  "trainer-8",
  "rocket-4",
] as const;

export const payaStops = ["trainer-2", "trainer-5", "trainer-7"] as const;

export const arenaChallenges = [
  "Karaoke",
  "Farmeo de aura",
  "Pulso de dedos",
  "Concurso de chupitos",
  "Cata de cerveza o vino",
  "Chiste malo",
  "Venta imposible",
  "Imitación",
] as const;

export const dexPool: Capture[] = [
  { id: 25, name: "Pikachu", rarity: "Normal", sprite: "25", value: 1 },
  { id: 4, name: "Charmander", rarity: "Normal", sprite: "4", value: 1 },
  { id: 7, name: "Squirtle", rarity: "Normal", sprite: "7", value: 1 },
  { id: 1, name: "Bulbasaur", rarity: "Normal", sprite: "1", value: 1 },
  { id: 133, name: "Eevee", rarity: "Normal", sprite: "133", value: 1 },
  { id: 52, name: "Meowth", rarity: "Normal", sprite: "52", value: 1 },
  { id: 143, name: "Snorlax", rarity: "Especial", sprite: "143", value: 2 },
  { id: 94, name: "Gengar", rarity: "Especial", sprite: "94", value: 2 },
  { id: 149, name: "Dragonite", rarity: "Especial", sprite: "149", value: 2 },
  { id: 6, name: "Charizard", rarity: "Especial", sprite: "6", value: 2 },
  { id: 150, name: "Mewtwo", rarity: "Legendario", sprite: "150", value: 4 },
  { id: 151, name: "Mew", rarity: "Legendario", sprite: "151", value: 4 },
  { id: 144, name: "Articuno", rarity: "Legendario", sprite: "144", value: 4 },
  { id: 145, name: "Zapdos", rarity: "Legendario", sprite: "145", value: 4 },
  { id: 146, name: "Moltres", rarity: "Legendario", sprite: "146", value: 4 },
  { id: 39, name: "Jigglypuff", rarity: "Normal", sprite: "39", value: 1 },
  { id: 54, name: "Psyduck", rarity: "Normal", sprite: "54", value: 1 },
  { id: 58, name: "Growlithe", rarity: "Normal", sprite: "58", value: 1 },
  { id: 63, name: "Abra", rarity: "Normal", sprite: "63", value: 1 },
  { id: 66, name: "Machop", rarity: "Normal", sprite: "66", value: 1 },
  { id: 92, name: "Gastly", rarity: "Normal", sprite: "92", value: 1 },
  { id: 95, name: "Onix", rarity: "Normal", sprite: "95", value: 1 },
  { id: 131, name: "Lapras", rarity: "Especial", sprite: "131", value: 2 },
  { id: 130, name: "Gyarados", rarity: "Especial", sprite: "130", value: 2 },
  { id: 448, name: "Lucario", rarity: "Especial", sprite: "448", value: 2 },
  { id: 282, name: "Gardevoir", rarity: "Especial", sprite: "282", value: 2 },
  { id: 359, name: "Absol", rarity: "Especial", sprite: "359", value: 2 },
  { id: 384, name: "Rayquaza", rarity: "Legendario", sprite: "384", value: 4 },
  { id: 249, name: "Lugia", rarity: "Legendario", sprite: "249", value: 4 },
  { id: 250, name: "Ho-Oh", rarity: "Legendario", sprite: "250", value: 4 },
  { id: 37, name: "Vulpix", rarity: "Normal", sprite: "37", value: 1 },
  { id: 50, name: "Diglett", rarity: "Normal", sprite: "50", value: 1 },
  { id: 74, name: "Geodude", rarity: "Normal", sprite: "74", value: 1 },
  { id: 77, name: "Ponyta", rarity: "Normal", sprite: "77", value: 1 },
  { id: 79, name: "Slowpoke", rarity: "Normal", sprite: "79", value: 1 },
  { id: 81, name: "Magnemite", rarity: "Normal", sprite: "81", value: 1 },
  { id: 104, name: "Cubone", rarity: "Normal", sprite: "104", value: 1 },
  { id: 123, name: "Scyther", rarity: "Normal", sprite: "123", value: 1 },
  { id: 125, name: "Electabuzz", rarity: "Normal", sprite: "125", value: 1 },
  { id: 126, name: "Magmar", rarity: "Normal", sprite: "126", value: 1 },
  { id: 129, name: "Magikarp", rarity: "Normal", sprite: "129", value: 1 },
  { id: 152, name: "Chikorita", rarity: "Normal", sprite: "152", value: 1 },
  { id: 155, name: "Cyndaquil", rarity: "Normal", sprite: "155", value: 1 },
  { id: 158, name: "Totodile", rarity: "Normal", sprite: "158", value: 1 },
  { id: 172, name: "Pichu", rarity: "Normal", sprite: "172", value: 1 },
  { id: 175, name: "Togepi", rarity: "Normal", sprite: "175", value: 1 },
  { id: 183, name: "Marill", rarity: "Normal", sprite: "183", value: 1 },
  { id: 196, name: "Espeon", rarity: "Especial", sprite: "196", value: 2 },
  { id: 197, name: "Umbreon", rarity: "Especial", sprite: "197", value: 2 },
  { id: 212, name: "Scizor", rarity: "Especial", sprite: "212", value: 2 },
  { id: 214, name: "Heracross", rarity: "Especial", sprite: "214", value: 2 },
  { id: 229, name: "Houndoom", rarity: "Especial", sprite: "229", value: 2 },
  { id: 248, name: "Tyranitar", rarity: "Especial", sprite: "248", value: 2 },
  { id: 254, name: "Sceptile", rarity: "Especial", sprite: "254", value: 2 },
  { id: 257, name: "Blaziken", rarity: "Especial", sprite: "257", value: 2 },
  { id: 260, name: "Swampert", rarity: "Especial", sprite: "260", value: 2 },
  { id: 373, name: "Salamence", rarity: "Especial", sprite: "373", value: 2 },
  { id: 445, name: "Garchomp", rarity: "Especial", sprite: "445", value: 2 },
  { id: 483, name: "Dialga", rarity: "Legendario", sprite: "483", value: 4 },
  { id: 484, name: "Palkia", rarity: "Legendario", sprite: "484", value: 4 },
  { id: 487, name: "Giratina", rarity: "Legendario", sprite: "487", value: 4 },
  { id: 643, name: "Reshiram", rarity: "Legendario", sprite: "643", value: 4 },
  { id: 644, name: "Zekrom", rarity: "Legendario", sprite: "644", value: 4 },
  { id: 716, name: "Xerneas", rarity: "Legendario", sprite: "716", value: 4 },
  { id: 717, name: "Yveltal", rarity: "Legendario", sprite: "717", value: 4 },
  { id: 888, name: "Zacian", rarity: "Legendario", sprite: "888", value: 4 },
];
