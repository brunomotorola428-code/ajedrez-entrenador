(() => {
"use strict";
const $=id=>document.getElementById(id);
const glyph={wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};
const game = new Chess();
let selected=null, targets=[], lastMove=null, thinking=false, engine=null, bestMove=null, beforeFen=null;
let history=[], counts=JSON.parse(localStorage.getItem("chessCounts")||'{"wins":0,"draws":0,"losses":0}');
function renderStats(){["wins","draws","losses"].forEach(k=>$(k).textContent=counts[k]);}
function render(){
 const board=$("board");board.className="board";board.innerHTML="";
 const rows=game.board();
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){
  const sq=String.fromCharCode(97+c)+(8-r),p=rows[r][c],b=document.createElement("button");
  b.className="square "+(((r+c)%2===0)?"light":"dark");
  if(selected===sq)b.classList.add("selected");
  if(targets.includes(sq))b.classList.add("target");
  if(lastMove&&(lastMove.from===sq||lastMove.to===sq))b.classList.add("last");
  b.setAttribute("aria-label",sq);b.dataset.square=sq;
  if(p){const span=document.createElement("span");span.className="piece";span.textContent=glyph[p.color+p.type];b.append(span);}
  b.addEventListener("click",()=>tap(sq));board.append(b);
 }
 $("turnLabel").textContent=game.game_over()?"Partida terminada":(game.turn()==="w"?"Tu turno · Blancas":"Turno del rival · Negras");
 $("moves").textContent=history.length?history.map((m,i)=>i%2===0?`${Math.floor(i/2)+1}. ${m}`:`${m}`).join("  "):"Las jugadas aparecerán aquí.";
}
function say(t){$("lesson").textContent=t;}
function tap(sq){
 if(thinking||game.game_over()||game.turn()!=="w")return;
 const piece=game.get(sq);
 if(selected&&targets.includes(sq)){
  const from=selected;beforeFen=game.fen();const move=game.move({from,to:sq,promotion:"q"});
  if(move){history.push(move.san);lastMove=move;selected=null;targets=[];render();say(explain(move));setTimeout(computerMove,250);return;}
 }
 if(piece&&piece.color==="w"){selected=sq;targets=game.moves({square:sq,verbose:true}).map(m=>m.to);render();}
 else{selected=null;targets=[];render();}
}
function explain(m){
 let s=`${m.san}: `;
 if(m.flags.includes("c")||m.flags.includes("e"))s+="Capturas una pieza, ganando material. ";
 else if(m.piece==="k"&&m.flags.includes("k"))s+="Enrocas: proteges al rey y activas la torre. ";
 else if(m.piece==="p")s+="Avanzas un peón para ganar espacio o abrir líneas. ";
 else s+="Desarrollas o reubicas una pieza. ";
 if(m.san.includes("+"))s+="Además, das jaque: el rey rival debe responder.";
 if(m.san.includes("#"))s+=" ¡Jaque mate!";
 return s;
}
function initEngine(){
 try{
  engine=new Worker("https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish-nnue-16-single.js");
  engine.onmessage=e=>{const line=String(e.data||"");
   if(line.startsWith("bestmove")){const u=line.split(/\s+/)[1];if(u&&u!=="(none)")bestMove=u;}
   if(line.includes("uciok")){engine.postMessage("isready");}
   if(line.includes("readyok")){$("engineStatus").textContent="Rival listo · Stockfish";say("¡Listo! Juega con blancas. El rival automático está preparado.");}
  };
  engine.postMessage("uci");
 }catch(e){$("engineStatus").textContent="Rival no disponible";}
}
function computerMove(){
 if(game.game_over())return finish();
 if(!engine){fallbackMove();return;}
 thinking=true;$("thinking").hidden=false;bestMove=null;
 const skill=Number($("level").value);
 engine.postMessage("setoption name Skill Level value "+skill);
 engine.postMessage("position fen "+game.fen());
 engine.postMessage("go movetime 700");
 const timer=setTimeout(()=>{if(thinking&&!bestMove){fallbackMove();}},3500);
 const old=engine.onmessage;
 engine.onmessage=e=>{
  const line=String(e.data||"");
  if(line.startsWith("bestmove")){
   clearTimeout(timer);const u=line.split(/\s+/)[1];engine.onmessage=old;thinking=false;$("thinking").hidden=true;
   if(u&&u!=="(none)"){const move=game.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]||"q"});if(move){history.push(move.san);lastMove=move;render();say("El rival juega "+move.san+". "+(move.san.includes("+")?"Te da jaque: debes resolverlo.":"Observa qué piezas controla y qué amenazas crea."));}}
   if(game.game_over())finish();
  }
 };
}
function fallbackMove(){
 thinking=false;$("thinking").hidden=true;
 const moves=game.moves({verbose:true});if(!moves.length){finish();return;}
 const m=game.move(moves[Math.floor(Math.random()*moves.length)]);history.push(m.san);lastMove=m;render();say("El rival hizo "+m.san+". (Modo de respaldo: el motor no respondió.)");
}
function finish(){
 const msg=game.in_checkmate()?(game.turn()==="w"?"Has perdido por jaque mate.":"¡Ganaste por jaque mate!"):"La partida terminó en tablas.";
 say(msg);
 const key=game.in_checkmate()?(game.turn()==="w"?"losses":"wins"):"draws";counts[key]++;localStorage.setItem("chessCounts",JSON.stringify(counts));renderStats();
}
$("undo").onclick=()=>{if(thinking)return;game.undo();game.undo();history.splice(-2);lastMove=null;selected=null;targets=[];render();say("Deshicimos el último turno completo. Intenta otra jugada.");};
$("hint").onclick=()=>{
 if(game.turn()!=="w"||thinking)return;
 if(!engine){say("La pista necesita que Stockfish esté disponible. Revisa tu conexión.");return;}
 say("Estoy calculando una pista…");engine.postMessage("position fen "+game.fen());engine.postMessage("go movetime 900");
 const old=engine.onmessage;engine.onmessage=e=>{const l=String(e.data||"");if(l.startsWith("bestmove")){engine.onmessage=old;const u=l.split(/\s+/)[1];if(u&&u!=="(none)")say("Pista: considera "+u.slice(0,2)+" a "+u.slice(2,4)+". Busca si esa jugada mejora la seguridad del rey o gana material.");}};
};
$("restart").onclick=()=>{game.reset();history=[];selected=null;targets=[];lastMove=null;thinking=false;$("thinking").hidden=true;render();say("Nueva partida. Recuerda: desarrolla piezas, controla el centro y protege tu rey.");};
$("level").onchange=()=>say("Dificultad actualizada. El nivel afecta la fuerza de cálculo del rival.");
renderStats();render();initEngine();
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
})();