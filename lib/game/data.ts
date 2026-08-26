import type { Capture, Eeveelution, MenuItem, Player, Question, Station } from "./types";
import { REWARDS } from "./rules";

export const playerNames = [
  "Eduardo",
  "Karim",
  "Carlos de la Fuente",
  "Cristian",
  "Nicole",
  "Ros",
  "María Santana",
  "María Alfonso",
  "Lola",
  "Ismael",
  "Marco",
  "Alex",
  "María Loufoukou",
] as const;

export const defaultPlayers: Player[] = [
  {
    id: "alejandro",
    name: "Alejandro",
    level: 1,
    xp: 20,
    energy: 100,
    tokens: 0,
    route: [],
    captures: [],
    arenaEvents: [],
    questionHistory: [],
  },
  ...playerNames.map((name, index) => ({
    id: `jugador-${index + 1}`,
    name,
    level: 1,
    xp: 0,
    energy: 100,
    tokens: 0,
    route: [],
    captures: [],
    arenaEvents: [],
    questionHistory: [],
  })),
];

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
  { name: "Flareon", type: "Fuego", perk: "Un segundo intento una vez por combate", image: "136" },
  { name: "Vaporeon", type: "Agua", perk: "Recuperación extra en Centro Pokémon", image: "134" },
  { name: "Jolteon", type: "Eléctrico", perk: "Pista rápida en códigos", image: "135" },
  { name: "Espeon", type: "Psíquico", perk: "Pista en lógica y deducción", image: "196" },
  { name: "Umbreon", type: "Siniestro", perk: "Menor pérdida de energía al fallar", image: "197" },
  { name: "Leafeon", type: "Planta", perk: "Pista en retos visuales", image: "470" },
  { name: "Glaceon", type: "Hielo", perk: "Descarta una respuesta errónea", image: "471" },
  { name: "Sylveon", type: "Hada", perk: "Ventaja especial en Team Rocket", image: "700" },
];

export const questions: Question[] = [
  { tier: 1, prompt: "¿Qué número falta? 3 · 8 · 15 · 24 · ?", options: ["32", "33", "35", "37"], answer: 2, label: "Golpe patrón" },
  { tier: 1, prompt: "Todos los flanes son postres. Algunos postres son fríos. ¿Qué podemos asegurar?", options: ["Todos los flanes son fríos", "Algunos flanes son fríos", "Los flanes son postres", "Nada"], answer: 2, label: "Lectura precisa" },
  { tier: 1, prompt: "En el código César, retroceder 3 letras convierte 'FDVD' en…", options: ["CASA", "CAMA", "DADA", "BABA"], answer: 0, label: "Descifrado" },
  { tier: 2, prompt: "Un reloj marca las 15:15. ¿Qué ángulo menor forman sus agujas?", options: ["0°", "7,5°", "15°", "30°"], answer: 1, label: "Cálculo fino" },
  { tier: 2, prompt: "Ana llega antes que Bruno. Bruno antes que Carla. Diego llega antes que Ana. ¿Quién llega primero?", options: ["Ana", "Bruno", "Carla", "Diego"], answer: 3, label: "Ruta lógica" },
  { tier: 2, prompt: "Tienes 8 bolas idénticas; una pesa más. Con una balanza, ¿cuántas pesadas bastan como mínimo?", options: ["1", "2", "3", "4"], answer: 1, label: "Estrategia" },
  { tier: 3, prompt: "Hay tres cajas: 'rojas', 'azules' y 'mezcladas'. Todas las etiquetas son falsas. Sacas una ficha de una caja. ¿De cuál debes sacar para deducirlo todo?", options: ["Rojas", "Azules", "Mezcladas", "Da igual"], answer: 2, label: "Deducción" },
  { tier: 3, prompt: "Un padre tiene cuatro hijas; cada hija tiene un hermano. ¿Cuántos hijos tiene en total?", options: ["4", "5", "8", "9"], answer: 1, label: "Trampa limpia" },
  { tier: 3, prompt: "Dos cuerdas tardan una hora en consumirse, de manera irregular. ¿Cómo mides 45 minutos?", options: ["Cortando una en cuatro", "Encendiendo ambas por un extremo", "Una por ambos extremos y la otra por un extremo; al acabar la primera, enciendes el otro extremo de la segunda", "No se puede"], answer: 2, label: "Plan maestro" },
  { tier: 4, prompt: "Solo una afirmación es cierta. A: 'B miente'. B: 'C miente'. C: 'A y B mienten'. ¿Quién dice la verdad?", options: ["A", "B", "C", "Nadie"], answer: 1, label: "Lógica élite" },
  { tier: 4, prompt: "En ajedrez, si tu rey está en jaque, ¿cuál de estas NO es una respuesta legal?", options: ["Mover el rey", "Capturar la pieza atacante", "Bloquear el ataque si es una línea", "Hacer jaque al rey rival ignorando el tuyo"], answer: 3, label: "Defensa real" },
  { tier: 4, prompt: "Cuatro personas cruzan un puente de noche en 1, 2, 7 y 10 minutos. Solo caben dos y hay una linterna. ¿Tiempo mínimo?", options: ["17", "19", "20", "21"], answer: 0, label: "Estrategia élite" },
];

export const menu: MenuItem[] = [
  { label: "Cerveza", cost: 2 },
  { label: "Chupito", cost: 3 },
  { label: "Cubata", cost: 6 },
  { label: "Extra de barbacoa", cost: 4 },
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
];
