"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  arenaChallenges,
  defaultPlayers,
  dexPool,
  eeveelutions,
  journeyIds,
  menu,
  payaStops,
  questions,
  stations,
} from "@/lib/game/data";
import { ACCESS_CODE, GAME_OPENS_AT, REWARDS, STORAGE_KEYS, TEST_MODE } from "@/lib/game/rules";
import type { Evolution, GameScreen, Player, Station } from "@/lib/game/types";
import {
  completeStationRemotely,
  createTeamInvite,
  loadGameSnapshot,
  recordQuestionAnswer,
  recordQuestionShown,
  redeemCaptureRemotely,
  resolveArenaMatchRemotely,
  saveProfile,
  spendTokensRemotely,
  subscribeToGameChanges,
} from "@/lib/game/supabase-service";
import { getNextQuestion, questionKey } from "@/lib/game/questions";
import { supabase } from "@/lib/supabase";
import type { Question } from "@/lib/game/types";

export function LigaTerrazaGame() {
  const [players, setPlayers] = useState<Player[]>(defaultPlayers);
  const [activeId, setActiveId] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem(STORAGE_KEYS.activePlayer) ?? "",
  );
  const [accessGranted, setAccessGranted] = useState(() =>
    typeof window === "undefined" ? false : localStorage.getItem(STORAGE_KEYS.accessGranted) === "true",
  );
  const [accessCode, setAccessCode] = useState("");
  const [screen, setScreen] = useState<GameScreen>("select");
  const [station, setStation] = useState<Station | null>(null);
  const [battleQuestion, setBattleQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [adminTarget, setAdminTarget] = useState("alejandro");
  const [arenaOpponent, setArenaOpponent] = useState("");
  const [arenaChallenge, setArenaChallenge] = useState("");
  const [arenaWinner, setArenaWinner] = useState("");
  const [arenaStartedAt, setArenaStartedAt] = useState<number | null>(null);
  const [battleOutcome, setBattleOutcome] = useState<"won" | "dead" | null>(null);
  const [healCost, setHealCost] = useState(0);
  const [pendingStation, setPendingStation] = useState<Station | null>(null);
  const [playerCardCode, setPlayerCardCode] = useState("");
  const [teamMate, setTeamMate] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [queuedStationId, setQueuedStationId] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanTimerRef = useRef<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [syncStatus, setSyncStatus] = useState<"connecting" | "online" | "local" | "error">("connecting");
  const [busyAction, setBusyAction] = useState(false);

  function loadLocalPlayers(): Player[] {
    if (typeof window === "undefined") return defaultPlayers;

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.localPlayers);
      if (!stored) return defaultPlayers;
      return JSON.parse(stored) as Player[];
    } catch {
      return defaultPlayers;
    }
  }

  function saveLocalPlayers(next: Player[]): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEYS.localPlayers, JSON.stringify(next));
  }

  async function loadGame(){
    if (!supabase) {
      setPlayers(loadLocalPlayers());
      setSyncStatus("local");
      setLoaded(true);
      return;
    }

    try {
      const snapshot = await loadGameSnapshot(supabase);
      setPlayers(snapshot.players);
      setSyncStatus(snapshot.mode === "remote" ? "online" : "local");
    } catch {
      setSyncStatus("error");
      setMessage("No se ha podido conectar con Supabase. Se mantiene el modo local sin guardar progreso.");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { const timer=window.setTimeout(()=>{const params=new URLSearchParams(location.search); const qr=params.get("qr"); const card=params.get("player"); const found=stations.find((item)=>item.id===qr); if(found) setQueuedStationId(found.id); if(qr==="arena") setScreen("arena"); if(card) { setPlayerCardCode(card); setMessage("Tarjeta de entrenador detectada. Elige tu perfil y abre la Arena o Team Rocket."); } if(qr==="alto-mando") setMessage("El Alto Mando se desbloquea al completar las 12 capturas de ruta.");},0); const loadTimer=window.setTimeout(()=>{void loadGame();},0); const channel=subscribeToGameChanges(supabase,()=>{void loadGame();}); return()=>{window.clearTimeout(timer);window.clearTimeout(loadTimer);if(channel&&supabase)void supabase.removeChannel(channel);}; }, []);
  useEffect(()=>{if(!loaded||!activeId||!queuedStationId)return;const timer=window.setTimeout(()=>{const found=stations.find((item)=>item.id===queuedStationId);setQueuedStationId("");if(found)void startStation(found);},0);return()=>window.clearTimeout(timer);},[loaded,activeId,queuedStationId]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
  const active = useMemo(()=>players.find((p)=>p.id===activeId) ?? players[0],[players,activeId]);
  const target = useMemo(()=>players.find((p)=>p.id===adminTarget) ?? players[0],[players,adminTarget]);
  const complete=active.route.length; const finalUnlocked=complete===stations.length;
  const isOpen=TEST_MODE || accessGranted || now>=GAME_OPENS_AT;
  const remaining=Math.max(0,GAME_OPENS_AT-now);
  const countdown={days:Math.floor(remaining/86400000),hours:Math.floor((remaining%86400000)/3600000),minutes:Math.floor((remaining%3600000)/60000),seconds:Math.floor((remaining%60000)/1000)};
  const persist=(next:Player[])=>{const changed=next.find((player,index)=>{const previous=players[index];return previous&&(player.evolution!==previous.evolution||player.level!==previous.level||player.xp!==previous.xp||player.energy!==previous.energy||player.tokens!==previous.tokens);});setPlayers(next);if(!supabase){saveLocalPlayers(next);return;}if(changed)void saveProfile(supabase,changed).catch(()=>setSyncStatus("error"));};
  const patchActive=(patch:Partial<Player>)=>persist(players.map((p)=>p.id===activeId?{...p,...patch}:p));
  const difficulty=Math.min(4,Math.floor(active.route.length/3)+1);
  const chosenEvolution=eeveelutions.find((item)=>item.name===active.evolution);
  const evolved=active.route.length>=4&&active.evolution?active.evolution:"Eevee";
  const companionImage=evolved==="Eevee"?"133":chosenEvolution?.image ?? "133";
  const arenaOpponentPlayer=players.find((p)=>p.id===arenaOpponent);
  const arenaOpponentEvolution=eeveelutions.find((item)=>item.name===arenaOpponentPlayer?.evolution);
  const arenaOpponentSprite=arenaOpponentEvolution?.image ?? "133";
  const arenaRemainingMs=arenaStartedAt?Math.max(0,600000-(now-arenaStartedAt)):600000;
  const arenaTimer=`${String(Math.floor(arenaRemainingMs/60000)).padStart(2,"0")}:${String(Math.floor((arenaRemainingMs%60000)/1000)).padStart(2,"0")}`;
  const expectedStationId=journeyIds[complete];
  const arenaStops = useMemo(() => {
    const seed = [...active.id].reduce((total, char) => total + char.charCodeAt(0), 0);
    const first = seed % payaStops.length;
    const second = (first + 1 + (seed % 2)) % payaStops.length;
    return [payaStops[first], payaStops[second]] as string[];
  }, [active.id]);

  useEffect(()=>{if(!loaded||!activeId||screen!=="select")return;const timer=window.setTimeout(()=>setScreen(active.evolution?(isOpen?"home":"waiting"):"partner"),0);return()=>window.clearTimeout(timer);},[loaded,activeId,active.evolution,isOpen,screen]);

  function unlockAccess(){if(accessCode.trim()!==ACCESS_CODE){setMessage("Código incorrecto.");return;}localStorage.setItem(STORAGE_KEYS.accessGranted,"true");setAccessGranted(true);setMessage("Acceso de Alejandro desbloqueado en este dispositivo.");setScreen(activeId?(active.evolution?"home":"partner"):"select");}

  async function startStation(next:Station){ if(!isOpen){setScreen("waiting");return;} if(active.energy<=0){setMessage("Tu compañero está debilitado. Ve al Centro Pokémon de Alejandro para recuperar vida.");setScreen("home");return;} if(active.route.includes(next.id)){setMessage("Este entrenador ya está superado en tu ruta.");return;} if(next.id!==expectedStationId){const expected=stations.find((item)=>item.id===expectedStationId);setMessage(expected?`Aún no toca este QR. El siguiente es ${expected.title}.`:"La ruta ya está completa.");setScreen("route");return;} if(arenaStops.includes(next.id)&&!active.arenaEvents?.includes(next.id)){setPendingStation(next);setArenaChallenge("");setArenaOpponent("");setArenaWinner("");setArenaStartedAt(null);setScreen("arena");setMessage("¡Aparece la Arena de Payá antes del combate!");return;} await openBattle(next); }
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
      const nextPlayers=players.map((player)=>player.id===active.id?{...player,questionHistory:[...new Set([...(player.questionHistory??[]),key])]}:player);
      setPlayers(nextPlayers);
      if(!supabase)saveLocalPlayers(nextPlayers);
      setBattleQuestion(selected);
      setAnswer(null);
      setBattleOutcome(null);
      setMessage("");
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
  function randomCapture(){ const roll=Math.random()*100; const pool=dexPool.filter((p)=>p.rarity=== (roll<4?"Legendario":roll<27?"Especial":"Normal")); return pool[Math.floor(Math.random()*pool.length)]; }
  async function resolveBattle(){ if(!station||answer===null||!battleQuestion||busyAction||battleOutcome)return; const correct=answer===battleQuestion.correctAnswer; try{await recordQuestionAnswer(supabase,active,questionKey(battleQuestion),answer,correct);}catch{setSyncStatus("error");} if(!correct){ const loss=active.evolution==="Umbreon"?15:25; const energy=Math.max(0,active.energy-loss);patchActive({energy});setAnswer(null); if(energy===0){setBattleOutcome("dead");setMessage("¡Tu compañero ha quedado debilitado! No puedes cerrar como victoria: ve al Centro Pokémon de Alejandro para recuperar vida al precio indicado.");return;} setMessage(`Fallaste. Pierdes un ${loss}% de energía, pero el combate sigue hasta acertar o caer.`);return;} if(active.route.includes(station.id)){setBattleOutcome("won");setMessage("Este combate ya estaba registrado.");return;} setBusyAction(true); const route=[...active.route,station.id];const xp=active.xp+25;const level=Math.max(1,Math.floor(xp/100)+1);const capture={...randomCapture(),recordId:crypto.randomUUID()}; try{await completeStationRemotely(supabase,active,station.id,station.reward,capture,xp,level);patchActive({route,tokens:active.tokens+station.reward,xp,level,captures:[...active.captures,capture]});setBattleOutcome("won");setMessage(`¡Rival derrotado! ${capture.rarity==="Legendario"?"¡UNA CAPTURA LEGENDARIA! ":""}Has capturado a ${capture.name}. +${station.reward} tokens.`);}catch{setSyncStatus("error");setMessage("No se ha podido registrar el combate en Supabase. Revisa conexión antes de continuar.");}finally{setBusyAction(false);} }
  async function cashCapture(index:number){ if(busyAction)return; const capture=active.captures[index]; if(!capture)return; setBusyAction(true); try{const redeemed=await redeemCaptureRemotely(supabase,active,capture); if(!redeemed){setMessage("Esta captura ya estaba canjeada o no pertenece al jugador.");return;} patchActive({captures:active.captures.filter((_,i)=>i!==index),tokens:active.tokens+capture.value});setMessage(`${capture.name} canjeado por ${capture.value} token${capture.value>1?"s":""}.`);}catch{setSyncStatus("error");setMessage("No se ha podido canjear la captura. Inténtalo de nuevo.");}finally{setBusyAction(false);} }
  async function beginArena(){ if(busyAction)return; const opponent=players.find((p)=>p.id===arenaOpponent); if(!opponent){setMessage("Escanea o introduce la tarjeta de tu contrincante primero.");return;} if(!arenaChallenge){setMessage("Elige el reto de la Arena.");return;} const winner=players.find((p)=>p.id===arenaWinner); if(!winner||![active.id,opponent.id].includes(winner.id)){setMessage("Selecciona quién ha ganado la Arena.");return;} const loser=winner.id===active.id?opponent:active; const eventId=pendingStation?.id??null; setBusyAction(true); try{const saved=await resolveArenaMatchRemotely(supabase,active,opponent,eventId,arenaChallenge,winner,loser,REWARDS.arena); if(!saved){setMessage("Esta Arena ya estaba resuelta para esta parada. No se duplican premios.");return;} const nextPlayers=players.map((player)=>{if(player.id===winner.id)return{...player,tokens:player.tokens+REWARDS.arena,arenaEvents:player.id===active.id&&eventId?[...(player.arenaEvents||[]),eventId]:player.arenaEvents};if(player.id===loser.id)return{...player,energy:0,arenaEvents:player.id===active.id&&eventId?[...(player.arenaEvents||[]),eventId]:player.arenaEvents};if(player.id===active.id&&eventId)return{...player,arenaEvents:[...(player.arenaEvents||[]),eventId]};return player;});setPlayers(nextPlayers);if(!supabase)saveLocalPlayers(nextPlayers); const go=pendingStation; setPendingStation(null);setArenaOpponent("");setArenaChallenge("");setArenaWinner("");setArenaStartedAt(null); if(go){setMessage(`${winner.name} gana +${REWARDS.arena} tokens. ${loser.name} se queda sin energía. Ahora toca ${go.title}.`);await openBattle(go,true);return;} setMessage(`${winner.name} gana +${REWARDS.arena} tokens. ${loser.name} se queda sin energía.`);}catch(error){setSyncStatus("error");const detail=error instanceof Error?` ${error.message}`:"";setMessage(`No se ha podido resolver la Arena en Supabase.${detail}`);}finally{setBusyAction(false);} }
  async function redeem(item:(typeof menu)[number]){if(busyAction)return;if(target.tokens<item.cost){setMessage(`${target.name} no tiene tokens suficientes.`);return;}setBusyAction(true);try{const ok=await spendTokensRemotely(supabase,target,item.label,item.cost); if(!ok){setMessage(`${target.name} no tiene tokens suficientes.`);return;}persist(players.map((p)=>p.id===target.id?{...p,tokens:p.tokens-item.cost}:p));setMessage(`Canje confirmado: ${item.label} para ${target.name}.`);}catch{setSyncStatus("error");setMessage("No se ha podido registrar el canje en Supabase.");}finally{setBusyAction(false);}}
  async function heal(){if(busyAction)return;const cost=Math.max(0,Math.floor(healCost));if(target.tokens<cost){setMessage(`${target.name} no tiene tokens suficientes para el Centro Pokémon.`);return;}setBusyAction(true);try{if(cost>0){const ok=await spendTokensRemotely(supabase,target,"Centro Pokémon",cost);if(!ok){setMessage(`${target.name} no tiene tokens suficientes para el Centro Pokémon.`);return;}}persist(players.map((p)=>p.id===target.id?{...p,energy:100,tokens:p.tokens-cost}:p));setMessage(`${target.name} vuelve al 100% de energía por ${cost} token${cost===1?"":"s"}.`);}catch{setSyncStatus("error");setMessage("No se ha podido registrar la cura en Supabase.");}finally{setBusyAction(false);}}
  function award(){persist(players.map((p)=>p.id===target.id?{...p,tokens:p.tokens+REWARDS.arena}:p));setMessage(`+${REWARDS.arena} tokens de Arena para ${target.name}.`);}
  async function linkTeammate(found:Player){if(busyAction)return;setBusyAction(true);try{await createTeamInvite(supabase,active.dbId,found.dbId,pendingStation?.id??null);setTeamMate(found.id);setMessage(`Invitación enviada a ${found.name}. Podéis jugar juntos.`);}catch{setSyncStatus("error");setMessage("No se ha podido enviar la invitación en Supabase.");}finally{setBusyAction(false);}}
  function linkPlayerCard(code:string){const found=players.find((p)=>p.id===code.trim().toLowerCase());if(!found||found.id===active.id){setMessage("Tarjeta no válida o es tu propio perfil.");return false;}if(screen==="arena"){setArenaOpponent(found.id);setArenaWinner("");setArenaStartedAt(Date.now());setMessage(`Tarjeta de ${found.name} enlazada. Empieza el reto de Arena.`);return true;}setPlayerCardCode(found.id);setMessage(`Tarjeta de ${found.name} detectada. Abre la Arena de Payá para retarle.`);return true;}
  function handleScannedValue(value:string){ const urlValue=value.trim(); let code=urlValue; try { const url=new URL(urlValue); const params=url.searchParams; const player=params.get("player"); const route=params.get("qr"); if(player){linkPlayerCard(player);closeCamera();return;} code=route||urlValue; } catch {} if(linkPlayerCard(code)){closeCamera();return;} const found=stations.find((item)=>item.id===code.toLowerCase()); if(found){closeCamera();void startStation(found);} else setMessage("Este QR no pertenece a la Liga."); }
  async function openCamera(){
    try { const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false}); setCameraOpen(true); await new Promise((resolve)=>requestAnimationFrame(resolve)); if(videoRef.current){videoRef.current.srcObject=stream; await videoRef.current.play();} const Detector=(window as unknown as {BarcodeDetector?:new (options:{formats:string[]})=>{detect:(source:HTMLVideoElement)=>Promise<{rawValue:string}[]>}}).BarcodeDetector; if(Detector){ const detector=new Detector({formats:["qr_code"]}); const read=async()=>{if(!videoRef.current)return; try{const found=await detector.detect(videoRef.current);if(found[0]?.rawValue){handleScannedValue(found[0].rawValue);return;}}catch{} scanTimerRef.current=window.setTimeout(read,450);}; read();} else setMessage("Tu navegador no permite lectura automática. Puedes escribir el código de debajo del QR."); }
    catch { setMessage("No se ha podido abrir la cámara. Usa el código escrito."); }
  }
  function closeCamera(){if(scanTimerRef.current)window.clearTimeout(scanTimerRef.current);scanTimerRef.current=null;const stream=videoRef.current?.srcObject as MediaStream | null;stream?.getTracks().forEach((track)=>track.stop());if(videoRef.current)videoRef.current.srcObject=null;setCameraOpen(false);}
  if(!loaded)return null;
  const visibleScreen: GameScreen = screen;

  return <main className="app-shell"><header className="topbar"><button className="wordmark" onClick={()=>setScreen(activeId?(isOpen?"home":"waiting"):"select")}><span className="ball-mark">◓</span> NIVEL <em>27</em></button>{activeId&&<button className="admin-link" onClick={()=>setScreen("select")}>Cambiar perfil</button>}</header>
    {visibleScreen==="gate"&&<section className="gate-view"><img className="hero-eevee" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/133.png" alt="Eevee"/><p className="eyebrow">ACCESO PRIVADO</p><h1>Liga Terraza 27</h1><p className="lead">Introduce el código de entrenador para preparar tu equipo antes de la apertura.</p><form className="access-card" onSubmit={(event)=>{event.preventDefault();unlockAccess();}}><label htmlFor="access-code">Código de acceso</label><div className="code-entry"><input id="access-code" inputMode="numeric" value={accessCode} onChange={(event)=>setAccessCode(event.target.value)} placeholder="8128"/><button type="submit">Entrar</button></div></form>{message&&<p className="toast">{message}</p>}</section>}
    {visibleScreen==="select"&&<section className="select-view"><img className="hero-eevee" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/133.png" alt="Eevee"/><p className="eyebrow">LIGA DE LA TERRAZA</p><h1>¿Quién eres?</h1><p>Elige tu perfil para entrar en la ruta.</p><div className="profile-grid">{players.map((player)=><button key={player.id} className="profile-choice" onClick={()=>{setActiveId(player.id);localStorage.setItem(STORAGE_KEYS.activePlayer,player.id);setScreen(player.evolution?(isOpen?"home":"waiting"):"partner");}}><span>{player.name.slice(0,1)}</span><b>{player.name}</b><small>{player.id==="alejandro"?"Administrador":player.evolution??"Elige Eevee"}</small></button>)}</div></section>}
    {visibleScreen==="partner"&&<section className="partner-view"><button className="back" onClick={()=>setScreen("select")}>← Cambiar perfil</button><img className="hero-eevee" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/133.png" alt="Eevee"/><p className="eyebrow">TU PRIMERA DECISIÓN</p><h2>¿Hacia dónde evolucionará Eevee?</h2><p className="lead">Elige la afinidad de tu compañero. Evolucionará al conseguir cuatro capturas.</p><div className="evolution-grid">{eeveelutions.map((evo)=><button className="evolution-card" key={evo.name} onClick={()=>chooseEvolution(evo.name)}><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${evo.image}.png`} alt={evo.name}/><b>{evo.name}</b><span>Tipo {evo.type}</span><small>{evo.perk}</small></button>)}</div></section>}
    {visibleScreen==="waiting"&&<section className="waiting-view"><img className="hero-eevee" src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${companionImage}.png`} alt={evolved}/><p className="eyebrow">LA LIGA TODAVÍA ESTÁ CERRADA</p><h1>Preparad<br/>vuestro equipo.</h1><p className="waiting-date">Sábado 29 de agosto · 17:00</p><div className="countdown">{([['Días',countdown.days],['Horas',countdown.hours],['Min',countdown.minutes],['Seg',countdown.seconds]] as const).map(([label,value])=><div key={label}><b>{String(value).padStart(2,'0')}</b><span>{label}</span></div>)}</div><article className="instructions-card"><b>Antes de que empiece</b><ol><li>Elige tu perfil y tu evolución de Eevee. Esa elección queda guardada.</li><li>El juego empieza el sábado a las 17:00. Hasta entonces solo verás este reloj y podrás cambiar tu Pokémon.</li><li>Cuando empiece, lee lo que ponga en el primer QR, cumple la prueba, escanéalo y resuelve el combate.</li><li>La ruta va en orden: no se puede saltar un QR. Son 12 paradas antes de la final.</li></ol></article><div className="rules-grid"><article><b>Arena de Payá</b><p>Aparecerá por sorpresa 2 veces durante la ruta. Elige rival, escanea su tarjeta, haced el reto con temporizador de 10 minutos y marca quién gana. Ganador: +2 tokens. Perdedor: energía a 0.</p></article><article><b>Centro Pokémon</b><p>Cada fallo quita vida. Si tu Pokémon cae a 0, no podrás seguir hasta ver a Alejandro. Te curará al 100% con chupito o con el precio que marque en ese momento.</p></article><article><b>Cantina</b><ul>{menu.map((item)=><li key={item.label}><span>{item.label}</span><b>{item.cost} token{item.cost===1?"":"s"}</b></li>)}</ul></article><article><b>BBQ de la victoria</b><p>Quien no termine la Liga Pokémon completa no podrá acceder a la BBQ de la victoria. La Meseta Añil se abre solo al completar los 12 QR.</p></article></div><button className="change-evolution" onClick={()=>setScreen("partner")}>Cambiar Eeveelution</button>{active.id==="alejandro"&&<form className="access-card admin-access" onSubmit={(event)=>{event.preventDefault();unlockAccess();}}><label htmlFor="access-code">Acceso Alejandro</label><div className="code-entry"><input id="access-code" inputMode="numeric" value={accessCode} onChange={(event)=>setAccessCode(event.target.value)} placeholder="Código privado"/><button type="submit">Desbloquear</button></div></form>}{active.id==="alejandro"&&<button className="admin-shortcut" onClick={()=>setScreen("admin")}>Abrir administración</button>}{message&&<p className="toast">{message}</p>}</section>}
    {visibleScreen==="evolution"&&<section className="evolution-scene"><p>¿Qué? ¡Eevee está evolucionando!</p><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${chosenEvolution?.image}.png`} alt={evolved}/><h1>¡{evolved} ha evolucionado!</h1><button onClick={()=>{patchActive({evolvedShown:true});setScreen("home");}}>Continuar</button></section>}
    {visibleScreen==="home"&&<section className="home-view">{TEST_MODE&&<div className="test-banner"><b>Modo pruebas activo</b><span>La Liga está abierta para probar todas las pantallas.</span></div>}<p className={`sync-pill ${syncStatus}`}>{syncStatus==="online"?"Supabase sincronizado":syncStatus==="connecting"?"Conectando Supabase":syncStatus==="local"?"Modo local temporal":"Revisar conexión"}</p><p className="eyebrow">ENTRENADOR/A · {active.name.toUpperCase()}</p><div className="profile-hero"><div className={`orb ${chosenEvolution?.type.toLowerCase()??""}`}><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${companionImage}.png`} alt={evolved}/></div><div><p className="muted">COMPAÑERO</p><h1>{evolved}</h1><p className="subline">Nivel {active.level} · {evolved==="Eevee"?`afinidad ${chosenEvolution?.type}`:`tipo ${chosenEvolution?.type}`}</p></div></div><div className="status-grid"><article className="status-card wide"><div><span>NIVEL {active.level}</span><strong>{active.xp%100}%</strong></div><div className="meter"><i style={{width:`${active.xp%100}%`}}/></div><small>{evolved==="Eevee"?"Evoluciona tras 4 capturas":"Progreso de entrenador"}</small></article><article className="status-card"><span>ENERGÍA</span><strong>{active.energy}%</strong><div className="meter energy"><i style={{width:`${active.energy}%`}}/></div></article><article className="status-card"><span>TOKENS</span><strong>{active.tokens}</strong><small>para la barra</small></article></div><button className="scan-cta" onClick={()=>setScreen("scan")}><b>◉</b><span>Escanear QR</span><small>Ruta {complete}/12</small></button><div className="bottom-nav"><button onClick={()=>setScreen("home")}>●<span>Perfil</span></button><button onClick={()=>setScreen("pokedex")}>▦<span>Pokédex</span></button><button className="scan-nav" onClick={()=>setScreen("scan")}>⌁<span>Escanear</span></button><button onClick={()=>setScreen("route")}>☰<span>Ruta</span></button></div>{active.id==="alejandro"&&<button className="admin-shortcut" onClick={()=>setScreen("admin")}>Centro Pokémon · administración</button>}{message&&<p className="toast">{message}</p>}</section>}
    {visibleScreen==="pokedex"&&<section className="panel-view"><button className="back" onClick={()=>setScreen("home")}>← Volver</button><p className="eyebrow">TU POKÉDEX</p><h2>Capturas reales</h2><p className="lead">Cada victoria revela un Pokémon aleatorio. Puedes conservarlo o canjearlo por tokens en cualquier momento.</p><div className="capture-grid">{active.captures.length?active.captures.map((capture,index)=><article className={`dex-card ${capture.rarity.toLowerCase()}`} key={`${capture.id}-${index}`}><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${capture.sprite}.png`} alt={capture.name}/><span>#{String(capture.id).padStart(3,"0")} · {capture.rarity}</span><b>{capture.name}</b><button disabled={busyAction} onClick={()=>cashCapture(index)}>Canjear · +{capture.value} token{capture.value>1?"s":""}</button></article>):<div className="empty-dex"><img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/133.png" alt="Eevee"/><b>Aún no hay capturas</b><small>Escanea un QR de entrenador para empezar.</small></div>}</div>{message&&<p className="toast">{message}</p>}</section>}
    {visibleScreen==="scan"&&<section className="panel-view scan-view"><button className="back" onClick={()=>{closeCamera();setScreen("home");}}>← Volver</button><p className="eyebrow">ESCÁNER</p><h2>Encuentra un QR</h2><div className="camera-box">{cameraOpen?<video ref={videoRef} playsInline muted/>:<><span>⌁</span><b>Escanea un código</b><small>Usa la cámara de tu móvil.</small></>}<button className="camera-button" onClick={cameraOpen?closeCamera:openCamera}>{cameraOpen?"Cerrar cámara":"Abrir cámara"}</button></div><p className="or">o introduce el código</p><div className="code-entry"><input value={manualCode} onChange={(e)=>setManualCode(e.target.value)} placeholder="Ej. trainer-1"/><button onClick={()=>{const found=stations.find((item)=>item.id===manualCode.trim().toLowerCase());if(found){closeCamera();void startStation(found);}else setMessage("Código no encontrado.");}}>Continuar</button></div><p className="hint">Prueba: trainer-1 a trainer-8, rocket-1 a rocket-4.</p>{message&&<p className="toast">{message}</p>}</section>}
    {visibleScreen==="route"&&<section className="panel-view"><button className="back" onClick={()=>setScreen("home")}>← Volver</button><p className="eyebrow">RUTA OBLIGATORIA · 12 QR</p><h2>Camino a Meseta Añil</h2><p className="lead">Avanza en línea recta por los 12 códigos. La Arena de Payá aparece como sorpresa antes de dos paradas de tu recorrido.</p><div className="route-track"><div className="route-start"><b>Salida</b><small>{active.name}</small></div>{journeyIds.map((id,index)=>{const item=stations.find((station)=>station.id===id)!;const done=active.route.includes(id);const previousDone=index===0||active.route.includes(journeyIds[index-1]);const available=previousDone&&!done;const arenaSoon=arenaStops.includes(id)&&!active.arenaEvents?.includes(id)&&!done;return <button onClick={()=>{void startStation(item);}} disabled={!available&&!done} key={id} className={`route-step ${item.kind} ${done?"complete":""} ${available?"available":""} ${arenaSoon?"arena-soon":""}`}><i>{done?"✓":item.kind==="rocket"?"R":String(index+1)}</i><span><b>{item.title}</b><small>{item.kind==="rocket"?"Team Rocket":item.area}</small></span><em>{done?"Hecho":arenaSoon?"Arena":available?"Listo":"Bloq."}</em></button>})}<button className={`elite-node ${finalUnlocked?"unlocked":""}`} disabled={!finalUnlocked} onClick={()=>setMessage(finalUnlocked?"Alto Mando listo para la siguiente fase.":"Completa los 12 QR para abrir el Alto Mando.")}><i>★</i><b>Meseta Añil</b><small>{finalUnlocked?"Final desbloqueada":"12/12 necesarios"}</small></button></div>{message&&<p className="toast">{message}</p>}</section>}
    {visibleScreen==="arena"&&<section className="panel-view arena-view"><button className="back" onClick={()=>{closeCamera();setPendingStation(null);setArenaStartedAt(null);setScreen("home")}}>← Volver</button><p className="eyebrow">✦ ARENA DE PAYÁ {pendingStation?"· ALERTA SORPRESA":"· RETO LIBRE"}</p><h2>{pendingStation?"Antes del QR...":"Reta a un entrenador"}</h2><p className="lead">{pendingStation?`Payá aparece antes de ${pendingStation.title}. Escanea la tarjeta del rival, elegid prueba y seleccionad ganador.`:"Escanea la tarjeta de tu contrincante, elegid el reto y registrad el resultado."}</p><div className="card-scanner"><span>▣</span><div><b>Tarjeta de entrenador rival</b><small>Escanea su QR o escribe el código del jugador.</small></div><button className="camera-button" onClick={cameraOpen?closeCamera:openCamera}>{cameraOpen?"Cerrar":"Escanear"}</button></div>{cameraOpen&&<div className="arena-camera"><video ref={videoRef} playsInline muted/></div>}<div className="code-entry"><input value={playerCardCode} onChange={(e)=>setPlayerCardCode(e.target.value)} placeholder="Ej. jugador-4"/><button onClick={()=>{void linkPlayerCard(playerCardCode);}}>Enlazar</button></div>{arenaOpponentPlayer&&<div className="arena-battle-stage"><article><b>{active.name}</b><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${companionImage}.png`} alt={evolved}/><small>{evolved}</small></article><div className="arena-clock"><span>VS</span><b>{arenaTimer}</b><small>10 minutos</small></div><article><b>{arenaOpponentPlayer.name}</b><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${arenaOpponentSprite}.png`} alt={arenaOpponentPlayer.evolution??"Eevee"}/><small>{arenaOpponentPlayer.evolution??"Eevee"}</small></article></div>}<div className="arena-cards">{arenaChallenges.map((challenge)=><button className={arenaChallenge===challenge?"chosen":""} key={challenge} onClick={()=>{setArenaChallenge(challenge);if(!arenaStartedAt)setArenaStartedAt(Date.now());}}>{challenge}<span>Ganador: +{REWARDS.arena} tokens · Perdedor: energía 0</span></button>)}</div>{arenaOpponentPlayer&&<div className="winner-picker"><b>¿Quién gana?</b><button className={arenaWinner===active.id?"chosen":""} onClick={()=>setArenaWinner(active.id)}>{active.name}</button><button className={arenaWinner===arenaOpponent?"chosen":""} onClick={()=>setArenaWinner(arenaOpponent)}>{arenaOpponentPlayer.name}</button></div>}<button className="arena-confirm" disabled={busyAction} onClick={beginArena}>{pendingStation?"Guardar ganador y combatir":"Guardar ganador de Arena"}</button>{message&&<p className="toast">{message}</p>}</section>}
    {visibleScreen==="team"&&<section className="panel-view team-view"><button className="back" onClick={()=>{setPendingStation(null);setScreen("home")}}>← Volver</button><p className="eyebrow">R ENEMIGO · MISIÓN COOPERATIVA</p><h2>Team Rocket os espera</h2><p className="lead">Escanea la tarjeta QR de otra persona. Le llegará la invitación al abrir su tarjeta; si no está disponible, puede ayudarte desde fuera y tú completas el combate.</p><div className="rocket-banner"><img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/52.png" alt="Meowth"/><b>¡Preparad un equipo de dos!</b><span>Recomendado · no obligatorio</span></div><div className="code-entry"><input value={playerCardCode} onChange={(e)=>setPlayerCardCode(e.target.value)} placeholder="Código de su tarjeta, ej. jugador-6"/><button disabled={busyAction} onClick={()=>{const found=players.find(p=>p.id===playerCardCode.trim().toLowerCase());if(found&&found.id!==active.id){void linkTeammate(found);}else setMessage("Tarjeta no válida o es tu propio perfil.")}}>Escanear</button></div>{teamMate&&<div className="opponent-found team-ok"><span>R</span><b>{active.name}</b><i>con</i><b>{players.find(p=>p.id===teamMate)?.name}</b></div>}<button className="arena-confirm" onClick={()=>{const go=pendingStation;setPendingStation(null);setScreen("home");if(go){setAnswer(null);setMessage("");setStation(go);}}}>{teamMate?"Entrar juntos en la guarida":"Jugar con ayuda externa"}</button>{message&&<p className="toast">{message}</p>}</section>}
    {visibleScreen==="admin"&&<section className="panel-view admin-view"><button className="back" onClick={()=>setScreen(isOpen?"home":"waiting")}>← Salir de administración</button><p className="eyebrow">PANEL DE ALEJANDRO · DIRECCIÓN DE JUEGO</p><h2>Entrenadores</h2><p className="lead">Aquí puedes consultar y corregir la evolución elegida por cada persona antes de que se abra la Liga.</p><div className="admin-roster">{players.filter((player)=>player.id!=="alejandro").map((player)=>{const evo=eeveelutions.find((item)=>item.name===player.evolution);return <article key={player.id} className="roster-row"><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${evo?.image??"133"}.png`} alt={evo?.name??"Eevee"}/><div><b>{player.name}</b><small>{evo?`${evo.name} · ${evo.type}`:"Aún no ha elegido"}</small></div><select aria-label={`Evolución de ${player.name}`} value={player.evolution??""} onChange={(e)=>e.target.value&&setPlayerEvolution(player.id,e.target.value as Evolution)}><option value="">Sin elegir</option>{eeveelutions.map((item)=><option key={item.name} value={item.name}>{item.name}</option>)}</select></article>})}</div><h3>Centro Pokémon y barra</h3><select className="large-select" value={adminTarget} onChange={(e)=>setAdminTarget(e.target.value)}>{players.map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}</select><article className="admin-player"><div className="mini-orb">◒</div><div><b>{target.name}</b><small>{target.tokens} tokens · energía {target.energy}% · ruta {target.route.length}/12</small></div></article><div className="admin-actions"><label className="heal-price"><span>Precio cura</span><input type="number" min="0" value={healCost} onChange={(e)=>setHealCost(Number(e.target.value))}/></label><button disabled={busyAction} onClick={()=>{void heal();}}>Curar al 100%</button><button onClick={award}>Dar +{REWARDS.arena} por Arena</button></div><h3>Canjear en barra</h3><div className="menu-grid">{menu.map((item)=><button disabled={busyAction} key={item.label} onClick={()=>redeem(item)}><b>{item.label}</b><span>{item.cost} tokens</span></button>)}</div>{message&&<p className="toast">{message}</p>}</section>}
    {station&&battleQuestion&&isOpen&&<div className="modal-wrap"><section className={`battle-modal classic-battle ${battleOutcome==="dead"?"fainted":battleOutcome==="won"?"victory":""}`}><button className="close" onClick={()=>{if(!battleOutcome){setMessage("El combate no se puede cerrar: acierta o cae debilitado.");return;}setStation(null);setBattleQuestion(null);setBattleOutcome(null);}}>×</button><p className="eyebrow">{station.kind==="rocket"?"¡TEAM ROCKET QUIERE LUCHAR!":"¡UN ENTRENADOR TE DESAFÍA!"}</p><div className="enemy-field"><div className="hp-card"><b>{station.kind==="rocket"?"MEOWTH":"RIVAL"} <small>Nv. {difficulty+3}</small></b><div className="battle-hp"><i/></div></div><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${station.kind==="rocket"?52:25}.png`} alt="Pokémon rival"/></div><div className="player-field"><img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${companionImage}.png`} alt={evolved}/><div className="hp-card"><b>{evolved.toUpperCase()} <small>Nv. {active.level}</small></b><div className="battle-hp player-hp"><i style={{width:`${active.energy}%`}}/></div></div></div><p className="battle-copy">{message||`${evolved}, ¿qué harás?`}</p><p className="question">{battleQuestion.question}</p><div className="answers">{battleQuestion.options.map((option,index)=><button key={option} disabled={Boolean(battleOutcome)} className={answer===index?"selected":""} onClick={()=>setAnswer(index)}><span>{["Impactrueno","Ataque rápido","Mordisco","Poder oculto"][index]}</span>{option}</button>)}</div><button className="answer-cta" disabled={answer===null||Boolean(battleOutcome)||busyAction} onClick={resolveBattle}>{busyAction?"Registrando...":battleOutcome==="won"?"Victoria":battleOutcome==="dead"?"Debilitado":battleQuestion.category==="trick"?"Pregunta trampa":"Pregunta general"}</button>{battleOutcome&&<div className="result"><button onClick={()=>{const evolveNow=battleOutcome==="won"&&active.route.length===4&&Boolean(active.evolution)&&!active.evolvedShown;setStation(null);setBattleQuestion(null);setBattleOutcome(null);setMessage(battleOutcome==="dead"?"Busca a Alejandro en el Centro Pokémon para recuperar vida.":"");setScreen(evolveNow?"evolution":"home");}}>Continuar</button></div>}</section></div>}
  </main>;
}
