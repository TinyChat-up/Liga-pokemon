"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import QRCode from "qrcode";
import {
  arenaChallenges,
  createDefaultPlayer,
  defaultPlayers,
  dexPool,
  eeveelutions,
  journeyIds,
  menu,
  payaStops,
  questions,
  stations,
} from "@/lib/game/data";
import { ELITE_QUESTION_BANK } from "@/lib/game/elite-question-bank";
import {
  GAME_CODE_MIN_LENGTH,
  GAME_OPENS_AT,
  REWARDS,
  STORAGE_KEYS,
  TEST_MODE,
  WILD_ENCOUNTER_DELAY_MS,
  normalizeGameCode,
} from "@/lib/game/rules";
import type { Capture, Evolution, GameScreen, MenuItem, Player, Question, Station, TeamInviteSummary } from "@/lib/game/types";
import {
  completeStationRemotely,
  completeTeamStationRemotely,
  completeEliteFourRemotely,
  claimGameMaster,
  createPlayerProfile,
  createTeamInvite,
  deletePlayerProfileRemotely,
  loadGameSnapshot,
  loadGameSettingsRemotely,
  recordQuestionAnswer,
  recordQuestionShown,
  recordWildCaptureRemotely,
  recoverPlayerRemotely,
  redeemCaptureRemotely,
  resetGameSessionRemotely,
  respondToTeamInvite,
  resolveArenaMatchRemotely,
  saveProfile,
  spendTokensRemotely,
  updateGameSettingsRemotely,
  subscribeToGameChanges,
} from "@/lib/game/supabase-service";
import { getNextQuestion, questionKey } from "@/lib/game/questions";
import {
  getCaptureRarity,
  getFailureDamage,
  getGlaceonBlockedAnswer,
  getHealingCost,
  getStationReward,
  hasEvolutionPerk,
} from "@/lib/game/evolution-perks";
import {
  FINAL_REWARDS,
  getStationPresentation,
} from "@/lib/game/progression";
import { supabase } from "@/lib/supabase";

const eliteTrainers = [
  { name: "Aaron", title: "Alto Mando Bicho", ace: "Drapion", image: "452", trainer: "aaron" },
  { name: "Bertha", title: "Alto Mando Tierra", ace: "Hippowdon", image: "450", trainer: "bertha" },
  { name: "Flint", title: "Alto Mando Fuego", ace: "Infernape", image: "392", trainer: "flint" },
] as const;

const EMPTY_PLAYER = createDefaultPlayer("Entrenador", "sin-jugador");
const WILD_STATION_PREFIX = "wild-route-";
type AdminSection = "overview" | "players" | "center" | "shop" | "rewards" | "route";

function getMasterTokenStorageKey(gameCode: string): string {
  return `${STORAGE_KEYS.masterTokenPrefix}${gameCode}`;
}

function getActivePlayerStorageKey(gameCode: string): string {
  return `${STORAGE_KEYS.activePlayer}:${gameCode}`;
}

function extractQrCode(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return (url.searchParams.get("player") ?? url.searchParams.get("qr") ?? "").trim().toLowerCase();
  } catch {
    return raw.toLowerCase().replace(/^(player|jugador|qr)\s*[:=]\s*/, "");
  }
}

function extractGameCode(value: string): string {
  try {
    return normalizeGameCode(new URL(value.trim()).searchParams.get("game") ?? "");
  } catch {
    return "";
  }
}

function getPlayerQrValue(player: Player, gameCode: string): string {
  if (typeof window === "undefined") return `player:${player.id}`;
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  if (gameCode) url.searchParams.set("game", gameCode);
  url.searchParams.set("player", player.id);
  return url.toString();
}

function getPlayerGameLink(gameCode: string): string {
  if (typeof window === "undefined") return `/?game=${encodeURIComponent(gameCode)}&mode=player`;
  const url = new URL(window.location.href);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  url.searchParams.set("game", gameCode);
  url.searchParams.set("mode", "player");
  return url.toString();
}

function selectEliteQuestions(): Question[] {
  const shuffled = [...ELITE_QUESTION_BANK];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, 6);
}

