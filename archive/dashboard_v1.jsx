import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";

const APP_NAME = "Laboratorium badania cienkich warstw dla sensorów gazu";
const APP_VER = "3.0";

const TH={
  dark:{bg:"linear-gradient(180deg,#080d14,#0a1018)",headerBg:"linear-gradient(90deg,#0a1520,#111a28,#0a1520)",sidebarBg:"#0a1018",cardBg:"linear-gradient(145deg,#111a28,#0d1520)",cardBorder:"#1a2a3a",inputBg:"#060a10",inputBorder:"#1a2a3a",inputText:"#d0dce8",boxBg:"#0a1018",boxBorder:"#1a2a3a",text:"#c0ccd8",textM:"#5a7090",textD:"#3a4a5a",textB:"#d0dce8",textA:"#00bbdd",titleC:"#8899aa",titleB:"#1a2233",gTrack:"#1a2332",gText:"#e0e8f0",gUnit:"#7a8ba8",grid:"#1a2233",tick:"#4a5a6a",badgeOff:"#0d141e",badgeOffB:"#1a2332",badgeOffT:"#3a4a5a",ledOff:"#2a3444",ledOffB:"#3a4a5a",ledOn:"#c8d8e8",ledOffT:"#556677",tblB:"#111a22",tblH:"#0d1520",tblT:"#b0c0d0",scroll:"#1a2a3a",selBg:"#0a1018",logoBg:"linear-gradient(135deg,#00b4d8,#0077b6)",userBg:"#111a28",userB:"#1a2a3a",userT:"#6a8aaa",loBg:"#1a0a1a",loB:"#2a1a2a",loT:"#aa5566",footBg:"#060a10",footB:"#1a2a3a",footT:"#3a4a5a",footL:"#4a7a9a",svgBg:"#0d1a2a",svgS:"#1a3050",fFill:"#1a0a0a",fStroke:"#2a1a1a",pv1:"#ff8855",pv1A:"#ff5566",pv2:"#55aaff",tEr:"#2a0a0f",tOk:"#0a2a12",tIn:"#0a1a2a",loginBg:"linear-gradient(135deg,#0a0e17,#111927,#0d1520)",loginCard:"linear-gradient(145deg,#131b2a,#0f1722)",loginCardB:"#1e2d42",actTab:"linear-gradient(135deg,#0d2040,#0a1830)",ttBg:"#111a28",codeBg:"#060a10",codeB:"#1a2a3a",codeT:"#88ccaa",logAlt:"#0c1420"},
  light:{bg:"linear-gradient(180deg,#f0f4f8,#e8ecf0)",headerBg:"linear-gradient(90deg,#fff,#f5f7fa,#fff)",sidebarBg:"#f5f7fa",cardBg:"linear-gradient(145deg,#fff,#f8fafc)",cardBorder:"#d0d8e0",inputBg:"#fff",inputBorder:"#c0c8d0",inputText:"#2a3040",boxBg:"#f5f7fa",boxBorder:"#d0d8e0",text:"#2a3040",textM:"#5a6a7a",textD:"#8a9aaa",textB:"#1a2030",textA:"#0077b6",titleC:"#5a6a7a",titleB:"#e0e4e8",gTrack:"#e0e4e8",gText:"#1a2030",gUnit:"#6a7a8a",grid:"#e0e4e8",tick:"#8a9aaa",badgeOff:"#f0f2f4",badgeOffB:"#d8dce0",badgeOffT:"#a0a8b0",ledOff:"#d0d8e0",ledOffB:"#b0b8c0",ledOn:"#2a3040",ledOffT:"#8a9aaa",tblB:"#e8ecf0",tblH:"#f5f7fa",tblT:"#3a4a5a",scroll:"#c0c8d0",selBg:"#fff",logoBg:"linear-gradient(135deg,#0077b6,#005f8a)",userBg:"#e8ecf0",userB:"#d0d8e0",userT:"#4a6a8a",loBg:"#fff0f0",loB:"#f0c0c0",loT:"#cc4455",footBg:"#e8ecf0",footB:"#d0d8e0",footT:"#7a8a9a",footL:"#0077b6",svgBg:"#e8f0f8",svgS:"#b0c8d8",fFill:"#fff0ee",fStroke:"#d0a8a0",pv1:"#dd5522",pv1A:"#cc2233",pv2:"#2277cc",tEr:"#fff0f0",tOk:"#f0fff4",tIn:"#f0f6ff",loginBg:"linear-gradient(135deg,#e8ecf0,#f0f4f8,#e4e8ec)",loginCard:"linear-gradient(145deg,#fff,#f5f7fa)",loginCardB:"#d0d8e0",actTab:"linear-gradient(135deg,#e0f0ff,#d0e8f8)",ttBg:"#fff",codeBg:"#f5f7fa",codeB:"#d0d8e0",codeT:"#226644",logAlt:"#f5f7fa"}
};

const USERS={admin:{password:"admin123",role:"admin",name:"Administrator"},operator:{password:"oper123",role:"user",name:"Operator"},student:{password:"stud123",role:"student",name:"Student"},guest:{password:"guest",role:"guest",name:"Gość"}};
const ROLE_ACCESS={admin:[1,2,3,4,5,6],user:[1,2,3,4,5,6],student:[1,2,3],guest:[1]};

const JSON_LV2WEB=[
  {type:"measurement_update",desc:"Pomiary co interwał",ex:{type:"measurement_update",ts:"ISO",data:{pv1:156.3,pv2:45.2,mv:67.4,out1:true,outAnalog:12.8}}},
  {type:"status_update",desc:"Status regulacji",ex:{type:"status_update",ts:"ISO",data:{regMode:"PID",regStatus:"RUN",progStage:2}}},
  {type:"alarm_event",desc:"Alarm",ex:{type:"alarm_event",ts:"ISO",data:{alarmId:"AL_HI",severity:"danger",pv1:210.5}}},
  {type:"profile_status",desc:"Status profilu",ex:{type:"profile_status",ts:"ISO",data:{profileName:"Spiekanie ZnO",stage:2,stageName:"Wygrzewanie"}}},
];
const JSON_WEB2LV=[
  {type:"setpoint_command",desc:"Zmiana SP",ex:{type:"setpoint_command",ts:"ISO",data:{target:"sp1",value:200},user:"admin"}},
  {type:"mode_command",desc:"Tryb",ex:{type:"mode_command",ts:"ISO",data:{command:"start",regMode:"PID"},user:"admin"}},
  {type:"manual_mv",desc:"MV ręczne",ex:{type:"manual_mv",ts:"ISO",data:{mv:75},user:"op"}},
  {type:"profile_command",desc:"Profil",ex:{type:"profile_command",ts:"ISO",data:{command:"start",profile:{name:"Spiekanie",segments:[{name:"Rampa",sp:400,ramp:5,hold:0}]}},user:"admin"}},
  {type:"pid_command",desc:"PID",ex:{type:"pid_command",ts:"ISO",data:{pidPb:4.2,pidTi:95,pidTd:24},user:"admin"}},
  {type:"sample_info",desc:"Próbka",ex:{type:"sample_info",ts:"ISO",data:{sampleId:"ZnO-001",material:"ZnO"},user:"admin"}},
  {type:"config_update",desc:"Konfiguracja",ex:{type:"config_update",ts:"ISO",data:{ethIP:"192.168.1.100"},user:"admin"}},
];

