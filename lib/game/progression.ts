import type { Achievement, Capture, Player, Station } from "./types";

export const FINAL_REWARDS = [
  "Ración extra de pollo",
  "Longaniza de campeón",
  "Costillas legendarias",
  "Elección prioritaria de la BBQ",
] as const;

const pokemonTypes: Record<string, string> = {
  "1": "Planta", "4": "Fuego", "6": "Fuego", "7": "Agua", "25": "Eléctrico",
  "37": "Fuego", "39": "Hada", "50": "Tierra", "52": "Normal", "54": "Agua",
  "58": "Fuego", "63": "Psíquico", "66": "Lucha", "74": "Roca", "77": "Fuego",
  "79": "Agua", "81": "Eléctrico", "92": "Fantasma", "94": "Fantasma", "95": "Roca",
  "104": "Tierra", "123": "Bicho", "125": "Eléctrico", "126": "Fuego", "129": "Agua",
  "130": "Agua", "131": "Agua", "133": "Normal", "143": "Normal", "144": "Hielo",
  "145": "Eléctrico", "146": "Fuego", "149": "Dragón", "150": "Psíquico", "151": "Psíquico",
  "152": "Planta", "155": "Fuego", "158": "Agua", "172": "Eléctrico", "175": "Hada",
  "183": "Agua", "196": "Psíquico", "197": "Siniestro", "212": "Acero", "214": "Bicho",
  "229": "Siniestro", "248": "Roca", "249": "Psíquico", "250": "Fuego", "254": "Planta",
  "257": "Fuego", "260": "Agua", "282": "Psíquico", "359": "Siniestro", "373": "Dragón",
  "384": "Dragón", "445": "Dragón", "448": "Lucha", "483": "Acero", "484": "Agua",
  "487": "Fantasma", "643": "Fuego", "644": "Eléctrico", "700": "Hada", "716": "Hada",
  "717": "Siniestro", "888": "Hada",
};

export const gymPresentation: Record<string, { rival: number; trainer: string; intro: string }> = {
  "trainer-1": { rival: 95, trainer: "brock", intro: "La roca no cede ante nadie." },
  "trainer-2": { rival: 121, trainer: "misty", intro: "El agua siempre encuentra un camino." },
  "trainer-3": { rival: 26, trainer: "ltsurge", intro: "Prepárate para una descarga de verdad." },
  "trainer-4": { rival: 45, trainer: "erika", intro: "La calma también puede ser peligrosa." },
  "trainer-5": { rival: 110, trainer: "koga", intro: "No podrás anticipar mi siguiente movimiento." },
  "trainer-6": { rival: 65, trainer: "sabrina", intro: "Ya he visto cómo termina este combate." },
  "trainer-7": { rival: 59, trainer: "blaine", intro: "¡Este gimnasio está al rojo vivo!" },
  "trainer-8": { rival: 112, trainer: "giovanni", intro: "Demuestra que mereces llegar a la Liga." },
};

export function getCaptureType(capture: Capture): string {
  return pokemonTypes[String(capture.id)] ?? "Misterio";
}

export function getCollectionBadges(captures: Capture[]): string[] {
  const counts = captures.reduce<Record<string, number>>((result, capture) => {
    const type = getCaptureType(capture);
    result[type] = (result[type] ?? 0) + 1;
    return result;
  }, {});
  return Object.entries(counts).filter(([, count]) => count >= 3).map(([type]) => `Maestría ${type}`);
}

export function getAchievements(player: Player): Achievement[] {
  const arenaWins = (player.arenaHistory ?? []).filter((match) => match.winnerId === player.dbId).length;
  return [
    { id: "first-step", title: "Primer paso", description: "Supera tu primer QR", unlocked: player.route.length >= 1 },
    { id: "collector", title: "Coleccionista", description: "Conserva 6 Pokémon", unlocked: player.captures.length >= 6 },
    { id: "legend", title: "Encuentro legendario", description: "Captura un Pokémon legendario", unlocked: player.captures.some((capture) => capture.rarity === "Legendario") },
    { id: "survivor", title: "Superviviente", description: "Sigue en ruta con 25% de energía o menos", unlocked: player.route.length > 0 && player.energy > 0 && player.energy <= 25 },
    { id: "arena", title: "Leyenda de Arena", description: "Gana una Arena de Payá", unlocked: arenaWins > 0 },
    { id: "flawless", title: "Mente perfecta", description: "Consigue 6 aciertos sin fallos registrados", unlocked: (player.correctAnswers ?? 0) >= 6 && (player.wrongAnswers ?? 0) === 0 },
    { id: "league", title: "Campeón de la Terraza", description: "Conquista el Alto Mando", unlocked: Boolean(player.finalReward) },
  ];
}

export function getStationPresentation(station: Station) {
  if (station.kind === "rocket") {
    return { rival: 52, trainer: "teamrocketgrunt", intro: "¡El Team Rocket vuelve a hacer de las suyas!" };
  }
  return gymPresentation[station.id] ?? { rival: 25, trainer: "red", intro: "¡Un entrenador quiere combatir!" };
}
