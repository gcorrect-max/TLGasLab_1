import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ComposedChart } from "recharts";
import { writeDataPoint, queryHistory, influxHealth } from "./influx.js";

const APP_NAME = "Stanowisko 2 badania cienkich warstw dla sensorów gazu";
const APP_VER = "3.0";

const TH={
  dark:{bg:"linear-gradient(180deg,#080d14,#0a1018)",headerBg:"linear-gradient(90deg,#0a1520,#111a28,#0a1520)",sidebarBg:"#0a1018",cardBg:"linear-gradient(145deg,#111a28,#0d1520)",cardBorder:"#1a2a3a",inputBg:"#060a10",inputBorder:"#1a2a3a",inputText:"#d0dce8",boxBg:"#0a1018",boxBorder:"#1a2a3a",text:"#c0ccd8",textM:"#5a7090",textD:"#3a4a5a",textB:"#d0dce8",textA:"#00bbdd",titleC:"#8899aa",titleB:"#1a2233",gTrack:"#1a2332",gText:"#e0e8f0",gUnit:"#7a8ba8",grid:"#1a2233",tick:"#4a5a6a",badgeOff:"#0d141e",badgeOffB:"#1a2332",badgeOffT:"#3a4a5a",ledOff:"#2a3444",ledOffB:"#3a4a5a",ledOn:"#c8d8e8",ledOffT:"#556677",tblB:"#111a22",tblH:"#0d1520",tblT:"#b0c0d0",scroll:"#1a2a3a",selBg:"#0a1018",logoBg:"linear-gradient(135deg,#00b4d8,#0077b6)",userBg:"#111a28",userB:"#1a2a3a",userT:"#6a8aaa",loBg:"#1a0a1a",loB:"#2a1a2a",loT:"#aa5566",footBg:"#060a10",footB:"#1a2a3a",footT:"#3a4a5a",footL:"#4a7a9a",svgBg:"#0d1a2a",svgS:"#1a3050",fFill:"#1a0a0a",fStroke:"#2a1a1a",pv1:"#ff8855",pv1A:"#ff5566",pv2:"#55aaff",tEr:"#2a0a0f",tOk:"#0a2a12",tIn:"#0a1a2a",loginBg:"linear-gradient(135deg,#0a0e17,#111927,#0d1520)",loginCard:"linear-gradient(145deg,#131b2a,#0f1722)",loginCardB:"#1e2d42",actTab:"linear-gradient(135deg,#0d2040,#0a1830)",ttBg:"#111a28",codeBg:"#060a10",codeB:"#1a2a3a",codeT:"#88ccaa",logAlt:"#0c1420"},
  light:{bg:"linear-gradient(180deg,#f0f4f8,#e8ecf0)",headerBg:"linear-gradient(90deg,#fff,#f5f7fa,#fff)",sidebarBg:"#f5f7fa",cardBg:"linear-gradient(145deg,#fff,#f8fafc)",cardBorder:"#d0d8e0",inputBg:"#fff",inputBorder:"#c0c8d0",inputText:"#2a3040",boxBg:"#f5f7fa",boxBorder:"#d0d8e0",text:"#2a3040",textM:"#5a6a7a",textD:"#8a9aaa",textB:"#1a2030",textA:"#0077b6",titleC:"#5a6a7a",titleB:"#e0e4e8",gTrack:"#e0e4e8",gText:"#1a2030",gUnit:"#6a7a8a",grid:"#e0e4e8",tick:"#8a9aaa",badgeOff:"#f0f2f4",badgeOffB:"#d8dce0",badgeOffT:"#a0a8b0",ledOff:"#d0d8e0",ledOffB:"#b0b8c0",ledOn:"#2a3040",ledOffT:"#8a9aaa",tblB:"#e8ecf0",tblH:"#f5f7fa",tblT:"#3a4a5a",scroll:"#c0c8d0",selBg:"#fff",logoBg:"linear-gradient(135deg,#0077b6,#005f8a)",userBg:"#e8ecf0",userB:"#d0d8e0",userT:"#4a6a8a",loBg:"#fff0f0",loB:"#f0c0c0",loT:"#cc4455",footBg:"#e8ecf0",footB:"#d0d8e0",footT:"#7a8a9a",footL:"#0077b6",svgBg:"#e8f0f8",svgS:"#b0c8d8",fFill:"#fff0ee",fStroke:"#d0a8a0",pv1:"#dd5522",pv1A:"#cc2233",pv2:"#2277cc",tEr:"#fff0f0",tOk:"#f0fff4",tIn:"#f0f6ff",loginBg:"linear-gradient(135deg,#e8ecf0,#f0f4f8,#e4e8ec)",loginCard:"linear-gradient(145deg,#fff,#f5f7fa)",loginCardB:"#d0d8e0",actTab:"linear-gradient(135deg,#e0f0ff,#d0e8f8)",ttBg:"#fff",codeBg:"#f5f7fa",codeB:"#d0d8e0",codeT:"#226644",logAlt:"#f5f7fa"}
};

const USERS_INIT={admin:{password:"admin123",role:"admin",name:"Administrator",firstName:"Jan",lastName:"Kowalski",email:"admin@lab.pl",phone:"+48 600 100 100",theme:"dark"},operator:{password:"oper123",role:"user",name:"Operator",firstName:"Anna",lastName:"Nowak",email:"operator@lab.pl",phone:"",theme:"dark"},student:{password:"stud123",role:"student",name:"Student",firstName:"",lastName:"",email:"",phone:"",theme:"dark"},guest:{password:"guest",role:"guest",name:"Gość",firstName:"",lastName:"",email:"",phone:"",theme:"dark"}};
const ROLE_ACCESS={admin:[1,2,3,7,8,4,5,6,9],user:[1,2,3,7,8,4,5,6,9],student:[1,2,3,7,8,9],guest:[1,9]};

function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function dlBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.style.display="none";document.body.appendChild(a);a.click();setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url)},300)}
function nowISO(){return new Date().toISOString()}

const JSON_LV2WEB=[
  {type:"measurement_update",desc:"Pomiary co interwał",ex:{type:"measurement_update",ts:"ISO",data:{pv1:156.3,pv2:45.2,mv:67.4,out1:true,outAnalog:12.8,resistance:12500,gasMixTemp:23.4,gasMixHumidity:48.2,mfc:[{id:1,pv:120.5,sp:150,enabled:true},{id:2,pv:85.0,sp:100,enabled:true}]}}},
  {type:"status_update",desc:"Status regulacji",ex:{type:"status_update",ts:"ISO",data:{regMode:"PID",regStatus:"RUN",progStage:2}}},
  {type:"alarm_event",desc:"Alarm",ex:{type:"alarm_event",ts:"ISO",data:{alarmId:"AL_HI",severity:"danger",pv1:210.5}}},
  {type:"profile_status",desc:"Status profilu",ex:{type:"profile_status",ts:"ISO",data:{profileName:"Spiekanie ZnO",stage:2,stageName:"Wygrzewanie"}}},
  {type:"impedance_data",desc:"Dane impedancji",ex:{type:"impedance_data",ts:"ISO",data:{sweepId:1,points:[{f:1000000,z_re:51.2,z_im:-3.5},{f:100000,z_re:55.8,z_im:-18.2}]}}},
  {type:"config_data",desc:"Konfiguracja systemu (odpowiedź na config_request)",ex:{type:"config_data",ts:"ISO",data:{users:{},roles:{},mfc:[],pages:[],wsUrl:"ws://localhost:8080",ethIP:"192.168.1.100",ethPort:502}}},
];
const JSON_WEB2LV=[
  {type:"setpoint_command",desc:"Zmiana SP",ex:{type:"setpoint_command",ts:"ISO",data:{target:"sp1",value:200},user:"admin"}},
  {type:"mode_command",desc:"Tryb",ex:{type:"mode_command",ts:"ISO",data:{command:"start",regMode:"PID"},user:"admin"}},
  {type:"manual_mv",desc:"MV ręczne",ex:{type:"manual_mv",ts:"ISO",data:{mv:75},user:"op"}},
  {type:"profile_command",desc:"Profil",ex:{type:"profile_command",ts:"ISO",data:{command:"start",profile:{name:"Spiekanie",segments:[{name:"Rampa",sp:400,ramp:5,hold:0,flow:[100,50,0,0]}]}},user:"admin"}},
  {type:"pid_command",desc:"PID",ex:{type:"pid_command",ts:"ISO",data:{pidPb:4.2,pidTi:95,pidTd:24},user:"admin"}},
  {type:"sample_info",desc:"Próbka",ex:{type:"sample_info",ts:"ISO",data:{sampleId:"ZnO-001",material:"ZnO"},user:"admin"}},
  {type:"config_update",desc:"Konfiguracja",ex:{type:"config_update",ts:"ISO",data:{ethIP:"192.168.1.100"},user:"admin"}},
  {type:"mfc_config",desc:"Konfiguracja MFC",ex:{type:"mfc_config",ts:"ISO",data:{mfc:[{id:1,name:"MFC-1",gas:"N\u2082",gasComposition:"100% N\u2082",ip:"192.168.1.101",port:502,slaveAddr:1,maxFlow:500,unit:"sccm",enabled:false}]},user:"admin"}},
  {type:"mfc_setpoint",desc:"SP MFC",ex:{type:"mfc_setpoint",ts:"ISO",data:{id:1,sp:100},user:"operator"}},
  {type:"impedance_request",desc:"Żądanie pomiaru impedancji",ex:{type:"impedance_request",ts:"ISO",data:{f_min:0.01,f_max:1000000,n_points:60,mode:"sweep"},user:"operator"}},
  {type:"config_request",desc:"Żądanie konfiguracji przy starcie",ex:{type:"config_request",ts:"ISO",data:{},user:"admin"}},
];

function initMb(){return{pv1:25+Math.random()*2,pv2:23+Math.random()*2,pv1Name:"Termopara 1 (piec)",pv2Name:"Termopara 2 (próbka)",resistance:null,gasMixTemp:null,gasMixHumidity:null,ch3:0,mv:0,mvManual:50,manualMode:false,sp1:100,sp2:60,sp3:80,out1:false,out2:false,outAnalog:0,alarm1:false,alarm2:false,alarmSTB:false,alarmLATCH:false,regMode:"PID",regStatus:"RUN",pidPb:5,pidTi:120,pidTd:30,pidI:0,pidPrevE:0,limitPower:100,hyst:1,progStage:0,progStatus:"STOP",progElapsed:0,modbusAddr:1,baudRate:9600,charFmt:"8N1",ethIP:"192.168.1.100",ethPort:502,mqttBroker:"192.168.1.1",mqttPort:1883,mqttTopic:"LAB/ThinFilm",recStatus:"REC",recInterval:5,memUsed:42,rtc:new Date(),inType1:"TC-K",wsUrl:(()=>{try{return localStorage.getItem("tfl_wsurl")||"ws://localhost:6060"}catch{return"ws://localhost:6060"}})(),wsConnected:false,
mfc:[
  {id:1,name:"MFC-1",gas:"N\u2082",gasComposition:"100% N\u2082",ip:"192.168.1.101",port:502,slaveAddr:1,maxFlow:500,unit:"sccm",pv:0,sp:0,enabled:false},
  {id:2,name:"MFC-2",gas:"Ar",gasComposition:"100% Ar",ip:"192.168.1.102",port:502,slaveAddr:1,maxFlow:200,unit:"sccm",pv:0,sp:0,enabled:false},
  {id:3,name:"MFC-3",gas:"O\u2082",gasComposition:"100% O\u2082",ip:"192.168.1.103",port:502,slaveAddr:1,maxFlow:100,unit:"sccm",pv:0,sp:0,enabled:false},
  {id:4,name:"MFC-4",gas:"H\u2082S",gasComposition:"10 ppm H\u2082S/N\u2082",ip:"192.168.1.104",port:502,slaveAddr:1,maxFlow:50,unit:"sccm",pv:0,sp:0,enabled:false},
]}}