function initMb(){return{pv1:25+Math.random()*2,pv2:45+Math.random()*3,ch3:0,mv:0,mvManual:50,manualMode:false,sp1:100,sp2:60,sp3:80,out1:false,out2:false,outAnalog:0,alarm1:false,alarm2:false,alarmSTB:false,alarmLATCH:false,regMode:"PID",regStatus:"RUN",pidPb:5,pidTi:120,pidTd:30,pidI:0,pidPrevE:0,limitPower:100,hyst:1,progStage:0,progStatus:"STOP",progElapsed:0,modbusAddr:1,baudRate:9600,charFmt:"8N1",ethIP:"192.168.1.100",ethPort:502,mqttBroker:"192.168.1.1",mqttPort:1883,mqttTopic:"LAB/ThinFilm",recStatus:"REC",recInterval:5,memUsed:42,rtc:new Date(),inType1:"TC-K",wsUrl:"ws://localhost:8080",wsConnected:false}}

function mkS(T){return{
  card:{background:T.cardBg,borderRadius:12,padding:16,border:`1px solid ${T.cardBorder}`},
  title:{color:T.titleC,fontSize:12,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${T.titleB}`,display:"flex",justifyContent:"space-between",alignItems:"center"},
  input:{width:"100%",padding:"8px 10px",borderRadius:6,background:T.inputBg,border:`1px solid ${T.inputBorder}`,color:T.inputText,fontSize:13,outline:"none"},
  btn:{padding:"10px 18px",borderRadius:8,border:"none",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"},
  box:{background:T.boxBg,borderRadius:8,padding:10,border:`1px solid ${T.boxBorder}`},
  lbl:{color:T.textM,fontSize:10,fontWeight:600,marginBottom:4},
  code:{background:T.codeBg,border:`1px solid ${T.codeB}`,borderRadius:8,padding:12,fontFamily:"monospace",fontSize:11,color:T.codeT,overflowX:"auto",whiteSpace:"pre-wrap",maxHeight:180,overflowY:"auto"},
};}

function Gauge({value,min,max,unit,label,sp,color="#00d4ff",warn,danger,size=140,T}){const rng=max-min,pct=Math.max(0,Math.min(1,(value-min)/rng));const sA=-225,eA=45,tA=eA-sA,ang=sA+pct*tA;const r=size/2-14,cx=size/2,cy=size/2;const p2c=a=>({x:cx+r*Math.cos(a*Math.PI/180),y:cy+r*Math.sin(a*Math.PI/180)});const arc=(s,e)=>{const a=p2c(s),b=p2c(e);return`M ${a.x} ${a.y} A ${r} ${r} 0 ${e-s>180?1:0} 1 ${b.x} ${b.y}`};let fc=color;if(danger&&value>=danger)fc="#ff3355";else if(warn&&value>=warn)fc="#ffaa00";const spA=sp!=null?sA+Math.max(0,Math.min(1,(sp-min)/rng))*tA:null,spP=spA!=null?p2c(spA):null;return(<div style={{textAlign:"center"}}><svg width={size} height={size*.7} viewBox={`0 0 ${size} ${size*.8}`}><path d={arc(sA,eA)} fill="none" stroke={T.gTrack} strokeWidth="9" strokeLinecap="round"/><path d={arc(sA,ang)} fill="none" stroke={fc} strokeWidth="9" strokeLinecap="round" style={{filter:`drop-shadow(0 0 5px ${fc}80)`}}/>{spP&&<circle cx={spP.x} cy={spP.y} r="4" fill="#ff3366" stroke="#fff" strokeWidth="1.5"/>}<text x={cx} y={cy-3} textAnchor="middle" fill={T.gText} fontSize="18" fontWeight="700" fontFamily="monospace">{typeof value==="number"?value.toFixed(1):value}</text><text x={cx} y={cy+12} textAnchor="middle" fill={T.gUnit} fontSize="10">{unit}</text></svg><div style={{color:T.textM,fontSize:9,marginTop:-4,fontWeight:600,letterSpacing:1,textTransform:"uppercase"}}>{label}</div></div>);}
function Led({on,color="#00ff88",label,T}){return(<div style={{display:"flex",alignItems:"center",gap:5,fontSize:11}}><div style={{width:9,height:9,borderRadius:"50%",background:on?color:T.ledOff,boxShadow:on?`0 0 5px ${color}88`:"none",border:`1px solid ${on?color:T.ledOffB}`}}/><span style={{color:on?T.ledOn:T.ledOffT}}>{label}</span></div>);}
function ABadge({on,label,type="warning",T}){const c={warning:["#ff990022","#ff9900","#ffaa33"],danger:["#ff336622","#ff3366","#ff5577"],info:["#00aaff22","#00aaff","#33bbff"],ok:["#00ff8822","#00ff88","#33ffaa"]}[type];return(<div style={{padding:"4px 8px",borderRadius:6,background:on?c[0]:T.badgeOff,border:`1px solid ${on?c[1]:T.badgeOffB}`,color:on?c[2]:T.badgeOffT,fontSize:10,fontWeight:600,animation:on&&type==="danger"?"pa 1s infinite":"none"}}>{on?"●":"○"} {label}</div>);}
function Toasts({items,rm,T}){return(<div style={{position:"fixed",top:56,right:14,zIndex:9999,display:"flex",flexDirection:"column",gap:6,maxWidth:320}}>{items.map(t=>(<div key={t.id} style={{padding:"9px 12px",borderRadius:10,background:t.type==="error"?T.tEr:t.type==="success"?T.tOk:T.tIn,border:`1px solid ${t.type==="error"?"#ff336644":t.type==="success"?"#00ff8844":"#00aaff44"}`,color:t.type==="error"?"#ff8899":t.type==="success"?"#22aa66":"#3388cc",fontSize:12,boxShadow:"0 4px 16px rgba(0,0,0,.15)",animation:"si .3s ease-out",display:"flex",justifyContent:"space-between",gap:8}}><span>{t.type==="error"?"⚠":t.type==="success"?"✓":"ℹ"} {t.msg}</span><button onClick={()=>rm(t.id)} style={{background:"none",border:"none",color:T.textD,cursor:"pointer",fontSize:14}}>×</button></div>))}</div>);}

// ═══ LOGIN ═══
function LoginScreen({onLogin,T}){const S=mkS(T);const[u,su]=useState("");const[p,sp]=useState("");const[err,se]=useState("");const[att,sa]=useState(0);
const go=()=>{const x=USERS[u];if(x&&x.password===p)onLogin({username:u,...x});else{sa(a=>a+1);se(att>=2?"Zbyt wiele prób.":"Nieprawidłowy login lub hasło.")}};
const onKey=e=>{if(e.key==="Enter")go()};
return(<div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:T.loginBg,fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
  <div style={{width:410,padding:38,borderRadius:16,background:T.loginCard,border:`1px solid ${T.loginCardB}`,boxShadow:"0 20px 60px rgba(0,0,0,.15)",animation:"si .5s ease-out"}}>
    <div style={{textAlign:"center",marginBottom:26}}>
      <div style={{width:60,height:60,borderRadius:14,margin:"0 auto 12px",background:T.logoBg,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 6px 20px rgba(0,180,216,.3)"}}><span style={{fontSize:20,fontWeight:800,color:"#fff"}}>TFL</span></div>
      <h1 style={{color:T.textB,fontSize:16,fontWeight:600,margin:"0 0 4px",lineHeight:1.3}}>{APP_NAME}</h1>
      <p style={{color:T.textM,fontSize:11,margin:0}}>Kontroler v{APP_VER} — WebSocket ↔ LabVIEW</p></div>
    <div>
      {[["UŻYTKOWNIK",u,su,"text","admin / operator / student / guest"],["HASŁO",p,sp,"password","Wprowadź hasło"]].map(([l,v,fn,t,ph])=>(
        <div key={l} style={{marginBottom:14}}><label style={{color:T.textM,fontSize:10,fontWeight:600,display:"block",marginBottom:4}}>{l}</label>
          <input type={t} value={v} onChange={e=>{fn(e.target.value);se("")}} onKeyDown={onKey} placeholder={ph} style={{...S.input,padding:"11px 14px",fontSize:13}}/></div>))}
      {err&&<div style={{background:"#ff336615",border:"1px solid #ff336644",borderRadius:8,padding:"8px 12px",marginBottom:14,color:"#ff6688",fontSize:12}}>⚠ {err}</div>}
      <button onClick={go} style={{width:"100%",padding:"12px",borderRadius:8,border:"none",background:T.logoBg,color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer"}}>Zaloguj się</button></div>
    <div style={{textAlign:"center",marginTop:16,color:T.textD,fontSize:10}}>v{APP_VER} • WebSocket JSON • LabVIEW Bridge</div>
  </div></div>);}

// ═══ P1 MONITORING ═══
function P1({mb,hist,alog,profileName,T}){const S=mkS(T);const TT={contentStyle:{background:T.ttBg,border:`1px solid ${T.cardBorder}`,borderRadius:8,fontSize:11,color:T.text}};
return(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
  <div style={S.card}><div style={S.title}><span>Schemat stanowiska</span><span style={{fontSize:10,color:mb.out1?"#ff6644":T.textD}}>{mb.out1?"🔥 GRZANIE":"○ IDLE"}</span></div>
    <svg viewBox="0 0 400 170" style={{width:"100%",height:140}}>
      <rect x="8" y="55" width="50" height="44" rx="5" fill={T.svgBg} stroke={T.svgS} strokeWidth="1.5"/><text x="33" y="74" textAnchor="middle" fill={T.textA} fontSize="8" fontWeight="600">GAZ</text><text x="33" y="87" textAnchor="middle" fill={T.textD} fontSize="7">N₂/Ar</text>
      <line x1="58" y1="77" x2="120" y2="77" stroke={T.svgS} strokeWidth="2.5"/>
      <rect x="120" y="63" width="36" height="26" rx="4" fill={T.svgBg} stroke={T.svgS}/><text x="138" y="78" textAnchor="middle" fill="#00ccff" fontSize="7" fontWeight="600">FLOW</text>
      <line x1="156" y1="77" x2="200" y2="77" stroke={T.svgS} strokeWidth="2.5"/>
      <rect x="200" y="32" width="95" height="88" rx="9" fill={T.fFill} stroke={mb.out1?"#ff4400":T.fStroke} strokeWidth="2"/>
      <text x="247" y="52" textAnchor="middle" fill="#cc4422" fontSize="8" fontWeight="700">PIEC</text>
      <text x="247" y="72" textAnchor="middle" fill={T.pv1} fontSize="16" fontWeight="700">{mb.pv1.toFixed(1)}°C</text>
      <text x="247" y="88" textAnchor="middle" fill={T.textD} fontSize="7">SP:{mb.sp1.toFixed(1)} MV:{(mb.manualMode?mb.mvManual:mb.mv).toFixed(0)}%</text>
      <rect x="316" y="55" width="55" height="44" rx="4" fill={T.svgBg} stroke="#00aadd" strokeWidth="1.5"/><text x="343" y="72" textAnchor="middle" fill="#00ccff" fontSize="7" fontWeight="700">LabVIEW</text><text x="343" y="84" textAnchor="middle" fill={T.textD} fontSize="5">WS Bridge</text>
      <line x1="295" y1="77" x2="316" y2="77" stroke="#00aadd44" strokeWidth="1.5" strokeDasharray="3 2"/>
    </svg></div>
  <div style={S.card}><div style={S.title}><span>Temperatura — {profileName||"brak profilu"}</span><span style={{fontSize:10,color:mb.regStatus==="RUN"?"#00cc66":"#ff6644"}}>● {mb.regStatus}{mb.manualMode?" MAN":" AUTO"}</span></div>
    <ResponsiveContainer width="100%" height={140}><LineChart data={hist.slice(-80)}>
      <CartesianGrid strokeDasharray="3 3" stroke={T.grid}/><XAxis dataKey="t" tick={{fill:T.tick,fontSize:9}} stroke={T.grid} interval="preserveStartEnd"/><YAxis tick={{fill:T.tick,fontSize:9}} stroke={T.grid} domain={["auto","auto"]}/><Tooltip {...TT}/>
      <Line type="monotone" dataKey="pv1" stroke="#ff6644" strokeWidth={2} dot={false} name="PV1°C" isAnimationActive={false}/>
      <Line type="monotone" dataKey="sp1" stroke="#00cc66" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="SP°C" isAnimationActive={false}/>
      <Line type="monotone" dataKey="mv" stroke="#ffaa00" strokeWidth={1} dot={false} name="MV%" isAnimationActive={false}/>
      <Legend wrapperStyle={{fontSize:9}}/></LineChart></ResponsiveContainer></div>
  <div style={S.card}><div style={S.title}><span>Przepływ gazu</span></div>
    <ResponsiveContainer width="100%" height={140}><AreaChart data={hist.slice(-80)}>
      <CartesianGrid strokeDasharray="3 3" stroke={T.grid}/><XAxis dataKey="t" tick={{fill:T.tick,fontSize:9}} stroke={T.grid} interval="preserveStartEnd"/><YAxis tick={{fill:T.tick,fontSize:9}} stroke={T.grid}/><Tooltip {...TT}/>
      <Area type="monotone" dataKey="pv2" stroke="#00aaff" fill="#00aaff15" strokeWidth={2} name="l/min" isAnimationActive={false}/>
      <Legend wrapperStyle={{fontSize:9}}/></AreaChart></ResponsiveContainer></div>
  <div style={S.card}><div style={S.title}><span>Alarmy</span><span style={{fontSize:10,color:T.textD}}>{alog.length}</span></div>
    <div style={{maxHeight:140,overflowY:"auto",fontSize:11}}>{alog.length===0?<div style={{color:T.textD,textAlign:"center",padding:20}}>Brak alarmów</div>:
      alog.slice(-15).reverse().map((a,i)=>(<div key={i} style={{display:"flex",gap:5,padding:"3px 5px",borderBottom:`1px solid ${T.tblB}`,color:a.sev==="danger"?"#ff7788":"#ffbb55"}}><span style={{color:T.textD,fontFamily:"monospace",fontSize:9}}>{a.time}</span><span>{a.msg}</span></div>))}</div></div>
</div>);}

// ═══ P2 USTAWIENIA TEMP ═══
function P2({mb,setMb,toast,segs,setSegs,profileName,setProfileName,addLog,T}){const S=mkS(T);const TT={contentStyle:{background:T.ttBg,border:`1px solid ${T.cardBorder}`,borderRadius:8,fontSize:11,color:T.text}};
  const pData=useMemo(()=>{const d=[];let t=0,tmp=25;for(const s of segs){const rt=Math.abs((s.sp-tmp)/(Math.abs(s.ramp)||1));d.push({time:t.toFixed(0),temp:tmp});t+=rt;d.push({time:t.toFixed(0),temp:s.sp});if(s.hold>0){t+=s.hold;d.push({time:t.toFixed(0),temp:s.sp})}tmp=s.sp}return d},[segs]);
  const uSeg=(i,k,v)=>setSegs(s=>s.map((x,j)=>j===i?{...x,[k]:k==="name"?v:(parseFloat(v)||0)}:x));
  return(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
    <div style={S.card}><div style={S.title}><span>Nastawy</span></div>
      <div style={{display:"flex",justifyContent:"space-around",flexWrap:"wrap",gap:4}}>
        <Gauge value={mb.pv1} min={-50} max={500} unit="°C" label="PV1 Temp" sp={mb.sp1} color="#ff6644" warn={mb.sp1+5} danger={mb.sp1+10} T={T}/>
        <Gauge value={mb.manualMode?mb.mvManual:mb.mv} min={0} max={100} unit="%" label="MV Moc" color="#00cc66" warn={80} danger={95} T={T}/>
        <Gauge value={mb.pv2} min={0} max={100} unit="l/min" label="PV2 Flow" color="#00aaff" T={T}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:10}}>
        {[["SP1","sp1"],["SP2","sp2"],["SP3","sp3"]].map(([l,k])=>(<div key={k} style={S.box}><div style={S.lbl}>{l}°C</div>
          <input type="number" value={mb[k]} step=".1" style={S.input} onChange={e=>{setMb(m=>({...m,[k]:parseFloat(e.target.value)||0}));addLog(`${l}→${e.target.value}°C`,"setpoint")}}/></div>))}</div></div>
    <div style={S.card}><div style={S.title}><span>Regulacja</span><span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:mb.manualMode?"#ff880022":"#00ff8822",color:mb.manualMode?"#ffaa44":"#22aa66"}}>{mb.manualMode?"MANUAL":"AUTO"}</span></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {[["Pb°C","pidPb",.1],["Ti s","pidTi",1],["Td s","pidTd",1],["Hyst°C","hyst",.1],["Limit%","limitPower",1]].map(([l,k,st])=>(<div key={k} style={S.box}><div style={S.lbl}>{l}</div><input type="number" value={mb[k]} step={st} style={S.input} onChange={e=>setMb(m=>({...m,[k]:parseFloat(e.target.value)||0}))}/></div>))}</div>
      <div style={{...S.box,marginTop:8}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={S.lbl}>MV ręczne</div>
        <button onClick={()=>{setMb(m=>({...m,manualMode:!m.manualMode}));addLog(mb.manualMode?"→AUTO":"→MANUAL","mode");toast(mb.manualMode?"AUTO":"MANUAL","info")}} style={{...S.btn,padding:"3px 10px",fontSize:10,background:mb.manualMode?"#886600":"#224488"}}>{mb.manualMode?"→AUTO":"→MAN"}</button></div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4,opacity:mb.manualMode?1:.3}}><input type="range" min="0" max="100" value={mb.mvManual} disabled={!mb.manualMode} onChange={e=>setMb(m=>({...m,mvManual:parseFloat(e.target.value)}))} style={{flex:1,accentColor:"#00aaff"}}/><span style={{color:T.textB,fontFamily:"monospace",fontSize:13}}>{mb.mvManual.toFixed(0)}%</span></div></div>
      <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
        <button onClick={()=>{setMb(m=>({...m,regStatus:m.regStatus==="RUN"?"STOP":"RUN",pidI:0}));addLog(mb.regStatus==="RUN"?"REG STOP":"REG START","mode");toast(mb.regStatus==="RUN"?"STOP":"START","success")}} style={{...S.btn,background:mb.regStatus==="RUN"?"#aa2211":"#22aa44"}}>{mb.regStatus==="RUN"?"⏹ STOP":"▶ START"}</button>
        <button style={{...S.btn,background:"#886600"}} onClick={()=>{setMb(m=>({...m,pidPb:4.2,pidTi:95,pidTd:24}));addLog("Autotune PID","config");toast("Autotune OK","success")}}>🔄 Autotune</button>
        {mb.alarmLATCH&&<button style={{...S.btn,background:"#663366"}} onClick={()=>{setMb(m=>({...m,alarmLATCH:false}));addLog("LATCH kasuj","alarm");toast("LATCH OK","info")}}>🔓 LATCH</button>}</div></div>
    <div style={{...S.card,gridColumn:"1/-1"}}><div style={S.title}><span>Profil temperaturowy — {profileName}</span>
      <span style={{fontSize:10,color:mb.progStatus==="RUN"?"#00cc66":T.textD}}>{mb.progStatus==="RUN"?`▶ E${mb.progStage} ${segs[mb.progStage-1]?.name||""}`:"STOP"}</span></div>
      <div style={{...S.box,marginBottom:8}}><div style={S.lbl}>Nazwa profilu</div><input value={profileName} onChange={e=>setProfileName(e.target.value)} placeholder="np. Spiekanie ZnO" style={S.input}/></div>
      <div style={{display:"grid",gridTemplateColumns:"260px 1fr",gap:12}}>
        <div style={{maxHeight:200,overflowY:"auto"}}>{segs.map((seg,i)=>(<div key={i} style={{...S.box,marginBottom:4,borderColor:mb.progStatus==="RUN"&&mb.progStage===i+1?"#00cc66":T.boxBorder}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{color:T.textA,fontSize:10,fontWeight:700}}>Etap {i+1}</span><button onClick={()=>setSegs(s=>s.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#ff4455",cursor:"pointer",fontSize:11}}>✕</button></div>
          <input value={seg.name} onChange={e=>uSeg(i,"name",e.target.value)} placeholder="Nazwa etapu" style={{...S.input,fontSize:11,padding:"3px 6px",marginBottom:3,fontWeight:600}}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:3}}>{[["SP°C","sp"],["°C/m","ramp"],["min","hold"]].map(([l,k])=>(<div key={k}><div style={{color:T.textD,fontSize:8}}>{l}</div><input type="number" value={seg[k]} onChange={e=>uSeg(i,k,e.target.value)} style={{...S.input,fontSize:11,padding:"2px 4px"}}/></div>))}</div></div>))}
          {segs.length<6&&<button onClick={()=>setSegs(s=>[...s,{name:`Etap ${s.length+1}`,sp:100,ramp:5,hold:30}])} style={{...S.btn,width:"100%",background:T.boxBg,border:`1px solid ${T.boxBorder}`,color:T.textM,fontSize:10}}>+ Dodaj etap</button>}</div>
        <div><ResponsiveContainer width="100%" height={160}><AreaChart data={pData}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.grid}/><XAxis dataKey="time" tick={{fill:T.tick,fontSize:9}} stroke={T.grid}/><YAxis tick={{fill:T.tick,fontSize:9}} stroke={T.grid}/><Tooltip {...TT}/>
          <Area type="linear" dataKey="temp" stroke="#ff8844" fill="#ff884420" strokeWidth={2} name="°C" dot={{r:2,fill:"#ff8844"}} isAnimationActive={false}/></AreaChart></ResponsiveContainer>
          <div style={{display:"flex",gap:6,marginTop:4}}>
            <button style={{...S.btn,fontSize:10,background:"#0077b6"}} onClick={()=>{const o={device:"AR200.B",kontroler:APP_VER,profile:profileName,segments:segs};const b=new Blob([JSON.stringify(o,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`profil_${(profileName||"noname").replace(/\s+/g,"_")}.json`;a.click();addLog(`Eksport profilu "${profileName}"`,"export");toast("JSON OK","success")}}>📥 JSON</button>
            <button style={{...S.btn,fontSize:10,background:mb.progStatus==="RUN"?"#aa2211":"#22aa44"}} onClick={()=>{if(mb.progStatus==="RUN"){setMb(m=>({...m,progStatus:"STOP",progStage:0,progElapsed:0}));addLog(`Program STOP: ${profileName}`,"mode");toast("STOP","info")}else{setMb(m=>({...m,progStatus:"RUN",progStage:1,progElapsed:0,sp1:segs[0]?.sp||m.sp1}));addLog(`Program START: ${profileName} E1: ${segs[0]?.name||""}`,"mode");toast("START","success")}}}>{mb.progStatus==="RUN"?"⏹ Stop":"▶ Start"}</button></div></div></div></div>
  </div>);}

// ═══ P3 PRÓBKA I PROCES ═══
function P3({sample,setSample,toast,addLog,T}){const S=mkS(T);
  const F=({label,k,ph,area})=>(<div style={S.box}><div style={S.lbl}>{label}</div>{area?<textarea value={sample[k]||""} onChange={e=>setSample(s=>({...s,[k]:e.target.value}))} placeholder={ph} rows={3} style={{...S.input,resize:"vertical"}}>{sample[k]||""}</textarea>:<input value={sample[k]||""} onChange={e=>setSample(s=>({...s,[k]:e.target.value}))} placeholder={ph} style={S.input}/>}</div>);
  return(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
    <div style={S.card}><div style={S.title}><span>Informacje o próbce</span></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      <F label="ID Próbki" k="sampleId" ph="ZnO-2026-001"/><F label="Materiał warstwy" k="material" ph="ZnO, SnO₂, TiO₂"/><F label="Podłoże" k="substrate" ph="SiO₂/Si, Al₂O₃"/><F label="Metoda osadzania" k="method" ph="PVD, CVD, Sol-Gel"/><F label="Grubość (nm)" k="thickness" ph="150"/><F label="Gaz docelowy" k="targetGas" ph="H₂S, CO, NO₂"/></div></div>
    <div style={S.card}><div style={S.title}><span>Parametry procesu</span></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      <F label="Temperatura (°C)" k="processTemp" ph="400"/><F label="Ciśnienie (mbar)" k="pressure" ph="5e-3"/><F label="Atmosfera" k="atmosphere" ph="N₂, Ar, vacuum"/><F label="Moc źródła (W)" k="sourcePower" ph="100"/><F label="Czas procesu (min)" k="processTime" ph="60"/><F label="Przepływ (sccm)" k="gasFlow" ph="50"/></div></div>
    <div style={S.card}><div style={S.title}><span>Dodatkowe</span></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      <F label="Operator" k="operator" ph="Jan Kowalski"/><F label="Nr serii" k="batchNo" ph="BATCH-2026-01"/><F label="Cel eksperymentu" k="goal" ph="Optymalizacja" area={true}/><F label="Uwagi" k="notes" ph="Notatki..." area={true}/></div></div>
    <div style={S.card}><div style={S.title}><span>JSON → baza danych</span></div>
      <pre style={S.code}>{JSON.stringify({type:"sample_info",data:sample},null,2)}</pre>
      <div style={{display:"flex",gap:6,marginTop:8}}>
        <button style={{...S.btn,background:"#0077b6"}} onClick={()=>{addLog(`Próbka ${sample.sampleId||"?"} zapisana`,"data");toast("Zapisano","success")}}>💾 Zapisz</button>
        <button style={{...S.btn,background:"#886600"}} onClick={()=>{const b=new Blob([JSON.stringify({type:"sample_info",data:sample},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`sample_${sample.sampleId||"x"}.json`;a.click();addLog(`Eksport próbki ${sample.sampleId}`,"export");toast("OK","success")}}>📥 JSON</button></div></div>
  </div>);}

// ═══ P4 KONFIGURACJA ═══
function P4({mb,setMb,toast,addLog,T}){const S=mkS(T);const[tab,sTab]=useState("ctrl");
  const F=({label,children})=><div style={S.box}><div style={S.lbl}>{label}</div>{children}</div>;
  return(<div>
    <div style={{display:"flex",gap:4,marginBottom:10}}>
      {[["ctrl","🌡 Kontroler"],["ws","🔌 WebSocket"],["db","🗄 Baza"]].map(([id,l])=><button key={id} onClick={()=>sTab(id)} style={{padding:"6px 12px",borderRadius:8,border:"none",background:tab===id?"#0077b6":T.boxBg,color:tab===id?"#fff":T.textM,fontSize:11,fontWeight:600,cursor:"pointer"}}>{l}</button>)}</div>
    {tab==="ctrl"&&<div style={S.card}><div style={S.title}><span>Komunikacja AR200.B</span></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
      {[["Addr MODBUS",mb.modbusAddr,"modbusAddr","number"],["Baud",mb.baudRate,"baudRate","number"],["IP",mb.ethIP,"ethIP","text"],["Port TCP",mb.ethPort,"ethPort","number"],["MQTT Broker",mb.mqttBroker,"mqttBroker","text"],["MQTT Port",mb.mqttPort,"mqttPort","number"]].map(([l,v,k,t])=>
        <F key={l} label={l}><input type={t} defaultValue={v} style={S.input} onChange={e=>setMb(m=>({...m,[k]:t==="number"?parseFloat(e.target.value)||0:e.target.value}))}/></F>)}</div>
      <button style={{...S.btn,marginTop:8,background:"#0077b6"}} onClick={()=>{addLog("Config kontroler zapisana","config");toast("OK","success")}}>💾 Zapisz</button></div>}
    {tab==="ws"&&<div style={S.card}><div style={S.title}><span>WebSocket ↔ LabVIEW</span></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      <F label="WebSocket URL"><input value={mb.wsUrl} onChange={e=>setMb(m=>({...m,wsUrl:e.target.value}))} style={S.input}/></F>
      <F label="Status"><div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}><Led on={mb.wsConnected} color="#00cc66" label={mb.wsConnected?"Połączony":"Rozłączony"} T={T}/></div></F></div>
      <p style={{color:T.textM,fontSize:11,margin:"8px 0"}}>LabVIEW = WebSocket Server. Kontroler = klient. Dane JSON.</p>
      <div style={{display:"flex",gap:6}}><button style={{...S.btn,background:"#22aa44"}} onClick={()=>{setMb(m=>({...m,wsConnected:true}));addLog("WS Połączono","ws");toast("Connected","success")}}>🔌 Połącz</button>
        <button style={{...S.btn,background:"#aa2211"}} onClick={()=>{setMb(m=>({...m,wsConnected:false}));addLog("WS Rozłączono","ws");toast("Disconnected","info")}}>⏏ Rozłącz</button></div></div>}
    {tab==="db"&&<div style={S.card}><div style={S.title}><span>Baza danych</span></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      {[["Typ","PostgreSQL+TimescaleDB"],["Host","localhost"],["Port","5432"],["Baza","thinfilm_lab"]].map(([l,v])=><F key={l} label={l}><input defaultValue={v} style={S.input}/></F>)}</div>
      <button style={{...S.btn,marginTop:8,background:"#0077b6"}} onClick={()=>{addLog("Config DB zapisana","config");toast("OK","success")}}>💾 Zapisz</button></div>}</div>);}

// ═══ P5 PROTOKÓŁ JSON ═══
function P5({mb,hist,T}){const S=mkS(T);const[tab,sTab]=useState("lv2web");
  const csv=()=>{if(!hist.length)return;const h="Czas,PV1,PV2,SP1,MV,OutAnalog\n";const r=hist.map(h=>`${h.t},${h.pv1.toFixed(2)},${h.pv2.toFixed(2)},${h.sp1.toFixed(2)},${h.mv.toFixed(1)},${(h.outA||0).toFixed(2)}`).join("\n");const b=new Blob([h+r],{type:"text/csv"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`thinfilm_${Date.now()}.csv`;a.click()};
  const schemas=tab==="lv2web"?JSON_LV2WEB:JSON_WEB2LV;
  return(<div style={{display:"grid",gap:12}}>
    <div style={S.card}><div style={S.title}><span>Protokół JSON — LabVIEW ↔ Kontroler</span></div>
      <div style={{display:"flex",gap:4,marginBottom:8}}>
        <button onClick={()=>sTab("lv2web")} style={{...S.btn,padding:"5px 10px",fontSize:10,background:tab==="lv2web"?"#0077b6":T.boxBg,color:tab==="lv2web"?"#fff":T.textM}}>LabVIEW → Web</button>
        <button onClick={()=>sTab("web2lv")} style={{...S.btn,padding:"5px 10px",fontSize:10,background:tab==="web2lv"?"#0077b6":T.boxBg,color:tab==="web2lv"?"#fff":T.textM}}>Web → LabVIEW</button></div>
      {schemas.map((s,i)=>(<div key={i} style={{...S.box,marginBottom:6}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:T.textA,fontSize:11,fontWeight:700}}>{s.type}</span><span style={{color:T.textD,fontSize:10}}>{s.desc}</span></div>
        <pre style={S.code}>{JSON.stringify(s.ex,null,2)}</pre></div>))}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <div style={S.card}><div style={S.title}><span>Eksport CSV</span></div>
        <div style={{color:T.textD,fontSize:11,marginBottom:8}}>Rekordów: <strong style={{color:T.pv2}}>{hist.length}</strong></div>
        <button onClick={csv} disabled={!hist.length} style={{...S.btn,background:hist.length?"#22aa44":"#888",opacity:hist.length?1:.4}}>📄 CSV</button></div>
      <div style={S.card}><div style={S.title}><span>Komunikacja</span></div>
        {[["WebSocket",mb.wsUrl,mb.wsConnected],["MODBUS-RTU",`Addr:${mb.modbusAddr}`,true],["MODBUS-TCP",`${mb.ethIP}:${mb.ethPort}`,true]].map(([l,d,on])=>(<div key={l} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",marginBottom:4,borderRadius:6,background:T.boxBg,border:`1px solid ${T.boxBorder}`}}><div style={{width:7,height:7,borderRadius:"50%",background:on?"#00cc66":"#999"}}/><div><div style={{color:T.tblT,fontSize:11,fontWeight:600}}>{l}</div><div style={{color:T.textD,fontSize:9,fontFamily:"monospace"}}>{d}</div></div></div>))}</div></div>
  </div>);}

// ═══ P6 LOGI ═══
function P6({logs,clearLogs,T}){const S=mkS(T);const[flt,sF]=useState("all");
  const cats={all:"Wszystkie",setpoint:"SP",mode:"Tryb",config:"Config",alarm:"Alarm",data:"Dane",export:"Export",ws:"WS",auth:"Auth"};
  const cc={setpoint:"#ffaa33",mode:"#33bbff",config:"#aa88ff",alarm:"#ff5577",data:"#33ddaa",export:"#77bbff",ws:"#ff88cc",auth:"#aacc55"};
  const fl=flt==="all"?logs:logs.filter(l=>l.cat===flt);
  const exp=()=>{const h="Czas,Kat,User,Akcja\n";const r=logs.map(l=>`${l.time},${l.cat},${l.user},${l.msg.replace(/,/g,";")}`).join("\n");const b=new Blob([h+r],{type:"text/csv"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`logs_${Date.now()}.csv`;a.click()};
  return(<div style={S.card}>
    <div style={S.title}><span>Logi akcji kontrolera</span><div style={{display:"flex",gap:4}}><span style={{color:T.textD,fontSize:10}}>{logs.length}</span>
      <button onClick={exp} style={{...S.btn,padding:"2px 8px",fontSize:10,background:"#22aa44"}}>CSV</button>
      <button onClick={clearLogs} style={{...S.btn,padding:"2px 8px",fontSize:10,background:"#aa2211"}}>🗑</button></div></div>
    <div style={{display:"flex",gap:3,marginBottom:8,flexWrap:"wrap"}}>{Object.entries(cats).map(([k,v])=><button key={k} onClick={()=>sF(k)} style={{padding:"3px 8px",borderRadius:6,border:"none",background:flt===k?"#0077b6":T.boxBg,color:flt===k?"#fff":T.textM,fontSize:10,fontWeight:600,cursor:"pointer"}}>{v}</button>)}</div>
    <div style={{maxHeight:380,overflowY:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{borderBottom:`1px solid ${T.cardBorder}`}}>
        {["Czas","Kat","User","Akcja"].map(h=><th key={h} style={{padding:"4px 6px",textAlign:"left",color:T.textM,fontWeight:600,fontSize:10,position:"sticky",top:0,background:T.tblH}}>{h}</th>)}</tr></thead>
        <tbody>{fl.slice().reverse().map((l,i)=>(<tr key={i} style={{borderBottom:`1px solid ${T.tblB}`,background:i%2?T.logAlt:"transparent"}}>
          <td style={{padding:"3px 6px",color:T.textD,fontFamily:"monospace",fontSize:9}}>{l.time}</td>
          <td style={{padding:"3px 6px"}}><span style={{color:cc[l.cat]||T.textM,fontWeight:600,fontSize:9,textTransform:"uppercase"}}>{l.cat}</span></td>
          <td style={{padding:"3px 6px",color:T.textM}}>{l.user}</td>
          <td style={{padding:"3px 6px",color:T.tblT}}>{l.msg}</td></tr>))}</tbody></table>
      {fl.length===0&&<div style={{color:T.textD,textAlign:"center",padding:20}}>Brak wpisów</div>}</div></div>);}

// ═══ FOOTER ═══
function Footer({T}){return(<footer style={{background:T.footBg,borderTop:`1px solid ${T.footB}`,padding:"8px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:4,flexShrink:0}}>
  <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:18,height:18,borderRadius:4,background:T.logoBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:6,fontWeight:800,color:"#fff"}}>TFL</div>
    <span style={{color:T.footT,fontSize:10}}>© 2026 <span style={{color:T.footL,fontWeight:600}}>{APP_NAME}</span></span></div>
  <div style={{fontSize:9,color:T.footT}}>Kontroler v{APP_VER} • WebSocket JSON ↔ LabVIEW • AR200.B</div>
  <div style={{fontSize:9,color:T.textD}}>React • Node.js • TimescaleDB</div></footer>);}

// ═══ MAIN APP ═══
export default function App(){
  const[user,setUser]=useState(null);const[dark,setDark]=useState(true);const[ac,sAc]=useState(1);
  const[mb,setMb]=useState(initMb);const[hist,setHist]=useState([]);const[alog,sAlog]=useState([]);
  const[toasts,sToasts]=useState([]);const[logs,sLogs]=useState([]);
  const[segs,setSegs]=useState([{name:"Rampa grzania",sp:200,ramp:5,hold:0},{name:"Wygrzewanie",sp:400,ramp:3,hold:60},{name:"Chłodzenie",sp:25,ramp:-10,hold:0}]);
  const[profileName,setProfileName]=useState("Spiekanie ZnO");
  const[sample,setSample]=useState({sampleId:"",material:"",substrate:"",method:"",thickness:"",targetGas:"",processTemp:"",pressure:"",atmosphere:"",sourcePower:"",processTime:"",gasFlow:"",operator:"",batchNo:"",goal:"",notes:""});
  const mbRef=useRef(mb);mbRef.current=mb;const segRef=useRef(segs);segRef.current=segs;const prevA=useRef({a1:false,a2:false});
  const T=dark?TH.dark:TH.light;const curUser=useRef("system");

  const toast=useCallback((msg,type="info")=>{const id=Date.now()+Math.random();sToasts(t=>[...t,{id,msg,type}]);setTimeout(()=>sToasts(t=>t.filter(x=>x.id!==id)),3500)},[]);
  const addAlm=useCallback((msg,sev="warning")=>{sAlog(l=>[...l.slice(-100),{time:new Date().toLocaleTimeString("pl-PL"),msg,sev}])},[]);
  const addLog=useCallback((msg,cat="info")=>{sLogs(l=>[...l.slice(-500),{time:new Date().toLocaleTimeString("pl-PL"),msg,cat,user:curUser.current}])},[]);
  const clearLogs=useCallback(()=>{sLogs([]);toast("Logi wyczyszczone","info")},[toast]);

  useEffect(()=>{if(!user)return;curUser.current=user.username;const iv=setInterval(()=>{
    setMb(m=>{const n1=(Math.random()-.5)*.3,n2=(Math.random()-.5)*.6;let pv1=m.pv1,mv=m.mv,sp1=m.sp1,intg=m.pidI,pErr=m.pidPrevE;
      let pStg=m.progStage,pSt=m.progStatus,pEl=m.progElapsed;const sg=segRef.current;
      if(pSt==="RUN"&&sg.length>0&&pStg>0&&pStg<=sg.length){const s=sg[pStg-1];sp1=s.sp;pEl+=1;const prev=pStg>1?sg[pStg-2].sp:25;const rt=Math.abs((s.sp-prev)/(Math.abs(s.ramp)||1))*60;if(pEl>=rt+s.hold*60){if(pStg<sg.length){pStg++;pEl=0}else{pSt="STOP";pStg=0;pEl=0}}}
      if(m.regStatus==="RUN"&&!m.manualMode){const e=sp1-pv1;const P=e/(m.pidPb||1);intg=m.pidTi>0?intg+(e*1)/m.pidTi:0;intg=Math.max(-50,Math.min(50,intg));const D=m.pidTd>0?((e-pErr)/1)*m.pidTd*.01:0;mv=Math.max(0,Math.min(m.limitPower,(P+intg+D)*20));pErr=e;pv1+=((mv/100)*.6-.12+n1*.15);}
      else if(m.regStatus==="RUN"&&m.manualMode){mv=m.mvManual;pv1+=(mv/100)*.6-.12+n1*.15;}else{pv1-=.08-n1*.1;mv=0;intg=0;}
      const pv2=Math.max(0,m.pv2+n2*.2);const outAnalog=4+(Math.max(0,Math.min(1,pv1/500))*16);
      const alarm1=pv1>sp1+m.hyst*5,alarm2=pv1<sp1-m.hyst*10,alarmSTB=alarm1||alarm2,alarmLATCH=m.alarmLATCH||alarmSTB;
      return{...m,pv1,pv2,ch3:(pv1+pv2)/2,mv,sp1,out1:mv>3,out2:alarm1,outAnalog,alarm1,alarm2,alarmSTB,alarmLATCH,pidI:intg,pidPrevE:pErr,progStage:pStg,progStatus:pSt,progElapsed:pEl,rtc:new Date()};});
    const m=mbRef.current;const now=new Date();const t=`${now.getMinutes().toString().padStart(2,"0")}:${now.getSeconds().toString().padStart(2,"0")}`;
    setHist(h=>[...h.slice(-150),{t,pv1:m.pv1,pv2:m.pv2,sp1:m.sp1,ch3:m.ch3,mv:m.manualMode?m.mvManual:m.mv,outA:m.outAnalog}]);
    if(m.alarm1&&!prevA.current.a1)addAlm(`HI: PV=${m.pv1.toFixed(1)}°C`,"danger");
    if(m.alarm2&&!prevA.current.a2)addAlm(`LO: PV=${m.pv1.toFixed(1)}°C`,"warning");
    prevA.current={a1:m.alarm1,a2:m.alarm2};
  },1000);return()=>clearInterval(iv);},[user,addAlm]);

  if(!user)return(<div style={{height:"100vh",overflow:"hidden"}}><style>{`@keyframes si{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}`}</style><LoginScreen onLogin={u=>{setUser(u);addLog(`Login: ${u.name} (${u.role})`,"auth")}} T={T}/></div>);

  const pages=[{id:1,label:"Monitoring",icon:"📊"},{id:2,label:"Ustawienia temp.",icon:"🌡"},{id:3,label:"Próbka i proces",icon:"🧪"},{id:4,label:"Konfiguracja",icon:"⚙"},{id:5,label:"Protokół JSON",icon:"📋"},{id:6,label:"Logi akcji",icon:"📜"}];
  const acc=pages.filter(p=>ROLE_ACCESS[user.role]?.includes(p.id));

  return(
    <div style={{height:"100vh",display:"flex",flexDirection:"column",background:T.bg,fontFamily:"'Segoe UI',system-ui,sans-serif",color:T.text,overflow:"hidden"}}>
      <style>{`@keyframes pa{0%,100%{opacity:1}50%{opacity:.5}}@keyframes si{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${T.sidebarBg}}::-webkit-scrollbar-thumb{background:${T.scroll};border-radius:3px}
        select option{background:${T.selBg};color:${T.text}}input[type=range]{height:5px}`}</style>
      <Toasts items={toasts} rm={id=>sToasts(t=>t.filter(x=>x.id!==id))} T={T}/>

      <header style={{background:T.headerBg,borderBottom:`1px solid ${T.cardBorder}`,padding:"0 14px",height:48,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:30,height:30,borderRadius:7,background:T.logoBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:"#fff"}}>TFL</div>
          <div><div style={{fontSize:12,fontWeight:700,color:T.textB}}>{APP_NAME} <span style={{fontSize:9,color:T.textD}}>v{APP_VER}</span></div>
            <div style={{fontSize:8,color:T.textD}}>Kontroler • WebSocket JSON ↔ LabVIEW • AR200.B</div></div></div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <Led on={mb.wsConnected} color="#00cc66" label="WS" T={T}/>
          <Led on={mb.regStatus==="RUN"} color="#ff8844" label={mb.manualMode?"MAN":"REG"} T={T}/>
          <Led on={mb.alarmSTB} color="#ff3366" label="ALM" T={T}/>
          {mb.progStatus==="RUN"&&<Led on={true} color="#ffaa00" label={`P${mb.progStage}`} T={T}/>}
          <div style={{color:T.textD,fontSize:10,borderLeft:`1px solid ${T.cardBorder}`,paddingLeft:8,fontFamily:"monospace"}}>{mb.rtc.toLocaleTimeString("pl-PL")}</div>
          <button onClick={()=>setDark(d=>!d)} title="Motyw" style={{width:36,height:20,borderRadius:10,border:`1px solid ${T.cardBorder}`,background:dark?"#1a2a3a":"#d0d8e0",cursor:"pointer",position:"relative",padding:0,flexShrink:0}}>
            <div style={{width:14,height:14,borderRadius:"50%",background:dark?"#00b4d8":"#ff9900",position:"absolute",top:2,left:dark?2:18,transition:"left .3s",fontSize:8,display:"flex",alignItems:"center",justifyContent:"center"}}>{dark?"🌙":"☀️"}</div></button>
          <div style={{padding:"2px 6px",borderRadius:5,background:T.userBg,border:`1px solid ${T.userB}`,fontSize:10,color:T.userT}}>👤 {user.name}</div>
          <button onClick={()=>{addLog(`Logout: ${user.name}`,"auth");setUser(null)}} style={{padding:"3px 8px",borderRadius:5,border:`1px solid ${T.loB}`,background:T.loBg,color:T.loT,fontSize:10,cursor:"pointer"}}>Wyloguj</button>
        </div></header>

      <div style={{display:"flex",flex:1,minHeight:0,overflow:"hidden"}}>
        <nav style={{width:185,background:T.sidebarBg,borderRight:`1px solid ${T.cardBorder}`,padding:"10px 6px",flexShrink:0,overflowY:"auto",overflowX:"hidden"}}>
          {acc.map(pg=>(<button key={pg.id} onClick={()=>sAc(pg.id)} style={{width:"100%",padding:"8px 10px",borderRadius:7,border:"none",textAlign:"left",marginBottom:2,cursor:"pointer",
            background:ac===pg.id?T.actTab:"transparent",color:ac===pg.id?T.textA:T.textM,fontSize:11,fontWeight:ac===pg.id?700:500,
            borderLeft:ac===pg.id?`3px solid ${T.textA}`:"3px solid transparent"}}><span style={{marginRight:4}}>{pg.icon}</span>{pg.label}</button>))}
          <div style={{marginTop:14,padding:6,borderTop:`1px solid ${T.titleB}`}}>
            <div style={{color:T.textD,fontSize:8,fontWeight:700,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>Status</div>
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              <ABadge on={mb.alarm1} label="HI" type="danger" T={T}/><ABadge on={mb.alarm2} label="LO" type="warning" T={T}/>
              <ABadge on={mb.alarmLATCH} label="LATCH" type="info" T={T}/><ABadge on={mb.regStatus==="RUN"} label="Regulacja" type="ok" T={T}/></div></div>
          <div style={{marginTop:8,padding:6,borderTop:`1px solid ${T.titleB}`}}>
            <div style={{fontSize:17,fontWeight:700,color:mb.alarm1?T.pv1A:T.pv1,fontFamily:"monospace"}}>{mb.pv1.toFixed(1)}<span style={{fontSize:9,color:T.textD}}>°C</span></div>
            <div style={{fontSize:9,color:T.textD}}>SP:{mb.sp1.toFixed(1)} MV:{(mb.manualMode?mb.mvManual:mb.mv).toFixed(0)}%</div>
            <div style={{fontSize:12,fontWeight:600,color:T.pv2,fontFamily:"monospace",marginTop:3}}>{mb.pv2.toFixed(1)}<span style={{fontSize:9,color:T.textD}}> l/min</span></div>
          </div></nav>
        <main style={{flex:1,padding:12,overflowY:"auto",overflowX:"hidden",minHeight:0}}>
          {ac===1&&<P1 mb={mb} hist={hist} alog={alog} profileName={profileName} T={T}/>}
          {ac===2&&<P2 mb={mb} setMb={setMb} toast={toast} segs={segs} setSegs={setSegs} profileName={profileName} setProfileName={setProfileName} addLog={addLog} T={T}/>}
          {ac===3&&<P3 sample={sample} setSample={setSample} toast={toast} addLog={addLog} T={T}/>}
          {ac===4&&<P4 mb={mb} setMb={setMb} toast={toast} addLog={addLog} T={T}/>}
          {ac===5&&<P5 mb={mb} hist={hist} T={T}/>}
          {ac===6&&<P6 logs={logs} clearLogs={clearLogs} T={T}/>}
        </main></div>
      <Footer T={T}/>
    </div>);
}