export function LigaTerrazaGame() {
  const [players, setPlayers] = useState<Player[]>(defaultPlayers);
  const [activeGameCode, setActiveGameCode] = useState("");
  const [gameCodeInput, setGameCodeInput] = useState("");
  const [masterToken, setMasterToken] = useState("");
  const [playerOnlyMode, setPlayerOnlyMode] = useState(false);
  const [qrExpanded, setQrExpanded] = useState(false);
  const [adminSection, setAdminSection] = useState<AdminSection>("players");
  const [menuItems, setMenuItems] = useState<MenuItem[]>(menu);
  const [finalRewardItems, setFinalRewardItems] = useState<string[]>([...FINAL_REWARDS]);
  const [gameTitle, setGameTitle] = useState("QR Quest");
  const [wildDelaySeconds, setWildDelaySeconds] = useState(WILD_ENCOUNTER_DELAY_MS / 1000);
  const [routeQrImages, setRouteQrImages] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState("");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [screen, setScreen] = useState<GameScreen>("select");
  const [station, setStation] = useState<Station | null>(null);
  const [battleQuestion, setBattleQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [adminTarget, setAdminTarget] = useState("");
  const [arenaOpponent, setArenaOpponent] = useState("");
  const [arenaChallenge, setArenaChallenge] = useState("");
  const [arenaWinner, setArenaWinner] = useState("");
  const [arenaStartedAt, setArenaStartedAt] = useState<number | null>(null);
  const [battleOutcome, setBattleOutcome] = useState<"won" | "dead" | null>(null);
  const [battleCapture, setBattleCapture] = useState<Capture | null>(null);
  const [wildOpponent, setWildOpponent] = useState<Capture | null>(null);
  const [battleReward, setBattleReward] = useState(0);
  const [playerHit, setPlayerHit] = useState(false);
  const [healCost, setHealCost] = useState(0);
  const [pendingStation, setPendingStation] = useState<Station | null>(null);
  const [playerCardCode, setPlayerCardCode] = useState("");
  const [teamMate, setTeamMate] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [adminCardCode, setAdminCardCode] = useState("");
  const [queuedStationId, setQueuedStationId] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const lastScanRef = useRef({ value: "", at: 0 });
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [syncStatus, setSyncStatus] = useState<"connecting" | "online" | "local" | "error">("connecting");
  const [busyAction, setBusyAction] = useState(false);
  const [rouletteSpinning, setRouletteSpinning] = useState(false);
  const [rouletteResult, setRouletteResult] = useState("");
  const [eliteActive, setEliteActive] = useState(false);
  const [eliteIndex, setEliteIndex] = useState(0);
  const [eliteRunQuestions, setEliteRunQuestions] = useState<Question[]>([]);
  const [eliteEnemyHp, setEliteEnemyHp] = useState(100);
  const [eliteTransitioning, setEliteTransitioning] = useState(false);
  const [eliteAnswer, setEliteAnswer] = useState<number | null>(null);
  const [eliteOutcome, setEliteOutcome] = useState<"won" | "dead" | null>(null);
  const [championName, setChampionName] = useState("");
  const [battlePerkUsed, setBattlePerkUsed] = useState(false);
  const [blockedAnswer, setBlockedAnswer] = useState<number | null>(null);
  const [criticalAlert, setCriticalAlert] = useState<{
    kind: "energy" | "tokens";
    title: string;
    body: string;
  } | null>(null);
  const [teamInvites, setTeamInvites] = useState<TeamInviteSummary[]>([]);
  const [correctStreak, setCorrectStreak] = useState(0);
  const [finalSaving, setFinalSaving] = useState(false);
  const [adminReason, setAdminReason] = useState("Corrección durante el evento");
  const [qrCheckInput, setQrCheckInput] = useState("");
  const [qrCheckResult, setQrCheckResult] = useState("");
  const [playerQrImage, setPlayerQrImage] = useState("");
  const [lastWildEncounterKey, setLastWildEncounterKey] = useState("");

  function loadLocalPlayers(gameCode = activeGameCode): Player[] {
    if (typeof window === "undefined") return defaultPlayers;

    try {
      const stored = localStorage.getItem(`${STORAGE_KEYS.localPlayers}:${gameCode}`);
      if (!stored) return defaultPlayers;
      return JSON.parse(stored) as Player[];
    } catch {
      return defaultPlayers;
    }
  }

  function saveLocalPlayers(next: Player[]): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(`${STORAGE_KEYS.localPlayers}:${activeGameCode}`, JSON.stringify(next));
  }

  async function loadGame(gameCode = activeGameCode){
    if (!gameCode) {
      setPlayers([]);
      setTeamInvites([]);
      setSyncStatus("local");
      setLoaded(true);
      return;
    }

    if (!supabase) {
      setPlayers(loadLocalPlayers(gameCode));
      setMenuItems(menu);
      setFinalRewardItems([...FINAL_REWARDS]);
      setGameTitle("QR Quest");
      setHealCost(0);
      setWildDelaySeconds(WILD_ENCOUNTER_DELAY_MS / 1000);
      setSyncStatus("local");
      setLoaded(true);
      return;
    }

    try {
      const [snapshot, settings] = await Promise.all([
        loadGameSnapshot(supabase, gameCode),
        loadGameSettingsRemotely(supabase, gameCode),
      ]);
      setPlayers(snapshot.players);
      setTeamInvites(snapshot.teamInvites);
      if (settings) {
        setGameTitle(settings.title);
        setHealCost(settings.healingCost);
        setWildDelaySeconds(settings.wildDelaySeconds);
        if (settings.rewardMenu.length) setMenuItems(settings.rewardMenu);
        if (settings.finalRewards.length) setFinalRewardItems(settings.finalRewards);
      }
      setSyncStatus(snapshot.mode === "remote" ? "online" : "local");
    } catch {
      setSyncStatus("error");
      setPlayers(loadLocalPlayers(gameCode));
      setMessage("No se ha podido conectar con Supabase. Se mantiene el modo local sin guardar progreso.");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { const timer=window.setTimeout(()=>{const params=new URLSearchParams(location.search); const qr=params.get("qr")?.trim().toLowerCase(); const card=params.get("player"); const claimMaster=params.get("claimMaster")==="1"; const masterAccess=params.get("master")==="1"; const providedMasterToken=params.get("masterToken")??""; const playerMode=params.get("mode")==="player"; const game=normalizeGameCode(params.get("game")??localStorage.getItem(STORAGE_KEYS.activeGameCode)??""); if(providedMasterToken){const cleanUrl=new URL(window.location.href);cleanUrl.searchParams.delete("claimMaster");cleanUrl.searchParams.delete("masterToken");window.history.replaceState({},"",`${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);} setPlayerOnlyMode(playerMode); if(game){setActiveGameCode(game);setGameCodeInput(game);if(claimMaster){void claimMasterFromLink(game,providedMasterToken);}else{setMasterToken(playerMode?"":localStorage.getItem(getMasterTokenStorageKey(game))??"");if(masterAccess)setScreen("admin");void loadGame(game);}}else{setLoaded(true);} const found=stations.find((item)=>item.id===qr); if(found) setQueuedStationId(found.id); if(qr==="arena") setScreen("arena"); if(card) { setPlayerCardCode(card); setMessage("Tarjeta de entrenador detectada. Entra en la partida y abre la Arena o Team Rocket."); } if(qr==="alto-mando") setQueuedStationId("alto-mando");},0); return()=>{window.clearTimeout(timer);}; }, []);
  useEffect(()=>{if(!activeGameCode)return;const channel=subscribeToGameChanges(supabase,()=>{void loadGame(activeGameCode);});return()=>{if(channel&&supabase)void supabase.removeChannel(channel);};},[activeGameCode]);
  useEffect(()=>{if(!loaded||!activeId||!queuedStationId)return;const timer=window.setTimeout(()=>{const code=queuedStationId;setQueuedStationId("");if(code==="alto-mando"){startEliteFour();return;}const found=stations.find((item)=>item.id===code);if(found)void startStation(found);},0);return()=>window.clearTimeout(timer);},[loaded,activeId,queuedStationId]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
  useEffect(()=>()=>{scannerControlsRef.current?.stop();scannerControlsRef.current=null;},[]);
  const active = useMemo(()=>players.find((p)=>p.id===activeId) ?? EMPTY_PLAYER,[players,activeId]);
  const target = useMemo(()=>players.find((p)=>p.id===adminTarget) ?? players[0] ?? active,[players,adminTarget,active]);
  const incomingInvite=teamInvites.find((invite)=>invite.toPlayerId===active.dbId&&invite.status==="pending");
  const targetHealingCost=getHealingCost(target,healCost);
  const complete=active.route.length; const finalUnlocked=complete===stations.length;
  const isOpen=TEST_MODE || now>=GAME_OPENS_AT;
  const isMaster=Boolean(activeGameCode&&masterToken&&!playerOnlyMode);
  const persist=(next:Player[])=>{const changed=next.find((player)=>{const previous=players.find((item)=>item.id===player.id);return previous&&(player.evolution!==previous.evolution||player.level!==previous.level||player.xp!==previous.xp||player.energy!==previous.energy||player.tokens!==previous.tokens);});setPlayers(next);if(!supabase){saveLocalPlayers(next);return;}if(changed)void saveProfile(supabase,changed).catch(()=>setSyncStatus("error"));};
  const patchActive=(patch:Partial<Player>)=>persist(players.map((p)=>p.id===activeId?{...p,...patch}:p));
  const difficulty=Math.min(4,Math.floor(active.route.length/3)+1);
  const chosenEvolution=eeveelutions.find((item)=>item.name===active.evolution);
  const evolutionPerkActive=hasEvolutionPerk(active);
  const evolved=active.route.length>=4&&active.evolution?active.evolution:"Eevee";
  const companionImage=evolved==="Eevee"?"133":chosenEvolution?.image ?? "133";
  const arenaOpponentPlayer=players.find((p)=>p.id===arenaOpponent);
  const arenaOpponentEvolution=eeveelutions.find((item)=>item.name===arenaOpponentPlayer?.evolution);
  const arenaOpponentSprite=arenaOpponentEvolution?.image ?? "133";
  const arenaRemainingMs=arenaStartedAt?Math.max(0,600000-(now-arenaStartedAt)):600000;
  const arenaTimer=`${String(Math.floor(arenaRemainingMs/60000)).padStart(2,"0")}:${String(Math.floor((arenaRemainingMs%60000)/1000)).padStart(2,"0")}`;
  const expectedStationId=journeyIds[complete];
  const isWildBattle=Boolean(station?.id.startsWith(WILD_STATION_PREFIX));
  const battlePresentation=station?(isWildBattle&&wildOpponent?{rival:wildOpponent.id,trainer:"red",intro:`${wildOpponent.name} ha salido de la hierba alta.`}:getStationPresentation(station)):null;
  const eliteTrainerIndex=Math.min(eliteTrainers.length-1,Math.floor(eliteIndex/2));
  const eliteTrainer=eliteTrainers[eliteTrainerIndex] ?? eliteTrainers[0];
  const eliteQuestion=eliteRunQuestions[eliteIndex] ?? ELITE_QUESTION_BANK[0];
  const arenaStops = useMemo(() => {
    const seed = [...active.id].reduce((total, char) => total + char.charCodeAt(0), 0);
    const first = seed % payaStops.length;
    const second = (first + 1 + (seed % 2)) % payaStops.length;
    return [payaStops[first], payaStops[second]] as string[];
  }, [active.id]);

  useEffect(()=>{if(!loaded||!activeGameCode||activeId)return;const timer=window.setTimeout(()=>{const stored=localStorage.getItem(getActivePlayerStorageKey(activeGameCode));const found=players.find((player)=>player.id===stored);if(found){setActiveId(found.id);setScreen(found.evolution?(isOpen?"home":"waiting"):"partner");}else if(players[0]&&!adminTarget){setAdminTarget(players[0].id);}},0);return()=>window.clearTimeout(timer);},[loaded,activeGameCode,players,activeId,isOpen,adminTarget]);
  useEffect(()=>{if(!loaded)return;const timer=window.setTimeout(()=>setLastWildEncounterKey(localStorage.getItem(STORAGE_KEYS.lastWildEncounter)??""),0);return()=>window.clearTimeout(timer);},[loaded]);
  useEffect(()=>{if(!activeId){const timer=window.setTimeout(()=>setPlayerQrImage(""),0);return()=>window.clearTimeout(timer);}let cancelled=false;QRCode.toDataURL(getPlayerQrValue(active,activeGameCode),{errorCorrectionLevel:"M",margin:2,width:230,color:{dark:"#17223b",light:"#fffdf2"}}).then((url)=>{if(!cancelled)setPlayerQrImage(url);}).catch(()=>{if(!cancelled)setPlayerQrImage("");});return()=>{cancelled=true;};},[activeId,active.id,active.name,activeGameCode]);
  useEffect(()=>{if(!activeGameCode||!isMaster)return;let cancelled=false;Promise.all(stations.map(async(item)=>[item.id,await QRCode.toDataURL(getRouteQrValue(item.id,activeGameCode),{errorCorrectionLevel:"M",margin:2,width:360,color:{dark:"#17223b",light:"#fffdf2"}})] as const)).then((entries)=>{if(!cancelled)setRouteQrImages(Object.fromEntries(entries));}).catch(()=>{if(!cancelled)setRouteQrImages({});});return()=>{cancelled=true;};},[activeGameCode,isMaster]);
  useEffect(()=>{if(!loaded||!activeId||!active.evolution||!isOpen||screen!=="waiting")return;const timer=window.setTimeout(()=>setScreen("home"),0);return()=>window.clearTimeout(timer);},[loaded,activeId,active.evolution,isOpen,screen]);
  useEffect(()=>{if(!loaded||!activeId||!active.evolution||!isOpen||complete<1||complete>=stations.length||station||eliteActive||screen==="select"||screen==="partner"||screen==="waiting"||screen==="arena"||screen==="team"||screen==="admin")return;const wildKey=`${active.id}:${complete}`;if(lastWildEncounterKey===wildKey)return;const timer=window.setTimeout(()=>{if(document.visibilityState==="visible")void openWildBattle(wildKey);},wildDelaySeconds*1000);return()=>window.clearTimeout(timer);},[loaded,activeId,active.id,active.evolution,isOpen,complete,station,eliteActive,screen,lastWildEncounterKey,wildDelaySeconds]);
  useEffect(()=>{if(answer===null)return;if(answer===blockedAnswer){const timer=window.setTimeout(()=>{setAnswer(null);setMessage("Barrera de Glaceon: esa respuesta estaba congelada porque es incorrecta.");},0);return()=>window.clearTimeout(timer);}if(evolutionPerkActive&&active.evolution==="Espeon"&&!battlePerkUsed&&battleQuestion){const timer=window.setTimeout(()=>{setBattlePerkUsed(true);setMessage(answer===battleQuestion.correctAnswer?"Premonición de Espeon: esa respuesta es correcta.":"Premonición de Espeon: esa respuesta es incorrecta. Puedes cambiarla.");},0);return()=>window.clearTimeout(timer);}},[answer,blockedAnswer,evolutionPerkActive,active.evolution,battlePerkUsed,battleQuestion]);
  useEffect(()=>{if(eliteAnswer===null)return;if(eliteAnswer===blockedAnswer){const timer=window.setTimeout(()=>{setEliteAnswer(null);setMessage("Barrera de Glaceon: esa respuesta estaba congelada porque es incorrecta.");},0);return()=>window.clearTimeout(timer);}if(evolutionPerkActive&&active.evolution==="Espeon"&&!battlePerkUsed&&eliteActive){const timer=window.setTimeout(()=>{setBattlePerkUsed(true);setMessage(eliteAnswer===eliteQuestion.correctAnswer?"Premonición de Espeon: esa respuesta es correcta.":"Premonición de Espeon: esa respuesta es incorrecta. Puedes cambiarla.");},0);return()=>window.clearTimeout(timer);}},[eliteAnswer,blockedAnswer,evolutionPerkActive,active.evolution,battlePerkUsed,eliteActive,eliteQuestion]);

  function enterGame(){
    const code=normalizeGameCode(gameCodeInput);
    if(code.length<GAME_CODE_MIN_LENGTH){setMessage(`El código de partida debe tener al menos ${GAME_CODE_MIN_LENGTH} caracteres.`);return;}
    setLoaded(false);
    setPlayerOnlyMode(false);
    setActiveGameCode(code);
    localStorage.setItem(STORAGE_KEYS.activeGameCode,code);
    setMasterToken(localStorage.getItem(getMasterTokenStorageKey(code))??"");
    setActiveId("");
    setAdminTarget("");
    setScreen("select");
    void loadGame(code);
  }
  async function claimMasterFromLink(code:string,providedToken=""){
    const storedToken=providedToken||localStorage.getItem(getMasterTokenStorageKey(code));
    if(storedToken){
      try{
        const token=await claimGameMaster(supabase,code,storedToken);
        localStorage.setItem(STORAGE_KEYS.activeGameCode,code);
        localStorage.setItem(getMasterTokenStorageKey(code),token);
        setMasterToken(token);
        setPlayerOnlyMode(false);
        await loadGame(code);
        setScreen("select");
        setMessage("Este dispositivo queda activado como master de la partida.");
        return;
      }catch(error){
        setMasterToken("");
        await loadGame(code);
        setMessage(error instanceof Error?error.message:"Esta partida ya tiene otro master.");
        return;
      }
    }
    setMasterToken("");
    await loadGame(code);
    setMessage("El enlace master está incompleto. Ábrelo de nuevo desde la pantalla posterior al pago.");
  }
  function leaveGame(){
    closeCamera();
    if(activeGameCode)localStorage.removeItem(getActivePlayerStorageKey(activeGameCode));
    localStorage.removeItem(STORAGE_KEYS.activeGameCode);
    setActiveGameCode("");
    setGameCodeInput("");
    setMasterToken("");
    setPlayerOnlyMode(false);
    setQrExpanded(false);
    setActiveId("");
    setPlayers([]);
    setTeamInvites([]);
    setAdminTarget("");
    setScreen("select");
    setMessage("");
    setLoaded(true);
  }
  function selectPlayer(player: Player){setQrExpanded(false);setActiveId(player.id);localStorage.setItem(getActivePlayerStorageKey(activeGameCode),player.id);setScreen(player.evolution?(isOpen?"home":"waiting"):"partner");}
  async function registerPlayer(){
    if(!activeGameCode){setMessage("Entra primero con un código de partida.");return;}
    const cleanName=newPlayerName.trim().replace(/\s+/g," ");
    if(cleanName.length<2){setMessage("Escribe un nombre de al menos 2 letras.");return;}
    if(players.some((player)=>player.name.localeCompare(cleanName,"es",{sensitivity:"base"})===0)){setMessage("Ese nombre ya está en la partida. Añade un apellido o inicial.");return;}
    setBusyAction(true);
    try{
      const created=await createPlayerProfile(supabase,activeGameCode,cleanName);
      setPlayers((current)=>{const next=[...current,created].sort((left,right)=>left.name.localeCompare(right.name,"es"));if(!supabase)saveLocalPlayers(next);return next;});
      setAdminTarget(created.id);
      setNewPlayerName("");
      selectPlayer(created);
      setMessage("Perfil creado. Tu QR virtual ya está listo para enseñarlo al master.");
    }catch(error){
      setSyncStatus("error");
      setMessage(`No se ha podido crear el perfil.${error instanceof Error?` ${error.message}`:""}`);
    }finally{setBusyAction(false);}
  }
  function unlockAdmin(){if(!isMaster){setMessage("Solo el dispositivo master de esta partida puede abrir este panel.");return;}setAdminSection("players");setMessage("");setScreen("admin");}
  async function saveSettings(){
    if(!isMaster){setMessage("Solo el master puede editar la configuración.");return;}
    const cleanMenu=menuItems.filter((item)=>item.label.trim()).map((item)=>({label:item.label.trim(),cost:Math.max(0,Math.floor(item.cost))}));
    const cleanRewards=finalRewardItems.map((item)=>item.trim()).filter(Boolean);
    if(!gameTitle.trim()||!cleanMenu.length||!cleanRewards.length){setMessage("Completa el título, la tienda y al menos un premio.");return;}
    setBusyAction(true);
    try{
      const cleanWildDelay=Math.min(3600,Math.max(10,Math.floor(wildDelaySeconds)));
      await updateGameSettingsRemotely(supabase,activeGameCode,masterToken,{title:gameTitle.trim(),healingCost:Math.max(0,Math.floor(healCost)),wildDelaySeconds:cleanWildDelay,rewardMenu:cleanMenu,finalRewards:cleanRewards});
      setMenuItems(cleanMenu);setFinalRewardItems(cleanRewards);setGameTitle(gameTitle.trim());setHealCost(Math.max(0,Math.floor(healCost)));setWildDelaySeconds(cleanWildDelay);setMessage("Configuración guardada para esta partida.");
    }catch(error){setSyncStatus("error");setMessage(error instanceof Error?error.message:"No se ha podido guardar la configuración.");}
    finally{setBusyAction(false);}
  }
  function updateMenuItem(index:number,field:"label"|"cost",value:string){setMenuItems((current)=>current.map((item,itemIndex)=>itemIndex===index?{...item,[field]:field==="cost"?Number(value):value}:item));}
  function addMenuItem(){if(menuItems.length<20)setMenuItems((current)=>[...current,{label:"Nuevo premio",cost:1}]);}
  function removeMenuItem(index:number){setMenuItems((current)=>current.filter((_,itemIndex)=>itemIndex!==index));}
  function updateFinalReward(index:number,value:string){setFinalRewardItems((current)=>current.map((item,itemIndex)=>itemIndex===index?value:item));}
  function addFinalReward(){if(finalRewardItems.length<20)setFinalRewardItems((current)=>[...current,"Nuevo premio final"]);}
  function removeFinalReward(index:number){setFinalRewardItems((current)=>current.filter((_,itemIndex)=>itemIndex!==index));}
  function showDamage(){setPlayerHit(false);window.requestAnimationFrame(()=>setPlayerHit(true));window.setTimeout(()=>setPlayerHit(false),650);}
  function showCriticalAlert(kind:"energy"|"tokens",title:string,body:string){setCriticalAlert({kind,title,body});setMessage(body);}
  function startEliteFour(){if(!finalUnlocked){setMessage("Completa los 12 QR antes de entrar en Meseta Añil.");return;}if(active.energy<=0){showCriticalAlert("energy","Tu Pokémon no tiene vida","Ve al Centro Pokémon del master antes de entrar en el Alto Mando.");return;}const selected=selectEliteQuestions();setEliteRunQuestions(selected);setEliteIndex(0);setEliteEnemyHp(100);setEliteTransitioning(false);setEliteAnswer(null);setEliteOutcome(null);setChampionName("");setBattlePerkUsed(false);setBlockedAnswer(getGlaceonBlockedAnswer(active,selected[0]));setEliteActive(true);setMessage("El Alto Mando comienza. Derrota a 3 rivales: cada uno resiste 2 respuestas correctas.");}

  async function finishEliteFour(){
    if(finalSaving)return;
    setFinalSaving(true);
    const proposed=active.finalReward??finalRewardItems[Math.floor(Math.random()*finalRewardItems.length)]??FINAL_REWARDS[0];
    try{
      const result=await completeEliteFourRemotely(supabase,active,proposed);
      const completedAt=active.finalCompletedAt??new Date().toISOString();
      patchActive({finalReward:result.reward,finalCompletedAt:completedAt});
      setChampionName(active.name);
      setEliteOutcome("won");
      setEliteTransitioning(false);
      setMessage(`¡${active.name} ha conquistado la Liga! Premio de BBQ: ${result.reward}.`);
    }catch{
      setSyncStatus("error");
      setEliteTransitioning(false);
      setMessage("No se ha podido guardar el título de campeón. Mantén esta pantalla y revisa la conexión.");
    }finally{
      setFinalSaving(false);
    }
  }

  async function answerInvite(invite:TeamInviteSummary,status:"accepted"|"declined"){
    try{
      await respondToTeamInvite(supabase,invite.id,status);
      setTeamInvites((current)=>current.map((item)=>item.id===invite.id?{...item,status}:item));
      if(status==="accepted"&&invite.stationId){
        const invitedStation=stations.find((item)=>item.id===invite.stationId);
        if(invitedStation){setPendingStation(invitedStation);setScreen("team");}
      }
      setMessage(status==="accepted"?"Invitación aceptada. El Team Rocket os espera.":"Invitación rechazada.");
    }catch{
      setSyncStatus("error");
      setMessage("No se ha podido responder a la invitación.");
    }
  }

  function verifyQrCode(value:string){
    const code=extractQrCode(value);
    const route=stations.find((item)=>item.id===code);
    const player=players.find((item)=>item.id===code);
    const result=route?`QR correcto: ${route.title} (${route.id}).`:player?`Tarjeta correcta: ${player.name} (${player.id}).`:code==="alto-mando"?"QR correcto: Alto Mando.":code==="arena"?"QR correcto: Arena sorpresa.":"Código no reconocido.";
    setQrCheckResult(result);
  }
  function getRouteQrValue(stationId:string,gameCode:string):string{if(typeof window==="undefined")return `route:${gameCode}:${stationId}`;const url=new URL(window.location.href);url.pathname="/";url.search="";url.hash="";url.searchParams.set("game",gameCode);url.searchParams.set("qr",stationId);return url.toString();}
  async function downloadRouteQr(item:Station,index:number){const dataUrl=routeQrImages[item.id]??await QRCode.toDataURL(getRouteQrValue(item.id,activeGameCode),{errorCorrectionLevel:"M",margin:3,width:900,color:{dark:"#17223b",light:"#fffdf2"}});const anchor=document.createElement("a");anchor.href=dataUrl;anchor.download=`${String(index+1).padStart(2,"0")}-${item.id}.png`;anchor.click();}

  async function runAdminRecovery(action:"heal"|"tokens"|"unstick",tokenDelta=0){
    if(!isMaster){setMessage("Solo el master puede hacer ajustes.");return;}
    if(!adminReason.trim()){setMessage("Escribe un motivo para dejar constancia del ajuste.");return;}
    setBusyAction(true);
    try{
      await recoverPlayerRemotely(supabase,activeGameCode,masterToken,target,action,adminReason,tokenDelta,journeyIds[target.route.length]??null);
      persist(players.map((player)=>player.id===target.id?{...player,energy:action==="heal"?100:player.energy,tokens:action==="tokens"?Math.max(0,player.tokens+tokenDelta):player.tokens}:player));
      setMessage(action==="heal"?`${target.name} recuperado al 100%.`:action==="tokens"?`Saldo de ${target.name} ajustado en ${tokenDelta>0?"+":""}${tokenDelta}.`:`Invitaciones y encuentro pendiente de ${target.name} desbloqueados.`);
    }catch(error){
      setSyncStatus("error");
      setMessage(`No se ha podido aplicar el rescate.${error instanceof Error?` ${error.message}`:""}`);
    }finally{setBusyAction(false);}
  }
  async function deletePlayerProfile(player:Player){
    if(!isMaster){setMessage("Solo el master puede borrar perfiles.");return;}
    if(!window.confirm(`¿Borrar el perfil de ${player.name} y todo su progreso?`))return;
    setBusyAction(true);
    try{
      await deletePlayerProfileRemotely(supabase,activeGameCode,masterToken,player);
      const next=players.filter((item)=>item.id!==player.id);
      setPlayers(next);
      if(!supabase)saveLocalPlayers(next);
      if(activeId===player.id){localStorage.removeItem(getActivePlayerStorageKey(activeGameCode));setActiveId("");setScreen("select");}
      if(adminTarget===player.id)setAdminTarget(next[0]?.id??"");
      setMessage(`${player.name} se ha borrado de esta partida.`);
    }catch(error){
      setSyncStatus("error");
      setMessage(`No se ha podido borrar el perfil.${error instanceof Error?` ${error.message}`:""}`);
    }finally{setBusyAction(false);}
  }
  async function resetCurrentGame(){
    if(!isMaster){setMessage("Solo el master puede borrar la partida.");return;}
    if(!window.confirm(`¿Borrar todos los perfiles y progreso de la partida ${activeGameCode}?`))return;
    setBusyAction(true);
    try{
      await resetGameSessionRemotely(supabase,activeGameCode,masterToken);
      setPlayers([]);
      setTeamInvites([]);
      setActiveId("");
      setAdminTarget("");
      localStorage.removeItem(getActivePlayerStorageKey(activeGameCode));
      saveLocalPlayers([]);
      setScreen("select");
      setMessage("Partida vaciada. Puedes crear perfiles nuevos con el mismo código.");
    }catch(error){
      setSyncStatus("error");
      setMessage(`No se ha podido borrar la partida.${error instanceof Error?` ${error.message}`:""}`);
    }finally{setBusyAction(false);}
  }

  async function startStation(next:Station){ if(!isOpen){setScreen("waiting");return;} if(active.energy<=0){showCriticalAlert("energy","Tu Pokémon no tiene vida","Ve al Centro Pokémon del master para recuperarla al 100%.");setScreen("home");return;} if(active.route.includes(next.id)){setMessage("Este entrenador ya está superado en tu ruta.");return;} if(next.id!==expectedStationId){const expected=stations.find((item)=>item.id===expectedStationId);setMessage(expected?`Aún no toca este QR. El siguiente es ${expected.title}.`:"La ruta ya está completa.");setScreen("home");return;} if(arenaStops.includes(next.id)&&!active.arenaEvents?.includes(next.id)){setPendingStation(next);setArenaChallenge("");setArenaOpponent("");setArenaWinner("");setArenaStartedAt(null);setScreen("arena");setMessage("¡Aparece la Arena sorpresa antes del combate!");return;} if(next.kind==="rocket"){setPendingStation(next);setTeamMate("");setPlayerCardCode("");setScreen("team");setMessage("Misión Team Rocket: invita a otra persona o entra en solitario.");return;} await openBattle(next); }
  async function openWildBattle(wildKey:string){
    if(busyAction||station||!activeId||active.energy<=0)return;
    const opponent=randomCapture();
    const wildStation:Station={id:`${WILD_STATION_PREFIX}${active.route.length}-${Date.now()}`,title:`${opponent.name} salvaje`,kind:"trainer",area:"Hierba alta",reward:0,color:opponent.rarity==="Legendario"?"yellow":"mint"};
    setLastWildEncounterKey(wildKey);
    localStorage.setItem(STORAGE_KEYS.lastWildEncounter,wildKey);
    setWildOpponent(opponent);
    await openBattle(wildStation,true);
    setMessage(`¡${opponent.name} salvaje aparece porque la ruta se está alargando! Derrótalo para capturarlo.`);
  }
  async function openBattle(next: Station, force = false){
    if(busyAction&&!force)return;
    setBusyAction(true);
    try{
      const used = new Set(active.questionHistory ?? []);
      let selected: Question | null = null;
      let key = "";
      while(!selected){
        selected=getNextQuestion(questions,[...used]);
        if(!selected){setMessage("Ya no quedan preguntas nuevas en esta partida.");return;}
        key=questionKey(selected);
        const saved=await recordQuestionShown(supabase,active,next.id,key);
        if(saved)break;
        used.add(key);
        selected=null;
      }
      setPlayers((currentPlayers)=>{
        const nextPlayers=currentPlayers.map((player)=>player.id===active.id?{...player,questionHistory:[...new Set([...(player.questionHistory??[]),key])]}:player);
        if(!supabase)saveLocalPlayers(nextPlayers);
        return nextPlayers;
      });
      setBattleQuestion(selected);
      setAnswer(null);
      setBattleOutcome(null);
      setBattleCapture(null);
      if(!next.id.startsWith(WILD_STATION_PREFIX))setWildOpponent(null);
      setBattleReward(0);
      setBattlePerkUsed(false);
      setCorrectStreak(0);
      setBlockedAnswer(getGlaceonBlockedAnswer(active,selected));
      setMessage(getGlaceonBlockedAnswer(active,selected)!==null?"Glaceon ha congelado una respuesta incorrecta.":"");
      setStation(next);
    }catch{
      setSyncStatus("error");
      setMessage("No se ha podido registrar la pregunta en Supabase. Revisa la conexión antes de continuar.");
    }finally{
      setBusyAction(false);
    }
  }
  function chooseEvolution(evolution: Evolution){patchActive({evolution});setScreen(isOpen?"home":"waiting");}
  function setPlayerEvolution(playerId:string, evolution:Evolution){persist(players.map((player)=>player.id===playerId?{...player,evolution}:player));setMessage(`Evolución actualizada.`);}
  function randomCapture(){const rarity=getCaptureRarity(active,Math.random()*100);const pool=dexPool.filter((pokemon)=>pokemon.rarity===rarity);return pool[Math.floor(Math.random()*pool.length)];}
  async function resolveBattle(){
    if(!station||answer===null||!battleQuestion||busyAction||battleOutcome)return;
    const correct=answer===battleQuestion.correctAnswer;
    try{await recordQuestionAnswer(supabase,active,questionKey(battleQuestion),answer,correct);}catch{setSyncStatus("error");}
    if(!correct){
      setCorrectStreak(0);
      if(evolutionPerkActive&&active.evolution==="Flareon"&&!battlePerkUsed){setBattlePerkUsed(true);setAnswer(null);setMessage("Llama protectora de Flareon: este primer fallo no quita energía.");return;}
      const loss=getFailureDamage(active);
      const energy=Math.max(0,active.energy-loss);
      showDamage();
      patchActive({energy,wrongAnswers:(active.wrongAnswers??0)+1});
      setAnswer(null);
      if(energy===0){setBattleOutcome("dead");showCriticalAlert("energy","Tu Pokémon se ha debilitado","Ve al Centro Pokémon del master para recuperar la vida al 100%.");return;}
      setMessage(`¡${evolved} ha recibido daño! Pierdes un ${loss}% de energía.`);
      return;
    }
    const nextStreak=correctStreak+1;
    setCorrectStreak(nextStreak);
    if(isWildBattle){
      setBusyAction(true);
      const capture={...(wildOpponent??randomCapture()),recordId:crypto.randomUUID()};
      const xp=active.xp+10;
      const level=Math.max(1,Math.floor(xp/100)+1);
      try{
        await recordWildCaptureRemotely(supabase,active,capture,xp,level);
        patchActive({xp,level,captures:[...active.captures,capture],correctAnswers:(active.correctAnswers??0)+1});
        setBattleCapture(capture);
        setBattleReward(0);
        setBattleOutcome("won");
        setMessage(`¡${capture.name} salvaje se ha unido a tu Pokédex! No cuenta como QR de ruta, pero ganas experiencia.`);
      }catch{
        setSyncStatus("error");
        setMessage("No se ha podido guardar la captura salvaje. Revisa la conexión antes de continuar.");
      }finally{setBusyAction(false);}
      return;
    }
    if(active.route.includes(station.id)){setBattleOutcome("won");setMessage("Este combate ya estaba registrado.");return;}
    setBusyAction(true);
    const route=[...active.route,station.id];
    const xp=active.xp+25;
    const level=Math.max(1,Math.floor(xp/100)+1);
    const capture={...randomCapture(),recordId:crypto.randomUUID()};
    const reward=getStationReward(active,station.kind,station.reward);
    const linkedTeammate=station.kind==="rocket"?players.find((player)=>player.id===teamMate&&journeyIds[player.route.length]===station.id):undefined;
    const teammateCapture=linkedTeammate?{...randomCapture(),recordId:crypto.randomUUID()}:null;
    try{
      if(linkedTeammate&&teammateCapture){
        await completeTeamStationRemotely(supabase,active,linkedTeammate,station.id,reward,capture,teammateCapture);
        setPlayers((current)=>{
          const next=current.map((player)=>{
            if(player.id===active.id)return{...player,route,tokens:player.tokens+reward,xp,level,captures:[...player.captures,capture],correctAnswers:(player.correctAnswers??0)+1};
            if(player.id===linkedTeammate.id){const partnerXp=player.xp+25;return{...player,route:[...player.route,station.id],tokens:player.tokens+reward,xp:partnerXp,level:Math.floor(partnerXp/100)+1,captures:[...player.captures,teammateCapture]};}
            return player;
          });
          if(!supabase)saveLocalPlayers(next);
          return next;
        });
      }else{
        await completeStationRemotely(supabase,active,station.id,reward,capture,xp,level);
        patchActive({route,tokens:active.tokens+reward,xp,level,captures:[...active.captures,capture],correctAnswers:(active.correctAnswers??0)+1});
      }
      setBattleCapture(capture);
      setBattleReward(reward);
      setBattleOutcome("won");
      setMessage(`¡El Pokémon rival se ha debilitado! ${linkedTeammate?`${active.name} y ${linkedTeammate.name} recibís progreso, captura y ${reward} tokens.`:`Ganas ${reward} tokens.`}${nextStreak>=2?` Racha de ${nextStreak} aciertos.`:""}`);
    }catch{
      setSyncStatus("error");
      setMessage("No se ha podido registrar el combate en Supabase. Revisa conexión antes de continuar.");
    }finally{setBusyAction(false);}
  }

  function resolveEliteBattle(){
    if(eliteAnswer===null||eliteOutcome||eliteTransitioning||finalSaving)return;
    const correct=eliteAnswer===eliteQuestion.correctAnswer;
    if(!correct){
      setCorrectStreak(0);
      if(evolutionPerkActive&&active.evolution==="Flareon"&&!battlePerkUsed){setBattlePerkUsed(true);setEliteAnswer(null);setMessage("Llama protectora de Flareon: este primer fallo no quita energía.");return;}
      const loss=getFailureDamage(active);
      const energy=Math.max(0,active.energy-loss);
      showDamage();
      patchActive({energy,wrongAnswers:(active.wrongAnswers??0)+1});
      setEliteAnswer(null);
      if(energy===0){setEliteOutcome("dead");showCriticalAlert("energy","Tu Pokémon se ha debilitado","El master debe curarlo en el Centro Pokémon antes de volver al Alto Mando.");return;}
      setMessage(`¡${evolved} ha recibido daño! Pierdes un ${loss}% de energía.`);
      return;
    }
    const nextStreak=correctStreak+1;
    setCorrectStreak(nextStreak);
    patchActive({correctAnswers:(active.correctAnswers??0)+1});
    const nextIndex=eliteIndex+1;
    const rivalDefeated=nextIndex%2===0;
    setEliteAnswer(null);
    setEliteTransitioning(true);
    setEliteEnemyHp(rivalDefeated?0:50);
    setMessage(rivalDefeated?`¡${eliteTrainer.ace} se ha debilitado! Has derrotado a ${eliteTrainer.name}.`:`¡Es muy eficaz! Racha de ${nextStreak} aciertos.`);
    window.setTimeout(()=>{
      if(nextIndex>=6){void finishEliteFour();return;}
      setEliteIndex(nextIndex);
      setEliteEnemyHp(rivalDefeated?100:50);
      setBattlePerkUsed(false);
      setBlockedAnswer(getGlaceonBlockedAnswer(active,eliteRunQuestions[nextIndex]));
      setEliteTransitioning(false);
    },900);
  }
  function finishBattleVictory(){const evolveNow=!isWildBattle&&active.route.length===4&&Boolean(active.evolution)&&!active.evolvedShown;setStation(null);setBattleQuestion(null);setBattleOutcome(null);setBattleCapture(null);setWildOpponent(null);setBattleReward(0);setScreen(evolveNow?"evolution":"home");}
  async function redeemBattleCapture(){if(!battleCapture||busyAction)return;setBusyAction(true);try{const redeemed=await redeemCaptureRemotely(supabase,active,battleCapture);if(!redeemed){setMessage("Esta captura ya estaba canjeada.");return;}patchActive({captures:active.captures.filter((capture)=>capture.recordId!==battleCapture.recordId),tokens:active.tokens+battleCapture.value});setMessage(`${battleCapture.name} canjeado por ${battleCapture.value} token${battleCapture.value===1?"":"s"}.`);finishBattleVictory();}catch{setSyncStatus("error");setMessage("No se ha podido canjear la captura. Inténtalo de nuevo.");}finally{setBusyAction(false);}}
  async function cashCapture(index:number){ if(busyAction)return; const capture=active.captures[index]; if(!capture)return; setBusyAction(true); try{const redeemed=await redeemCaptureRemotely(supabase,active,capture); if(!redeemed){setMessage("Esta captura ya estaba canjeada o no pertenece al jugador.");return;} patchActive({captures:active.captures.filter((_,i)=>i!==index),tokens:active.tokens+capture.value});setMessage(`${capture.name} canjeado por ${capture.value} token${capture.value>1?"s":""}.`);}catch{setSyncStatus("error");setMessage("No se ha podido canjear la captura. Inténtalo de nuevo.");}finally{setBusyAction(false);} }
  async function beginArena(){
    if(busyAction)return;
    const opponent=players.find((p)=>p.id===arenaOpponent);
    if(!opponent){setMessage("Escanea o introduce la tarjeta de tu contrincante primero.");return;}
    if(!arenaChallenge){setMessage("Elige el reto de la Arena.");return;}
    const winner=players.find((p)=>p.id===arenaWinner);
    if(!winner||![active.id,opponent.id].includes(winner.id)){setMessage("Selecciona quién ha ganado la Arena.");return;}
    const loser=winner.id===active.id?opponent:active;
    const eventId=pendingStation?.id??null;
    const go=pendingStation;
    setBusyAction(true);
    try{
      const saved=await resolveArenaMatchRemotely(supabase,active,opponent,eventId,arenaChallenge,winner,loser,REWARDS.arena);
      setPlayers((currentPlayers)=>{
        const nextPlayers=currentPlayers.map((player)=>{
          const arenaEvents=player.id===active.id&&eventId
            ? [...new Set([...(player.arenaEvents??[]),eventId])]
            : player.arenaEvents;
          if(!saved)return player.id===active.id?{...player,arenaEvents}:player;
          if(player.id===winner.id)return{...player,tokens:player.tokens+REWARDS.arena,arenaEvents};
          if(player.id===loser.id)return{...player,energy:0,arenaEvents};
          return player.id===active.id?{...player,arenaEvents}:player;
        });
        if(!supabase)saveLocalPlayers(nextPlayers);
        return nextPlayers;
      });
      setPendingStation(null);
      setArenaOpponent("");
      setArenaChallenge("");
      setArenaWinner("");
      setArenaStartedAt(null);
      if(go){
        setMessage(saved?`${winner.name} gana +${REWARDS.arena} tokens. ${loser.name} se queda sin energía. Ahora toca ${go.title}.`:`La Arena ya estaba resuelta. Continuamos con ${go.title} sin repetir premio.`);
        await openBattle(go,true);
        return;
      }
      setMessage(saved?`${winner.name} gana +${REWARDS.arena} tokens. ${loser.name} se queda sin energía.`:"Esta Arena ya estaba resuelta. No se duplican premios.");
    }catch(error){
      setSyncStatus("error");
      const detail=error instanceof Error?` ${error.message}`:"";
      setMessage(`No se ha podido resolver la Arena en Supabase.${detail}`);
    }finally{
      setBusyAction(false);
    }
  }
  async function redeem(item:MenuItem){if(!isMaster){setMessage("Solo el master puede procesar canjes.");return;}if(busyAction)return;if(target.tokens<item.cost){showCriticalAlert("tokens","No hay tokens suficientes",`${target.name} necesita ${item.cost} tokens para canjear ${item.label}.`);return;}setBusyAction(true);try{const ok=await spendTokensRemotely(supabase,target,item.label,item.cost); if(!ok){showCriticalAlert("tokens","No hay tokens suficientes",`${target.name} no tiene saldo suficiente para completar el canje.`);return;}persist(players.map((p)=>p.id===target.id?{...p,tokens:p.tokens-item.cost}:p));if(item.label==="Ruleta sorpresa"){setRouletteResult("");setRouletteSpinning(true);window.setTimeout(()=>{setRouletteSpinning(false);setRouletteResult(Math.random()<0.5?"Prueba otra vez":"Chupito");},2200);}setMessage(`Canje confirmado: ${item.label} para ${target.name}.`);}catch{setSyncStatus("error");setMessage("No se ha podido registrar el canje en Supabase.");}finally{setBusyAction(false);}}
  async function heal(){if(!isMaster){setMessage("Solo el master puede curar jugadores.");return;}if(busyAction)return;const cost=targetHealingCost;if(target.tokens<cost){showCriticalAlert("tokens","No hay tokens suficientes",`${target.name} necesita ${cost} tokens para usar el Centro Pokémon.`);return;}setBusyAction(true);try{if(cost>0){const ok=await spendTokensRemotely(supabase,target,"Centro Pokémon",cost);if(!ok){showCriticalAlert("tokens","No hay tokens suficientes",`${target.name} no tiene saldo suficiente para completar la cura.`);return;}}persist(players.map((p)=>p.id===target.id?{...p,energy:100,tokens:p.tokens-cost}:p));setMessage(`${target.name} vuelve al 100% de energía por ${cost} token${cost===1?"":"s"}${cost<Math.floor(healCost)?" gracias a Vaporeon":""}.`);}catch{setSyncStatus("error");setMessage("No se ha podido registrar la cura en Supabase.");}finally{setBusyAction(false);}}
  function award(){if(!isMaster){setMessage("Solo el master puede dar tokens.");return;}persist(players.map((p)=>p.id===target.id?{...p,tokens:p.tokens+REWARDS.arena}:p));setMessage(`+${REWARDS.arena} tokens de Arena para ${target.name}.`);}
  async function linkTeammate(found:Player){if(busyAction)return;if(pendingStation&&journeyIds[found.route.length]!==pendingStation.id){setMessage(`${found.name} no está en esta misma parada de la ruta.`);return;}setBusyAction(true);try{await createTeamInvite(supabase,active.dbId,found.dbId,pendingStation?.id??null);setTeamMate(found.id);setMessage(`Invitación enviada a ${found.name}. Si entráis juntos, ambos recibiréis progreso, captura y tokens.`);}catch{setSyncStatus("error");setMessage("No se ha podido enviar la invitación en Supabase.");}finally{setBusyAction(false);}}
  function linkPlayerCard(code:string){const found=players.find((p)=>p.id===extractQrCode(code));if(!found||found.id===active.id){setMessage("Tarjeta no válida o es tu propio perfil.");return false;}if(screen==="arena"){setArenaOpponent(found.id);setArenaWinner("");setArenaStartedAt(Date.now());setMessage(`Tarjeta de ${found.name} enlazada. Empieza el reto de Arena.`);return true;}setPlayerCardCode(found.id);setMessage(`Tarjeta de ${found.name} detectada. Abre la Arena para retarle.`);return true;}
  function selectAdminPlayer(code:string){const found=players.find((p)=>p.id===extractQrCode(code));if(!found){setMessage("Tarjeta de jugador no reconocida.");return false;}setAdminTarget(found.id);setAdminCardCode(found.id);setMessage(`${found.name} identificado: ${found.tokens} tokens disponibles.`);return true;}
  function handleScannedValue(value:string){
    const scannedGame=extractGameCode(value);
    if(scannedGame&&scannedGame!==activeGameCode){setMessage("Este QR pertenece a otra partida.");return;}
    const code=extractQrCode(value);
    if(!code){setMessage("El QR está vacío o no contiene un código válido.");return;}
    const nowScan=Date.now();
    if(lastScanRef.current.value===code&&nowScan-lastScanRef.current.at<1800)return;
    lastScanRef.current={value:code,at:nowScan};
    if(screen==="admin"){
      if(selectAdminPlayer(code)){navigator.vibrate?.(70);closeCamera();}
      return;
    }
    const foundPlayer=players.find((player)=>player.id===code);
    if(foundPlayer){
      if(screen==="team"){
        if(foundPlayer.id===active.id){setMessage("No puedes enlazar tu propia tarjeta.");return;}
        navigator.vibrate?.(70);
        closeCamera();
        void linkTeammate(foundPlayer);
        return;
      }
      if(linkPlayerCard(code)){navigator.vibrate?.(70);closeCamera();}
      return;
    }
    const foundStation=stations.find((item)=>item.id===code);
    if(foundStation){navigator.vibrate?.(70);closeCamera();void startStation(foundStation);return;}
    if(code==="alto-mando"){navigator.vibrate?.(70);closeCamera();startEliteFour();return;}
    setMessage(`Código no reconocido: ${code}. Usa el código impreso debajo del QR.`);
  }
  async function openCamera(){
    if(cameraOpen)return;
    if(!window.isSecureContext&&!location.hostname.includes("localhost")){setMessage("La cámara necesita una conexión HTTPS. Usa el código escrito debajo del QR.");return;}
    try {
      scannerControlsRef.current?.stop();
      setCameraOpen(true);
      setMessage("Apunta al QR y mantenlo dentro del recuadro.");
      await new Promise<void>((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
      if(!videoRef.current)throw new Error("video-not-ready");
      const reader=new BrowserQRCodeReader(undefined,{delayBetweenScanAttempts:180,delayBetweenScanSuccess:700});
      scannerControlsRef.current=await reader.decodeFromConstraints(
        {audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}}},
        videoRef.current,
        (result)=>{if(result?.getText())handleScannedValue(result.getText());},
      );
    } catch(error) {
      setCameraOpen(false);
      scannerControlsRef.current?.stop();
      scannerControlsRef.current=null;
      const name=error instanceof DOMException?error.name:"";
      if(name==="NotAllowedError")setMessage("Permiso de cámara bloqueado. Actívalo en Safari/Ajustes o escribe el código.");
      else if(name==="NotFoundError")setMessage("No se encuentra una cámara trasera. Escribe el código del QR.");
      else setMessage("No se ha podido iniciar el lector QR. Escribe el código impreso debajo.");
    }
  }
  function closeCamera(){scannerControlsRef.current?.stop();scannerControlsRef.current=null;const stream=videoRef.current?.srcObject as MediaStream | null;stream?.getTracks().forEach((track)=>track.stop());if(videoRef.current)videoRef.current.srcObject=null;setCameraOpen(false);}
  if(!loaded)return <main className="app-shell loading-game"><section><span className="ball-mark" aria-hidden="true">◓</span><p className="eyebrow">QR QUEST</p><h1>Conectando partida</h1><div className="loading-track" aria-label="Cargando"><i/></div><small>Recuperando perfiles y progreso...</small></section></main>;
  if(!activeGameCode)return <main className="app-shell game-code-view"><section><img className="access-art" src="/qr-quest-route-hero.png" alt="Ruta de aventura de QR Quest"/><p className="eyebrow">ACCESO A PARTIDA</p><h1>Introduce tu código</h1><p className="lead">Lo encontrarás en la invitación que te ha enviado el master.</p><form className="register-card" onSubmit={(event)=>{event.preventDefault();enterGame();}}><label htmlFor="game-code">Código de partida</label><div className="code-entry"><input id="game-code" value={gameCodeInput} onChange={(event)=>setGameCodeInput(event.target.value)} placeholder="Ej. quest-a7c9f2" autoCapitalize="none" autoCorrect="off" maxLength={40}/><button type="submit">Entrar</button></div></form>{message&&<p className="toast">{message}</p>}</section></main>;
  const requestedScreen: GameScreen = screen==="select" ? "select" : screen==="admin" ? "admin" : !activeId ? "select" : !active.evolution ? "partner" : isOpen||screen==="partner" ? screen : "waiting";
  const visibleScreen: GameScreen = requestedScreen;

  return <main className={`app-shell ${playerHit?"damage-hit":""}`}><header className="topbar"><button className="wordmark" onClick={()=>{closeCamera();setScreen(activeId?(isOpen?"home":"waiting"):"select")}}><span className="ball-mark">◓</span> QR QUEST</button><div className="topbar-actions">{isMaster&&<span className="game-code-pill">{activeGameCode}</span>}{activeId&&<button className="admin-link" onClick={()=>{closeCamera();setScreen("select")}}>Perfil</button>}{isMaster&&<button className="admin-link" onClick={()=>{closeCamera();unlockAdmin();}}>Master</button>}<button className="admin-link" onClick={leaveGame}>Partida</button></div></header>
    {visibleScreen==="select"&&<section className="select-view"><img className="hero-eevee" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/133.png" alt="Eevee"/><p className="eyebrow">{isMaster?`MASTER · ${activeGameCode.toUpperCase()}`:"PARTIDA ABIERTA"}</p><h1>Crea tu entrenador</h1><p>Escribe tu nombre para entrar en esta partida.</p><form className="register-card" onSubmit={(event)=>{event.preventDefault();void registerPlayer();}}><label htmlFor="new-player-name">Nombre del jugador</label><div className="code-entry"><input id="new-player-name" value={newPlayerName} onChange={(event)=>setNewPlayerName(event.target.value)} placeholder="Ej. Laura" autoComplete="name" maxLength={40}/><button type="submit" disabled={busyAction}>{busyAction?"Creando...":"Crear"}</button></div></form>{players.length>0&&<><p className="select-subtitle">Perfiles de esta partida</p><div className="profile-grid">{players.map((player)=><button key={player.id} className="profile-choice" onClick={()=>selectPlayer(player)}><span>{player.name.slice(0,1).toUpperCase()}</span><b>{player.name}</b><small>{player.evolution??"Elige Eevee"}</small></button>)}</div></>}{isMaster&&<button className="admin-shortcut master-entry" onClick={unlockAdmin}>Abrir panel master</button>}<button className="admin-shortcut secondary" onClick={leaveGame}>Cambiar partida</button>{message&&<p className="toast">{message}</p>}</section>}
    {visibleScreen==="partner"&&<section className="partner-view"><button className="back" onClick={()=>setScreen("select")}>← Cambiar perfil</button><img className="hero-eevee" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/133.png" alt="Eevee"/><p className="eyebrow">TU PRIMERA DECISIÓN</p><h2>¿Hacia dónde evolucionará Eevee?</h2><p className="lead">Elige la afinidad de tu compañero. Evolucionará al conseguir cuatro capturas.</p><div className="evolution-grid">{eeveelutions.map((evo)=><button className="evolution-card" key={evo.name} onClick={()=>chooseEvolution(evo.name)}><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${evo.image}.png`} alt={evo.name}/><b>{evo.name}</b><span>Tipo {evo.type}</span><small>{evo.perk}</small></button>)}</div></section>}
    {visibleScreen==="waiting"&&<section className="waiting-view"><img className="hero-eevee" src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${companionImage}.png`} alt={evolved}/><p className="eyebrow">LA PARTIDA TODAVÍA ESTÁ CERRADA</p><h1>Preparad<br/>vuestro equipo.</h1><p className="waiting-date">El master abrirá la ruta cuando empiece el evento.</p><article className="instructions-card"><b>Antes de que empiece</b><ol><li>Crea tu perfil y elige tu evolución de Eevee.</li><li>Tu QR virtual aparece en el perfil y sirve para identificarte.</li><li>Cuando empiece, busca los QR de ruta en orden y resuelve los combates.</li><li>Si tardas demasiado tras el primer QR, puede aparecer un Pokémon salvaje.</li></ol></article><div className="rules-grid"><article><b>Arena sorpresa</b><p>Aparecerá durante la ruta. Elige rival, escanea su tarjeta, haced el reto con temporizador de 10 minutos y marca quién gana. Ganador: +2 tokens. Perdedor: energía a 0.</p></article><article><b>Centro Pokémon</b><p>Cada fallo quita vida. Si tu Pokémon cae a 0, no podrás seguir hasta ver al master. Te curará al 100% con el precio que marque en ese momento.</p></article><article><b>Cantina</b><ul>{menuItems.map((item)=><li key={item.label}><span>{item.label}</span><b>{item.cost} token{item.cost===1?"":"s"}</b></li>)}</ul></article><article><b>Recompensa final</b><p>El premio final se desbloquea al completar los 12 QR de la ruta y superar el Alto Mando.</p></article></div><button className="change-evolution" onClick={()=>setScreen("partner")}>Cambiar Eeveelution</button>{isMaster&&<button className="admin-shortcut" onClick={unlockAdmin}>Abrir panel master</button>}{message&&<p className="toast">{message}</p>}</section>}
    {visibleScreen==="evolution"&&<section className="evolution-scene"><div className="evolution-stars" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div><p>¿Qué? ¡Eevee está evolucionando!</p><div className="evolution-stage"><div className="evolution-energy" aria-hidden="true"><i/><i/><i/></div><img className="evolution-before" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/133.png" alt="Eevee"/><img className="evolution-after" src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${chosenEvolution?.image}.png`} alt={evolved}/></div><div className="evolution-dialogue"><span>¡Enhorabuena!</span><h1>¡Tu Eevee ha evolucionado en {evolved}!</h1><small>Ventaja desbloqueada: {chosenEvolution?.perk}</small></div><button onClick={()=>{patchActive({evolvedShown:true});setScreen("home");}}>Continuar aventura</button></section>}
    {visibleScreen==="home"&&chosenEvolution&&<article className={`perk-status ${evolutionPerkActive?"active":"locked"}`}><b>{evolutionPerkActive?"VENTAJA ACTIVA":"VENTAJA BLOQUEADA"}</b><span>{chosenEvolution.perk}</span><small>{evolutionPerkActive?`${chosenEvolution.name} ya puede usarla en el juego.`:"Se activa automáticamente al completar 4 capturas."}</small></article>}
    {visibleScreen==="home"&&incomingInvite&&<article className="invite-alert"><span>R</span><div><b>¡Invitación Team Rocket!</b><small>{players.find((player)=>player.dbId===incomingInvite.fromPlayerId)?.name??"Otro entrenador"} quiere formar equipo contigo.</small></div><button onClick={()=>{void answerInvite(incomingInvite,"accepted");}}>Aceptar</button><button onClick={()=>{void answerInvite(incomingInvite,"declined");}}>Rechazar</button></article>}
    {visibleScreen==="home"&&<section className="home-view">{TEST_MODE&&<div className="test-banner"><b>Modo pruebas activo</b><span>La ruta está abierta.</span></div>}<p className={`sync-pill ${syncStatus}`}>{syncStatus==="online"?"Partida sincronizada":syncStatus==="connecting"?"Conectando":syncStatus==="local"?"Modo local":"Sin conexión"}</p><p className="eyebrow">ENTRENADOR/A · {active.name.toUpperCase()}</p><div className="profile-hero"><div className={`orb ${chosenEvolution?.type.toLowerCase()??""}`}><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${companionImage}.png`} alt={evolved}/></div><div><p className="muted">COMPAÑERO</p><h1>{evolved}</h1><p className="subline">Nivel {active.level} · tipo {chosenEvolution?.type}</p></div></div><div className="status-grid"><article className="status-card wide"><div><span>PROGRESO</span><strong>{complete}/12</strong></div><div className="meter"><i style={{width:`${(complete/stations.length)*100}%`}}/></div><small>{finalUnlocked?"Alto Mando disponible":`Siguiente: ${stations.find((item)=>item.id===expectedStationId)?.title??"Ruta completa"}`}</small></article><article className="status-card"><span>ENERGÍA</span><strong>{active.energy}%</strong><div className="meter energy"><i style={{width:`${active.energy}%`}}/></div></article><article className="status-card"><span>TOKENS</span><strong>{active.tokens}</strong><small>para premios</small></article></div><div className="journey-progress" aria-label={`${complete} de 12 paradas completadas`}>{journeyIds.map((id,index)=><span key={id} className={active.route.includes(id)?"done":id===expectedStationId?"next":""}>{active.route.includes(id)?"✓":index+1}</span>)}</div>{finalUnlocked&&<button className="elite-home-cta" onClick={startEliteFour}>Entrar al Alto Mando</button>}<div className="primary-game-actions"><button className="scan-cta" onClick={()=>setScreen("scan")}><b>◉</b><span>Escanear QR</span><small>Siguiente parada</small></button><button className="dex-cta" onClick={()=>setScreen("pokedex")}><b>{active.captures.length}</b><span>Pokédex</span><small>Tus capturas</small></button><button className="bag-cta" onClick={()=>setScreen("bag")}><b>▣</b><span>Bolsa</span><small>Hall y premios</small></button></div><article className={`player-qr-card ${qrExpanded?"qr-expanded":""}`}><div><b>Tu tarjeta QR</b><small>{qrExpanded?"Pulsa el QR para volver a su tamaño normal.":"Pulsa el QR para ampliarlo y enséñalo al master."}</small><code>{active.id}</code></div><button className="player-qr-toggle" type="button" aria-label={qrExpanded?"Reducir tarjeta QR":"Ampliar tarjeta QR"} aria-expanded={qrExpanded} onClick={()=>setQrExpanded((expanded)=>!expanded)}>{playerQrImage?<img src={playerQrImage} alt={`QR de ${active.name}`}/>:<span>QR</span>}</button></article>{isMaster&&<button className="admin-shortcut" onClick={unlockAdmin}>Abrir panel master</button>}{message&&<p className="toast">{message}</p>}</section>}
    {visibleScreen==="pokedex"&&<section className="panel-view"><button className="back" onClick={()=>setScreen("home")}>← Aventura</button><p className="eyebrow">TU POKÉDEX</p><h2>{active.captures.length} captura{active.captures.length===1?"":"s"}</h2><div className="capture-grid">{active.captures.length?active.captures.map((capture,index)=><article className={`dex-card ${capture.rarity.toLowerCase()}`} key={`${capture.id}-${index}`}><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${capture.sprite}.png`} alt={capture.name}/><span>#{String(capture.id).padStart(3,"0")} · {capture.rarity}</span><b>{capture.name}</b><button disabled={busyAction} onClick={()=>cashCapture(index)}>Canjear · +{capture.value} token{capture.value>1?"s":""}</button></article>):<div className="empty-dex"><img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/133.png" alt="Eevee"/><b>Aún no hay capturas</b><small>Tu primera victoria aparecerá aquí.</small></div>}</div>{message&&<p className="toast">{message}</p>}</section>}
    {visibleScreen==="bag"&&<section className="panel-view bag-view"><button className="back" onClick={()=>setScreen("home")}>← Aventura</button><p className="eyebrow">MOCHILA DEL ENTRENADOR</p><h2>Tu Bolsa</h2><p className="lead">Todo lo que has conseguido durante la ruta, reunido en un solo lugar.</p><div className="bag-sections"><button type="button" onClick={()=>setScreen("pokedex")}><span className="bag-icon">◈</span><b>Pokédex</b><small>{active.captures.length} capturas guardadas</small></button><article><span className="bag-icon">★</span><b>Hall de campeones</b><small>{players.filter((player)=>player.finalReward).length} entrenadores han superado la Liga</small>{players.filter((player)=>player.finalReward).length>0&&<div className="bag-champions">{players.filter((player)=>player.finalReward).slice(0,3).map((player)=><span key={player.id}>{player.name}</span>)}</div>}</article><article><span className="bag-icon">✦</span><b>Premios</b><small>{active.tokens} tokens disponibles en la Tienda Pokémon</small><div className="bag-prize-list">{menuItems.slice(0,3).map((item)=><span key={item.label}><em>{item.label}</em><strong>{item.cost}</strong></span>)}</div></article></div>{message&&<p className="toast">{message}</p>}</section>}
    {visibleScreen==="scan"&&<section className="panel-view scan-view"><button className="back" onClick={()=>{closeCamera();setScreen("home");}}>← Aventura</button><p className="eyebrow">ESCÁNER</p><h2>Apunta al QR</h2><div className="camera-box">{cameraOpen?<video ref={videoRef} playsInline muted/>:<><span>⌁</span><b>Cámara preparada</b><small>Usa la cámara trasera de tu móvil.</small></>}<button className="camera-button" onClick={cameraOpen?closeCamera:openCamera}>{cameraOpen?"Cerrar cámara":"Abrir cámara"}</button></div><p className="or">o escribe el código impreso</p><div className="code-entry"><input value={manualCode} onChange={(e)=>setManualCode(e.target.value)} placeholder="Código del QR" autoCapitalize="none" autoCorrect="off"/><button onClick={()=>handleScannedValue(manualCode)}>Continuar</button></div>{message&&<p className="toast">{message}</p>}</section>}
    {visibleScreen==="arena"&&<section className="panel-view arena-view"><button className="back" onClick={()=>{closeCamera();setPendingStation(null);setArenaStartedAt(null);setScreen("home")}}>← Volver</button><p className="eyebrow">ARENA SORPRESA {pendingStation?"· ALERTA SORPRESA":"· RETO LIBRE"}</p><h2>{pendingStation?"Antes del QR...":"Reta a un entrenador"}</h2><p className="lead">{pendingStation?`La arena aparece antes de ${pendingStation.title}. Escanea la tarjeta del rival, elegid prueba y seleccionad ganador.`:"Escanea la tarjeta de tu contrincante, elegid el reto y registrad el resultado."}</p><div className="card-scanner"><span>▣</span><div><b>Tarjeta de entrenador rival</b><small>Escanea su QR o escribe el código del jugador.</small></div><button className="camera-button" onClick={cameraOpen?closeCamera:openCamera}>{cameraOpen?"Cerrar":"Escanear"}</button></div>{cameraOpen&&<div className="arena-camera"><video ref={videoRef} playsInline muted/></div>}<div className="code-entry"><input value={playerCardCode} onChange={(e)=>setPlayerCardCode(e.target.value)} placeholder="Ej. player-ab12cd34"/><button onClick={()=>{void linkPlayerCard(playerCardCode);}}>Enlazar</button></div>{arenaOpponentPlayer&&<div className="arena-battle-stage"><article><b>{active.name}</b><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${companionImage}.png`} alt={evolved}/><small>{evolved}</small></article><div className="arena-clock"><span>VS</span><b>{arenaTimer}</b><small>10 minutos</small></div><article><b>{arenaOpponentPlayer.name}</b><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${arenaOpponentSprite}.png`} alt={arenaOpponentPlayer.evolution??"Eevee"}/><small>{arenaOpponentPlayer.evolution??"Eevee"}</small></article></div>}<div className="arena-cards">{arenaChallenges.map((challenge)=><button className={arenaChallenge===challenge?"chosen":""} key={challenge} onClick={()=>{setArenaChallenge(challenge);if(!arenaStartedAt)setArenaStartedAt(Date.now());}}>{challenge}<span>Ganador: +{REWARDS.arena} tokens · Perdedor: energía 0</span></button>)}</div>{arenaOpponentPlayer&&<div className="winner-picker"><b>¿Quién gana?</b><button className={arenaWinner===active.id?"chosen":""} onClick={()=>setArenaWinner(active.id)}>{active.name}</button><button className={arenaWinner===arenaOpponent?"chosen":""} onClick={()=>setArenaWinner(arenaOpponent)}>{arenaOpponentPlayer.name}</button></div>}<button className="arena-confirm" disabled={busyAction} onClick={beginArena}>{pendingStation?"Guardar ganador y combatir":"Guardar ganador de Arena"}</button>{message&&<p className="toast">{message}</p>}</section>}
    {visibleScreen==="team"&&<section className="panel-view team-view">
      <button className="back" onClick={()=>{closeCamera();setPendingStation(null);setScreen("home")}}>← Volver</button>
      <p className="eyebrow">R ENEMIGO · MISIÓN COOPERATIVA</p>
      <h2>Team Rocket os espera</h2>
      <p className="lead">Escanea la tarjeta QR de otra persona. Le llegará una invitación en tiempo real. También puedes entrar en solitario.</p>
      <div className="rocket-banner"><img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/52.png" alt="Meowth"/><b>¡Preparad un equipo de dos!</b><span>Cooperativo recomendado · solitario permitido</span></div>
      <button className="camera-button team-camera-button" onClick={cameraOpen?closeCamera:openCamera}>{cameraOpen?"Cerrar cámara":"Escanear tarjeta"}</button>
      {cameraOpen&&<div className="arena-camera"><video ref={videoRef} playsInline muted/></div>}
      <div className="code-entry"><input value={playerCardCode} onChange={(e)=>setPlayerCardCode(e.target.value)} placeholder="Ej. player-ab12cd34" autoCapitalize="none" autoCorrect="off"/><button disabled={busyAction} onClick={()=>handleScannedValue(playerCardCode)}>Invitar</button></div>
      {teamMate&&<div className="opponent-found team-ok"><span>R</span><b>{active.name}</b><i>con</i><b>{players.find(p=>p.id===teamMate)?.name}</b></div>}
      <button className="arena-confirm" disabled={busyAction} onClick={()=>{const go=pendingStation;setPendingStation(null);setScreen("home");if(go)void openBattle(go,true);}}>{teamMate?"Entrar juntos en la guarida":"Entrar en solitario"}</button>
      {message&&<p className="toast">{message}</p>}
    </section>}
    {visibleScreen==="admin"&&<nav className="admin-tabs" aria-label="Secciones del panel master"><button className={adminSection==="overview"?"active":""} type="button" onClick={()=>setAdminSection("overview")}>Resumen</button><button className={adminSection==="players"?"active":""} type="button" onClick={()=>setAdminSection("players")}>Jugadores</button><button className={adminSection==="center"?"active":""} type="button" onClick={()=>setAdminSection("center")}>Centro Pokémon</button><button className={adminSection==="shop"?"active":""} type="button" onClick={()=>setAdminSection("shop")}>Tienda</button><button className={adminSection==="rewards"?"active":""} type="button" onClick={()=>setAdminSection("rewards")}>Premios</button><button className={adminSection==="route"?"active":""} type="button" onClick={()=>setAdminSection("route")}>QR ruta</button></nav>}
    {visibleScreen==="admin"&&adminSection==="overview"&&<section className="panel-view admin-event-tools"><p className="eyebrow">CONTROL DEL EVENTO</p><h2>Resumen operativo</h2><p className="lead">Comprueba los QR y resuelve cualquier incidencia durante la partida.</p><label className="admin-reason"><span>Motivo del ajuste</span><input value={adminReason} onChange={(event)=>setAdminReason(event.target.value)} /></label><select className="large-select" value={adminTarget} onChange={(event)=>setAdminTarget(event.target.value)}>{players.length?players.map((player)=><option key={player.id} value={player.id}>{player.name}</option>):<option value="">Sin jugadores</option>}</select><div className="rescue-actions"><button disabled={busyAction||!players.length} onClick={()=>{void runAdminRecovery("heal");}}>Curar al 100%</button><button disabled={busyAction||!players.length} onClick={()=>{void runAdminRecovery("tokens",2);}}>+2 tokens</button><button disabled={busyAction||!players.length} onClick={()=>{void runAdminRecovery("tokens",-2);}}>-2 tokens</button><button disabled={busyAction||!players.length} onClick={()=>{void runAdminRecovery("unstick");}}>Desbloquear encuentro</button></div><h3>Comprobador de QR</h3><div className="code-entry"><input value={qrCheckInput} onChange={(event)=>setQrCheckInput(event.target.value)} placeholder="Escanea o escribe un código" autoCapitalize="none" autoCorrect="off"/><button onClick={()=>verifyQrCode(qrCheckInput)}>Comprobar</button></div>{qrCheckResult&&<p className={`qr-check-result ${qrCheckResult.includes("correcto")||qrCheckResult.includes("correcta")?"ok":"error"}`}>{qrCheckResult}</p>}<div className="qr-manifest">{stations.map((item)=><span key={item.id}><b>{item.id}</b><small>{item.title}</small></span>)}<span><b>alto-mando</b><small>Final</small></span>{players.map((player)=><span key={player.id}><b>{player.id}</b><small>{player.name}</small></span>)}</div></section>}
    {visibleScreen==="admin"&&<section className="panel-view admin-view"><button className="back" onClick={()=>{closeCamera();setScreen(activeId?(isOpen?"home":"waiting"):"select")}}>← Salir del panel master</button><p className="eyebrow">PANEL MASTER · {activeGameCode.toUpperCase()}</p><h2>{adminSection==="players"?"Entrenadores":adminSection==="center"?"Centro Pokémon":adminSection==="shop"?"Tienda Pokémon":adminSection==="rewards"?"Premios de la partida":adminSection==="route"?"QR de la ruta":"Resumen operativo"}</h2><p className="lead">{gameTitle} · Gestiona esta partida desde un único panel privado.</p>
      {adminSection==="players"&&<><button className="cantina-shortcut" onClick={()=>setAdminSection("center")}>Abrir Centro Pokémon</button>{players.length?<div className="admin-roster">{players.map((player)=>{const evo=eeveelutions.find((item)=>item.name===player.evolution);return <article key={player.id} className="roster-row"><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${evo?.image??"133"}.png`} alt={evo?.name??"Eevee"}/><div><b>{player.name}</b><small>{evo?`${evo.name} · ${evo.type}`:"Aún no ha elegido"}</small><small>{player.route.length}/12 QR · {player.tokens} tokens</small></div><select aria-label={`Evolución de ${player.name}`} value={player.evolution??""} onChange={(e)=>e.target.value&&setPlayerEvolution(player.id,e.target.value as Evolution)}><option value="">Sin elegir</option>{eeveelutions.map((item)=><option key={item.name} value={item.name}>{item.name}</option>)}</select><button className="delete-profile" disabled={busyAction} onClick={()=>{void deletePlayerProfile(player);}}>Borrar</button></article>})}</div>:<p className="empty-admin">Aún no hay jugadores. Cada participante debe crear su perfil desde la pantalla inicial.</p>}<button className="danger-action" disabled={busyAction||!players.length} onClick={()=>{void resetCurrentGame();}}>Borrar todos los perfiles de esta partida</button></>}
      {adminSection==="center"&&<><h3 id="admin-cantina">Configuración del Centro Pokémon</h3><div className="settings-editor"><label><span>Nombre de la partida</span><input value={gameTitle} onChange={(e)=>setGameTitle(e.target.value)} maxLength={60}/></label><label><span>Precio de una cura</span><input type="number" min="0" max="100" value={healCost} onChange={(e)=>setHealCost(Number(e.target.value))}/></label><label><span>Espera para Pokémon salvaje (segundos)</span><input type="number" min="10" max="3600" value={wildDelaySeconds} onChange={(e)=>setWildDelaySeconds(Number(e.target.value))}/></label></div><button className="save-settings" disabled={busyAction} onClick={()=>{void saveSettings();}}>Guardar configuración</button><h3>Operativa de curas</h3><div className="admin-card-scanner"><div><b>Identificar tarjeta</b><small>Escanea el QR virtual del perfil del jugador.</small></div><button className="camera-button" onClick={cameraOpen?closeCamera:openCamera}>{cameraOpen?"Cerrar cámara":"Escanear tarjeta"}</button></div>{cameraOpen&&<div className="arena-camera"><video ref={videoRef} playsInline muted/></div>}<div className="code-entry admin-code-entry"><input value={adminCardCode} onChange={(e)=>setAdminCardCode(e.target.value)} placeholder="Ej. player-ab12cd34" autoCapitalize="none" autoCorrect="off"/><button onClick={()=>selectAdminPlayer(adminCardCode)}>Buscar</button></div><select className="large-select" value={players.some((p)=>p.id===adminTarget)?adminTarget:""} onChange={(e)=>setAdminTarget(e.target.value)}>{players.length?players.map((p)=><option key={p.id} value={p.id}>{p.name}</option>):<option value="">Sin jugadores</option>}</select><article className="admin-player"><div className="mini-orb">◒</div><div><b>{players.length?target.name:"Sin jugador seleccionado"}</b><small>{target.tokens} tokens · energía {target.energy}% · ruta {target.route.length}/12</small></div></article><div className="admin-actions"><button disabled={busyAction||!players.length} onClick={()=>{void heal();}}>Curar al 100%</button><button disabled={!players.length} onClick={award}>Dar +{REWARDS.arena} por Arena</button></div><h3>Canjear en barra</h3><div className="menu-grid">{menuItems.filter((item)=>item.label.trim()).map((item)=><button disabled={busyAction||!players.length} key={item.label} onClick={()=>redeem(item)}><b>{item.label}</b><span>{item.cost} tokens</span></button>)}</div></>}
      {adminSection==="shop"&&<><h3>Recompensas de la Tienda Pokémon</h3><p className="section-note">Edita los canjes que verán los jugadores y el master en esta partida.</p><div className="menu-editor">{menuItems.map((item,index)=><div className="menu-editor-row" key={`${index}-${item.label}`}><input aria-label={`Nombre del producto ${index+1}`} value={item.label} onChange={(e)=>updateMenuItem(index,"label",e.target.value)} placeholder="Nombre del premio"/><input aria-label={`Coste del producto ${index+1}`} type="number" min="0" value={item.cost} onChange={(e)=>updateMenuItem(index,"cost",e.target.value)}/><button type="button" className="editor-remove" aria-label={`Eliminar ${item.label||"producto"}`} onClick={()=>removeMenuItem(index)}>×</button></div>)}</div><div className="editor-actions"><button className="editor-add" type="button" onClick={addMenuItem} disabled={menuItems.length>=20}>+ Añadir producto</button><button className="save-settings" disabled={busyAction} onClick={()=>{void saveSettings();}}>Guardar tienda</button></div><h3>Vista rápida</h3><div className="menu-grid">{menuItems.filter((item)=>item.label.trim()).map((item)=><button disabled key={item.label}><b>{item.label}</b><span>{item.cost} tokens</span></button>)}</div></>}
      {adminSection==="rewards"&&<><h3>Premios del Alto Mando</h3><p className="section-note">Crea la lista de premios que se sorteará al superar la Liga.</p><div className="menu-editor">{finalRewardItems.map((item,index)=><div className="menu-editor-row reward-editor-row" key={`${index}-${item}`}><span className="reward-number">{index+1}</span><input aria-label={`Premio final ${index+1}`} value={item} onChange={(e)=>updateFinalReward(index,e.target.value)} placeholder="Premio final"/><button type="button" className="editor-remove" aria-label={`Eliminar premio ${item||index+1}`} onClick={()=>removeFinalReward(index)}>×</button></div>)}</div><div className="editor-actions"><button className="editor-add" type="button" onClick={addFinalReward} disabled={finalRewardItems.length>=20}>+ Añadir premio</button><button className="save-settings" disabled={busyAction} onClick={()=>{void saveSettings();}}>Guardar premios</button></div></>}
      {adminSection==="route"&&<><h3>QR imprimibles</h3><p className="section-note">Estos QR pertenecen solo a {gameTitle}. Descarga cada tarjeta, imprímela y colócala en orden.</p><a className="player-link-card" href={getPlayerGameLink(activeGameCode)} target="_blank" rel="noreferrer">Abrir enlace de jugadores</a><div className="route-qr-grid">{stations.map((item,index)=><article key={item.id}><div className="route-qr-image">{routeQrImages[item.id]?<img src={routeQrImages[item.id]} alt={`QR ${index+1}: ${item.title}`}/>:<span>Generando QR...</span>}</div><b>QR {String(index+1).padStart(2,"0")}</b><strong>{item.title}</strong><small>{item.kind==="rocket"?"Team Rocket":"Entrenador"}</small><button type="button" onClick={()=>{void downloadRouteQr(item,index);}}>Descargar PNG</button></article>)}</div></>}
      {message&&<p className="toast">{message}</p>}</section>}
    {criticalAlert&&<div className="critical-alert-wrap" role="dialog" aria-modal="true" aria-labelledby="critical-alert-title"><section className={`critical-alert ${criticalAlert.kind}`}><div className="critical-alert-icon" aria-hidden="true">{criticalAlert.kind==="energy"?"HP":"T"}</div><p>{criticalAlert.kind==="energy"?"CENTRO POKÉMON":"CANTINA"}</p><h2 id="critical-alert-title">{criticalAlert.title}</h2><span>{criticalAlert.body}</span><button autoFocus onClick={()=>setCriticalAlert(null)}>Entendido</button></section></div>}
    {battleOutcome==="won"&&battleCapture&&<div className="capture-reveal-wrap" role="dialog" aria-modal="true" aria-labelledby="capture-title"><section className={`capture-reveal ${battleCapture.rarity.toLowerCase()}`}><p className="eyebrow">{isWildBattle?"¡ENCUENTRO SALVAJE SUPERADO!":"¡EL POKÉMON RIVAL SE HA DEBILITADO!"}</p><h2 id="capture-title">¡Has capturado a {battleCapture.name}!</h2><div className="capture-spotlight"><i aria-hidden="true"/><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${battleCapture.sprite}.png`} alt={battleCapture.name}/></div><div className="capture-values"><span>{isWildBattle?"Exploración":"Victoria"} <b>{isWildBattle?"+10 XP":`+${battleReward} tokens`}</b></span><span>Valor del Pokémon <b>{battleCapture.value} token{battleCapture.value===1?"":"s"}</b></span></div><p>¿Quieres guardarlo en tu Pokédex o canjearlo ahora por su valor?</p><div className="capture-actions"><button disabled={busyAction} onClick={()=>{setMessage(`${battleCapture.name} guardado en tu Pokédex.`);finishBattleVictory();}}>Guardar</button><button disabled={busyAction} onClick={()=>{void redeemBattleCapture();}}>{busyAction?"Canjeando...":`Canjear +${battleCapture.value}`}</button></div></section></div>}
    {(rouletteSpinning||rouletteResult)&&<div className="modal-wrap"><section className="roulette-modal"><p className="eyebrow">RULETA SORPRESA</p><h2>{rouletteSpinning?"Girando...":"Premio"}</h2><div className={`roulette-wheel ${rouletteSpinning?"spinning":""}`}>{[["iPhone 17 Pro","/prizes/iphone.svg"],["Reloj inteligente","/prizes/watch.svg"],["Viaje sorpresa","/prizes/trip.svg"],["100 tokens","/prizes/tokens.svg"],["Prueba otra vez","/prizes/retry.svg"],["Chupito","/prizes/shot.svg"]].map(([label,image])=><span key={label}><img src={image} alt={label}/><em>{label}</em></span>)}</div><b>{rouletteResult||"¿Qué tocará?"}</b>{rouletteResult&&<button onClick={()=>{setRouletteResult("");setRouletteSpinning(false);}}>Cerrar</button>}</section></div>}
    {eliteActive&&isOpen&&<div className="modal-wrap elite-wrap"><section className={`elite-modal classic-battle ${eliteOutcome==="won"?"champion":eliteOutcome==="dead"?"fainted":""} ${playerHit?"damage-hit":""}`}>{eliteOutcome==="won"?<div className="champion-scene"><div className="champion-rays"><span/><span/><span/><span/></div><p className="eyebrow">NUEVO CAMPEÓN · 6 ACIERTOS</p><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${companionImage}.png`} alt={evolved}/><h2>¡{championName} gana QR Quest!</h2><p>Has derrotado a los tres miembros del Alto Mando. Meseta Añil queda conquistada.</p><button onClick={()=>{setEliteActive(false);setEliteOutcome(null);setEliteAnswer(null);setScreen("home");}}>Celebrar</button></div>:<><div className="elite-progress">{eliteTrainers.map((trainer,index)=><i key={trainer.name} className={index<eliteTrainerIndex?"done":index===eliteTrainerIndex?"active":""}>{index+1}</i>)}</div><p className="eyebrow">{eliteTrainer.title.toUpperCase()} · COMBATE {eliteTrainerIndex+1}/3 · ACIERTO {(eliteIndex%2)+1}/2</p><div className="elite-battle-sequence" key={eliteTrainer.name}><div className="elite-trainer-entrance"><div><small>{eliteTrainer.title}</small><b>{eliteTrainer.name}</b><span>¡Adelante, {eliteTrainer.ace}!</span></div><img src={`https://play.pokemonshowdown.com/sprites/trainers/${eliteTrainer.trainer}.png`} alt={`Entrenador ${eliteTrainer.name}`}/><i className="elite-thrown-ball" aria-hidden="true"/></div><div className={`enemy-field elite-enemy-field ${eliteEnemyHp===0?"enemy-fainted":eliteTransitioning?"enemy-damaged":""}`}><div className="hp-card"><b>{eliteTrainer.ace.toUpperCase()} <small>Nv. {active.level+5+eliteTrainerIndex}</small></b><div className="battle-hp"><i style={{width:`${eliteEnemyHp}%`}}/></div><small>PS {eliteEnemyHp}/100</small></div><div className="elite-release"><span aria-hidden="true"/><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${eliteTrainer.image}.png`} alt={eliteTrainer.ace}/></div></div><div className="player-field elite-player-field"><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${companionImage}.png`} alt={evolved}/><div className="hp-card"><b>{evolved.toUpperCase()} <small>Nv. {active.level}</small></b><div className="battle-hp player-hp"><i style={{width:`${active.energy}%`}}/></div><small>PS {active.energy}/100</small></div></div></div><p className="battle-copy">{message||`${eliteTrainer.name} te observa. Necesitas dos aciertos para debilitar a ${eliteTrainer.ace}.`}</p><p className="elite-counter">Aciertos totales: <b>{eliteIndex}/6</b></p><p className="question">{eliteQuestion.question}</p><div className="answers elite-answers">{eliteQuestion.options.map((option,index)=><button key={option} disabled={Boolean(eliteOutcome)||eliteTransitioning} className={eliteAnswer===index?"selected":""} onClick={()=>setEliteAnswer(index)}><span>{["Psíquico","Tierra Viva","Llamarada","Último recurso"][index]}</span>{option}</button>)}</div><button className="answer-cta" disabled={eliteAnswer===null||Boolean(eliteOutcome)||eliteTransitioning} onClick={resolveEliteBattle}>{eliteTransitioning?"Atacando...":eliteOutcome==="dead"?"Debilitado":eliteIndex===5?"Ataque final":"Atacar"}</button>{eliteOutcome==="dead"&&<div className="result"><p>¡{evolved} se ha debilitado!</p><button onClick={()=>{setEliteActive(false);setEliteOutcome(null);setEliteAnswer(null);setMessage("Busca al master en el Centro Pokémon para recuperar vida.");setScreen("home");}}>Ir al Centro Pokémon</button></div>}</>}</section></div>}
    {eliteOutcome==="won"&&active.finalReward&&<div className="champion-reward-banner"><span>RECOMPENSA BBQ</span><b>{active.finalReward}</b></div>}
    {station&&battleQuestion&&battlePresentation&&isOpen&&<div className="modal-wrap"><section className={`battle-modal classic-battle gym-${station.color} ${battleOutcome==="dead"?"fainted":battleOutcome==="won"?"victory":""}`}>
      <button className="close" onClick={()=>{if(!battleOutcome){setMessage("El combate no se puede cerrar: acierta o cae debilitado.");return;}setStation(null);setBattleQuestion(null);setBattleOutcome(null);}}>×</button>
      <p className="eyebrow">{station.kind==="rocket"?"¡TEAM ROCKET QUIERE LUCHAR!":station.area.toUpperCase()}</p>
      <div className="gym-intro"><div><b>{station.title}</b><span>{battlePresentation.intro}</span></div><img src={`https://play.pokemonshowdown.com/sprites/trainers/${battlePresentation.trainer}.png`} alt={`Entrenador de ${station.title}`}/></div>
      <div className="enemy-field"><div className="hp-card"><b>RIVAL <small>Nv. {difficulty+3}</small></b><div className="battle-hp"><i/></div></div><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${battlePresentation.rival}.png`} alt="Pokémon rival"/></div>
      <div className="player-field"><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${companionImage}.png`} alt={evolved}/><div className="hp-card"><b>{evolved.toUpperCase()} <small>Nv. {active.level}</small></b><div className="battle-hp player-hp"><i style={{width:`${active.energy}%`}}/></div></div></div>
      {correctStreak>=2&&<div className="streak-banner">RACHA ×{correctStreak}</div>}
      <p className="battle-copy">{message||`${evolved}, ¿qué harás?`}</p><p className="question">{battleQuestion.question}</p>
      <div className="answers">{battleQuestion.options.map((option,index)=><button key={option} disabled={Boolean(battleOutcome)} className={answer===index?"selected":""} onClick={()=>setAnswer(index)}><span>{["Impactrueno","Ataque rápido","Mordisco","Poder oculto"][index]}</span>{option}</button>)}</div>
      <button className="answer-cta" disabled={answer===null||Boolean(battleOutcome)||busyAction} onClick={resolveBattle}>{busyAction?"Registrando...":battleOutcome==="won"?"Victoria":battleOutcome==="dead"?"Debilitado":battleQuestion.category==="trick"?"Pregunta trampa":"Pregunta general"}</button>
      {battleOutcome&&<div className="result"><button onClick={()=>{const evolveNow=battleOutcome==="won"&&!isWildBattle&&active.route.length===4&&Boolean(active.evolution)&&!active.evolvedShown;setStation(null);setBattleQuestion(null);setBattleOutcome(null);setWildOpponent(null);setMessage(battleOutcome==="dead"?"Busca al master en el Centro Pokémon para recuperar vida.":"");setScreen(evolveNow?"evolution":"home");}}>Continuar</button></div>}
    </section></div>}
  </main>;
}