function mkS(T){return{
  card:{background:T.cardBg,borderRadius:12,padding:16,border:`1px solid ${T.cardBorder}`},
  title:{color:T.titleC,fontSize:14,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${T.titleB}`,display:"flex",justifyContent:"space-between",alignItems:"center"},
  input:{width:"100%",padding:"8px 10px",borderRadius:6,background:T.inputBg,border:`1px solid ${T.inputBorder}`,color:T.inputText,fontSize:15,outline:"none"},
  btn:{padding:"10px 18px",borderRadius:8,border:"none",color:T.textB,fontSize:14,fontWeight:600,cursor:"pointer"},
  box:{background:T.boxBg,borderRadius:8,padding:10,border:`1px solid ${T.boxBorder}`},
  lbl:{color:T.textM,fontSize:12,fontWeight:600,marginBottom:4},
  code:{background:T.codeBg,border:`1px solid ${T.codeB}`,borderRadius:8,padding:12,fontFamily:"monospace",fontSize:13,color:T.codeT,overflowX:"auto",whiteSpace:"pre-wrap",maxHeight:180,overflowY:"auto"},
};}

function Gauge({value,min,max,unit,label,sp,color="#00d4ff",warn,danger,size=140,T}){const rng=max-min,pct=Math.max(0,Math.min(1,(value-min)/rng));const sA=-225,eA=45,tA=eA-sA,ang=sA+pct*tA;const r=size/2-14,cx=size/2,cy=size/2;const p2c=a=>({x:cx+r*Math.cos(a*Math.PI/180),y:cy+r*Math.sin(a*Math.PI/180)});const arc=(s,e)=>{const a=p2c(s),b=p2c(e);return`M ${a.x} ${a.y} A ${r} ${r} 0 ${e-s>180?1:0} 1 ${b.x} ${b.y}`};let fc=color;if(danger&&value>=danger)fc="#ff3355";else if(warn&&value>=warn)fc="#ffaa00";const spA=sp!=null?sA+Math.max(0,Math.min(1,(sp-min)/rng))*tA:null,spP=spA!=null?p2c(spA):null;return(<div style={{textAlign:"center"}}><svg width={size} height={size*.7} viewBox={`0 0 ${size} ${size*.8}`}><path d={arc(sA,eA)} fill="none" stroke={T.gTrack} strokeWidth="9" strokeLinecap="round"/><path d={arc(sA,ang)} fill="none" stroke={fc} strokeWidth="9" strokeLinecap="round" style={{filter:`drop-shadow(0 0 5px ${fc}80)`}}/>{spP&&<circle cx={spP.x} cy={spP.y} r="4" fill="#ff3366" stroke="#fff" strokeWidth="1.5"/>}<text x={cx} y={cy-3} textAnchor="middle" fill={T.gText} fontSize="18" fontWeight="700" fontFamily="monospace">{typeof value==="number"?value.toFixed(1):value}</text><text x={cx} y={cy+12} textAnchor="middle" fill={T.gUnit} fontSize="10">{unit}</text></svg><div style={{color:T.textM,fontSize:11,marginTop:-4,fontWeight:600,letterSpacing:1,textTransform:"uppercase"}}>{label}</div></div>);}
function Led({on,color="#00ff88",label,T}){return(<div style={{display:"flex",alignItems:"center",gap:5,fontSize:13}}><div style={{width:9,height:9,borderRadius:"50%",background:on?color:T.ledOff,boxShadow:on?`0 0 5px ${color}88`:"none",border:`1px solid ${on?color:T.ledOffB}`}}/><span style={{color:on?T.ledOn:T.ledOffT}}>{label}</span></div>);}
function ABadge({on,label,type="warning",T}){const c={warning:["#ff990022","#ff9900","#ffaa33"],danger:["#ff336622","#ff3366","#ff5577"],info:["#00aaff22","#00aaff","#33bbff"],ok:["#00ff8822","#00ff88","#33ffaa"]}[type];return(<div style={{padding:"4px 8px",borderRadius:6,background:on?c[0]:T.badgeOff,border:`1px solid ${on?c[1]:T.badgeOffB}`,color:on?c[2]:T.badgeOffT,fontSize:12,fontWeight:600,animation:on&&type==="danger"?"pa 1s infinite":"none"}}>{on?"●":"○"} {label}</div>);}
function Toasts({items,rm,T}){return(<div style={{position:"fixed",top:56,right:14,zIndex:9999,display:"flex",flexDirection:"column",gap:6,maxWidth:320}}>{items.map(t=>(<div key={t.id} style={{padding:"9px 12px",borderRadius:10,background:t.type==="error"?T.tEr:t.type==="success"?T.tOk:T.tIn,border:`1px solid ${t.type==="error"?"#ff336644":t.type==="success"?"#00ff8844":"#00aaff44"}`,color:t.type==="error"?"#ff8899":t.type==="success"?"#22aa66":"#3388cc",fontSize:14,boxShadow:"0 4px 16px rgba(0,0,0,.15)",animation:"si .3s ease-out",display:"flex",justifyContent:"space-between",gap:8}}><span>{t.type==="error"?"⚠":t.type==="success"?"✓":"ℹ"} {t.msg}</span><button onClick={()=>rm(t.id)} style={{background:"none",border:"none",color:T.textD,cursor:"pointer",fontSize:16}}>×</button></div>))}</div>);}

// ═══ LOGIN ═══
function LoginScreen({onLogin,users,T}){const S=mkS(T);const[u,su]=useState("");const[p,sp]=useState("");const[err,se]=useState("");const[att,sa]=useState(0);
const go=()=>{const x=users[u];if(x&&x.password===p)onLogin({username:u,...x});else{sa(a=>a+1);se(att>=2?"Zbyt wiele prób.":"Nieprawidłowy login lub hasło.")}};
const onKey=e=>{if(e.key==="Enter")go()};
return(<div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:T.loginBg,fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
  <div style={{width:410,padding:38,borderRadius:16,background:T.loginCard,border:`1px solid ${T.loginCardB}`,boxShadow:"0 20px 60px rgba(0,0,0,.15)",animation:"si .5s ease-out"}}>
    <div style={{textAlign:"center",marginBottom:26}}>
      <div style={{width:60,height:60,borderRadius:14,margin:"0 auto 12px",background:T.logoBg,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 6px 20px rgba(0,180,216,.3)"}}><span style={{fontSize:22,fontWeight:800,color:"#fff"}}>TFL</span></div>
      <h1 style={{color:T.textB,fontSize:18,fontWeight:600,margin:"0 0 4px",lineHeight:1.3}}>{APP_NAME}</h1>
      <p style={{color:T.textM,fontSize:13,margin:0}}>Kontroler v{APP_VER} — WebSocket ↔ LabVIEW</p></div>
    <div>
      {[["UŻYTKOWNIK",u,su,"text","admin / operator / student / guest"],["HASŁO",p,sp,"password","Wprowadź hasło"]].map(([l,v,fn,t,ph])=>(
        <div key={l} style={{marginBottom:14}}><label style={{color:T.textM,fontSize:12,fontWeight:600,display:"block",marginBottom:4}}>{l}</label>
          <input type={t} value={v} onChange={e=>{fn(e.target.value);se("")}} onKeyDown={onKey} placeholder={ph} style={{...S.input,padding:"11px 14px",fontSize:15}}/></div>))}
      {err&&<div style={{background:"#ff336615",border:"1px solid #ff336644",borderRadius:8,padding:"8px 12px",marginBottom:14,color:"#ff6688",fontSize:14}}>⚠ {err}</div>}
      <button onClick={go} style={{width:"100%",padding:"12px",borderRadius:8,border:"none",background:T.logoBg,color:"#fff",fontSize:16,fontWeight:600,cursor:"pointer"}}>Zaloguj się</button></div>
    <div style={{textAlign:"center",marginTop:16,color:T.textD,fontSize:12}}>v{APP_VER} • WebSocket JSON • LabVIEW Bridge</div>
  </div></div>);}

// ═══ P1 MONITORING ═══
function P1({mb,setMb,hist,alog,profileName,setProfileName,diagram:D,customSvg,segs,setSegs,sample,setSample,user,addLog,toast,goPage:sAc,sendCmd,experiments,setExperiments,T}){const S=mkS(T);const TT={contentStyle:{background:T.ttBg,border:`1px solid ${T.cardBorder}`,borderRadius:8,fontSize:13,color:T.text}};
const crdL={...S.card,display:"flex",flexDirection:"column",overflow:"hidden"};
const[showConfirm,setShowConfirm]=useState(false);
const[pendingExp,setPendingExp]=useState(null);
const fileRef=useRef(null);
const[chartVis,setChartVis]=useState({profSP:true,pv1:true,pv2:true,sp1:true,mv:true,mfc1:true,mfc2:true,mfc3:true,mfc4:true,gasMixTemp:true,gasMixHumidity:true});
const togVis=k=>setChartVis(v=>({...v,[k]:!v[k]}));
const[histRange,setHistRange]=useState("live");
const[histData,setHistData]=useState([]);
const[histLoading,setHistLoading]=useState(false);
const loadRange=r=>{setHistRange(r);if(r==="live"){setHistData([]);return;}setHistLoading(true);queryHistory(r).then(d=>{setHistData(d);setHistLoading(false)}).catch(()=>setHistLoading(false))};
useEffect(()=>{if(histRange==="live")return;const iv=setInterval(()=>queryHistory(histRange).then(d=>setHistData(d)),15000);return()=>clearInterval(iv)},[histRange]);

// ── eksport bieżącego eksperymentu do JSON ──
const exportExp=()=>{const exp={type:"experiment",ver:APP_VER,app:APP_NAME,exportedAt:new Date().toISOString(),
  exportedBy:{username:user.username,role:user.role,name:user.name,firstName:user.firstName||"",lastName:user.lastName||""},
  profile:{name:profileName,segments:segs},sample:{...sample}};
  const b=new Blob([JSON.stringify(exp,null,2)],{type:"application/json"});dlBlob(b,`experiment_${(profileName||"exp").replace(/\s+/g,"_")}_${new Date().toISOString().slice(0,10)}.json`);
  addLog(`Eksport eksperymentu: ${profileName}`,"export");toast("JSON eksperymentu zapisany","success")};

// ── import JSON eksperymentu ──
const handleFile=(e)=>{const f=e.target.files?.[0];if(!f)return;if(!f.name.endsWith(".json")){toast("Tylko pliki .json","error");return;}
  const r=new FileReader();r.onload=(ev)=>{try{const j=JSON.parse(ev.target.result);
    if(!j.profile?.segments||!j.sample){toast("Nieprawidłowy format pliku eksperymentu","error");return;}
    setPendingExp({...j,_fileName:f.name});setShowConfirm(true);
  }catch(err){toast(`Błąd parsowania JSON: ${err.message}`,"error")}};r.readAsText(f);
  e.target.value=""};

// ── potwierdź i uruchom eksperyment ──
const confirmExp=()=>{if(!pendingExp)return;const ex=pendingExp;
  // Apply profile
  if(ex.profile.name)setProfileName(ex.profile.name);
  if(ex.profile.segments?.length)setSegs(ex.profile.segments.map(s=>({...s,flow:s.flow||[0,0,0,0]})));
  // Apply sample
  const sKeys=["sampleId","material","substrate","method","thickness","targetGas","processTemp","pressure","atmosphere","sourcePower","processTime","gasFlow","operator","batchNo","goal","notes"];
  const ns={};for(const k of sKeys)ns[k]=ex.sample[k]||"";ns.photos=Array.isArray(ex.sample.photos)?ex.sample.photos:[];
  setSample(ns);
  // Start program
  const sp=ex.profile.segments?.[0]?.sp||100;
  setMb(m=>({...m,progStatus:"RUN",progStage:1,progElapsed:0,sp1:sp}));
  sendCmd?.("profile_command",{action:"start",profileName:ex.profile.name||"Imported",segments:ex.profile.segments||[]});
  sendCmd?.("sample_info",ns);
  // Save to experiments history
  const record={id:Date.now(),loadedAt:new Date().toISOString(),loadedBy:{username:user.username,role:user.role,name:user.name},
    fileName:ex._fileName||"unknown.json",exportedBy:ex.exportedBy||null,exportedAt:ex.exportedAt||null,
    profile:{name:ex.profile.name,segments:ex.profile.segments},sample:ns,status:"RUN"};
  setExperiments(prev=>[record,...prev]);
  addLog(`Eksperyment załadowany i uruchomiony: ${ex.profile.name} (${ex._fileName})`,"mode");
  toast("Eksperyment uruchomiony!","success");setShowConfirm(false);setPendingExp(null)};

const pe=pendingExp;
return(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gridTemplateRows:"3fr 2fr",gap:10,height:"100%"}}>
  <div style={{...crdL,gridColumn:1,gridRow:"1 / 3",minHeight:0}}><div style={{...S.title,flexShrink:0}}><span>Schemat stanowiska</span></div>
    <div style={{flex:1,minHeight:0,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",borderRadius:6}}>
    {customSvg?<div dangerouslySetInnerHTML={{__html:customSvg}} style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}/>:
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="-0.5 -0.5 810 912" style={{width:"auto",height:"100%",maxWidth:"100%",display:"block"}}>
      <defs/>
      <g>
        <path d="M 568 260 L 568 460 L 278.1 460" fill="none" stroke={T.text} strokeWidth="3" strokeMiterlimit="10"/>
        <path d="M 271.35 460 L 280.35 455.5 L 278.1 460 L 280.35 464.5 Z" fill={T.text} stroke={T.text} strokeWidth="3" strokeMiterlimit="10"/>
        <path d="M 408 260 L 408 340 L 158 340 L 158 140 L 91.33 140 L 91.33 169.9" fill="none" stroke={T.text} strokeWidth="3" strokeMiterlimit="10"/>
        <path d="M 91.33 176.65 L 86.83 167.65 L 91.33 169.9 L 95.83 167.65 Z" fill={T.text} stroke={T.text} strokeWidth="3" strokeMiterlimit="10"/>
        <path d="M 248 260 L 248 429.9" fill="none" stroke={T.text} strokeWidth="3" strokeMiterlimit="10"/>
        <path d="M 248 436.65 L 243.5 427.65 L 248 429.9 L 252.5 427.65 Z" fill={T.text} stroke={T.text} strokeWidth="3" strokeMiterlimit="10"/>
        <rect x="233" y="80" width="30" height="40" fill="none" stroke={T.text} strokeWidth="3"/>
        <rect x="233" y="238" width="30" height="40" fill="none" stroke={T.text} strokeWidth="3"/>
        <rect x="393" y="80" width="30" height="40" fill="none" stroke={T.text} strokeWidth="3"/>
        <rect x="393" y="238" width="30" height="40" fill="none" stroke={T.text} strokeWidth="3"/>
        <rect x="553" y="81" width="30" height="40" fill="none" stroke={T.text} strokeWidth="3"/>
        <rect x="553" y="239" width="30" height="40" fill="none" stroke={T.text} strokeWidth="3"/>
        <path d="M 248 480 L 248 579.9" fill="none" stroke={T.text} strokeWidth="3" strokeMiterlimit="10"/>
        <path d="M 248 586.65 L 243.5 577.65 L 248 579.9 L 252.5 577.65 Z" fill={T.text} stroke={T.text} strokeWidth="3" strokeMiterlimit="10"/>
        <ellipse cx="248" cy="460" rx="20" ry="20" fill="none" stroke={T.text}/>
        <rect x="38" y="261.4" width="80" height="39.3" fill="#3399ff" stroke={T.text}/>
        <rect x="58" y="180" width="13.33" height="70.18" fill="none" stroke={T.text}/>
        <rect x="38" y="238.95" width="80" height="61.75" fill="none" stroke={T.text}/>
        <path d="M 38 308 L 58 300.7 L 98 300.7 L 118 308 Z" fill="#3399ff" stroke={T.text} strokeMiterlimit="10" transform="translate(0,304.35)scale(1,-1)translate(0,-304.35)"/>
        <rect x="84.67" y="180" width="13.33" height="115.09" fill="none" stroke={T.text} strokeDasharray="3 3"/>
        <path d="M 38 238.95 L 58 216.49 L 98 216.49 L 118 238.95 Z" fill="none" stroke={T.text} strokeMiterlimit="10"/>
        <rect x="58" y="210" width="40" height="6.49" fill="none" stroke={T.text} strokeWidth="2"/>
        <rect x="53" y="190" width="50" height="20" fill="none" stroke={T.text} strokeWidth="2"/>
        <path d="M 248 630 L 248 679.9" fill="none" stroke={T.text} strokeWidth="3" strokeMiterlimit="10"/>
        <path d="M 248 686.65 L 243.5 677.65 L 248 679.9 L 252.5 677.65 Z" fill={T.text} stroke={T.text} strokeWidth="3" strokeMiterlimit="10"/>
        <ellipse cx="248" cy="610" rx="20" ry="20" fill="none" stroke={T.text} strokeWidth="5"/>
        <path d="M 64.67 180 L 64.67 140 L 8 140 L 8 460 L 217.9 460" fill="none" stroke={T.text} strokeWidth="3" strokeMiterlimit="10"/>
        <path d="M 224.65 460 L 215.65 464.5 L 217.9 460 L 215.65 455.5 Z" fill={T.text} stroke={T.text} strokeWidth="3" strokeMiterlimit="10"/>
        <path d="M 243 280.5 L 253 280.5 L 253 300.5 L 263.5 300.5 L 248 319.5 L 232.5 300.5 L 243 300.5 Z" fill="#b3b3b3" stroke="#b3b3b3" strokeLinejoin="round" strokeMiterlimit="10"/>
        <path d="M 402.86 280.5 L 412.86 280.5 L 412.86 300.5 L 423.36 300.5 L 407.86 319.5 L 392.36 300.5 L 402.86 300.5 Z" fill="#b3b3b3" stroke="#b3b3b3" strokeLinejoin="round" strokeMiterlimit="10"/>
        <path d="M 562.58 280.5 L 572.58 280.5 L 572.58 300.5 L 583.08 300.5 L 567.58 319.5 L 552.08 300.5 L 562.58 300.5 Z" fill="#b3b3b3" stroke="#b3b3b3" strokeLinejoin="round" strokeMiterlimit="10"/>
        <path d="M 248.5 34 L 248.5 24 L 402.98 24 Q 413.02 24 412.98 34.04 L 412.88 59.52 L 423.38 59.56 L 407.8 78.5 L 392.38 59.44 L 402.88 59.48 L 402.98 34 Z" fill="none" stroke={T.text} strokeLinejoin="round" strokeMiterlimit="10"/>
        <path d="M 412.88 59.52 L 423.38 59.56 L 407.8 78.5 L 392.38 59.44 L 402.88 59.48" fill="none" stroke={T.text} strokeMiterlimit="4"/>
        <path d="M 243 -0.5 L 253 -0.5 L 253 59.5 L 263.5 59.5 L 248 78.5 L 232.5 59.5 L 243 59.5 Z" fill="none" stroke={T.text} strokeLinejoin="round" strokeMiterlimit="10"/>
        <path d="M 562.8 -0.5 L 572.8 -0.5 L 572.8 59.5 L 583.3 59.5 L 567.8 78.5 L 552.3 59.5 L 562.8 59.5 Z" fill="#b3b3b3" stroke={T.text} strokeLinejoin="round" strokeMiterlimit="10"/>
        <path d="M 262.14 474.14 L 233.86 445.86" fill="none" stroke={T.text} strokeMiterlimit="10"/>
        <path d="M 262.14 445.86 L 233.86 474.14" fill="none" stroke={T.text} strokeMiterlimit="10"/>
        {[{x:208,cx:248,idx:0,label:"MKS1"},{x:368,cx:408,idx:1,label:"MKS2"},{x:528,cx:568,idx:2,label:"MKS3"}].map(({x,cx,idx,label})=>{const d=mb.mfc[idx];return(<g key={label}>
          <rect x={x} y="100" width="80" height="160" fill="none" stroke={T.text} strokeWidth="5"/>
          <text x={cx} y="140" fill={T.textM} fontFamily="Helvetica" fontSize="14px" textAnchor="middle" fontWeight="bold">{label}</text>
          <text x={cx} y="165" fill={T.text} fontFamily="Helvetica" fontSize="18px" textAnchor="middle" fontWeight="bold">{d?.pv!=null?d.pv.toFixed(1):"—"}</text>
          <text x={cx} y="185" fill={T.textD} fontFamily="Helvetica" fontSize="13px" textAnchor="middle">{d?.unit||"sccm"}</text>
          <text x={cx} y="207" fill={T.textA} fontFamily="Helvetica" fontSize="14px" textAnchor="middle" fontWeight="bold">{d?.gas||""}</text>
        </g>)})}
        <rect x="713" y="81" width="30" height="40" fill="none" stroke={T.text} strokeWidth="3"/>
        <rect x="713" y="239" width="30" height="40" fill="none" stroke={T.text} strokeWidth="3"/>
        <path d="M 722.58 280.5 L 732.58 280.5 L 732.58 300.5 L 743.08 300.5 L 727.58 319.5 L 712.08 300.5 L 722.58 300.5 Z" fill="#b3b3b3" stroke="#b3b3b3" strokeLinejoin="round" strokeMiterlimit="10"/>
        <path d="M 722.8 -0.5 L 732.8 -0.5 L 732.8 59.5 L 743.3 59.5 L 727.8 78.5 L 712.3 59.5 L 722.8 59.5 Z" fill="#b3b3b3" stroke={T.text} strokeLinejoin="round" strokeMiterlimit="10"/>
        {(()=>{const d=mb.mfc[3];return(<g>
          <rect x="688" y="100" width="80" height="160" fill="none" stroke={T.text} strokeWidth="5"/>
          <text x="728" y="140" fill={T.textM} fontFamily="Helvetica" fontSize="14px" textAnchor="middle" fontWeight="bold">MKS4</text>
          <text x="728" y="165" fill={T.text} fontFamily="Helvetica" fontSize="18px" textAnchor="middle" fontWeight="bold">{d?.pv!=null?d.pv.toFixed(1):"—"}</text>
          <text x="728" y="185" fill={T.textD} fontFamily="Helvetica" fontSize="13px" textAnchor="middle">{d?.unit||"sccm"}</text>
          <text x="728" y="207" fill={T.textA} fontFamily="Helvetica" fontSize="14px" textAnchor="middle" fontWeight="bold">{d?.gas||""}</text>
        </g>)})()}
        <rect x="273" y="580" width="200" height="72" fill="none" stroke={T.cardBorder} strokeWidth="2" rx="6"/>
        <text x="373" y="598" fill={T.textM} fontFamily="Helvetica" fontSize="13px" textAnchor="middle">SENSIRION</text>
        <text x="283" y="622" fill={T.text} fontFamily="Helvetica" fontSize="15px" fontWeight="bold">
          {"T: "}{mb.gasMixTemp!=null?`${mb.gasMixTemp.toFixed(1)} °C`:"— °C"}
        </text>
        <text x="283" y="644" fill={T.textA} fontFamily="Helvetica" fontSize="15px" fontWeight="bold">
          {"RH: "}{mb.gasMixHumidity!=null?`${mb.gasMixHumidity.toFixed(1)} %`:"— %"}
        </text>
        <text x="81" y="335" fill={T.text} fontFamily="Helvetica" fontSize="16px" textAnchor="middle">Nawilzanie</text>
        <text x="81" y="355" fill={T.text} fontFamily="Helvetica" fontSize="16px" textAnchor="middle">powietrza</text>
        <text x="163" y="22" fill={T.text} fontFamily="Helvetica" fontSize="20px" textAnchor="middle">POWIETRZE</text>
        <text x="163" y="46" fill={T.text} fontFamily="Helvetica" fontSize="20px" textAnchor="middle">Z BUTLI</text>
        <text x="618" y="36" fill={T.text} fontFamily="Helvetica" fontSize="20px" textAnchor="middle">GAZ 1</text>
        <text x="773" y="36" fill={T.text} fontFamily="Helvetica" fontSize="20px" textAnchor="middle">GAZ2</text>
        <text x="378" y="455" fill={T.text} fontFamily="Helvetica" fontSize="16px" textAnchor="middle">GAZ1</text>
        <text x="255" y="390" fill={T.text} fontFamily="Helvetica" fontSize="16px">Powietrze</text>
        <text x="255" y="410" fill={T.text} fontFamily="Helvetica" fontSize="16px">suche</text>
        <text x="113" y="454" fill={T.text} fontFamily="Helvetica" fontSize="16px" textAnchor="middle">Powietrze wilgotne</text>
        <path d="M 728 320 L 728 520 L 278.1 520" fill="none" stroke={T.text} strokeWidth="3" strokeMiterlimit="10"/>
        <path d="M 271.35 520 L 280.35 515.5 L 278.1 520 L 280.35 524.5 Z" fill={T.text} stroke={T.text} strokeWidth="3" strokeMiterlimit="10"/>
        <ellipse cx="248" cy="520" rx="20" ry="20" fill="none" stroke={T.text}/>
        <path d="M 263 534.14 L 234.72 505.86" fill="none" stroke={T.text} strokeMiterlimit="10"/>
        <path d="M 263 505.86 L 234.72 534.14" fill="none" stroke={T.text} strokeMiterlimit="10"/>
        <text x="378" y="515" fill={T.text} fontFamily="Helvetica" fontSize="16px" textAnchor="middle">GAZ2</text>
        <path d="M 253 34 L 253 24" fill="none" stroke="transparent" strokeWidth="3" strokeMiterlimit="10"/>
        <rect x="138" y="690" width="220" height="220" fill="none" stroke={T.cardBorder} strokeWidth="2"/>
        <ellipse cx="248" cy="800" rx="80" ry="80" fill="none" stroke={T.text} strokeWidth="2"/>
        <rect x="188" y="766" width="120" height="64" fill="none" stroke={T.cardBorder} strokeWidth="3"/>
        <text x="248" y="782" fill={T.text} fontFamily="Helvetica" fontSize="16px" textAnchor="middle">Rezystancja</text>
        {mb.resistance!=null
          ?<text x="248" y="820" fill="#ff6666" fontFamily="Helvetica" fontSize="24px" textAnchor="middle" fontWeight="bold">{mb.resistance>=1e6?(mb.resistance/1e6).toFixed(2)+" MΩ":mb.resistance>=1e3?(mb.resistance/1e3).toFixed(1)+" kΩ":mb.resistance.toFixed(0)+" Ω"}</text>
          :<text x="248" y="820" fill={T.textD} fontFamily="Helvetica" fontSize="22px" textAnchor="middle">— Ω</text>
        }
        <rect x="78" y="720" width="60" height="20" fill="none" stroke={T.text} strokeWidth="3"/>
        <rect x="78" y="857" width="60" height="20" fill="none" stroke={T.text} strokeWidth="3"/>
        <rect x="375" y="700" width="390" height="200" fill="none" stroke={T.cardBorder} strokeWidth="2" rx="6"/>
        <text x="570" y="724" fill={T.textM} fontFamily="Helvetica" fontSize="13px" textAnchor="middle">Próbka</text>
        <text x="391" y="754" fill={T.textM} fontFamily="Helvetica" fontSize="12px">ID:</text>
        <text x="391" y="754" dx="28" fill={T.text} fontFamily="Helvetica" fontSize="14px" fontWeight="bold">{sample?.sampleId||"—"}</text>
        <text x="391" y="778" fill={T.textM} fontFamily="Helvetica" fontSize="12px">Materiał:</text>
        <text x="391" y="778" dx="60" fill={T.text} fontFamily="Helvetica" fontSize="14px">{sample?.material||"—"}</text>
        <text x="391" y="802" fill={T.textM} fontFamily="Helvetica" fontSize="12px">Podłoże:</text>
        <text x="391" y="802" dx="60" fill={T.text} fontFamily="Helvetica" fontSize="14px">{sample?.substrate||"—"}</text>
        <text x="391" y="826" fill={T.textM} fontFamily="Helvetica" fontSize="12px">Metoda:</text>
        <text x="391" y="826" dx="54" fill={T.text} fontFamily="Helvetica" fontSize="14px">{sample?.method||"—"}</text>
        <text x="391" y="850" fill={T.textM} fontFamily="Helvetica" fontSize="12px">Operator:</text>
        <text x="391" y="850" dx="62" fill={T.text} fontFamily="Helvetica" fontSize="14px">{sample?.operator||"—"}</text>
        <text x="391" y="874" fill={T.textM} fontFamily="Helvetica" fontSize="12px">Uwagi:</text>
        <text x="391" y="874" dx="46" fill={T.textD} fontFamily="Helvetica" fontSize="12px" fontStyle="italic">{sample?.notes||"—"}</text>
      </g>
    </svg>}</div></div>

  <div style={{...crdL,gridColumn:2,gridRow:1,minHeight:0}}><div style={{...S.title,flexShrink:0}}><span>Temperatura i przepływ — {profileName||"brak profilu"}</span>
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <div style={{display:"flex",gap:3}}>{mb.mfc.map((d,i)=>d.enabled&&<span key={d.id} style={{fontSize:14,padding:"1px 5px",borderRadius:3,background:["#00aaff22","#ffaa0022","#00cc6622","#cc44ff22"][i],color:["#44bbff","#ffbb33","#33dd77","#dd66ff"][i],fontWeight:600}}>{d.gas}</span>)}</div>
      <span style={{fontSize:15,color:mb.regStatus==="RUN"?"#00cc66":"#ff6644"}}>● {mb.regStatus}{mb.manualMode?" MAN":" AUTO"}</span></div></div>
    <div style={{display:"flex",gap:3,marginBottom:4,flexShrink:0}}>{[["live","Na żywo"],["-1h","1h"],["-6h","6h"],["-24h","24h"],["-7d","7d"]].map(([k,l])=>(<button key={k} onClick={()=>loadRange(k)} style={{padding:"2px 7px",borderRadius:4,border:"none",fontSize:14,fontWeight:600,cursor:"pointer",background:histRange===k?T.actTab:T.boxBg,color:histRange===k?T.textA:T.textM}}>{l}</button>))}{histLoading&&<span style={{fontSize:14,color:T.textD,alignSelf:"center"}}>⏳</span>}</div>
    <div style={{flex:1,minHeight:0}}>
    <ResponsiveContainer width="100%" height="100%"><ComposedChart data={histRange==="live"?hist.slice(-80):histData}>
      <CartesianGrid strokeDasharray="3 3" stroke={T.grid}/><XAxis dataKey="t" tick={{fill:T.tick,fontSize:17}} stroke={T.grid} interval="preserveStartEnd"/>
      <YAxis yAxisId="temp" tick={{fill:T.tick,fontSize:17}} stroke={T.grid} domain={["auto","auto"]} label={{value:"°C",position:"insideTopLeft",fill:T.tick,fontSize:17}}/>
      <YAxis yAxisId="flow" orientation="right" tick={{fill:T.tick,fontSize:17}} stroke={T.grid} domain={[0,"auto"]} label={{value:"sccm",position:"insideTopRight",fill:T.tick,fontSize:17}}/>
      <YAxis yAxisId="rh" orientation="right" tick={{fill:T.tick,fontSize:15}} stroke={T.grid} domain={[0,100]} width={32} label={{value:"%",position:"insideTopRight",fill:T.tick,fontSize:17}}/>
      <Tooltip {...TT}/>
      {chartVis.profSP&&<Line yAxisId="temp" type="stepAfter" dataKey="profSP" stroke="#555577" strokeWidth={2.5} strokeDasharray="8 4" dot={false} name="Profil temp." isAnimationActive={false}/>}
      {chartVis.pv1&&<Line yAxisId="temp" type="monotone" dataKey="pv1" stroke="#ff6644" strokeWidth={2} dot={false} name={mb.pv1Name||"PV1"} isAnimationActive={false}/>}
      {chartVis.pv2&&<Line yAxisId="temp" type="monotone" dataKey="pv2" stroke="#aa44ff" strokeWidth={2} dot={false} name={mb.pv2Name||"PV2"} isAnimationActive={false}/>}
      {chartVis.sp1&&<Line yAxisId="temp" type="monotone" dataKey="sp1" stroke="#00cc66" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="Nastawa temp." isAnimationActive={false}/>}
      {chartVis.mv&&<Line yAxisId="temp" type="monotone" dataKey="mv" stroke="#ffaa00" strokeWidth={1} dot={false} name="MV%" isAnimationActive={false}/>}
      {chartVis.gasMixTemp&&<Line yAxisId="temp" type="monotone" dataKey="gasMixTemp" stroke="#ff88cc" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="T miesz." isAnimationActive={false}/>}
      {chartVis.gasMixHumidity&&<Line yAxisId="rh" type="monotone" dataKey="gasMixHumidity" stroke="#44ddff" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="RH miesz." isAnimationActive={false}/>}
      {chartVis.mfc1&&<Line yAxisId="flow" type="monotone" dataKey="mfc1" stroke="#00aaff" strokeWidth={2} dot={false} name={mb.mfc[0]?.gas||"MFC1"} isAnimationActive={false}/>}
      {chartVis.mfc2&&<Line yAxisId="flow" type="monotone" dataKey="mfc2" stroke="#ffaa00" strokeWidth={2} dot={false} name={mb.mfc[1]?.gas||"MFC2"} isAnimationActive={false}/>}
      {chartVis.mfc3&&<Line yAxisId="flow" type="monotone" dataKey="mfc3" stroke="#00cc66" strokeWidth={2} dot={false} name={mb.mfc[2]?.gas||"MFC3"} isAnimationActive={false}/>}
      {chartVis.mfc4&&<Line yAxisId="flow" type="monotone" dataKey="mfc4" stroke="#cc44ff" strokeWidth={2} dot={false} name={mb.mfc[3]?.gas||"MFC4"} isAnimationActive={false}/>}
    </ComposedChart></ResponsiveContainer></div>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",padding:"4px 0",flexShrink:0,alignItems:"center"}}>
      {[["profSP","#555577","Profil temp."],["pv1","#ff6644",mb.pv1Name||"PV1"],["pv2","#aa44ff",mb.pv2Name||"PV2"],["sp1","#00cc66","Nastawa temp."],["mv","#ffaa00","MV%"],["gasMixTemp","#ff88cc","T miesz."],["gasMixHumidity","#44ddff","RH miesz."]].map(([k,c,l])=>(
        <label key={k} style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",fontSize:17,color:chartVis[k]?c:T.textD,opacity:chartVis[k]?1:.45,userSelect:"none"}}>
          <input type="checkbox" checked={chartVis[k]} onChange={()=>togVis(k)} style={{width:14,height:14,accentColor:c}}/>{l}</label>))}
      <span style={{color:T.titleB,margin:"0 4px"}}>│</span>
      {[[1,"#00aaff"],[2,"#ffaa00"],[3,"#00cc66"],[4,"#cc44ff"]].map(([i,c])=>{const k=`mfc${i}`;const d=mb.mfc[i-1];return(
        <label key={k} style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",fontSize:17,color:chartVis[k]?c:T.textD,opacity:chartVis[k]?1:.45,userSelect:"none"}}>
          <input type="checkbox" checked={chartVis[k]} onChange={()=>togVis(k)} style={{width:14,height:14,accentColor:c}}/>{d?.gas||`MFC${i}`}</label>)})}</div></div>

  <div style={{...crdL,gridColumn:2,gridRow:2}}><div style={{...S.title,flexShrink:0}}><span>Sterowanie eksperymentem</span>
    <span style={{fontSize:16,color:mb.progStatus==="RUN"?"#00cc66":T.textD}}>{mb.progStatus==="RUN"?`▶ Etap ${mb.progStage}`:"STOP"}</span></div>
    <div style={{flex:1,minHeight:0,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,padding:"4px 0"}}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        <input ref={fileRef} type="file" accept=".json" onChange={handleFile} style={{display:"none"}}/>
        <button onClick={()=>fileRef.current?.click()} style={{...S.btn,background:T.boxBg,fontSize:17,padding:"8px 14px"}}>📂 Załaduj eksperyment</button>
        <button onClick={exportExp} style={{...S.btn,background:T.boxBg,fontSize:17,padding:"8px 14px"}}>📥 Eksportuj bieżący</button></div>
      <div style={{fontSize:15,color:T.textM,lineHeight:1.5}}>
        Plik JSON zawiera profil temperaturowy, dane próbki i operatora. Załadowanie pliku otworzy podgląd z potwierdzeniem przed uruchomieniem.</div>
      {alog.length>0&&<div style={{borderTop:`1px solid ${T.titleB}`,paddingTop:6}}>
        <div style={{fontSize:16,fontWeight:600,color:T.textM,marginBottom:4}}>Ostatnie alarmy ({alog.length})</div>
        {alog.slice(-6).reverse().map((a,i)=>(<div key={i} style={{display:"flex",gap:5,padding:"2px 5px",borderBottom:`1px solid ${T.tblB}`,color:a.sev==="danger"?"#ff7788":"#ffbb55",fontSize:15}}>
          <span style={{color:T.textD,fontFamily:"monospace",fontSize:13}}>{a.time}</span><span>{a.msg}</span></div>))}</div>}
    </div></div>

  <div style={{...S.card,gridColumn:"1 / -1",display:"none"}}>
    <div style={S.title}><span>Panel przepływomierzy — status</span></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
      {mb.mfc.map((d,i)=>{const col=["#00aaff","#ffaa00","#00cc66","#cc44ff"][i];return(
        <div key={d.id} style={{...S.box,borderColor:d.enabled?col:T.boxBorder,opacity:d.enabled?1:.5}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:13,fontWeight:700,color:col}}>{d.name}</span>
            <span style={{fontSize:10,padding:"1px 5px",borderRadius:3,background:d.enabled?`${col}22`:T.badgeOff,color:d.enabled?col:T.badgeOffT,fontWeight:600}}>{d.enabled?"ON":"OFF"}</span></div>
          <div style={{fontSize:11,color:T.textM,marginBottom:4}}>{d.gas} — {d.gasComposition}</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
            <div><span style={{fontSize:20,fontWeight:700,color:col,fontFamily:"monospace"}}>{d.pv.toFixed(1)}</span><span style={{fontSize:11,color:T.textD,marginLeft:2}}>{d.unit}</span></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:10,color:T.textD}}>SP</div><span style={{fontSize:14,fontWeight:600,color:T.textM,fontFamily:"monospace"}}>{d.sp.toFixed(1)}</span></div></div>
          <div style={{marginTop:4,height:3,borderRadius:2,background:T.gTrack}}><div style={{height:"100%",borderRadius:2,background:col,width:`${d.maxFlow>0?Math.min(100,(d.pv/d.maxFlow)*100):0}%`}}/></div>
        </div>)})}
    </div></div>

  {showConfirm&&pe&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}} onClick={()=>{setShowConfirm(false);setPendingExp(null)}}>
    <div onClick={e=>e.stopPropagation()} style={{background:T.cardBg,border:`1px solid ${T.cardBorder}`,borderRadius:16,padding:0,minWidth:500,maxWidth:620,maxHeight:"85vh",boxShadow:"0 20px 60px rgba(0,0,0,.4)",animation:"si .2s ease-out",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"18px 24px 12px",borderBottom:`1px solid ${T.cardBorder}`,flexShrink:0}}>
        <div style={{fontSize:17,fontWeight:700,color:T.textB}}>📂 Załaduj i uruchom eksperyment</div>
        <div style={{fontSize:13,color:T.textD,marginTop:4}}>Plik: <span style={{color:T.textA,fontFamily:"monospace"}}>{pe._fileName}</span></div>
        {pe.exportedBy&&<div style={{fontSize:12,color:T.textD,marginTop:2}}>Eksportował: {pe.exportedBy.name||pe.exportedBy.username} • {pe.exportedAt?new Date(pe.exportedAt).toLocaleString("pl-PL"):""}</div>}</div>
      <div style={{overflowY:"auto",padding:"12px 24px",flex:1}}>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:700,color:T.textA,marginBottom:6}}>🌡 Profil temperaturowy</div>
          <div style={{fontSize:14,fontWeight:600,color:T.textB,marginBottom:4}}>{pe.profile?.name||"—"}</div>
          {pe.profile?.segments?.length>0&&<div style={{display:"flex",flexDirection:"column",gap:3}}>
            {pe.profile.segments.map((s,i)=>(<div key={i} style={{display:"flex",gap:8,alignItems:"center",padding:"4px 8px",borderRadius:6,background:T.boxBg,border:`1px solid ${T.boxBorder}`}}>
              <span style={{fontSize:12,fontWeight:700,color:T.textA}}>E{i+1}</span>
              <span style={{fontSize:13,color:T.textB,fontWeight:600,flex:1}}>{s.name||`Etap ${i+1}`}</span>
              <span style={{fontSize:12,color:T.pv1,fontFamily:"monospace"}}>{s.sp}°C</span>
              <span style={{fontSize:11,color:T.textD}}>{s.ramp}°C/min</span>
              <span style={{fontSize:11,color:T.textD}}>{s.hold}min</span></div>))}</div>}</div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:700,color:T.textA,marginBottom:6}}>🧪 Dane próbki</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
            {[["ID",pe.sample?.sampleId],["Materiał",pe.sample?.material],["Podłoże",pe.sample?.substrate],["Metoda",pe.sample?.method],
              ["Grubość",pe.sample?.thickness],["Gaz",pe.sample?.targetGas],["Temp. proc.",pe.sample?.processTemp],["Operator",pe.sample?.operator],
              ["Seria",pe.sample?.batchNo],["Zdjęcia",Array.isArray(pe.sample?.photos)?`${pe.sample.photos.length} ścieżek`:"0"]].filter(([,v])=>v).map(([l,v])=>(
            <div key={l} style={{padding:"3px 6px",borderRadius:4,background:T.boxBg,border:`1px solid ${T.boxBorder}`}}>
              <span style={{fontSize:11,color:T.textD}}>{l}: </span><span style={{fontSize:12,color:T.tblT}}>{v}</span></div>))}</div></div>
        <div><div style={{fontSize:13,fontWeight:700,color:T.textA,marginBottom:4}}>👤 Uruchamiający</div>
          <div style={{fontSize:13,color:T.textB}}>{user.name} ({user.username}) — {user.role}</div></div>
      </div>
      <div style={{padding:"12px 24px 18px",borderTop:`1px solid ${T.cardBorder}`,display:"flex",flexDirection:"column",gap:8,flexShrink:0}}>
        <div style={{background:T.tIn,border:"1px solid #4488cc44",borderRadius:8,padding:"8px 12px",fontSize:13,color:T.textA}}>
          ⚠ Załadowanie eksperymentu nadpisze bieżące ustawienia profilu temperaturowego i danych próbki, a następnie uruchomi program segmentowy.</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={confirmExp} style={{...S.btn,flex:1,background:T.boxBg,fontSize:14,padding:"10px 16px"}}>
            <div style={{fontWeight:700}}>🔬 Potwierdź i uruchom</div>
            <div style={{fontSize:11,opacity:.8,fontWeight:400,marginTop:2}}>Zastosuj dane i rozpocznij eksperyment</div></button>
          <button onClick={()=>{setShowConfirm(false);setPendingExp(null)}} style={{...S.btn,background:T.boxBg,border:`1px solid ${T.boxBorder}`,color:T.textM,fontSize:13,padding:"10px 20px"}}>Anuluj</button></div>
      </div>
    </div></div>}
</div>);}

// ═══ P2 USTAWIENIA TEMP ═══
function P2({mb,setMb,toast,segs,setSegs,profileName,setProfileName,addLog,goPage,sendCmd,T}){const S=mkS(T);const TT={contentStyle:{background:T.ttBg,border:`1px solid ${T.cardBorder}`,borderRadius:8,fontSize:13,color:T.text}};
  const[showConfirm,setShowConfirm]=useState(false);
  const[nastawyOpen,setNastawyOpen]=useState(false);const[regulacjaOpen,setRegulacjaOpen]=useState(false);
  const[selSeg,setSelSeg]=useState(null);
  const mfcCols=["#00aaff","#ffaa00","#00cc66","#cc44ff"];
  const pData=useMemo(()=>{const d=[];let t=0,tmp=25;for(const s of segs){const fl=s.flow||[0,0,0,0];const rt=Math.abs((s.sp-tmp)/(Math.abs(s.ramp)||1));d.push({time:t.toFixed(0),temp:tmp,f1:fl[0],f2:fl[1],f3:fl[2],f4:fl[3]});t+=rt;d.push({time:t.toFixed(0),temp:s.sp,f1:fl[0],f2:fl[1],f3:fl[2],f4:fl[3]});if(s.hold>0){t+=s.hold;d.push({time:t.toFixed(0),temp:s.sp,f1:fl[0],f2:fl[1],f3:fl[2],f4:fl[3]})}tmp=s.sp}return d},[segs]);
  const hasAnyFlow=useMemo(()=>segs.some(s=>(s.flow||[]).some(v=>v>0)),[segs]);
  const uSeg=(i,k,v)=>setSegs(s=>s.map((x,j)=>j===i?{...x,[k]:k==="name"?v:(parseFloat(v)||0)}:x));
  const profH="calc(63vh - 60px)";const btmH="calc(27vh - 20px)";
  const doStart=(full)=>{setShowConfirm(false);setMb(m=>({...m,progStatus:"RUN",progStage:1,progElapsed:0,sp1:segs[0]?.sp||m.sp1}));
    sendCmd?.("profile_command",{action:"start",profileName:profileName||"Profil_1",segments:segs});
    addLog(`${full?"Pełny pomiar":"Profil temp."} START: ${profileName} E1: ${segs[0]?.name||""}`,"mode");toast(full?"Pełny pomiar uruchomiony":"Profil temperatury uruchomiony","success");if(full)goPage(1)};
  const doStop=()=>{setMb(m=>({...m,progStatus:"STOP",progStage:0,progElapsed:0}));sendCmd?.("profile_command",{action:"stop",profileName:profileName||"Profil_1"});addLog(`Program STOP: ${profileName}`,"mode");toast("STOP","info")};
  return(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gridTemplateRows:`${profH} ${btmH}`,gap:10}}>
    <div style={{...S.card,gridColumn:"1/-1",display:"flex",flexDirection:"column",overflow:"hidden"}}><div style={{...S.title,flexShrink:0}}><span>Profil temperaturowy — {profileName}</span>
      <span style={{fontSize:12,color:mb.progStatus==="RUN"?"#00cc66":T.textD}}>{mb.progStatus==="RUN"?`▶ E${mb.progStage} ${segs[mb.progStage-1]?.name||""}`:"STOP"}</span></div>
      <div style={{...S.box,marginBottom:8}}><div style={S.lbl}>Nazwa profilu</div><input value={profileName} onChange={e=>setProfileName(e.target.value)} placeholder="np. Spiekanie ZnO" style={S.input}/></div>
      <div style={{display:"grid",gridTemplateColumns:"260px 1fr",gap:12,flex:1,minHeight:0}}>
        <div style={{overflowY:"auto"}}>{segs.map((seg,i)=>{const fl=seg.flow||[0,0,0,0];const flTotal=fl.reduce((a,b)=>a+b,0);return(<div key={i} onClick={()=>setSelSeg(selSeg===i?null:i)} style={{...S.box,marginBottom:4,cursor:"pointer",borderColor:selSeg===i?"#0077b6":mb.progStatus==="RUN"&&mb.progStage===i+1?"#00cc66":T.boxBorder,boxShadow:selSeg===i?"0 0 0 1px #0077b644":"none"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{color:T.textA,fontSize:12,fontWeight:700}}>Etap {i+1}</span><button onClick={e=>{e.stopPropagation();setSegs(s=>s.filter((_,j)=>j!==i));if(selSeg===i)setSelSeg(null)}} style={{background:"none",border:"none",color:"#ff4455",cursor:"pointer",fontSize:13}}>✕</button></div>
          <input value={seg.name} onChange={e=>uSeg(i,"name",e.target.value)} onClick={e=>e.stopPropagation()} placeholder="Nazwa etapu" style={{...S.input,fontSize:13,padding:"3px 6px",marginBottom:3,fontWeight:600}}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:3}}>{[["SP°C","sp"],["°C/m","ramp"],["min","hold"]].map(([l,k])=>(<div key={k}><div style={{color:T.textD,fontSize:10}}>{l}</div><input type="number" value={seg[k]} onClick={e=>e.stopPropagation()} onChange={e=>uSeg(i,k,e.target.value)} style={{...S.input,fontSize:13,padding:"2px 4px"}}/></div>))}</div>
          <div style={{marginTop:3,padding:4,borderRadius:4,border:`1px solid ${T.boxBorder}`,background:T.boxBg}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3}}><span style={{color:T.textM,fontSize:10,fontWeight:600}}>Przepływy MFC</span>
              {flTotal>0&&<span style={{fontSize:9,color:T.textD}}>Σ {flTotal.toFixed(0)} sccm</span>}</div>
            {flTotal>0&&<div style={{display:"flex",height:6,borderRadius:3,overflow:"hidden",marginBottom:3,background:T.gTrack}}>
              {fl.map((v,mi)=>v>0?<div key={mi} style={{width:`${(v/flTotal)*100}%`,background:mfcCols[mi]}} title={`${mb.mfc[mi]?.gas}: ${v} sccm`}/>:null)}</div>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:3}} onClick={e=>e.stopPropagation()}>{mb.mfc.map((d,mi)=>{const col=mfcCols[mi];return(<div key={mi}><div style={{color:col,fontSize:9,fontWeight:600}}>{d.name} ({d.gas})</div>
              <input type="number" value={fl[mi]} onChange={e=>{const v=parseFloat(e.target.value)||0;setSegs(s=>s.map((x,j)=>j===i?{...x,flow:(x.flow||[0,0,0,0]).map((f,fi)=>fi===mi?v:f)}:x))}}
                min={0} max={d.maxFlow} step={1} style={{...S.input,fontSize:12,padding:"2px 4px"}} placeholder={`0-${d.maxFlow}`}/></div>)})}</div></div>
        </div>)})}
          {segs.length<6&&<button onClick={()=>setSegs(s=>[...s,{name:`Etap ${s.length+1}`,sp:100,ramp:5,hold:30,flow:[0,0,0,0]}])} style={{...S.btn,width:"100%",background:T.boxBg,border:`1px solid ${T.boxBorder}`,color:T.textM,fontSize:12}}>+ Dodaj etap</button>}</div>
        <div style={{display:"flex",flexDirection:"column",minHeight:0}}><div style={{flex:1,minHeight:0}}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={pData}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.grid}/><XAxis dataKey="time" tick={{fill:T.tick,fontSize:17}} stroke={T.grid} label={{value:"min",position:"insideBottomRight",offset:-2,style:{fill:T.textD,fontSize:15}}}/>
          <YAxis yAxisId="temp" tick={{fill:"#ff8844",fontSize:17}} stroke={T.grid}/>
          {hasAnyFlow&&<YAxis yAxisId="flow" orientation="right" tick={{fill:T.textD,fontSize:17}} stroke={T.grid}/>}
          <Tooltip {...TT}/>
          <Area yAxisId="temp" type="linear" dataKey="temp" stroke="#ff8844" fill="#ff884420" strokeWidth={2} name="Temp °C" dot={{r:2,fill:"#ff8844"}} isAnimationActive={false}/>
          {mb.mfc.map((d,mi)=>{const key=`f${mi+1}`;const show=pData.some(p=>p[key]>0);return show?<Area key={key} yAxisId="flow" type="stepAfter" dataKey={key} stroke={mfcCols[mi]} fill={mfcCols[mi]+"44"} strokeWidth={1.5} stackId="flow" name={`${d.name} (${d.gas})`} isAnimationActive={false}/>:null})}
          <Legend wrapperStyle={{fontSize:17}}/></ComposedChart></ResponsiveContainer></div>
          <div style={{display:"flex",gap:6,marginTop:4,flexShrink:0}}>
            <button style={{...S.btn,fontSize:12,background:T.boxBg}} onClick={()=>{const o={device:"AR200.B",kontroler:APP_VER,profile:profileName,segments:segs};const b=new Blob([JSON.stringify(o,null,2)],{type:"application/json"});dlBlob(b,`profil_${(profileName||"noname").replace(/\s+/g,"_")}.json`);addLog(`Eksport profilu "${profileName}"`,"export");toast("JSON OK","success")}}>📥 JSON</button>
            <button style={{...S.btn,fontSize:12,background:T.boxBg}} onClick={()=>{if(mb.progStatus==="RUN"){doStop()}else{setShowConfirm(true)}}}>{mb.progStatus==="RUN"?"⏹ Stop":"▶ Start"}</button></div></div></div></div>
    {showConfirm&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}} onClick={()=>setShowConfirm(false)}>
      <div onClick={e=>e.stopPropagation()} style={{background:T.cardBg,border:`1px solid ${T.cardBorder}`,borderRadius:14,padding:28,minWidth:380,maxWidth:460,boxShadow:"0 20px 60px rgba(0,0,0,.3)",animation:"si .2s ease-out"}}>
        <div style={{fontSize:16,fontWeight:700,color:T.textB,marginBottom:6}}>▶ Uruchomienie profilu</div>
        <div style={{fontSize:14,color:T.textM,marginBottom:6}}>Profil: <strong style={{color:T.textA}}>{profileName}</strong></div>
        <div style={{fontSize:13,color:T.textD,marginBottom:8}}>Etapy: {segs.map((s,i)=>`${i+1}. ${s.name} (${s.sp}°C)`).join(" → ")}</div>
        {hasAnyFlow&&<div style={{fontSize:12,color:T.textD,marginBottom:16}}>{mb.mfc.map((d,mi)=>{const vals=segs.map(s=>(s.flow||[0,0,0,0])[mi]);return vals.some(v=>v>0)?<span key={mi} style={{marginRight:8}}><span style={{color:mfcCols[mi],fontWeight:600}}>{d.name}:</span> {vals.join("→")} {d.unit}</span>:null})}</div>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <button onClick={()=>doStart(true)} style={{...S.btn,background:T.boxBg,fontSize:14,padding:"10px 16px",textAlign:"left"}}>
            <div style={{fontWeight:700}}>🔬 Start — pełny pomiar</div>
            <div style={{fontSize:12,opacity:.8,fontWeight:400,marginTop:2}}>Profil temp. + rejestracja danych + przejście do Eksperyment</div></button>
          <button onClick={()=>doStart(false)} style={{...S.btn,background:T.boxBg,fontSize:14,padding:"10px 16px",textAlign:"left"}}>
            <div style={{fontWeight:700}}>🌡 Start — tylko temperatura</div>
            <div style={{fontSize:12,opacity:.8,fontWeight:400,marginTop:2}}>Uruchom profil segmentowy bez przejścia na stronę pomiarową</div></button>
          <button onClick={()=>setShowConfirm(false)} style={{...S.btn,background:T.boxBg,border:`1px solid ${T.boxBorder}`,color:T.textM,fontSize:13,padding:"8px 16px"}}>Anuluj</button></div>
      </div></div>}
    <div style={S.card}>
      <button onClick={()=>setNastawyOpen(o=>!o)} style={{...S.title,flexShrink:0,cursor:"pointer",background:"none",border:"none",width:"100%",textAlign:"left",padding:0,margin:0,marginBottom:nastawyOpen?12:0,borderBottom:nastawyOpen?`1px solid ${T.titleB}`:"none"}}>
        <span style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:11,color:T.textD}}>{nastawyOpen?"▾":"▸"}</span>Nastawy</span>
        <span style={{fontSize:12,color:T.textD,fontWeight:400}}>PV1: {mb.pv1.toFixed(1)}°C  SP: {mb.sp1.toFixed(0)}°C  MV: {(mb.manualMode?mb.mvManual:mb.mv).toFixed(0)}%</span></button>
      {nastawyOpen&&<div>
      <div style={{display:"flex",justifyContent:"space-around",flexWrap:"wrap",gap:4}}>
        <Gauge value={mb.pv1} min={-50} max={500} unit="°C" label="PV1 Temp" sp={mb.sp1} color="#ff6644" warn={mb.sp1+5} danger={mb.sp1+10} T={T}/>
        <Gauge value={mb.manualMode?mb.mvManual:mb.mv} min={0} max={100} unit="%" label="MV Moc" color="#00cc66" warn={80} danger={95} T={T}/>
        <Gauge value={mb.pv2} min={0} max={100} unit="l/min" label="PV2 Flow" color="#00aaff" T={T}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:10}}>
        {[["SP1","sp1"],["SP2","sp2"],["SP3","sp3"]].map(([l,k])=>(<div key={k} style={S.box}><div style={S.lbl}>{l}°C</div>
          <input type="number" value={mb[k]} step=".1" style={S.input} onChange={e=>{const v=parseFloat(e.target.value)||0;setMb(m=>({...m,[k]:v}));sendCmd?.("setpoint_command",{[k]:v});addLog(`${l}→${v}°C`,"setpoint")}}/></div>))}</div></div>}</div>
    <div style={S.card}>
      <button onClick={()=>setRegulacjaOpen(o=>!o)} style={{...S.title,flexShrink:0,cursor:"pointer",background:"none",border:"none",width:"100%",textAlign:"left",padding:0,margin:0,marginBottom:regulacjaOpen?12:0,borderBottom:regulacjaOpen?`1px solid ${T.titleB}`:"none"}}>
        <span style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:11,color:T.textD}}>{regulacjaOpen?"▾":"▸"}</span>Regulacja</span>
        <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:12,padding:"2px 6px",borderRadius:4,background:mb.manualMode?"#ff880022":"#00ff8822",color:mb.manualMode?"#ffaa44":"#22aa66"}}>{mb.manualMode?"MANUAL":"AUTO"}</span>
          <span style={{fontSize:12,color:mb.regStatus==="RUN"?"#00cc66":"#ff6644"}}>{mb.regStatus}</span></div></button>
      {regulacjaOpen&&<div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {[["Pb°C","pidPb",.1],["Ti s","pidTi",1],["Td s","pidTd",1],["Hyst°C","hyst",.1],["Limit%","limitPower",1]].map(([l,k,st])=>(<div key={k} style={S.box}><div style={S.lbl}>{l}</div><input type="number" value={mb[k]} step={st} style={S.input} onChange={e=>setMb(m=>({...m,[k]:parseFloat(e.target.value)||0}))}/></div>))}</div>
      <div style={{...S.box,marginTop:8}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={S.lbl}>MV ręczne</div>
        <button onClick={()=>{const nm=!mb.manualMode;setMb(m=>({...m,manualMode:nm}));sendCmd?.("mode_command",{manualMode:nm});addLog(nm?"→MANUAL":"→AUTO","mode");toast(nm?"MANUAL":"AUTO","info")}} style={{...S.btn,padding:"3px 10px",fontSize:12,background:T.boxBg}}>{mb.manualMode?"→AUTO":"→MAN"}</button></div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4,opacity:mb.manualMode?1:.3}}><input type="range" min="0" max="100" value={mb.mvManual} disabled={!mb.manualMode} onChange={e=>{const v=parseFloat(e.target.value);setMb(m=>({...m,mvManual:v}));sendCmd?.("manual_mv",{mvManual:v})}} style={{flex:1,accentColor:"#00aaff"}}/><span style={{color:T.textB,fontFamily:"monospace",fontSize:15}}>{mb.mvManual.toFixed(0)}%</span></div></div>
      <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
        <button onClick={()=>{const ns=mb.regStatus==="RUN"?"STOP":"RUN";setMb(m=>({...m,regStatus:ns,pidI:0}));sendCmd?.("mode_command",{regStatus:ns});addLog(ns==="RUN"?"REG START":"REG STOP","mode");toast(ns,"success")}} style={{...S.btn,background:T.boxBg}}>{mb.regStatus==="RUN"?"⏹ STOP":"▶ START"}</button>
        <button style={{...S.btn,background:T.boxBg}} onClick={()=>{const pid={pidPb:4.2,pidTi:95,pidTd:24};setMb(m=>({...m,...pid}));sendCmd?.("pid_command",pid);addLog("Autotune PID","config");toast("Autotune OK","success")}}>🔄 Autotune</button>
        {mb.alarmLATCH&&<button style={{...S.btn,background:T.boxBg}} onClick={()=>{setMb(m=>({...m,alarmLATCH:false}));sendCmd?.("alarm_clear",{latch:true});addLog("LATCH kasuj","alarm");toast("LATCH OK","info")}}>🔓 LATCH</button>}</div></div>}</div>
  </div>);}

// ═══ P3 PRÓBKA I PROCES ═══
function P3({sample,setSample,toast,addLog,sendCmd,T}){const S=mkS(T);
  const API="http://localhost:3001/api";
  const[dbRes,setDbRes]=useState([]);const[dbLoading,setDbLoading]=useState(false);const[dbStatus,setDbStatus]=useState(null);
  const[srchField,setSrchField]=useState("sampleId");const[srchQuery,setSrchQuery]=useState("");const[showResults,setShowResults]=useState(false);
  const[newPhoto,setNewPhoto]=useState("");

  const allFields=[["sampleId","ID Próbki"],["material","Materiał"],["substrate","Podłoże"],["method","Metoda"],["thickness","Grubość"],["targetGas","Gaz docelowy"],
    ["processTemp","Temperatura"],["pressure","Ciśnienie"],["atmosphere","Atmosfera"],["sourcePower","Moc źródła"],["processTime","Czas procesu"],["gasFlow","Przepływ"],
    ["operator","Operator"],["batchNo","Nr serii"],["goal","Cel"],["notes","Uwagi"],["photos","Zdjęcia"]];

  const addPhoto=(path)=>{const p=(path||newPhoto).trim();if(!p){toast("Podaj ścieżkę","error");return;}
    setSample(s=>({...s,photos:[...s.photos,p]}));setNewPhoto("");};
  const rmPhoto=(i)=>setSample(s=>({...s,photos:s.photos.filter((_,j)=>j!==i)}));

  const dbHealth=async()=>{try{const r=await fetch(`${API}/health`);const j=await r.json();setDbStatus(j.ok?"ok":"err");toast(j.ok?"MySQL: połączono":"MySQL: błąd",j.ok?"success":"error")}catch(e){setDbStatus("err");toast(`MySQL: ${e.message}`,"error")}};

  const dbInsert=async()=>{if(!sample.sampleId){toast("Podaj ID próbki","error");return;}setDbLoading(true);
    try{const r=await fetch(`${API}/samples`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(sample)});const j=await r.json();
      if(j.ok){toast(`MySQL INSERT OK (id:${j.id})`,"success");addLog(`MySQL INSERT: ${sample.sampleId} → id:${j.id}`,"data");sendCmd?.("sample_info",sample)}
      else{toast(`MySQL: ${j.error}`,"error")}}catch(e){toast(`MySQL: ${e.message}`,"error")}finally{setDbLoading(false)}};

  const dbSearch=async(field,query)=>{if(!query?.trim()){toast("Podaj frazę wyszukiwania","error");return;}setDbLoading(true);setShowResults(true);
    try{const r=await fetch(`${API}/samples/search?field=${encodeURIComponent(field)}&query=${encodeURIComponent(query)}`);const j=await r.json();
      if(j.ok){setDbRes(j.data);toast(`Znaleziono: ${j.count}`,"success");addLog(`MySQL SEARCH: ${field}="${query}" → ${j.count}`,"data")}
      else{toast(`MySQL: ${j.error}`,"error");setDbRes([])}}catch(e){toast(`MySQL: ${e.message}`,"error");setDbRes([])}finally{setDbLoading(false)}};

  const dbLoadAll=async()=>{setDbLoading(true);setShowResults(true);
    try{const r=await fetch(`${API}/samples`);const j=await r.json();
      if(j.ok){setDbRes(j.data);toast(`Załadowano: ${j.count}`,"success");addLog(`MySQL ALL → ${j.count}`,"data")}
      else{toast(`MySQL: ${j.error}`,"error")}}catch(e){toast(`MySQL: ${e.message}`,"error")}finally{setDbLoading(false)}};

  const dbDelete=async(id)=>{setDbLoading(true);
    try{const r=await fetch(`${API}/samples/${id}`,{method:"DELETE"});const j=await r.json();
      if(j.ok){setDbRes(d=>d.filter(x=>x._id!==id));toast("Usunięto z MySQL","info");addLog(`MySQL DELETE id:${id}`,"data")}
      else{toast(`MySQL: ${j.error}`,"error")}}catch(e){toast(`MySQL: ${e.message}`,"error")}finally{setDbLoading(false)}};

  const loadToForm=(row)=>{const s={};for(const[k]of allFields){if(k==="photos"){s.photos=Array.isArray(row.photos)?row.photos:[];continue;}s[k]=row[k]||"";}setSample(s);toast("Załadowano do formularza","info")};

  useEffect(()=>{dbHealth()},[]);

  const F=({label,k,ph,area})=>(<div style={S.box}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={S.lbl}>{label}</div>
    <button onClick={()=>{setSrchField(k);setSrchQuery(sample[k]||"");if(sample[k])dbSearch(k,sample[k])}} title={`Szukaj wg ${label}`} style={{background:"none",border:"none",color:T.textA,cursor:"pointer",fontSize:12,padding:0}}>🔍</button></div>
    {area?<textarea value={sample[k]||""} onChange={e=>setSample(s=>({...s,[k]:e.target.value}))} placeholder={ph} rows={3} style={{...S.input,resize:"vertical"}}></textarea>
    :<input value={sample[k]||""} onChange={e=>setSample(s=>({...s,[k]:e.target.value}))} placeholder={ph} style={S.input}/>}</div>);

  const tblCols=[["sampleId","ID"],["material","Mat."],["substrate","Podł."],["method","Met."],["thickness","nm"],["targetGas","Gaz"],["processTemp","T°C"],["operator","Operator"],["batchNo","Seria"],["photos","📷"]];

  return(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
    <div style={S.card}><div style={S.title}><span>Informacje o próbce</span></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      <F label="ID Próbki" k="sampleId" ph="ZnO-2026-001"/><F label="Materiał warstwy" k="material" ph="ZnO, SnO₂, TiO₂"/><F label="Podłoże" k="substrate" ph="SiO₂/Si, Al₂O₃"/><F label="Metoda osadzania" k="method" ph="PVD, CVD, Sol-Gel"/><F label="Grubość (nm)" k="thickness" ph="150"/><F label="Gaz docelowy" k="targetGas" ph="H₂S, CO, NO₂"/></div></div>
    <div style={S.card}><div style={S.title}><span>Parametry procesu</span></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      <F label="Temperatura (°C)" k="processTemp" ph="400"/><F label="Ciśnienie (mbar)" k="pressure" ph="5e-3"/><F label="Atmosfera" k="atmosphere" ph="N₂, Ar, vacuum"/><F label="Moc źródła (W)" k="sourcePower" ph="100"/><F label="Czas procesu (min)" k="processTime" ph="60"/><F label="Przepływ (sccm)" k="gasFlow" ph="50"/></div></div>
    <div style={S.card}><div style={S.title}><span>Dodatkowe</span></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      <F label="Operator" k="operator" ph="Jan Kowalski"/><F label="Nr serii" k="batchNo" ph="BATCH-2026-01"/><F label="Cel eksperymentu" k="goal" ph="Optymalizacja" area={true}/><F label="Uwagi" k="notes" ph="Notatki..." area={true}/></div></div>

    <div style={S.card}><div style={S.title}><span>📷 Zdjęcia próbki</span><span style={{fontSize:12,color:T.textD}}>{sample.photos.length} ścieżek</span></div>
      <div style={{...S.box,marginBottom:8}}>
        <div style={S.lbl}>Dodaj ścieżkę do zdjęcia</div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <input value={newPhoto} onChange={e=>setNewPhoto(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addPhoto()}} placeholder="/data/images/sample_001.jpg" style={{...S.input,flex:1,fontFamily:"monospace",fontSize:13}}/>
          <button onClick={()=>addPhoto()} style={{...S.btn,background:T.boxBg,padding:"5px 12px",fontSize:12,flexShrink:0}}>+ Dodaj</button></div></div>
      {sample.photos.length>0&&<div style={{display:"flex",flexDirection:"column",gap:4}}>
        {sample.photos.map((p,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 8px",borderRadius:6,background:T.boxBg,border:`1px solid ${T.boxBorder}`}}>
          <span style={{fontSize:12,color:T.textA,fontWeight:600,flexShrink:0}}>📷 {i+1}</span>
          <span style={{flex:1,fontSize:13,color:T.tblT,fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={p}>{p}</span>
          <button onClick={()=>{setSrchField("photos");setSrchQuery(p);dbSearch("photos",p)}} title="Szukaj w bazie" style={{background:"none",border:"none",color:T.textA,cursor:"pointer",fontSize:12,flexShrink:0}}>🔍</button>
          <button onClick={()=>rmPhoto(i)} style={{background:"none",border:"none",color:"#ff4455",cursor:"pointer",fontSize:14,flexShrink:0}} title="Usuń">✕</button></div>))}</div>}
      {sample.photos.length===0&&<div style={{color:T.textD,fontSize:13,padding:"10px 0",textAlign:"center"}}>Brak zdjęć — dodaj ścieżki powyżej</div>}</div>

    <div style={{...S.card,gridColumn:"1/-1"}}><div style={S.title}><span>🗄 MySQL — baza danych</span>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:dbStatus==="ok"?"#22cc66":dbStatus==="err"?"#ff4455":"#888"}}/>
        <span style={{fontSize:11,color:dbStatus==="ok"?T.textA:T.textD}}>{dbStatus==="ok"?"Połączono":"Brak połączenia"}</span>
        <button onClick={dbHealth} style={{background:"none",border:"none",color:T.textA,cursor:"pointer",fontSize:12}}>⟳</button></div></div>

      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
        <button style={{...S.btn,background:T.boxBg,opacity:dbLoading?.5:1}} disabled={dbLoading} onClick={dbInsert}>🗄 Zapisz do MySQL</button>
        <button style={{...S.btn,background:T.boxBg,opacity:dbLoading?.5:1}} disabled={dbLoading} onClick={dbLoadAll}>📋 Pokaż wszystkie</button>
        <button style={{...S.btn,background:T.boxBg}} onClick={()=>{sendCmd?.("sample_info",sample);addLog(`WS sample_info: ${sample.sampleId||"?"}`,"data");toast("Wysłano WS","success")}}>📡 Wyślij WS</button>
        <button style={{...S.btn,background:T.boxBg,border:`1px solid ${T.boxBorder}`,color:T.textM}} onClick={()=>{const b=new Blob([JSON.stringify({type:"sample_info",data:sample},null,2)],{type:"application/json"});dlBlob(b,`sample_${sample.sampleId||"x"}.json`);addLog(`Eksport próbki ${sample.sampleId}`,"export");toast("JSON OK","success")}}>📥 JSON</button></div>

      <div style={{...S.box,marginBottom:10}}>
        <div style={S.lbl}>🔍 Wyszukaj w bazie</div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <select value={srchField} onChange={e=>setSrchField(e.target.value)} style={{...S.input,width:160,fontSize:13}}>
            {allFields.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select>
          <input value={srchQuery} onChange={e=>setSrchQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")dbSearch(srchField,srchQuery)}} placeholder="Szukana fraza..." style={{...S.input,flex:1,fontSize:13}}/>
          <button style={{...S.btn,background:T.boxBg,padding:"5px 12px",opacity:dbLoading?.5:1}} disabled={dbLoading} onClick={()=>dbSearch(srchField,srchQuery)}>Szukaj</button></div>
        <div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>
          {allFields.map(([k,l])=><button key={k} onClick={()=>{setSrchField(k);const v=k==="photos"?(sample.photos[0]||""):sample[k]||"";if(v){setSrchQuery(v);dbSearch(k,v)}else{setSrchField(k)}}} style={{padding:"2px 6px",borderRadius:4,border:`1px solid ${srchField===k?T.textA:T.boxBorder}`,background:srchField===k?T.textA+"22":"transparent",color:srchField===k?T.textA:T.textD,fontSize:10,cursor:"pointer"}}>{l}</button>)}</div></div>

      {showResults&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <span style={{fontSize:13,color:T.textM,fontWeight:600}}>Wyniki: {dbRes.length} {dbLoading&&"⏳"}</span>
          <button onClick={()=>{setShowResults(false);setDbRes([])}} style={{background:"none",border:"none",color:T.textD,cursor:"pointer",fontSize:13}}>✕ Zamknij</button></div>
        {dbRes.length===0?<div style={{color:T.textD,textAlign:"center",padding:20,fontSize:13}}>Brak wyników</div>:
        <div style={{overflowX:"auto",maxHeight:280,overflowY:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{borderBottom:`2px solid ${T.cardBorder}`,position:"sticky",top:0,background:T.tblH}}>
            <th style={{padding:"4px 5px",textAlign:"left",color:T.textM,fontWeight:600,fontSize:11}}>id</th>
            {tblCols.map(([,l])=><th key={l} style={{padding:"4px 5px",textAlign:"left",color:T.textM,fontWeight:600,fontSize:11}}>{l}</th>)}
            <th style={{padding:"4px 5px",textAlign:"left",color:T.textM,fontWeight:600,fontSize:11}}>Data</th>
            <th style={{padding:"4px 5px",fontSize:11}}></th></tr></thead>
          <tbody>{dbRes.map((r,i)=>(<tr key={r._id} style={{borderBottom:`1px solid ${T.tblB}`,background:i%2?T.logAlt:"transparent"}}>
            <td style={{padding:"3px 5px",color:T.textD,fontFamily:"monospace"}}>{r._id}</td>
            {tblCols.map(([k])=><td key={k} style={{padding:"3px 5px",color:T.tblT,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{k==="photos"?(Array.isArray(r[k])?r[k].length:0):r[k]||"—"}</td>)}
            <td style={{padding:"3px 5px",color:T.textD,fontFamily:"monospace",fontSize:11}}>{r._createdAt?new Date(r._createdAt).toLocaleString("pl-PL"):""}</td>
            <td style={{padding:"3px 5px"}}><div style={{display:"flex",gap:3}}>
              <button onClick={()=>loadToForm(r)} title="Załaduj" style={{background:"none",border:"none",color:T.textA,cursor:"pointer",fontSize:13}}>📋</button>
              <button onClick={()=>dbDelete(r._id)} title="Usuń z MySQL" style={{background:"none",border:"none",color:"#ff4455",cursor:"pointer",fontSize:13}}>🗑</button></div></td>
          </tr>))}</tbody></table></div>}</div>}

      <pre style={{...S.code,marginTop:8,maxHeight:120,overflow:"auto"}}>{JSON.stringify({type:"sample_info",data:sample},null,2)}</pre>
    </div>
  </div>);}

const StableInput=memo(function StableInput({value,onCommit,placeholder}){const[v,setV]=useState(value);const focused=useRef(false);const cbRef=useRef(onCommit);cbRef.current=onCommit;
  useEffect(()=>{if(!focused.current)setV(value)},[value]);
  return <input value={v} onChange={e=>setV(e.target.value)} onFocus={()=>{focused.current=true}} onBlur={e=>{focused.current=false;cbRef.current(e.target.value)}} placeholder={placeholder}
    style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid #1a2a3a",fontSize:15,outline:"none",background:"inherit",color:"inherit"}}/>;
},function(p,n){return p.value===n.value&&p.placeholder===n.placeholder});

// ═══ P4 KONFIGURACJA ═══
function P4({mb,setMb,toast,addLog,diagram,setDiagram,customSvg,setCustomSvg,user,users,setUsers,connectWs,disconnectWs,influxOk,setInfluxOk,T}){const S=mkS(T);const[tab,sTab]=useState("ctrl");
  const isAdmin=user?.role==="admin";
  const F=({label,children})=><div style={S.box}><div style={S.lbl}>{label}</div>{children}</div>;
  const diagFields=[["gas","Źródło gazu","GAZ"],["gasType","Typ gazu","N₂/Ar"],["flow","Przepływomierz","FLOW"],["furnace","Piec / Komora","PIEC"],["bridge","Bridge / DAQ","LabVIEW"],["bridgeSub","Opis bridge","WS Bridge"]];
  const handleSvgUpload=(e)=>{const f=e.target.files?.[0];if(!f)return;if(!f.name.endsWith(".svg")){toast("Tylko pliki .svg","error");return;}const r=new FileReader();r.onload=(ev)=>{const txt=ev.target?.result;if(typeof txt==="string"&&txt.includes("<svg")){setCustomSvg(txt);addLog(`SVG załadowany: ${f.name}`,"config");toast(`SVG: ${f.name}`,"success")}else{toast("Nieprawidłowy plik SVG","error")}};r.readAsText(f)};
  const[editUser,setEditUser]=useState(null);
  const[showAdd,setShowAdd]=useState(false);
  const[confirmDel,setConfirmDel]=useState(null);
  const emptyUser={login:"",name:"",firstName:"",lastName:"",email:"",phone:"",password:"",role:"user"};
  const[newUser,setNewUser]=useState(emptyUser);
  const uFields=[["name","Nazwa wyświetlana"],["firstName","Imię"],["lastName","Nazwisko"],["email","Email"],["phone","Telefon"],["password","Hasło"]];
  const roles=[["admin","Admin"],["user","Operator"],["student","Student"],["guest","Gość"]];
  const uU=(login,k,v)=>setUsers(u=>({...u,[login]:{...u[login],[k]:v}}));
  const nU=(k,v)=>setNewUser(u=>({...u,[k]:v}));
  const addUser=()=>{const l=newUser.login.trim().toLowerCase().replace(/\s+/g,"_");if(!l){toast("Podaj login","error");return;}if(users[l]){toast("Login zajęty","error");return;}if(!newUser.password){toast("Podaj hasło","error");return;}
    setUsers(u=>({...u,[l]:{password:newUser.password,role:newUser.role,name:newUser.name||l,firstName:newUser.firstName,lastName:newUser.lastName,email:newUser.email,phone:newUser.phone}}));setNewUser(emptyUser);setShowAdd(false);addLog(`Nowy użytkownik: ${l}`,"config");toast(`Dodano: ${l}`,"success")};
  const delUser=(login)=>{if(login==="admin"){toast("Nie można usunąć admina","error");return;}setUsers(u=>{const n={...u};delete n[login];return n});addLog(`Usunięto użytkownika: ${login}`,"config");toast(`Usunięto: ${login}`,"info");if(editUser===login)setEditUser(null)};

  const hwTabs=[["ctrl","🌡 Kontroler"],["ws","🔌 WebSocket"],["db","🗄 Baza"]];
  const uiTabs=[["mfc","🔧 Przepływomierz"],["ui_names","🏷 Nazwy"],["diag","🖼 Diagram"]];
  const adminTabs=isAdmin?[["users","👥 Użytkownicy"]]:[];
  const mfcUnits=["sccm","slm","l/min"];
  const updMfc=(idx,k,v)=>setMb(m=>({...m,mfc:m.mfc.map((d,i)=>i===idx?{...d,[k]:v}:d)}));
  const tabBtn=(id,l)=><button key={id} onClick={()=>sTab(id)} style={{padding:"5px 10px",borderRadius:6,border:"none",background:tab===id?T.actTab:T.boxBg,color:tab===id?T.textA:T.textM,fontSize:12,fontWeight:600,cursor:"pointer"}}>{l}</button>;

  return(<div>
    <div style={{display:"flex",gap:10,marginBottom:10,alignItems:"center",flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:4}}>
        <span style={{fontSize:10,fontWeight:700,color:T.textD,textTransform:"uppercase",letterSpacing:1}}>Sprzęt</span>
        {hwTabs.map(([id,l])=>tabBtn(id,l))}</div>
      <div style={{width:1,height:18,background:T.cardBorder}}/>
      <div style={{display:"flex",alignItems:"center",gap:4}}>
        <span style={{fontSize:10,fontWeight:700,color:T.textD,textTransform:"uppercase",letterSpacing:1}}>Interfejs</span>
        {uiTabs.map(([id,l])=>tabBtn(id,l))}</div>
      {adminTabs.length>0&&<><div style={{width:1,height:18,background:T.cardBorder}}/>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{fontSize:10,fontWeight:700,color:T.textD,textTransform:"uppercase",letterSpacing:1}}>Admin</span>
          {adminTabs.map(([id,l])=>tabBtn(id,l))}</div></>}
    </div>
    {tab==="ctrl"&&<div style={S.card}><div style={S.title}><span>Komunikacja AR200.B</span></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        {[["Addr MODBUS",mb.modbusAddr,"modbusAddr","number"],["Baud",mb.baudRate,"baudRate","number"],["IP",mb.ethIP,"ethIP","text"],["Port TCP",mb.ethPort,"ethPort","number"],["MQTT Broker",mb.mqttBroker,"mqttBroker","text"],["MQTT Port",mb.mqttPort,"mqttPort","number"]].map(([l,v,k,t])=>
          <F key={l} label={l}><input type={t} defaultValue={v} style={S.input} onChange={e=>setMb(m=>({...m,[k]:t==="number"?parseFloat(e.target.value)||0:e.target.value}))}/></F>)}</div>
        <button style={{...S.btn,marginTop:8,background:T.boxBg}} onClick={()=>{addLog("Config kontroler zapisana","config");toast("OK","success")}}>💾 Zapisz</button></div>}
    {tab==="ui_names"&&<div style={S.card}><div style={S.title}><span>Nazwy kanałów temperaturowych</span></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <div style={S.box}><div style={S.lbl}>Nazwa termopary 1</div><StableInput value={mb.pv1Name} onCommit={v=>setMb(m=>({...m,pv1Name:v}))} placeholder="Termopara 1 (piec)"/></div>
        <div style={S.box}><div style={S.lbl}>Nazwa termopary 2</div><StableInput value={mb.pv2Name} onCommit={v=>setMb(m=>({...m,pv2Name:v}))} placeholder="Termopara 2 (próbka)"/></div></div></div>}
    {tab==="mfc"&&<div style={{display:"grid",gap:12}}>
      <div style={{...S.title,margin:0,border:"none",paddingBottom:0}}><span>Przepływomierze MKS — MODBUS Ethernet</span><span style={{fontSize:12,color:T.textD}}>{mb.mfc.filter(d=>d.enabled).length}/{mb.mfc.length} aktywnych</span></div>
      {mb.mfc.map((d,i)=>(<div key={d.id} style={{...S.card,opacity:d.enabled?1:.6}}>
        <div style={{...S.title,marginBottom:8}}><span style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:16}}>{d.enabled?"🟢":"⚪"}</span>
          <span>{d.name} — {d.gas}</span></span>
          <label style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:T.textM,cursor:"pointer"}}>
            <input type="checkbox" checked={d.enabled} onChange={e=>updMfc(i,"enabled",e.target.checked)}/> Aktywny</label></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          <F label="Nazwa urządzenia"><input value={d.name} onChange={e=>updMfc(i,"name",e.target.value)} style={S.input}/></F>
          <F label="Gaz — nazwa"><input value={d.gas} onChange={e=>updMfc(i,"gas",e.target.value)} style={S.input} placeholder="N₂, Ar, O₂..."/></F>
          <F label="Gaz — skład"><input value={d.gasComposition} onChange={e=>updMfc(i,"gasComposition",e.target.value)} style={S.input} placeholder="100% N₂"/></F>
          <F label="IP Address"><input value={d.ip} onChange={e=>updMfc(i,"ip",e.target.value)} style={S.input} placeholder="192.168.1.x"/></F>
          <F label="Port TCP"><input type="number" value={d.port} onChange={e=>updMfc(i,"port",parseInt(e.target.value)||502)} style={S.input}/></F>
          <F label="Slave Address"><input type="number" value={d.slaveAddr} onChange={e=>updMfc(i,"slaveAddr",parseInt(e.target.value)||1)} style={S.input}/></F>
          <F label="Max Flow"><input type="number" value={d.maxFlow} onChange={e=>updMfc(i,"maxFlow",parseFloat(e.target.value)||0)} style={S.input}/></F>
          <F label="Jednostka"><select value={d.unit} onChange={e=>updMfc(i,"unit",e.target.value)} style={S.input}>{mfcUnits.map(u=><option key={u} value={u}>{u}</option>)}</select></F>
          <F label="Setpoint"><input type="number" value={d.sp} onChange={e=>{const v=parseFloat(e.target.value)||0;updMfc(i,"sp",v)}} style={S.input}/></F>
        </div></div>))}
      <div style={{display:"flex",gap:8}}>
        <button style={{...S.btn,background:T.boxBg}} onClick={()=>{sendCmd("mfc_config",{mfc:mb.mfc});addLog("Konfiguracja przepływomierzy wysłana","config");toast("Konfiguracja przepływomierzy zapisana","success")}}>💾 Zapisz konfigurację</button>
        <button style={{...S.btn,background:T.boxBg}} onClick={()=>{mb.mfc.forEach(d=>{if(d.enabled)sendCmd("mfc_setpoint",{id:d.id,sp:d.sp})});toast("Nastawy przepływomierzy wysłane","success")}}>📤 Wyślij nastawy</button>
      </div></div>}
    {tab==="diag"&&<div style={{display:"grid",gap:12}}>
      <div style={S.card}><div style={S.title}><span>Nazwy elementów schematu</span></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {diagFields.map(([k,label,ph])=><F key={k} label={label}><input value={diagram[k]||""} onChange={e=>setDiagram(d=>({...d,[k]:e.target.value}))} placeholder={ph} style={S.input}/></F>)}</div>
        <button style={{...S.btn,marginTop:8,background:T.boxBg}} onClick={()=>{addLog("Nazwy diagramu zapisane","config");toast("Diagram zapisany","success")}}>💾 Zapisz nazwy</button></div>
      <div style={S.card}><div style={S.title}><span>Własny schemat SVG</span></div>
        <p style={{color:T.textM,fontSize:13,margin:"0 0 10px"}}>Załaduj własny plik SVG jako schemat stanowiska. SVG zastąpi domyślny diagram na stronie Eksperyment.</p>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <label style={{...S.btn,background:T.boxBg,display:"inline-flex",alignItems:"center",gap:5,cursor:"pointer"}}>
            📂 Załaduj SVG<input type="file" accept=".svg" onChange={handleSvgUpload} style={{display:"none"}}/></label>
          {customSvg&&<button style={{...S.btn,background:T.boxBg}} onClick={()=>{setCustomSvg(null);addLog("SVG usunięty","config");toast("SVG usunięty","info")}}>🗑 Usuń SVG</button>}
          <span style={{fontSize:12,color:customSvg?T.textA:T.textD}}>{customSvg?"✓ Własny SVG aktywny":"Domyślny schemat"}</span></div>
        {customSvg&&<div style={{...S.box,marginTop:10,maxHeight:180,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div dangerouslySetInnerHTML={{__html:customSvg}} style={{maxWidth:"100%",maxHeight:170}}/></div>}</div>
    </div>}
    {tab==="ws"&&<div style={S.card}><div style={S.title}><span>WebSocket ↔ LabVIEW</span><span style={{fontSize:11,color:T.textD,fontWeight:400,letterSpacing:0}}>💾 URL zapisywany automatycznie</span></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      <F label="WebSocket URL"><input value={mb.wsUrl} onChange={e=>setMb(m=>({...m,wsUrl:e.target.value}))} style={S.input} placeholder="ws://192.168.x.x:6060"/></F>
      <F label="Status"><div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}><Led on={mb.wsConnected} color="#00cc66" label={mb.wsConnected?"Połączony":"Rozłączony"} T={T}/></div></F></div>
      <p style={{color:T.textM,fontSize:13,margin:"8px 0"}}>LabVIEW = WebSocket Server. Kontroler = klient. Dane JSON. Auto-reconnect z exponential backoff.</p>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}><button style={{...S.btn,background:T.boxBg,opacity:mb.wsConnected?.5:1}} disabled={mb.wsConnected} onClick={()=>connectWs?.({manual:true})}>🔌 Połącz</button>
        <button style={{...S.btn,background:T.boxBg,opacity:!mb.wsConnected?.5:1}} disabled={!mb.wsConnected} onClick={()=>disconnectWs?.("manual")}>⏏ Rozłącz</button>
        <button style={{...S.btn,background:"#1a4a2e",border:"1px solid #2d7a4a",color:"#fff"}} onClick={()=>{disconnectWs?.("manual");setTimeout(()=>connectWs?.({manual:true}),700);addLog?.(`WS URL zmieniony na: ${mb.wsUrl}`,"ws");toast("Rozłączanie → reconnect z nowym URL…","info")}}>🔄 Zastosuj URL</button></div></div>}
    {tab==="db"&&<div style={S.card}><div style={S.title}><span>InfluxDB v2 — Time Series</span>
      <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:"50%",background:influxOk?"#8844ff":"#555"}}/><span style={{fontSize:12,color:influxOk?T.textA:T.textD}}>{influxOk?"Połączono":"Brak połączenia"}</span></div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      {[["URL","http://localhost:8086"],["Organizacja","ThinFilmLab"],["Bucket","measurements"],["Retencja","30 dni (raw)"],["Token","tfl-dev-token-****"],["Port Docker","8086"]].map(([l,v])=><F key={l} label={l}><input defaultValue={v} readOnly style={{...S.input,opacity:.7}}/></F>)}</div>
      <div style={{display:"flex",gap:8,marginTop:8}}>
      <button style={{...S.btn,background:T.boxBg}} onClick={()=>{influxHealth().then(ok=>{setInfluxOk(ok);toast(ok?"InfluxDB: połączono":"InfluxDB: brak połączenia",ok?"success":"error")})}}>🔄 Test połączenia</button>
      <a href="http://localhost:8086" target="_blank" rel="noreferrer" style={{...S.btn,background:T.boxBg,textDecoration:"none",display:"inline-flex",alignItems:"center"}}>📊 InfluxDB UI</a></div></div>}
    {tab==="users"&&isAdmin&&<div style={{display:"grid",gap:12}}>
      <div style={S.card}><div style={S.title}><span>Zarządzanie użytkownikami</span><span style={{fontSize:12,color:T.textD}}>{Object.keys(users).length} kont</span></div>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{borderBottom:`2px solid ${T.cardBorder}`}}>
            {["Login","Nazwa","Imię","Nazwisko","Rola","Email","Telefon",""].map(h=><th key={h} style={{padding:"5px 6px",textAlign:"left",color:T.textM,fontWeight:600,fontSize:12,background:T.tblH}}>{h}</th>)}</tr></thead>
          <tbody>{Object.entries(users).map(([login,u],i)=>(<tr key={login} style={{borderBottom:`1px solid ${T.tblB}`,background:editUser===login?`${T.textA}11`:i%2?T.logAlt:"transparent"}}>
            <td style={{padding:"4px 6px",color:T.textA,fontFamily:"monospace",fontWeight:600}}>{login}{login==="admin"&&<span style={{fontSize:10,color:"#ffaa44",marginLeft:4}}>★</span>}</td>
            <td style={{padding:"4px 6px",color:T.textB}}>{u.name}</td>
            <td style={{padding:"4px 6px",color:T.textM}}>{u.firstName||"-"}</td>
            <td style={{padding:"4px 6px",color:T.textM}}>{u.lastName||"-"}</td>
            <td style={{padding:"4px 6px"}}><span style={{fontSize:11,padding:"2px 6px",borderRadius:4,fontWeight:600,background:u.role==="admin"?"#ff880022":"#00aaff15",color:u.role==="admin"?"#ffaa44":"#44aadd"}}>{u.role}</span></td>
            <td style={{padding:"4px 6px",color:T.textD,fontSize:12}}>{u.email||"-"}</td>
            <td style={{padding:"4px 6px",color:T.textD,fontSize:12}}>{u.phone||"-"}</td>
            <td style={{padding:"4px 6px"}}><div style={{display:"flex",gap:3}}>
              <button onClick={()=>setEditUser(editUser===login?null:login)} style={{background:"none",border:"none",color:T.textA,cursor:"pointer",fontSize:14}} title="Edytuj">✏</button>
              {login!=="admin"&&<button onClick={()=>setConfirmDel(login)} style={{background:"none",border:"none",color:"#ff4455",cursor:"pointer",fontSize:14}} title="Usuń">🗑</button>}</div></td>
          </tr>))}</tbody></table></div>
        <button onClick={()=>setShowAdd(!showAdd)} style={{...S.btn,marginTop:10,background:T.boxBg,fontSize:13}}>{showAdd?"✕ Anuluj":"➕ Dodaj użytkownika"}</button></div>

      {showAdd&&<div style={S.card}><div style={S.title}><span>➕ Nowy użytkownik</span>
        <button onClick={()=>{setShowAdd(false);setNewUser(emptyUser)}} style={{background:"none",border:"none",color:T.textD,cursor:"pointer",fontSize:16}}>✕</button></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
          <F label="Login *"><input value={newUser.login} onChange={e=>nU("login",e.target.value)} placeholder="np. jnowak" style={{...S.input,fontFamily:"monospace",fontWeight:600}}/></F>
          <F label="Nazwa wyświetlana"><input value={newUser.name} onChange={e=>nU("name",e.target.value)} placeholder="Jan Nowak" style={S.input}/></F>
          <F label="Hasło *"><input value={newUser.password} onChange={e=>nU("password",e.target.value)} placeholder="min. 4 znaki" style={S.input}/></F>
          <F label="Rola"><select value={newUser.role} onChange={e=>nU("role",e.target.value)} style={S.input}>
            {roles.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
          <F label="Imię"><input value={newUser.firstName} onChange={e=>nU("firstName",e.target.value)} placeholder="Jan" style={S.input}/></F>
          <F label="Nazwisko"><input value={newUser.lastName} onChange={e=>nU("lastName",e.target.value)} placeholder="Nowak" style={S.input}/></F>
          <F label="Email"><input type="email" value={newUser.email} onChange={e=>nU("email",e.target.value)} placeholder="jan@lab.pl" style={S.input}/></F>
          <F label="Telefon"><input value={newUser.phone} onChange={e=>nU("phone",e.target.value)} placeholder="+48 600..." style={S.input}/></F></div>
        <button onClick={addUser} style={{...S.btn,marginTop:10,background:T.boxBg,fontSize:13}}>✓ Utwórz konto</button></div>}

      {editUser&&users[editUser]&&<div style={S.card}><div style={S.title}><span>✏ Edycja: <span style={{color:T.textA,fontFamily:"monospace"}}>{editUser}</span></span>
        <button onClick={()=>setEditUser(null)} style={{background:"none",border:"none",color:T.textD,cursor:"pointer",fontSize:16}}>✕</button></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {uFields.map(([k,label])=><F key={k} label={label}><input type={k==="password"?"text":"text"} value={users[editUser][k]||""} onChange={e=>uU(editUser,k,e.target.value)} style={S.input}/></F>)}
          <F label="Rola"><select value={users[editUser].role} onChange={e=>uU(editUser,"role",e.target.value)} style={S.input} disabled={editUser==="admin"}>
            {roles.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F></div>
        <button style={{...S.btn,marginTop:8,background:T.boxBg}} onClick={()=>{addLog(`Użytkownik ${editUser} zaktualizowany`,"config");toast(`${editUser} zapisany`,"success");setEditUser(null)}}>💾 Zapisz</button></div>}
    </div>}

    {confirmDel&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}} onClick={()=>setConfirmDel(null)}>
      <div onClick={e=>e.stopPropagation()} style={{background:T.cardBg,border:`1px solid ${T.cardBorder}`,borderRadius:14,padding:"24px 28px",minWidth:360,maxWidth:440,boxShadow:"0 20px 60px rgba(0,0,0,.4)"}}>
        <div style={{fontSize:16,fontWeight:700,color:T.textB,marginBottom:10}}>🗑 Usunąć użytkownika?</div>
        <div style={{fontSize:14,color:T.textM,marginBottom:6}}>Czy na pewno chcesz usunąć konto:</div>
        <div style={{padding:"10px 14px",borderRadius:8,background:T.boxBg,border:`1px solid ${T.boxBorder}`,marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:700,color:T.textB}}>{users[confirmDel]?.name||confirmDel}</div>
          <div style={{fontSize:13,color:T.textD,marginTop:2}}>Login: <span style={{fontFamily:"monospace",color:T.textM}}>{confirmDel}</span> • Rola: {users[confirmDel]?.role||"?"}</div>
          {users[confirmDel]?.email&&<div style={{fontSize:12,color:T.textD,marginTop:1}}>{users[confirmDel].email}</div>}</div>
        <div style={{background:"#ff335515",border:"1px solid #ff335533",borderRadius:8,padding:"8px 12px",marginBottom:16,fontSize:13,color:"#ff6677"}}>⚠ Ta operacja jest nieodwracalna. Użytkownik utraci dostęp do systemu.</div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={()=>setConfirmDel(null)} style={{...S.btn,background:T.boxBg,border:`1px solid ${T.boxBorder}`,color:T.textM,padding:"8px 18px"}}>Anuluj</button>
          <button onClick={()=>{delUser(confirmDel);setConfirmDel(null)}} style={{...S.btn,background:T.boxBg,padding:"8px 18px"}}>🗑 Usuń</button></div>
      </div></div>}
  </div>);}

// ═══ P5 PROTOKÓŁ JSON ═══
function P5({mb,hist,T}){const S=mkS(T);const[tab,sTab]=useState("lv2web");
  const[csvRange,setCsvRange]=useState("mem");const[csvBusy,setCsvBusy]=useState(false);
  const csvExport=async()=>{setCsvBusy(true);try{const src=csvRange==="mem"?hist:await queryHistory(csvRange);if(!src.length){setCsvBusy(false);return;}
    const h="Czas,PV1,PV2,SP1,MV,OutAnalog,MFC1,MFC2,MFC3,MFC4\n";
    const r=src.map(h=>`${h.t},${(h.pv1||0).toFixed(2)},${(h.pv2||0).toFixed(2)},${(h.sp1||0).toFixed(2)},${(h.mv||0).toFixed(1)},${(h.outA||0).toFixed(2)},${(h.mfc1||0).toFixed(1)},${(h.mfc2||0).toFixed(1)},${(h.mfc3||0).toFixed(1)},${(h.mfc4||0).toFixed(1)}`).join("\n");
    const b=new Blob([h+r],{type:"text/csv"});dlBlob(b,`thinfilm_${csvRange}_${Date.now()}.csv`)}catch{}setCsvBusy(false)};
  const schemas=tab==="lv2web"?JSON_LV2WEB:JSON_WEB2LV;
  return(<div style={{display:"grid",gap:12}}>
    <div style={S.card}><div style={S.title}><span>Protokół JSON — LabVIEW ↔ Kontroler</span></div>
      <div style={{display:"flex",gap:4,marginBottom:8}}>
        <button onClick={()=>sTab("lv2web")} style={{...S.btn,padding:"5px 10px",fontSize:12,background:tab==="lv2web"?T.actTab:T.boxBg,color:tab==="lv2web"?T.textA:T.textM}}>LabVIEW → Web</button>
        <button onClick={()=>sTab("web2lv")} style={{...S.btn,padding:"5px 10px",fontSize:12,background:tab==="web2lv"?T.actTab:T.boxBg,color:tab==="web2lv"?T.textA:T.textM}}>Web → LabVIEW</button></div>
      {schemas.map((s,i)=>(<div key={i} style={{...S.box,marginBottom:6}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:T.textA,fontSize:13,fontWeight:700}}>{s.type}</span><span style={{color:T.textD,fontSize:12}}>{s.desc}</span></div>
        <pre style={S.code}>{JSON.stringify(s.ex,null,2)}</pre></div>))}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <div style={S.card}><div style={S.title}><span>Eksport CSV</span></div>
        <div style={{color:T.textD,fontSize:13,marginBottom:8}}>Pamięć: <strong style={{color:T.pv2}}>{hist.length}</strong> rekordów</div>
        <div style={{display:"flex",gap:4,marginBottom:8,flexWrap:"wrap"}}>{[["mem","Pamięć"],["-1h","1h"],["-24h","24h"],["-7d","7d"]].map(([k,l])=>(<button key={k} onClick={()=>setCsvRange(k)} style={{padding:"3px 8px",borderRadius:4,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",background:csvRange===k?T.actTab:T.boxBg,color:csvRange===k?T.textA:T.textM}}>{l}</button>))}</div>
        <button onClick={csvExport} disabled={csvBusy} style={{...S.btn,background:T.boxBg,opacity:csvBusy?.5:1}}>📄 {csvBusy?"Eksportowanie...":"CSV"}</button></div>
      <div style={S.card}><div style={S.title}><span>Komunikacja</span></div>
        {[["WebSocket",mb.wsUrl,mb.wsConnected],["MODBUS-RTU",`Addr:${mb.modbusAddr}`,true],["MODBUS-TCP",`${mb.ethIP}:${mb.ethPort}`,true]].map(([l,d,on])=>(<div key={l} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",marginBottom:4,borderRadius:6,background:T.boxBg,border:`1px solid ${T.boxBorder}`}}><div style={{width:7,height:7,borderRadius:"50%",background:on?"#00cc66":"#999"}}/><div><div style={{color:T.tblT,fontSize:13,fontWeight:600}}>{l}</div><div style={{color:T.textD,fontSize:11,fontFamily:"monospace"}}>{d}</div></div></div>))}</div></div>
  </div>);}

// ═══ P6 LOGI ═══
function P6({logs,clearLogs,T}){const S=mkS(T);const[flt,sF]=useState("all");
  const cats={all:"Wszystkie",setpoint:"SP",mode:"Tryb",config:"Config",alarm:"Alarm",data:"Dane",export:"Export",ws:"WS",auth:"Auth"};
  const cc={setpoint:"#ffaa33",mode:"#33bbff",config:"#aa88ff",alarm:"#ff5577",data:"#33ddaa",export:"#77bbff",ws:"#ff88cc",auth:"#aacc55"};
  const fl=flt==="all"?logs:logs.filter(l=>l.cat===flt);
  const exp=()=>{const h="Czas,Kat,User,Akcja\n";const r=logs.map(l=>`${l.time},${l.cat},${l.user},${l.msg.replace(/,/g,";")}`).join("\n");const b=new Blob([h+r],{type:"text/csv"});dlBlob(b,`logs_${Date.now()}.csv`)};
  return(<div style={S.card}>
    <div style={S.title}><span>Logi akcji kontrolera</span><div style={{display:"flex",gap:4}}><span style={{color:T.textD,fontSize:12}}>{logs.length}</span>
      <button onClick={exp} style={{...S.btn,padding:"2px 8px",fontSize:12,background:T.boxBg}}>CSV</button>
      <button onClick={clearLogs} style={{...S.btn,padding:"2px 8px",fontSize:12,background:T.boxBg}}>🗑</button></div></div>
    <div style={{display:"flex",gap:3,marginBottom:8,flexWrap:"wrap"}}>{Object.entries(cats).map(([k,v])=><button key={k} onClick={()=>sF(k)} style={{padding:"3px 8px",borderRadius:6,border:"none",background:flt===k?T.actTab:T.boxBg,color:flt===k?T.textA:T.textM,fontSize:12,fontWeight:600,cursor:"pointer"}}>{v}</button>)}</div>
    <div style={{maxHeight:380,overflowY:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr style={{borderBottom:`1px solid ${T.cardBorder}`}}>
        {["Czas","Kat","User","Akcja"].map(h=><th key={h} style={{padding:"4px 6px",textAlign:"left",color:T.textM,fontWeight:600,fontSize:12,position:"sticky",top:0,background:T.tblH}}>{h}</th>)}</tr></thead>
        <tbody>{fl.slice().reverse().map((l,i)=>(<tr key={i} style={{borderBottom:`1px solid ${T.tblB}`,background:i%2?T.logAlt:"transparent"}}>
          <td style={{padding:"3px 6px",color:T.textD,fontFamily:"monospace",fontSize:11}}>{l.time}</td>
          <td style={{padding:"3px 6px"}}><span style={{color:cc[l.cat]||T.textM,fontWeight:600,fontSize:11,textTransform:"uppercase"}}>{l.cat}</span></td>
          <td style={{padding:"3px 6px",color:T.textM}}>{l.user}</td>
          <td style={{padding:"3px 6px",color:T.tblT}}>{l.msg}</td></tr>))}</tbody></table>
      {fl.length===0&&<div style={{color:T.textD,textAlign:"center",padding:20}}>Brak wpisów</div>}</div></div>);}

// ═══ P7 RAPORTY POMIAROWE ═══
function P7({reports,setReports,sample,profileName,toast,addLog,sendCmd,experiments,setExperiments,T}){const S=mkS(T);
  const[tab7,setTab7]=useState("reports");
  const[expDetail,setExpDetail]=useState(null);
  const empty={title:"",sampleId:sample.sampleId||"",material:sample.material||"",substrate:sample.substrate||"",method:sample.method||"",tempMax:"",result:"",notes:"",photos:[]};
  const[form,setForm]=useState(empty);const[edit,setEdit]=useState(-1);
  const uF=(k,v)=>setForm(f=>({...f,[k]:v}));
  const addPhoto=(e)=>{const files=Array.from(e.target.files||[]);files.forEach(f=>{if(!f.type.startsWith("image/")){toast("Tylko obrazy","error");return;}const r=new FileReader();r.onload=ev=>{if(typeof ev.target?.result==="string")setForm(fm=>({...fm,photos:[...fm.photos,{name:f.name,data:ev.target.result}]}))};r.readAsDataURL(f)})};
  const rmPhoto=(i)=>setForm(f=>({...f,photos:f.photos.filter((_,j)=>j!==i)}));
  const save=()=>{if(!form.title){toast("Podaj tytuł raportu","error");return;}const entry={...form,id:edit>=0?reports[edit].id:Date.now(),date:edit>=0?reports[edit].date:new Date().toISOString().slice(0,10),profile:profileName};
    if(edit>=0){setReports(r=>r.map((x,i)=>i===edit?entry:x));sendCmd?.("report_update",entry);toast("Raport zaktualizowany","success");addLog(`Raport edytowany: ${form.title}`,"data")}
    else{setReports(r=>[...r,entry]);sendCmd?.("report_create",entry);toast("Raport dodany","success");addLog(`Nowy raport: ${form.title}`,"data")}
    setForm(empty);setEdit(-1)};
  const startEdit=(i)=>{setForm(reports[i]);setEdit(i)};
  const del=(i)=>{setReports(r=>r.filter((_,j)=>j!==i));toast("Raport usunięty","info");addLog(`Raport usunięty: ${reports[i].title}`,"data")};

  const genHTML=()=>{const css=`body{font-family:'Segoe UI',sans-serif;max-width:900px;margin:20px auto;color:#222}h1{color:#0077b6;border-bottom:2px solid #0077b6;padding-bottom:8px}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #ccc;padding:8px 10px;text-align:left;font-size:13px}th{background:#f0f4f8;font-weight:600}tr:nth-child(even){background:#fafafa}.photos{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0}.photos img{max-width:140px;max-height:100px;border-radius:6px;border:1px solid #ddd}.meta{color:#666;font-size:12px;margin:4px 0}`;
    const rows=reports.map(r=>`<tr><td>${r.date}</td><td><strong>${r.title}</strong></td><td>${r.sampleId}</td><td>${r.material}</td><td>${r.substrate}</td><td>${r.method}</td><td>${r.tempMax||"-"}</td><td>${r.result||"-"}</td><td>${r.notes||"-"}</td><td class="photos">${r.photos.map(p=>`<img src="${p.data}" alt="${p.name}"/>`).join("")}</td></tr>`).join("");
    return`<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"><title>Raporty pomiarowe — ${APP_NAME}</title><style>${css}</style></head><body><h1>📑 Raporty pomiarowe</h1><p class="meta">${APP_NAME} v${APP_VER} • Wygenerowano: ${new Date().toLocaleString("pl-PL")}</p><table><thead><tr><th>Data</th><th>Tytuł</th><th>ID próbki</th><th>Materiał</th><th>Podłoże</th><th>Metoda</th><th>T max°C</th><th>Wynik</th><th>Uwagi</th><th>Zdjęcia</th></tr></thead><tbody>${rows}</tbody></table><footer style="margin-top:30px;padding-top:10px;border-top:1px solid #ddd;color:#999;font-size:11px">${APP_NAME} • Kontroler v${APP_VER}</footer></body></html>`};

  const exportHTML=()=>{const html=genHTML();const b=new Blob([html],{type:"text/html"});dlBlob(b,`raporty_${Date.now()}.html`);addLog("Eksport raportów HTML","export");toast("HTML OK","success")};

  const exportPDF=()=>{const html=genHTML();const w=window.open("","_blank");if(w){w.document.write(html);w.document.close();setTimeout(()=>{w.print()},500);addLog("Eksport raportów PDF (print)","export");toast("Okno druku otwarte — zapisz jako PDF","info")}else{toast("Zablokowano popup — zezwól na wyskakujące okna","error")}};

  const fld=[["Tytuł raportu *","title","Wygrzewanie ZnO #1"],["ID próbki","sampleId","ZnO-2026-001"],["Materiał","material","ZnO"],["Podłoże","substrate","SiO₂/Si"],["Metoda","method","PVD"],["T max (°C)","tempMax","400"],["Wynik","result","Warstwa jednorodna"],["Uwagi","notes","Notatki..."]];

  return(<div style={{display:"grid",gap:12}}>
    <div style={{display:"flex",gap:4}}>
      {[["reports","📑 Raporty pomiarowe"],["experiments","🔬 Zapisane eksperymenty"]].map(([id,l])=><button key={id} onClick={()=>setTab7(id)} style={{padding:"7px 14px",borderRadius:8,border:"none",background:tab7===id?T.actTab:T.boxBg,color:tab7===id?T.textA:T.textM,fontSize:13,fontWeight:600,cursor:"pointer"}}>{l}{id==="experiments"&&experiments.length>0?` (${experiments.length})`:""}</button>)}</div>

    {tab7==="reports"&&<>
    <div style={S.card}><div style={S.title}><span>{edit>=0?"✏ Edycja raportu":"➕ Nowy raport pomiarowy"}</span>
      <div style={{display:"flex",gap:4}}><button onClick={exportHTML} disabled={!reports.length} style={{...S.btn,padding:"4px 10px",fontSize:12,background:T.boxBg,opacity:reports.length?1:.4}}>📄 HTML</button>
        <button onClick={exportPDF} disabled={!reports.length} style={{...S.btn,padding:"4px 10px",fontSize:12,background:T.boxBg,opacity:reports.length?1:.4}}>📋 PDF</button></div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
        {fld.map(([l,k,ph])=><div key={k} style={S.box}><div style={S.lbl}>{l}</div><input value={form[k]||""} onChange={e=>uF(k,e.target.value)} placeholder={ph} style={S.input}/></div>)}</div>
      <div style={{...S.box,marginTop:8}}><div style={S.lbl}>Zdjęcia próbek</div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <label style={{...S.btn,padding:"6px 12px",fontSize:12,background:T.boxBg,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}}>
            📷 Dodaj zdjęcia<input type="file" accept="image/*" multiple onChange={addPhoto} style={{display:"none"}}/></label>
          <span style={{color:T.textD,fontSize:12}}>{form.photos.length} zdjęć</span></div>
        {form.photos.length>0&&<div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>{form.photos.map((p,i)=>(
          <div key={i} style={{position:"relative",borderRadius:8,overflow:"hidden",border:`1px solid ${T.boxBorder}`}}>
            <img src={p.data} alt={p.name} style={{width:90,height:70,objectFit:"cover",display:"block"}}/>
            <button onClick={()=>rmPhoto(i)} style={{position:"absolute",top:2,right:2,width:18,height:18,borderRadius:"50%",background:"rgba(0,0,0,.6)",color:"#fff",border:"none",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
            <div style={{fontSize:9,color:T.textD,padding:"1px 3px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:90}}>{p.name}</div></div>))}</div>}</div>
      <div style={{display:"flex",gap:6,marginTop:8}}>
        <button onClick={save} style={{...S.btn,background:T.boxBg}}>{edit>=0?"💾 Zapisz zmiany":"➕ Dodaj raport"}</button>
        {edit>=0&&<button onClick={()=>{setForm(empty);setEdit(-1)}} style={{...S.btn,background:T.boxBg,border:`1px solid ${T.boxBorder}`,color:T.textM}}>Anuluj</button>}</div></div>

    <div style={S.card}><div style={S.title}><span>Tabela raportów</span><span style={{fontSize:12,color:T.textD}}>{reports.length} raportów</span></div>
      {reports.length===0?<div style={{color:T.textD,textAlign:"center",padding:30,fontSize:14}}>Brak raportów — dodaj pierwszy powyżej</div>:
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr style={{borderBottom:`2px solid ${T.cardBorder}`}}>
          {["Data","Tytuł","Próbka","Materiał","Metoda","T max","Wynik","Zdjęcia",""].map(h=><th key={h} style={{padding:"5px 6px",textAlign:"left",color:T.textM,fontWeight:600,fontSize:12,position:"sticky",top:0,background:T.tblH}}>{h}</th>)}</tr></thead>
        <tbody>{reports.map((r,i)=>(<tr key={r.id} style={{borderBottom:`1px solid ${T.tblB}`,background:i%2?T.logAlt:"transparent"}}>
          <td style={{padding:"4px 6px",color:T.textD,fontFamily:"monospace",fontSize:12}}>{r.date}</td>
          <td style={{padding:"4px 6px",color:T.textB,fontWeight:600}}>{r.title}</td>
          <td style={{padding:"4px 6px",color:T.textM}}>{r.sampleId}</td>
          <td style={{padding:"4px 6px",color:T.textM}}>{r.material}</td>
          <td style={{padding:"4px 6px",color:T.textM}}>{r.method}</td>
          <td style={{padding:"4px 6px",color:T.pv1,fontFamily:"monospace"}}>{r.tempMax||"-"}</td>
          <td style={{padding:"4px 6px",color:T.tblT}}>{r.result||"-"}</td>
          <td style={{padding:"4px 6px"}}><div style={{display:"flex",gap:3}}>{r.photos.slice(0,3).map((p,j)=><img key={j} src={p.data} alt={p.name} style={{width:36,height:28,objectFit:"cover",borderRadius:4,border:`1px solid ${T.boxBorder}`}}/>)}{r.photos.length>3&&<span style={{color:T.textD,fontSize:11,alignSelf:"center"}}>+{r.photos.length-3}</span>}</div></td>
          <td style={{padding:"4px 6px"}}><div style={{display:"flex",gap:3}}>
            <button onClick={()=>startEdit(i)} style={{background:"none",border:"none",color:T.textA,cursor:"pointer",fontSize:14}} title="Edytuj">✏</button>
            <button onClick={()=>del(i)} style={{background:"none",border:"none",color:"#ff4455",cursor:"pointer",fontSize:14}} title="Usuń">🗑</button></div></td>
        </tr>))}</tbody></table></div>}</div>
    </>}

    {tab7==="experiments"&&<>
      <div style={S.card}><div style={S.title}><span>🔬 Historia załadowanych eksperymentów</span><span style={{fontSize:12,color:T.textD}}>{experiments.length} eksperymentów</span></div>
        {experiments.length===0?<div style={{color:T.textD,textAlign:"center",padding:40,fontSize:14}}>Brak zapisanych eksperymentów. Załaduj eksperyment z pliku JSON na stronie Eksperyment.</div>:
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{borderBottom:`2px solid ${T.cardBorder}`}}>
            {["Data","Profil","Etapy","ID Próbki","Materiał","Metoda","Operator","Plik",""].map(h=><th key={h} style={{padding:"5px 6px",textAlign:"left",color:T.textM,fontWeight:600,fontSize:12,position:"sticky",top:0,background:T.tblH}}>{h}</th>)}</tr></thead>
          <tbody>{experiments.map((ex,i)=>(<tr key={ex.id} style={{borderBottom:`1px solid ${T.tblB}`,background:i%2?T.logAlt:"transparent",cursor:"pointer"}} onClick={()=>setExpDetail(expDetail===i?null:i)}>
            <td style={{padding:"4px 6px",color:T.textD,fontFamily:"monospace",fontSize:12}}>{ex.loadedAt?new Date(ex.loadedAt).toLocaleString("pl-PL"):""}</td>
            <td style={{padding:"4px 6px",color:T.textB,fontWeight:600}}>{ex.profile?.name||"—"}</td>
            <td style={{padding:"4px 6px",color:T.textA,fontFamily:"monospace"}}>{ex.profile?.segments?.length||0}</td>
            <td style={{padding:"4px 6px",color:T.textM}}>{ex.sample?.sampleId||"—"}</td>
            <td style={{padding:"4px 6px",color:T.textM}}>{ex.sample?.material||"—"}</td>
            <td style={{padding:"4px 6px",color:T.textM}}>{ex.sample?.method||"—"}</td>
            <td style={{padding:"4px 6px",color:T.textM}}>{ex.loadedBy?.name||"—"}</td>
            <td style={{padding:"4px 6px",color:T.textD,fontSize:11,fontFamily:"monospace"}}>{ex.fileName||"—"}</td>
            <td style={{padding:"4px 6px"}}><div style={{display:"flex",gap:3}}>
              <button onClick={e=>{e.stopPropagation();const exp={type:"experiment",ver:APP_VER,app:APP_NAME,exportedAt:ex.exportedAt||ex.loadedAt,exportedBy:ex.exportedBy||ex.loadedBy,profile:ex.profile,sample:ex.sample};
                const bl=new Blob([JSON.stringify(exp,null,2)],{type:"application/json"});dlBlob(bl,ex.fileName||`exp_${ex.id}.json`);toast("Eksport OK","success")}} title="Eksport JSON" style={{background:"none",border:"none",color:T.textA,cursor:"pointer",fontSize:14}}>📥</button>
              <button onClick={e=>{e.stopPropagation();setExperiments(prev=>prev.filter((_,j)=>j!==i));if(expDetail===i)setExpDetail(null);toast("Usunięto","info")}} title="Usuń" style={{background:"none",border:"none",color:"#ff4455",cursor:"pointer",fontSize:14}}>🗑</button></div></td>
          </tr>))}</tbody></table></div>}</div>

      {expDetail!==null&&experiments[expDetail]&&(()=>{const ex=experiments[expDetail];return(
        <div style={S.card}><div style={S.title}><span>📋 Szczegóły eksperymentu</span>
          <button onClick={()=>setExpDetail(null)} style={{background:"none",border:"none",color:T.textD,cursor:"pointer",fontSize:14}}>✕</button></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><div style={{fontSize:13,fontWeight:700,color:T.textA,marginBottom:8}}>🌡 Profil: {ex.profile?.name||"—"}</div>
              {ex.profile?.segments?.map((s,i)=>(<div key={i} style={{display:"flex",gap:8,alignItems:"center",padding:"5px 8px",marginBottom:3,borderRadius:6,background:T.boxBg,border:`1px solid ${T.boxBorder}`}}>
                <span style={{fontSize:12,fontWeight:700,color:T.textA,width:20}}>E{i+1}</span>
                <span style={{fontSize:13,color:T.textB,fontWeight:600,flex:1}}>{s.name}</span>
                <span style={{fontSize:12,color:T.pv1,fontFamily:"monospace"}}>{s.sp}°C</span>
                <span style={{fontSize:11,color:T.textD}}>{s.ramp}°C/m</span>
                <span style={{fontSize:11,color:T.textD}}>{s.hold}min</span></div>))}
              <div style={{marginTop:10,fontSize:12,color:T.textD}}>
                <div>Załadowany: {ex.loadedAt?new Date(ex.loadedAt).toLocaleString("pl-PL"):""}</div>
                <div>Przez: {ex.loadedBy?.name} ({ex.loadedBy?.username})</div>
                {ex.exportedBy&&<div>Eksportował: {ex.exportedBy.name||ex.exportedBy.username} • {ex.exportedAt?new Date(ex.exportedAt).toLocaleString("pl-PL"):""}</div>}
                <div>Plik: {ex.fileName}</div></div></div>
            <div><div style={{fontSize:13,fontWeight:700,color:T.textA,marginBottom:8}}>🧪 Dane próbki</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                {[["ID",ex.sample?.sampleId],["Materiał",ex.sample?.material],["Podłoże",ex.sample?.substrate],["Metoda",ex.sample?.method],["Grubość",ex.sample?.thickness],["Gaz",ex.sample?.targetGas],
                  ["Temp.",ex.sample?.processTemp],["Ciśn.",ex.sample?.pressure],["Atmosf.",ex.sample?.atmosphere],["Moc",ex.sample?.sourcePower],["Czas",ex.sample?.processTime],["Przepływ",ex.sample?.gasFlow],
                  ["Operator",ex.sample?.operator],["Seria",ex.sample?.batchNo]].filter(([,v])=>v).map(([l,v])=>(
                <div key={l} style={{padding:"3px 6px",borderRadius:4,background:T.boxBg,border:`1px solid ${T.boxBorder}`}}>
                  <span style={{fontSize:11,color:T.textD}}>{l}: </span><span style={{fontSize:12,color:T.tblT}}>{v}</span></div>))}
              </div>
              {ex.sample?.goal&&<div style={{...S.box,marginTop:6}}><div style={{fontSize:11,color:T.textD}}>Cel:</div><div style={{fontSize:12,color:T.tblT}}>{ex.sample.goal}</div></div>}
              {ex.sample?.photos?.length>0&&<div style={{marginTop:6,fontSize:12,color:T.textD}}>📷 Zdjęcia: {ex.sample.photos.length} ścieżek
                <div style={{display:"flex",flexDirection:"column",gap:2,marginTop:3}}>{ex.sample.photos.map((p,j)=><div key={j} style={{fontSize:11,color:T.tblT,fontFamily:"monospace",padding:"2px 6px",background:T.boxBg,borderRadius:4}}>{p}</div>)}</div></div>}
            </div></div>
        </div>)})()}
    </>}
  </div>);}

// ═══ WS CONSOLE ═══
function WsConsole({open,onClose,wsCon,clearCon,T}){const S=mkS(T);const[tab,sTab]=useState("rx");
  if(!open)return null;const list=tab==="rx"?wsCon.rx:wsCon.tx;
  return(<div style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,.5)"}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{position:"absolute",right:10,top:10,bottom:10,width:"min(700px,95vw)",background:T.cardBg,border:`1px solid ${T.cardBorder}`,borderRadius:16,boxShadow:"0 20px 60px rgba(0,0,0,.3)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"10px 14px",borderBottom:`1px solid ${T.cardBorder}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div><div style={{fontWeight:700,fontSize:15,color:T.textB}}>🛰 WS Console</div><div style={{fontSize:12,color:T.textD}}>Podgląd RX/TX JSON na żywo</div></div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {["rx","tx"].map(id=><button key={id} onClick={()=>sTab(id)} style={{padding:"4px 10px",borderRadius:6,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",background:tab===id?T.actTab:T.boxBg,color:tab===id?T.textA:T.textM}}>{id.toUpperCase()} ({(id==="rx"?wsCon.rx:wsCon.tx).length})</button>)}
          <button onClick={clearCon} style={{...S.btn,padding:"4px 8px",fontSize:11,background:T.boxBg,border:`1px solid ${T.boxBorder}`,color:T.textM}}>Wyczyść</button>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.textD,cursor:"pointer",fontSize:18}}>✕</button></div></div>
      <div style={{flex:1,minHeight:0,overflowY:"auto",padding:10}}>
        {list.length===0?<div style={{color:T.textD,textAlign:"center",padding:30,fontSize:13}}>Brak wiadomości</div>:
        list.map((m,i)=>(<div key={i} style={{padding:"8px 10px",borderRadius:10,border:`1px solid ${T.cardBorder}`,background:T.boxBg,marginBottom:6}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:11,padding:"2px 6px",borderRadius:4,fontWeight:700,background:tab==="rx"?"#00aaff22":"#22aa4422",color:tab==="rx"?"#44bbff":"#44cc66"}}>{tab.toUpperCase()}</span>
              <span style={{fontSize:13,fontWeight:700,color:T.textB}}>{m.type}</span></div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:11,color:T.textD,fontFamily:"monospace"}}>{m.time}</span>
              <button onClick={()=>navigator.clipboard?.writeText(m.json||"")} style={{background:"none",border:`1px solid ${T.boxBorder}`,borderRadius:4,color:T.textM,cursor:"pointer",fontSize:10,padding:"2px 5px"}}>Kopiuj</button></div></div>
          <pre style={{margin:0,whiteSpace:"pre-wrap",fontSize:12,color:T.codeT,fontFamily:"monospace",lineHeight:1.35,maxHeight:160,overflowY:"auto"}}>{m.json}</pre></div>))}</div>
      <div style={{padding:"6px 14px",borderTop:`1px solid ${T.cardBorder}`,fontSize:11,color:T.textD,flexShrink:0}}>Tylko wiadomości JSON. Nowe na górze. Max 80 wpisów.</div>
    </div></div>);}

// ═══ P8: IMPEDANCJA ═══
function P8({mb,sendCmd,impData,T}){const S=mkS(T);const ifrRef=useRef(null);
  // Forward impedance_data from LV to iframe
  useEffect(()=>{if(impData&&ifrRef.current?.contentWindow){
    ifrRef.current.contentWindow.postMessage({type:"impedance_data",data:impData},"*")}
  },[impData]);
  // Listen for requests from iframe
  useEffect(()=>{const h=(ev)=>{if(ev.data?.type==="impedance_request"&&sendCmd){sendCmd("impedance_request",ev.data.data||{})}};
    window.addEventListener("message",h);return()=>window.removeEventListener("message",h)},[sendCmd]);
  return(<div style={S.card}>
    <div style={{...S.title,marginBottom:0}}><span>Spektroskopia impedancyjna</span>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:12,color:mb.wsConnected?T.textA:T.textD}}>{mb.wsConnected?"● WS":"○ Offline"}</span>
        <a href="/impedance.html" target="_blank" rel="noopener" style={{fontSize:12,color:T.textA,textDecoration:"none",fontWeight:500}}>↗ Nowe okno</a></div></div>
    <iframe ref={ifrRef} src="/impedance.html" style={{width:"100%",height:"calc(100vh - 160px)",border:"none",borderRadius:8,marginTop:8,background:"#0a1929"}} title="Impedance Spectroscopy"/></div>);
}

// ═══ P9: HELP / POMOC ═══
function P9({T}){
  const S=mkS(T);
  const[lang,setLang]=useState(()=>{try{return localStorage.getItem("tfl_help_lang")||"pl"}catch{return"pl"}});
  const[search,setSearch]=useState("");
  const[selSec,setSelSec]=useState("all");
  const[expanded,setExpanded]=useState(null);
  const[helpData,setHelpData]=useState(null);
  const[helpLoading,setHelpLoading]=useState(true);
  const[helpError,setHelpError]=useState(null);

  useEffect(()=>{let cancel=false;setHelpLoading(true);setHelpError(null);
    fetch("/help.json").then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json()})
      .then(all=>{if(!cancel){setHelpData(all);setHelpLoading(false)}})
      .catch(e=>{if(!cancel){setHelpError(e.message||"Fetch error");setHelpLoading(false)}});
    return()=>{cancel=true}},[]);

  if(helpLoading) return(<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%"}}>
    <div style={{textAlign:"center"}}><div style={{fontSize:32,marginBottom:8,animation:"pa 1.2s infinite"}}>⏳</div>
      <div style={{color:T.textD,fontSize:13}}>{lang==="pl"?"Ładowanie pomocy\u2026":"Loading help\u2026"}</div></div></div>);
  if(helpError||!helpData) return(<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%"}}>
    <div style={{textAlign:"center"}}><div style={{fontSize:40,marginBottom:8}}>⚠️</div>
      <div style={{color:"#ff5566",fontSize:15,marginBottom:4}}>{lang==="pl"?"Błąd ładowania pomocy":"Failed to load help"}</div>
      <div style={{color:T.textD,fontSize:12}}>{helpError||"Unknown error"}</div></div></div>);

  const d=helpData[lang]||helpData.pl;
  const{meta,sections}=d;

  const changeLang=(l)=>{setLang(l);try{localStorage.setItem("tfl_help_lang",l)}catch{}};

  const filtered=sections
    .filter(s=>selSec==="all"||s.id===selSec)
    .flatMap(s=>s.items
      .filter(it=>!search||it.q.toLowerCase().includes(search.toLowerCase())||it.a.toLowerCase().includes(search.toLowerCase()))
      .map((it,i)=>({key:`${s.id}-${i}`,secId:s.id,secTitle:s.title,secIcon:s.icon,q:it.q,a:it.a})));

  const toggle=k=>setExpanded(p=>p===k?null:k);

  const cardS={background:T.cardBg,border:`1px solid ${T.cardBorder}`,borderRadius:10,overflow:"hidden"};
  const headS={background:"linear-gradient(90deg,#0066aa,#0088cc)",color:"#fff",padding:"8px 12px",fontSize:14,fontWeight:700,display:"flex",alignItems:"center",gap:8};
  const bodyS={padding:10};

  return(<div style={{display:"flex",flexDirection:"column",gap:10,height:"100%",minHeight:0,overflow:"hidden"}}>
    {/* Header */}
    <div style={{flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
      <div><h1 style={{margin:0,fontSize:22,fontWeight:800,color:T.textB}}>{meta.title}</h1>
        <p style={{margin:"2px 0 0",fontSize:12,color:T.textD}}>{meta.subtitle}</p></div>
      <div style={{display:"flex",gap:4}}>
        {[["pl","🇵🇱 PL"],["en","🇬🇧 EN"]].map(([c,l])=>(
          <button key={c} onClick={()=>changeLang(c)} style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${lang===c?T.textA:T.cardBorder}`,
            background:lang===c?T.actTab:T.boxBg,color:lang===c?T.textA:T.textM,fontSize:12,fontWeight:600,cursor:"pointer"}}>{l}</button>))}
      </div>
    </div>

    <div style={{display:"flex",flex:1,minHeight:0,gap:10,overflow:"hidden"}}>
      {/* Left panel */}
      <div style={{width:220,flexShrink:0,display:"flex",flexDirection:"column",gap:8,overflowY:"auto",paddingBottom:4}}>
        {/* Search */}
        <div style={cardS}>
          <div style={headS}><span>🔍</span><span>{lang==="pl"?"Szukaj":"Search"}</span></div>
          <div style={bodyS}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={lang==="pl"?"Szukaj w pomocy…":"Search help topics…"}
              style={{...S.input,width:"100%",boxSizing:"border-box",marginBottom:8}}/>
            <div style={{fontSize:11,fontWeight:600,color:T.textD,marginBottom:4}}>{lang==="pl"?"Sekcja":"Section"}</div>
            <select value={selSec} onChange={e=>{setSelSec(e.target.value);setExpanded(null)}}
              style={{...S.input,width:"100%",boxSizing:"border-box",cursor:"pointer"}}>
              <option value="all">{lang==="pl"?"Wszystkie":"All"}</option>
              {sections.map(s=><option key={s.id} value={s.id}>{s.icon} {s.title}</option>)}
            </select>
          </div>
        </div>

        {/* Sections nav */}
        <div style={cardS}>
          <div style={headS}><span>📑</span><span>{lang==="pl"?"Sekcje":"Sections"}</span></div>
          <div style={{padding:6,display:"flex",flexDirection:"column",gap:2}}>
            {sections.map(s=>(
              <button key={s.id} onClick={()=>{setSelSec(s.id);setExpanded(null)}}
                style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,fontWeight:selSec===s.id?700:500,textAlign:"left",width:"100%",
                  background:selSec===s.id?T.actTab:"transparent",color:selSec===s.id?T.textA:T.textM}}>
                <span>{s.icon}</span><span style={{flex:1}}>{s.title}</span>
                <span style={{fontSize:10,color:T.textD,fontWeight:400}}>{s.items.length}</span>
              </button>))}
          </div>
        </div>

        {/* Contact */}
        <div style={cardS}>
          <div style={headS}><span>💬</span><span>{meta.contact_label}</span></div>
          <div style={bodyS}>
            <a href={`mailto:${meta.contact_email}`} style={{display:"flex",alignItems:"center",gap:8,padding:8,borderRadius:8,background:T.boxBg,textDecoration:"none",marginBottom:6}}>
              <span style={{fontSize:16}}>✉️</span>
              <div><div style={{fontSize:10,fontWeight:600,color:T.textA}}>Email</div>
                <div style={{fontSize:11,color:T.textM}}>{meta.contact_email}</div></div></a>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:8,borderRadius:8,background:T.boxBg,marginBottom:6}}>
              <span style={{fontSize:16}}>📞</span>
              <div><div style={{fontSize:10,fontWeight:600,color:"#22bb66"}}>Telefon</div>
                <div style={{fontSize:11,color:T.textM}}>{meta.contact_phone}</div></div></div>
            <div style={{fontSize:10,color:T.textD,textAlign:"center",marginTop:4}}>{meta.support_hours}</div>
          </div>
        </div>
      </div>

      {/* Right panel — FAQ accordion */}
      <div style={{flex:1,minHeight:0,overflowY:"auto"}}>
        <div style={cardS}>
          <div style={headS}><span>❓</span><span>FAQ ({filtered.length})</span></div>
          <div style={bodyS}>
            {filtered.length===0?(
              <div style={{textAlign:"center",padding:"40px 20px"}}>
                <div style={{fontSize:40,marginBottom:10}}>🔎</div>
                <div style={{fontSize:16,color:T.textM,marginBottom:4}}>{lang==="pl"?"Brak wyników":"No results found"}</div>
                <div style={{fontSize:12,color:T.textD}}>{lang==="pl"?"Spróbuj innych słów kluczowych lub zmień sekcję.":"Try different search terms or select another section."}</div>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {(()=>{
                  if(selSec!=="all") return filtered.map(it=>(
                    <FaqItem key={it.key} k={it.key} q={it.q} a={it.a} expanded={expanded===it.key} toggle={toggle} T={T}/>));
                  const groups=new Map();
                  for(const it of filtered){if(!groups.has(it.secId))groups.set(it.secId,[]);groups.get(it.secId).push(it)}
                  return Array.from(groups.entries()).map(([sid,items])=>(
                    <div key={sid} style={{marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,padding:"0 4px"}}>
                        <span>{items[0].secIcon}</span>
                        <span style={{fontSize:12,fontWeight:700,color:T.textM,textTransform:"uppercase",letterSpacing:.5}}>{items[0].secTitle}</span>
                        <div style={{flex:1,borderTop:`1px solid ${T.cardBorder}`,marginLeft:6}}/>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:6}}>
                        {items.map(it=>(<FaqItem key={it.key} k={it.key} q={it.q} a={it.a} expanded={expanded===it.key} toggle={toggle} T={T}/>))}
                      </div>
                    </div>));
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>);
}

function FaqItem({k,q,a,expanded,toggle,T}){
  return(<div style={{border:`1px solid ${T.cardBorder}`,borderRadius:8,overflow:"hidden"}}>
    <button onClick={()=>toggle(k)} style={{width:"100%",padding:"10px 14px",textAlign:"left",border:"none",cursor:"pointer",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,
      background:T.boxBg,color:T.textB,fontSize:13,fontWeight:600,lineHeight:1.4}}>{q}<span style={{flexShrink:0,color:T.textD,fontSize:14,marginTop:1}}>{expanded?"▾":"▸"}</span></button>
    {expanded&&<div style={{padding:"10px 14px",background:T.cardBg,borderTop:`1px solid ${T.cardBorder}`,fontSize:13,color:T.textM,lineHeight:1.6}}>{a}</div>}
  </div>);
}

// ═══ FOOTER ═══
function Footer({T}){return(<footer style={{background:T.footBg,borderTop:`1px solid ${T.footB}`,padding:"8px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:4,flexShrink:0}}>
  <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:18,height:18,borderRadius:4,background:T.logoBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,fontWeight:800,color:"#fff"}}>TFL</div>
    <span style={{color:T.footT,fontSize:12}}>© 2026 <span style={{color:T.footL,fontWeight:600}}>{APP_NAME}</span></span></div>
  <div style={{fontSize:11,color:T.footT}}>Kontroler v{APP_VER} • WebSocket JSON ↔ LabVIEW • AR200.B</div>
  <div style={{fontSize:11,color:T.textD}}>React • Node.js • TimescaleDB</div></footer>);}

// ═══ MAIN APP ═══
export default function App(){
  const[user,setUser]=useState(null);const[dark,setDark]=useState(true);const[ac,sAc]=useState(1);
  const[mb,setMb]=useState(initMb);const[hist,setHist]=useState([]);const[alog,sAlog]=useState([]);
  const[toasts,sToasts]=useState([]);const[logs,sLogs]=useState([]);const[influxOk,setInfluxOk]=useState(false);
  const[segs,setSegs]=useState([{name:"Rampa grzania",sp:200,ramp:5,hold:0,flow:[0,0,0,0]},{name:"Wygrzewanie",sp:400,ramp:3,hold:60,flow:[0,0,0,0]},{name:"Chłodzenie",sp:25,ramp:-10,hold:0,flow:[0,0,0,0]}]);
  const[profileName,setProfileName]=useState("Spiekanie ZnO");
  const[sample,setSample]=useState({sampleId:"",material:"",substrate:"",method:"",thickness:"",targetGas:"",processTemp:"",pressure:"",atmosphere:"",sourcePower:"",processTime:"",gasFlow:"",operator:"",batchNo:"",goal:"",notes:"",photos:[]});
  const[diagram,setDiagram]=useState({gas:"GAZ",gasType:"N₂/Ar",flow:"FLOW",furnace:"PIEC",bridge:"LabVIEW",bridgeSub:"WS Bridge"});
  const[customSvg,setCustomSvg]=useState(null);
  const[reports,setReports]=useState([]);
  const[experiments,setExperiments]=useState([]);
  const[users,setUsers]=useState(USERS_INIT);
  const[wsCon,setWsCon]=useState({rx:[],tx:[]});const[showWsCon,setShowWsCon]=useState(false);const[showUserMenu,setShowUserMenu]=useState(false);const[impData,setImpData]=useState(null);
  const mbRef=useRef(mb);mbRef.current=mb;const segRef=useRef(segs);segRef.current=segs;const prevA=useRef({a1:false,a2:false});
  const wsRef=useRef(null);const wsUrlRef=useRef(mb.wsUrl);const wsLastMsg=useRef(Date.now());const wsRecon=useRef({tries:0,timer:null});
  const T=dark?TH.dark:TH.light;const curUser=useRef("system");

  // ── Load cached config from localStorage (offline fallback) ──
  useEffect(()=>{try{const raw=localStorage.getItem("tfl_config");if(raw){const cfg=JSON.parse(raw);
    if(cfg.mfc&&Array.isArray(cfg.mfc))setMb(m=>({...m,mfc:cfg.mfc.map((c,i)=>({...m.mfc[i],...c}))}));
    if(cfg.ethIP)setMb(m=>({...m,ethIP:cfg.ethIP,ethPort:cfg.ethPort||m.ethPort}));
    if(cfg.users)setUsers(u=>({...u,...cfg.users}));
  }}catch{}},[]);

  const toast=useCallback((msg,type="info")=>{const id=Date.now()+Math.random();sToasts(t=>[...t,{id,msg,type}]);setTimeout(()=>sToasts(t=>t.filter(x=>x.id!==id)),3500)},[]);
  const addAlm=useCallback((msg,sev="warning")=>{sAlog(l=>[...l.slice(-100),{time:new Date().toLocaleTimeString("pl-PL"),msg,sev}])},[]);
  const addLog=useCallback((msg,cat="info")=>{sLogs(l=>[...l.slice(-500),{time:new Date().toLocaleTimeString("pl-PL"),msg,cat,user:curUser.current}])},[]);
  const clearLogs=useCallback(()=>{sLogs([]);toast("Logi wyczyszczone","info")},[toast]);

  // ── WebSocket URL sync + persist to localStorage ──
  useEffect(()=>{wsUrlRef.current=mb.wsUrl;try{localStorage.setItem("tfl_wsurl",mb.wsUrl)}catch{}},[mb.wsUrl]);

  // ── applyLvMessage: handle incoming LabVIEW messages ──
  const applyLvMessage=useCallback((msg)=>{
    const type=msg?.type||msg?.kind;const data=msg?.data??msg?.payload??msg;
    if(!type)return;wsLastMsg.current=Date.now();
    if(type==="measurement_update"){
      const mfcData=Array.isArray(data.mfc)?data.mfc:null;
      const rest={...data};delete rest.mfc;
      setMb(m=>{const next={...m,...rest};
        if(mfcData){next.mfc=m.mfc.map(d=>{const upd=mfcData.find(x=>x.id===d.id);return upd?{...d,pv:upd.pv??d.pv,sp:upd.sp??d.sp,enabled:upd.enabled??d.enabled}:d})}
        return next});
      const t=new Date();const label=`${String(t.getMinutes()).padStart(2,"0")}:${String(t.getSeconds()).padStart(2,"0")}`;
      const hp={t:label,pv1:+(data.pv1??0),pv2:+(data.pv2??0),sp1:+(data.sp1??0),profSP:+(data.sp1??0),ch3:+(data.ch3??0),mv:+(data.mv??0),outA:+(data.outAnalog??0),gasMixTemp:data.gasMixTemp??null,gasMixHumidity:data.gasMixHumidity??null,resistance:data.resistance??null};
      if(mfcData){mfcData.forEach(x=>{if(x.id>=1&&x.id<=4)hp[`mfc${x.id}`]=+(x.pv??0)})}
      setHist(h=>[...h,hp].slice(-150));writeDataPoint({...hp,_source:"ws"});return;}
    if(type==="status_update"){setMb(m=>({...m,...data}));return;}
    if(type==="alarm_event"){const sev=data?.sev||"warning";const msgT=data?.msg||"alarm";const latch=!!data?.latch;
      setMb(m=>({...m,alarmSTB:true,alarmLATCH:latch?true:m.alarmLATCH}));sAlog(a=>[...a,{time:new Date().toLocaleTimeString("pl-PL"),sev,msg:msgT}].slice(-100));return;}
    if(type==="state_snapshot"||type==="mb_snapshot"){setMb(m=>({...m,...data}));return;}
    if(type==="impedance_data"){setImpData(data);return;}
    if(type==="config_data"){
      // Apply received config: mfc, network, users, pages tooltips, etc.
      if(data.mfc&&Array.isArray(data.mfc))setMb(m=>({...m,mfc:data.mfc.map((c,i)=>({...m.mfc[i],...c}))}));
      if(data.wsUrl)setMb(m=>({...m,wsUrl:data.wsUrl}));
      if(data.ethIP)setMb(m=>({...m,ethIP:data.ethIP,ethPort:data.ethPort||m.ethPort}));
      if(data.users)setUsers(u=>({...u,...data.users}));
      // Cache config in localStorage for offline fallback
      try{localStorage.setItem("tfl_config",JSON.stringify({...data,_ts:Date.now()}))}catch{}
      addLog("Konfiguracja odebrana z LabVIEW","config");return;}
  },[addLog]);

  // ── disconnectWs ──
  const disconnectWs=useCallback((reason="")=>{
    try{if(wsRecon.current.timer){clearTimeout(wsRecon.current.timer);wsRecon.current.timer=null}
      wsRecon.current.tries=0;
      if(wsRef.current){wsRef.current.onopen=null;wsRef.current.onmessage=null;wsRef.current.onerror=null;wsRef.current.onclose=null;wsRef.current.close();wsRef.current=null}}catch{}
    setMb(m=>({...m,wsConnected:false}));if(reason)addLog(`WS disconnect: ${reason}`,"ws");
  },[addLog]);

  // ── connectWs ──
  const connectWs=useCallback(({manual=false}={})=>{
    const url=wsUrlRef.current;if(!url)return;
    if(wsRef.current&&(wsRef.current.readyState===0||wsRef.current.readyState===1))return;
    try{const ws=new WebSocket(url);wsRef.current=ws;
      ws.onopen=()=>{wsRecon.current.tries=0;wsLastMsg.current=Date.now();setMb(m=>({...m,wsConnected:true}));addLog(`WS connected: ${url}`,"ws");
        try{ws.send(JSON.stringify({type:"hello",ts:nowISO(),user:user||null,app:APP_NAME,ver:APP_VER}));
          ws.send(JSON.stringify({type:"config_request",ts:nowISO(),data:{},user:user?{username:user.username,role:user.role}:null}))}catch{}};
      ws.onmessage=(ev)=>{wsLastMsg.current=Date.now();let msg=null;try{msg=JSON.parse(ev.data)}catch{return}
        if(typeof msg!=="object"||!msg)return;
        const rxType=msg?.type||msg?.kind||"(?)";
        setWsCon(s=>({...s,rx:[{time:new Date().toLocaleTimeString("pl-PL"),type:rxType,json:JSON.stringify(msg,null,2)},...s.rx].slice(0,80)}));
        applyLvMessage(msg)};
      ws.onerror=()=>{addLog("WS error","ws")};
      ws.onclose=()=>{setMb(m=>({...m,wsConnected:false}));const tries=wsRecon.current.tries;const delay=clamp(1000*Math.pow(1.7,tries),1000,15000);
        wsRecon.current.tries=tries+1;addLog(`WS closed. Reconnect ${Math.round(delay/1000)}s`,"ws");
        if(wsRecon.current.timer)clearTimeout(wsRecon.current.timer);wsRecon.current.timer=setTimeout(()=>connectWs({manual:false}),delay)};
      if(manual)toast("WS łączenie...","info");
    }catch(e){addLog(`WS error: ${String(e)}`,"ws");setMb(m=>({...m,wsConnected:false}))}
  },[applyLvMessage,addLog,toast,user]);

  // ── sendCmd: send command to LabVIEW ──
  const sendCmd=useCallback((type,data={})=>{
    const payload={type,ts:nowISO(),user:user?{username:user.username,role:user.role,name:user.name}:null,data};
    const jsonText=JSON.stringify(payload,null,2);
    setWsCon(s=>({...s,tx:[{time:new Date().toLocaleTimeString("pl-PL"),type,json:jsonText},...s.tx].slice(0,80)}));
    addLog(`TX: ${type}`,"ws");
    const ws=wsRef.current;
    if(ws&&ws.readyState===1){try{ws.send(JSON.stringify(payload))}catch(e){addLog(`TX fail: ${String(e)}`,"ws")}}
  },[addLog,user]);

  // ── WS watchdog (timeout 12s → reconnect) ──
  useEffect(()=>{if(!user)return;
    const wd=setInterval(()=>{if(mb.wsConnected){const dt=Date.now()-wsLastMsg.current;if(dt>12000){addLog("WS timeout >12s. Reconnect.","ws");disconnectWs("timeout");connectWs({manual:false})}}},1500);
    return()=>clearInterval(wd)},[user,mb.wsConnected,addLog,disconnectWs,connectWs]);

  // ── InfluxDB health check ──
  useEffect(()=>{if(!user)return;influxHealth().then(ok=>setInfluxOk(ok));
    const hc=setInterval(()=>influxHealth().then(ok=>setInfluxOk(ok)),30000);
    return()=>clearInterval(hc)},[user]);

  // ── DEMO simulation (only when WS disconnected) ──

  useEffect(()=>{if(!user)return;curUser.current=user.username;const iv=setInterval(()=>{
    setMb(m=>{
      // Always update RTC
      const base={...m,rtc:new Date()};
      // If WS connected, LabVIEW drives data — skip simulation
      if(m.wsConnected) return base;
      // DEMO: PID simulation
      const n1=(Math.random()-.5)*.3,n2=(Math.random()-.5)*.6;let pv1=m.pv1,mv=m.mv,sp1=m.sp1,intg=m.pidI,pErr=m.pidPrevE;
      let pStg=m.progStage,pSt=m.progStatus,pEl=m.progElapsed;const sg=segRef.current;
      if(pSt==="RUN"&&sg.length>0&&pStg>0&&pStg<=sg.length){const s=sg[pStg-1];sp1=s.sp;pEl+=1;const prev=pStg>1?sg[pStg-2].sp:25;const rt=Math.abs((s.sp-prev)/(Math.abs(s.ramp)||1))*60;if(pEl>=rt+s.hold*60){if(pStg<sg.length){pStg++;pEl=0}else{pSt="STOP";pStg=0;pEl=0}}}
      if(m.regStatus==="RUN"&&!m.manualMode){const e=sp1-pv1;const P=e/(m.pidPb||1);intg=m.pidTi>0?intg+(e*1)/m.pidTi:0;intg=Math.max(-50,Math.min(50,intg));const D=m.pidTd>0?((e-pErr)/1)*m.pidTd*.01:0;mv=Math.max(0,Math.min(m.limitPower,(P+intg+D)*20));pErr=e;pv1+=((mv/100)*.6-.12+n1*.15);}
      else if(m.regStatus==="RUN"&&m.manualMode){mv=m.mvManual;pv1+=(mv/100)*.6-.12+n1*.15;}else{pv1-=.08-n1*.1;mv=0;intg=0;}
      const pv2=pv1-8+(Math.random()-.5)*3;const outAnalog=4+(Math.max(0,Math.min(1,pv1/500))*16);
      const alarm1=pv1>sp1+m.hyst*5,alarm2=pv1<sp1-m.hyst*10,alarmSTB=alarm1||alarm2,alarmLATCH=m.alarmLATCH||alarmSTB;
      // MFC sim: use flow setpoints from current profile segment if running
      const segFlows=(pSt==="RUN"&&pStg>0&&pStg<=sg.length)?(sg[pStg-1].flow||[0,0,0,0]):null;
      const mfcSim=m.mfc.map((d,mi)=>{const sp=segFlows?segFlows[mi]:d.sp;if(!d.enabled&&!sp)return{...d,pv:0,sp:segFlows?sp:d.sp};const drift=(Math.random()-.5)*(d.maxFlow||100)*0.02;return{...d,sp:segFlows?sp:d.sp,pv:Math.max(0,Math.min(d.maxFlow||500,sp+drift))}});
      return{...base,pv1,pv2,ch3:(pv1+pv2)/2,mv,sp1,out1:mv>3,out2:alarm1,outAnalog,alarm1,alarm2,alarmSTB,alarmLATCH,pidI:intg,pidPrevE:pErr,progStage:pStg,progStatus:pSt,progElapsed:pEl,mfc:mfcSim};});
    // History point (works for both demo and WS modes — WS updates via applyLvMessage also push history)
    const m=mbRef.current;if(!m.wsConnected){const now=new Date();const t=`${now.getMinutes().toString().padStart(2,"0")}:${now.getSeconds().toString().padStart(2,"0")}`;
    const hp={t,pv1:m.pv1,pv2:m.pv2,sp1:m.sp1,profSP:m.sp1,ch3:m.ch3,mv:m.manualMode?m.mvManual:m.mv,outA:m.outAnalog};
    m.mfc.forEach(d=>{hp[`mfc${d.id}`]=d.pv});
    setHist(h=>[...h.slice(-150),hp]);writeDataPoint({...hp,_source:"demo"});}
    if(m.alarm1&&!prevA.current.a1)addAlm(`HI: PV=${m.pv1.toFixed(1)}°C`,"danger");
    if(m.alarm2&&!prevA.current.a2)addAlm(`LO: PV=${m.pv1.toFixed(1)}°C`,"warning");
    prevA.current={a1:m.alarm1,a2:m.alarm2};
  },1000);return()=>clearInterval(iv);},[user,addAlm]);

  if(!user)return(<div style={{height:"100vh",overflow:"hidden"}}><style>{`@keyframes si{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}`}</style><LoginScreen onLogin={u=>{setUser(u);setDark(u.theme!=="light");addLog(`Login: ${u.name} (${u.role})`,"auth")}} users={users} T={T}/></div>);

  const pages=[
    {id:1,label:"Eksperyment",icon:"⬚",tip:"Podgląd na żywo temperatury, przepływów MFC, wykresów i statusu regulacji PID"},
    {id:8,label:"Impedancja",icon:"〰",tip:"Spektroskopia impedancyjna — wykresy Bode'go, Nyquista i R(f), pomiar lub symulacja Randles"},
    {id:3,label:"Próbka i proces",icon:"⏣",tip:"Opis próbki, parametry procesu technologicznego i profil temperaturowy"},
    {id:2,label:"Ustawienia eksperymentu",icon:"△",tip:"Profil temperaturowy z przepływami MFC, parametry PID, tryb ręczny/auto"},
    {id:7,label:"Raporty pomiarowe",icon:"▤",tip:"Generowanie i eksport raportów z wynikami pomiarów w formacie PDF/CSV"},
    {id:4,label:"Konfiguracja",icon:"⛭",tip:"Ustawienia systemu: połączenie WS, konfiguracja MFC, konta użytkowników"},
    {id:5,label:"Protokół JSON",icon:"❴❵",tip:"Dokumentacja protokołu komunikacji WebSocket JSON z aplikacją LabVIEW"},
    {id:6,label:"Logi akcji",icon:"☰",tip:"Historia zdarzeń systemowych, logowania, alarmów i komend użytkownika"},
    {id:9,label:"Pomoc",icon:"?",tip:"Dokumentacja, FAQ i kontakt z pomocą techniczną (PL/EN)"}
  ];
  const acc=pages.filter(p=>ROLE_ACCESS[user.role]?.includes(p.id));

  return(
    <div style={{height:"100vh",display:"flex",flexDirection:"column",background:T.bg,fontFamily:"'Segoe UI',system-ui,sans-serif",color:T.text,overflow:"hidden"}}>
      <style>{`@keyframes pa{0%,100%{opacity:1}50%{opacity:.5}}@keyframes si{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${T.sidebarBg}}::-webkit-scrollbar-thumb{background:${T.scroll};border-radius:3px}
        select option{background:${T.selBg};color:${T.text}}input[type=range]{height:5px}`}</style>
      <Toasts items={toasts} rm={id=>sToasts(t=>t.filter(x=>x.id!==id))} T={T}/>

      <header style={{background:T.headerBg,borderBottom:`1px solid ${T.cardBorder}`,padding:"0 14px",height:48,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:30,height:30,borderRadius:7,background:T.logoBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff"}}>TFL</div>
          <div><div style={{fontSize:14,fontWeight:700,color:T.textB}}>{APP_NAME} <span style={{fontSize:11,color:T.textD}}>v{APP_VER}</span></div>
            <div style={{fontSize:10,color:T.textD}}>Kontroler • WebSocket JSON ↔ LabVIEW • AR200.B</div></div></div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <Led on={mb.wsConnected} color="#00cc66" label="WS" T={T}/>
          <Led on={influxOk} color="#8844ff" label="DB" T={T}/>
          <button onClick={()=>setShowWsCon(true)} style={{padding:"2px 7px",borderRadius:5,background:T.boxBg,border:`1px solid ${T.boxBorder}`,color:T.textM,fontSize:11,cursor:"pointer",fontWeight:600}} title="WS Console">🛰</button>
          <Led on={mb.regStatus==="RUN"} color="#ff8844" label={mb.manualMode?"MAN":"REG"} T={T}/>
          <Led on={mb.alarmSTB} color="#ff3366" label="ALM" T={T}/>
          {mb.progStatus==="RUN"&&<Led on={true} color="#ffaa00" label={`P${mb.progStage}`} T={T}/>}
          <div style={{color:T.textD,fontSize:12,borderLeft:`1px solid ${T.cardBorder}`,paddingLeft:8,fontFamily:"monospace"}}>{mb.rtc.toLocaleTimeString("pl-PL")}</div>
          <button onClick={()=>{const nxt=dark?"light":"dark";setDark(d=>!d);setUser(u=>u?{...u,theme:nxt}:u);if(user)setUsers(us=>({...us,[user.username]:{...us[user.username],theme:nxt}}))}} title="Motyw" style={{width:36,height:20,borderRadius:10,border:`1px solid ${T.cardBorder}`,background:dark?"#1a2a3a":"#d0d8e0",cursor:"pointer",position:"relative",padding:0,flexShrink:0}}>
            <div style={{width:14,height:14,borderRadius:"50%",background:dark?"#00b4d8":"#ff9900",position:"absolute",top:2,left:dark?2:18,transition:"left .3s",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}}>{dark?"🌙":"☀️"}</div></button>
          <div style={{position:"relative"}}>
            <button onClick={()=>setShowUserMenu(v=>!v)} style={{padding:"2px 8px",borderRadius:5,background:T.userBg,border:`1px solid ${T.userB}`,fontSize:12,color:T.userT,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>👤 {user.name} <span style={{fontSize:9,opacity:.6}}>▼</span></button>
            {showUserMenu&&<><div style={{position:"fixed",inset:0,zIndex:9998}} onClick={()=>setShowUserMenu(false)}/>
              <div style={{position:"absolute",top:"100%",right:0,marginTop:6,width:280,background:T.cardBg,border:`1px solid ${T.cardBorder}`,borderRadius:12,boxShadow:"0 12px 40px rgba(0,0,0,.3)",zIndex:9999,animation:"si .15s ease-out",overflow:"hidden"}}>
                <div style={{padding:"14px 16px",borderBottom:`1px solid ${T.cardBorder}`,display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:36,height:36,borderRadius:8,background:T.logoBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#fff",fontWeight:700}}>{(user.firstName||user.name||"?")[0].toUpperCase()}</div>
                  <div><div style={{fontSize:14,fontWeight:700,color:T.textB}}>{user.firstName&&user.lastName?`${user.firstName} ${user.lastName}`:user.name}</div>
                    <div style={{fontSize:11,color:T.textD}}>@{user.username} • <span style={{padding:"1px 4px",borderRadius:3,background:user.role==="admin"?"#ff880022":"#00aaff15",color:user.role==="admin"?"#ffaa44":"#44aadd",fontWeight:600}}>{user.role}</span></div></div></div>
                <div style={{padding:"8px 12px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,fontSize:12,borderBottom:`1px solid ${T.cardBorder}`}}>
                  {[["Email",user.email],["Telefon",user.phone],["Motyw",dark?"🌙 Ciemny":"☀️ Jasny"]].map(([l,v])=>v?<div key={l}><div style={{color:T.textD,fontSize:10,fontWeight:600}}>{l}</div><div style={{color:T.textM}}>{v}</div></div>:null)}</div>
                <div style={{padding:"6px 8px",display:"flex",flexDirection:"column",gap:2}}>
                  <button onClick={()=>{setShowUserMenu(false);sAc(4);}} style={{width:"100%",padding:"7px 10px",borderRadius:6,border:"none",background:"transparent",color:T.textM,fontSize:12,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:6}}
                    onMouseEnter={e=>{e.currentTarget.style.background=T.boxBg}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}>⚙ Konfiguracja konta</button>
                  <button onClick={()=>{setShowUserMenu(false);const nxt=dark?"light":"dark";setDark(d=>!d);setUser(u=>({...u,theme:nxt}));setUsers(us=>({...us,[user.username]:{...us[user.username],theme:nxt}}))}} style={{width:"100%",padding:"7px 10px",borderRadius:6,border:"none",background:"transparent",color:T.textM,fontSize:12,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:6}}
                    onMouseEnter={e=>{e.currentTarget.style.background=T.boxBg}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}>{dark?"☀️ Jasny motyw":"🌙 Ciemny motyw"}</button>
                  <div style={{borderTop:`1px solid ${T.cardBorder}`,margin:"2px 0"}}/>
                  <button onClick={()=>{setShowUserMenu(false);addLog(`Logout: ${user.name}`,"auth");setUser(null)}} style={{width:"100%",padding:"7px 10px",borderRadius:6,border:"none",background:"transparent",color:"#ff5566",fontSize:12,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:6,fontWeight:600}}
                    onMouseEnter={e=>{e.currentTarget.style.background=T.loBg}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}>⏏ Wyloguj</button>
                </div></div></>}
          </div>
        </div></header>

      <div style={{display:"flex",flex:1,minHeight:0,overflow:"hidden"}}>
        <nav style={{width:185,background:T.sidebarBg,borderRight:`1px solid ${T.cardBorder}`,padding:"10px 6px",flexShrink:0,overflowY:"auto",overflowX:"hidden"}}>
          {acc.map(pg=>(<button key={pg.id} onClick={()=>sAc(pg.id)} title={pg.tip} style={{width:"100%",padding:"8px 10px",borderRadius:7,border:"none",textAlign:"left",marginBottom:2,cursor:"pointer",
            background:ac===pg.id?T.actTab:"transparent",color:ac===pg.id?T.textA:T.textM,fontSize:13,fontWeight:ac===pg.id?700:500,
            borderLeft:ac===pg.id?`3px solid ${T.textA}`:"3px solid transparent"}}><span style={{marginRight:4}}>{pg.icon}</span>{pg.label}</button>))}
          <div style={{marginTop:8,padding:6,borderTop:`1px solid ${T.titleB}`}}>
            <div style={{fontSize:14,color:T.textD,fontWeight:600,marginBottom:2}}>{mb.pv1Name||"PV1"}</div>
            <div style={{fontSize:19,fontWeight:700,color:mb.alarm1?T.pv1A:T.pv1,fontFamily:"monospace"}}>{mb.pv1.toFixed(1)}<span style={{fontSize:15,color:T.textD}}>°C</span></div>
            <div style={{fontSize:15,color:T.textD}}>Nastawa:{mb.sp1.toFixed(1)} MV:{(mb.manualMode?mb.mvManual:mb.mv).toFixed(0)}%</div>
            <div style={{fontSize:14,color:T.textD,fontWeight:600,marginTop:5,marginBottom:2}}>{mb.pv2Name||"PV2"}</div>
            <div style={{fontSize:16,fontWeight:600,color:"#aa44ff",fontFamily:"monospace"}}>{mb.pv2.toFixed(1)}<span style={{fontSize:15,color:T.textD}}>°C</span></div>
          </div>
          <div style={{marginTop:8,padding:6,borderTop:`1px solid ${T.titleB}`}}>
            <div style={{color:T.textD,fontSize:14,fontWeight:700,letterSpacing:1,marginBottom:4,textTransform:"uppercase"}}>Przepływ</div>
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              {mb.mfc.map((d,i)=>{const col=["#00aaff","#ffaa00","#00cc66","#cc44ff"][i];return(
                <div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",opacity:d.enabled?1:.35}}>
                  <span style={{fontSize:15,color:col,fontWeight:600}}>{d.gas}</span>
                  <span style={{fontSize:16,fontFamily:"monospace",color:d.enabled?col:T.textD}}>{d.pv.toFixed(1)}<span style={{fontSize:12,color:T.textD}}> {d.unit}</span></span>
                </div>)})}
            </div></div></nav>
        <main style={{flex:1,padding:12,minHeight:0,overflowY:"auto",overflowX:"hidden"}}>
          {ac===1&&<P1 mb={mb} setMb={setMb} hist={hist} alog={alog} profileName={profileName} setProfileName={setProfileName} diagram={diagram} customSvg={customSvg} segs={segs} setSegs={setSegs} sample={sample} setSample={setSample} user={user} addLog={addLog} toast={toast} goPage={sAc} sendCmd={sendCmd} experiments={experiments} setExperiments={setExperiments} T={T}/>}
          {ac===2&&<P2 mb={mb} setMb={setMb} toast={toast} segs={segs} setSegs={setSegs} profileName={profileName} setProfileName={setProfileName} addLog={addLog} goPage={sAc} sendCmd={sendCmd} T={T}/>}
          {ac===3&&<P3 sample={sample} setSample={setSample} toast={toast} addLog={addLog} sendCmd={sendCmd} T={T}/>}
          {ac===4&&<P4 mb={mb} setMb={setMb} toast={toast} addLog={addLog} diagram={diagram} setDiagram={setDiagram} customSvg={customSvg} setCustomSvg={setCustomSvg} user={user} users={users} setUsers={setUsers} connectWs={connectWs} disconnectWs={disconnectWs} influxOk={influxOk} setInfluxOk={setInfluxOk} T={T}/>}
          {ac===5&&<P5 mb={mb} hist={hist} T={T}/>}
          {ac===6&&<P6 logs={logs} clearLogs={clearLogs} T={T}/>}
          {ac===7&&<P7 reports={reports} setReports={setReports} sample={sample} profileName={profileName} toast={toast} addLog={addLog} sendCmd={sendCmd} experiments={experiments} setExperiments={setExperiments} T={T}/>}
          {ac===8&&<P8 mb={mb} sendCmd={sendCmd} impData={impData} T={T}/>}
          {ac===9&&<P9 T={T}/>}
        </main></div>
      <Footer T={T}/>
      <WsConsole open={showWsCon} onClose={()=>setShowWsCon(false)} wsCon={wsCon} clearCon={()=>setWsCon({rx:[],tx:[]})} T={T}/>
    </div>);
}
