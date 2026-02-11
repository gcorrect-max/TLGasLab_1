import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";

const APP_NAME = "Laboratorium badania cienkich warstw dla sensorów gazu";
const APP_VER = "3.0";

const TH={
  dark:{bg:"linear-gradient(180deg,#080d14,#0a1018)",headerBg:"linear-gradient(90deg,#0a1520,#111a28,#0a1520)",sidebarBg:"#0a1018",cardBg:"linear-gradient(145deg,#111a28,#0d1520)",cardBorder:"rgba(255,255,255,.08)",txt:"#e9eefc",sub:"rgba(233,238,252,.72)",muted:"rgba(233,238,252,.55)",acc:"#4da3ff",good:"#28d17c",warn:"#f5c542",bad:"#ff5d5d",shadow:"0 14px 40px rgba(0,0,0,.42)",chipBg:"rgba(255,255,255,.06)",inputBg:"rgba(255,255,255,.05)",grid:"rgba(255,255,255,.08)"},
  light:{bg:"linear-gradient(180deg,#f3f7ff,#ffffff)",headerBg:"linear-gradient(90deg,#ffffff,#f2f6ff,#ffffff)",sidebarBg:"#ffffff",cardBg:"linear-gradient(145deg,#ffffff,#f7f9ff)",cardBorder:"rgba(0,0,0,.09)",txt:"#0a1220",sub:"rgba(10,18,32,.72)",muted:"rgba(10,18,32,.55)",acc:"#1a73e8",good:"#17a765",warn:"#c58b11",bad:"#e53935",shadow:"0 12px 32px rgba(0,0,0,.12)",chipBg:"rgba(0,0,0,.05)",inputBg:"rgba(0,0,0,.04)",grid:"rgba(0,0,0,.08)"}
};

const USERS={
  admin:{password:"admin123",role:"admin",name:"Administrator"},
  operator:{password:"oper123",role:"user",name:"Operator"},
  student:{password:"stud123",role:"student",name:"Student"},
  guest:{password:"guest",role:"guest",name:"Gość"}
};

const ROLE_ACCESS={
  admin:[1,2,3,7,4,5,6],
  user:[1,2,3,7,4,5,6],
  student:[1,2,3,7],
  guest:[1]
};

const JSON_LV2WEB=[
  {k:"measurement_update", d:"Okresowe dane pomiarowe (PV/SP/MV/OUT)", ex:{type:"measurement_update", ts:"2026-02-10T12:00:00.000Z", data:{pv1:120.2,pv2:45.1,ch3:12.3,sp1:130,mv:60,outAnalog:12.0,manualMode:false}}},
  {k:"status_update", d:"Status regulatora / programu segmentowego / limity", ex:{type:"status_update", ts:"2026-02-10T12:00:01.000Z", data:{regMode:"PID",regStatus:"RUN",manualMode:false,progStatus:"RUN",progStage:2,progElapsed:120,limitPower:85,pidPb:4.2,pidTi:95,pidTd:24}}},
  {k:"alarm_event", d:"Zdarzenie alarmu (warning/error) + latch", ex:{type:"alarm_event", ts:"2026-02-10T12:00:02.000Z", data:{sev:"warning",msg:"HI: PV1 przekroczone",latch:true}}},
  {k:"state_snapshot", d:"Snapshot stanu (częściowy lub pełny)", ex:{type:"state_snapshot", ts:"2026-02-10T12:00:03.000Z", data:{pv1:140,sp1:150,manualMode:true,mvManual:40,regStatus:"STOP",progStatus:"STOP"}}}
];

const JSON_WEB2LV=[
  {k:"setpoint_command", d:"Ustawienie SP1/SP2/SP3", ex:{type:"setpoint_command", ts:"2026-02-10T12:00:00.000Z", user:{username:"operator",role:"user",name:"Operator"}, data:{sp1:180}}},
  {k:"mode_command", d:"MAN/AUTO + RUN/STOP regulator", ex:{type:"mode_command", ts:"2026-02-10T12:00:00.000Z", user:{username:"admin",role:"admin",name:"Administrator"}, data:{manualMode:true,regStatus:"RUN"}}},
  {k:"manual_mv", d:"Ręczne MV w trybie MAN", ex:{type:"manual_mv", ts:"2026-02-10T12:00:00.000Z", user:{username:"operator",role:"user",name:"Operator"}, data:{mvManual:55}}},
  {k:"pid_command", d:"Ustawienia PID", ex:{type:"pid_command", ts:"2026-02-10T12:00:00.000Z", user:{username:"admin",role:"admin",name:"Administrator"}, data:{pidPb:4.2,pidTi:95,pidTd:24}}},
  {k:"alarm_clear", d:"Kasowanie LATCH", ex:{type:"alarm_clear", ts:"2026-02-10T12:00:00.000Z", user:{username:"admin",role:"admin",name:"Administrator"}, data:{latch:true}}},
  {k:"profile_command", d:"Start/stop profilu segmentowego", ex:{type:"profile_command", ts:"2026-02-10T12:00:00.000Z", user:{username:"operator",role:"user",name:"Operator"}, data:{action:"start",profileName:"Profil_1",segments:[{name:"E1",sp:150,ramp:5,hold:120},{name:"E2",sp:200,ramp:3,hold:180}]}}},
  {k:"sample_info", d:"Dane próbki i procesu", ex:{type:"sample_info", ts:"2026-02-10T12:00:00.000Z", user:{username:"student",role:"student",name:"Student"}, data:{sampleId:"ZnO-001",material:"ZnO",gas:"NO2",thicknessNm:120,notes:"..."}}},
  {k:"report_create", d:"Utworzenie raportu", ex:{type:"report_create", ts:"2026-02-10T12:00:00.000Z", user:{username:"operator",role:"user",name:"Operator"}, data:{title:"Pomiar 2026-02-10",date:"2026-02-10",profile:"Profil_1",sampleId:"ZnO-001",result:"OK",notes:"...",photos:[{name:"img1.png",dataUrl:"data:image/png;base64,iVBORw0..."}]}}},
  {k:"report_update", d:"Aktualizacja raportu", ex:{type:"report_update", ts:"2026-02-10T12:00:00.000Z", user:{username:"operator",role:"user",name:"Operator"}, data:{title:"Pomiar 2026-02-10",date:"2026-02-10",profile:"Profil_1",sampleId:"ZnO-001",result:"OK",notes:"...",photos:[]}}}
];

function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
function fmt(n,dec=1){ if(n===null||n===undefined||Number.isNaN(+n)) return "—"; return (+n).toFixed(dec); }
function nowISO(){ return new Date().toISOString(); }

function downloadText(filename, text){
  const blob=new Blob([text],{type:"text/plain;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),500);
}

function downloadJson(filename, obj){
  downloadText(filename, JSON.stringify(obj,null,2));
}

function downloadCsv(filename, rows){
  const esc=(s)=>{
    const v=(s??"").toString();
    if(/[",\n]/.test(v)) return '"'+v.replaceAll('"','""')+'"';
    return v;
  };
  const csv=rows.map(r=>r.map(esc).join(",")).join("\n");
  downloadText(filename,csv);
}

function initMb(){
  return {
    pv1:25.0,pv2:24.7,ch3:12.0,
    sp1:40.0,sp2:0.0,sp3:0.0,
    mv:0.0,mvManual:0.0,manualMode:false,
    regMode:"PID",regStatus:"STOP",limitPower:100,
    out1:false,out2:false,outAnalog:0.0,
    alarm1:false,alarm2:false,alarmSTB:false,alarmLATCH:false,hyst:1.5,
    pidPb:4.5,pidTi:90,pidTd:22,pidI:0.0,pidPrevE:0.0,
    progStage:0,progStatus:"STOP",progElapsed:0,
    modbusAddr:1,baudRate:9600,charFmt:"8N1",ethIP:"192.168.1.50",ethPort:502,
    mqttBroker:"",mqttPort:1883,mqttTopic:"",
    recStatus:"STOP",recInterval:1,memUsed:12,
    rtc:new Date().toLocaleString(),
    inType1:"TC-K",
    wsUrl:"ws://127.0.0.1:8765/ws",wsConnected:false
  };
}

function Toasts({toasts,theme}){
  return (
    <div style={{position:"fixed",right:14,top:14,zIndex:9999,display:"flex",flexDirection:"column",gap:10}}>
      {toasts.map(t=>(
        <div key={t.id} style={{minWidth:260,maxWidth:360,padding:"10px 12px",borderRadius:14,boxShadow:theme.shadow,
          background:theme.cardBg,border:`1px solid ${theme.cardBorder}`,color:theme.txt}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
            <div style={{fontWeight:800}}>{t.title}</div>
            <div style={{fontSize:12,color:theme.muted}}>{t.time}</div>
          </div>
          <div style={{marginTop:6,color:theme.sub,fontSize:13,lineHeight:1.25}}>{t.msg}</div>
        </div>
      ))}
    </div>
  );
}

function WsConsole({open,onClose,theme,wsConsole,clearConsole}){
  const [tab,setTab]=useState("rx");
  const list = tab==="rx" ? wsConsole.rx : wsConsole.tx;

  if(!open) return null;

  return (
    <div style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,.45)"}} onMouseDown={onClose}>
      <div onMouseDown={(e)=>e.stopPropagation()} style={{
        position:"absolute",right:12,top:12,bottom:12,width:"min(720px,96vw)",
        background:theme.cardBg,border:`1px solid ${theme.cardBorder}`,borderRadius:20,boxShadow:theme.shadow,
        display:"flex",flexDirection:"column",overflow:"hidden"
      }}>
        <div style={{padding:"12px 12px",borderBottom:`1px solid ${theme.cardBorder}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
          <div>
            <div style={{fontWeight:1000}}>🛰 WS Console</div>
            <div style={{fontSize:12,color:theme.muted}}>Podgląd ostatnich RX/TX JSONów (na żywo)</div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",justifyContent:"flex-end"}}>
            <SimpleTabs theme={theme} tab={tab} setTab={setTab} tabs={[{id:"rx",label:`RX (${wsConsole.rx.length})`},{id:"tx",label:`TX (${wsConsole.tx.length})`}]} />
            <Btn theme={theme} kind="sec" onClick={clearConsole} small>Wyczyść</Btn>
            <Btn theme={theme} kind="sec" onClick={onClose} small>Zamknij</Btn>
          </div>
        </div>

        <div style={{padding:12,display:"grid",gap:10,overflow:"auto"}}>
          {list.length===0 && <div style={{fontSize:12,color:theme.muted}}>Brak wiadomości.</div>}
          {list.map((m,idx)=>(
            <div key={idx} style={{padding:"10px 10px",borderRadius:16,border:`1px solid ${theme.cardBorder}`,background:theme.chipBg}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
                <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                  <ABadge theme={theme} kind={tab==="rx"?"info":"good"} text={tab==="rx"?"RX":"TX"} />
                  <div style={{fontWeight:1000,fontSize:12}}>{m.type || "(no type)"}</div>
                </div>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <div style={{fontSize:12,color:theme.muted}}>{m.time}</div>
                  <Btn theme={theme} kind="sec" small onClick={()=>navigator.clipboard?.writeText(m.jsonText || "")}>Kopiuj</Btn>
                </div>
              </div>
              <pre style={{marginTop:8,whiteSpace:"pre-wrap",fontSize:12,color:theme.sub,lineHeight:1.3}}>{m.jsonText}</pre>
            </div>
          ))}
        </div>

        <div style={{padding:"10px 12px",borderTop:`1px solid ${theme.cardBorder}`,fontSize:12,color:theme.muted}}>
          Tip: jeśli LV wysyła tekst (nie-JSON), nie będzie widoczny tutaj (celowo filtrujemy tylko obiekty JSON).
        </div>
      </div>
    </div>
  );
}

function Led({on,label,theme,color}){
  const c=on?(color||theme.good):"rgba(255,255,255,.18)";
  return (
    <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:999,
      border:`1px solid ${theme.cardBorder}`,background:theme.chipBg}}>
      <div style={{width:10,height:10,borderRadius:20,background:c,boxShadow:on?`0 0 12px ${c}`:"none"}} />
      <div style={{fontSize:12,color:theme.sub,fontWeight:700}}>{label}</div>
    </div>
  );
}

function ABadge({text,theme,kind="info"}){
  const map={
    info:{bg:`rgba(77,163,255,.14)`,bd:`rgba(77,163,255,.35)`,tx:theme.acc},
    good:{bg:`rgba(40,209,124,.14)`,bd:`rgba(40,209,124,.35)`,tx:theme.good},
    warn:{bg:`rgba(245,197,66,.14)`,bd:`rgba(245,197,66,.35)`,tx:theme.warn},
    bad:{bg:`rgba(255,93,93,.14)`,bd:`rgba(255,93,93,.35)`,tx:theme.bad}
  };
  const s=map[kind]||map.info;
  return (
    <span style={{display:"inline-flex",alignItems:"center",padding:"4px 10px",borderRadius:999,
      background:s.bg,border:`1px solid ${s.bd}`,color:s.tx,fontSize:12,fontWeight:800}}>
      {text}
    </span>
  );
}

function Gauge({value,min=0,max=100,sp=null,title="",unit="",warn=null,danger=null,theme}){
  const v=clamp(+value,min,max);
  const pct=(v-min)/(max-min);
  const ang=-140+280*pct;
  const r=52; const cx=60; const cy=60;
  const rad=(a)=> (Math.PI/180)*a;
  const x=cx+r*Math.cos(rad(ang));
  const y=cy+r*Math.sin(rad(ang));
  const col=(danger!==null && v>=danger)?theme.bad:(warn!==null && v>=warn)?theme.warn:theme.good;
  const arcPath=(a1,a2)=>{
    const x1=cx+r*Math.cos(rad(a1)); const y1=cy+r*Math.sin(rad(a1));
    const x2=cx+r*Math.cos(rad(a2)); const y2=cy+r*Math.sin(rad(a2));
    const large=(a2-a1)>180?1:0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };
  const spAng = sp===null?null: -140+280*clamp((sp-min)/(max-min),0,1);
  const spx = spAng===null?null: cx+r*Math.cos(rad(spAng));
  const spy = spAng===null?null: cy+r*Math.sin(rad(spAng));

  return (
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
        <div style={{fontWeight:900}}>{title}</div>
        <div style={{fontSize:12,color:theme.muted}}>{unit}</div>
      </div>
      <div style={{display:"flex",gap:12,alignItems:"center"}}>
        <svg width="120" height="90" viewBox="0 0 120 90">
          <path d={arcPath(-140,140)} stroke={theme.grid} strokeWidth="12" fill="none" strokeLinecap="round" />
          <path d={arcPath(-140,ang)} stroke={col} strokeWidth="12" fill="none" strokeLinecap="round" />
          {spAng!==null && (
            <>
              <circle cx={spx} cy={spy} r="4" fill={theme.acc} />
            </>
          )}
          <circle cx={x} cy={y} r="5" fill={col} />
        </svg>
        <div>
          <div style={{fontSize:28,fontWeight:1000,lineHeight:1}}>{fmt(v,1)}</div>
          <div style={{fontSize:12,color:theme.muted,marginTop:2}}>
            {sp===null?"":`SP: ${fmt(sp,1)} ${unit}`}
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({title,subtitle,theme,actions,children}){
  return (
    <div style={{background:theme.cardBg,border:`1px solid ${theme.cardBorder}`,borderRadius:18,boxShadow:theme.shadow,padding:14}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}>
        <div>
          <div style={{fontWeight:1000,letterSpacing:.2}}>{title}</div>
          {subtitle && <div style={{fontSize:12,color:theme.muted,marginTop:2}}>{subtitle}</div>}
        </div>
        {actions}
      </div>
      <div style={{marginTop:12}}>{children}</div>
    </div>
  );
}

function Btn({children,onClick,theme,kind="pri",disabled=false,small=false}){
  const map={
    pri:{bg:theme.acc,tx:"#fff",bd:"transparent"},
    sec:{bg:"transparent",tx:theme.txt,bd:theme.cardBorder},
    good:{bg:theme.good,tx:"#07130e",bd:"transparent"},
    warn:{bg:theme.warn,tx:"#1a1202",bd:"transparent"},
    bad:{bg:theme.bad,tx:"#1a0202",bd:"transparent"}
  };
  const s=map[kind]||map.pri;
  return (
    <button disabled={disabled} onClick={onClick} style={{
      cursor:disabled?"not-allowed":"pointer",
      opacity:disabled?.55:1,
      padding:small?"7px 10px":"9px 12px",
      borderRadius:12,
      border:`1px solid ${s.bd}`,
      background:s.bg,
      color:s.tx,
      fontWeight:900,
      fontSize:small?12:13,
      boxShadow: kind==="sec"?"none":theme.shadow
    }}>{children}</button>
  );
}

function Input({value,onChange,theme,placeholder="",type="text",min,max,step}){
  return (
    <input value={value} type={type} placeholder={placeholder} min={min} max={max} step={step}
      onChange={(e)=>onChange(e.target.value)}
      style={{width:"100%",padding:"9px 10px",borderRadius:12,border:`1px solid ${theme.cardBorder}`,
        background:theme.inputBg,color:theme.txt,outline:"none"}} />
  );
}

function Textarea({value,onChange,theme,placeholder="",rows=4}){
  return (
    <textarea rows={rows} value={value} placeholder={placeholder}
      onChange={(e)=>onChange(e.target.value)}
      style={{width:"100%",padding:"9px 10px",borderRadius:12,border:`1px solid ${theme.cardBorder}`,
        background:theme.inputBg,color:theme.txt,outline:"none",resize:"vertical"}} />
  );
}

function Select({value,onChange,theme,options=[]}){
  return (
    <select value={value} onChange={(e)=>onChange(e.target.value)} style={{width:"100%",padding:"9px 10px",borderRadius:12,
      border:`1px solid ${theme.cardBorder}`,background:theme.inputBg,color:theme.txt,outline:"none"}}>
      {options.map(o=> <option key={o.value} value={o.value}>{o.label}</option>) }
    </select>
  );
}

function LoginScreen({onLogin,theme}){
  const [u,setU]=useState("admin");
  const [p,setP]=useState("admin123");
  const [tries,setTries]=useState(0);
  const [err,setErr]=useState(" ");

  const submit=()=>{
    const rec=USERS[u];
    if(!rec || rec.password!==p){
      const t=tries+1;
      setTries(t);
      setErr(t>=3?"Zbyt wiele prób.":"Błędny login lub hasło.");
      return;
    }
    onLogin({username:u,role:rec.role,name:rec.name});
  };

  return (
    <div style={{minHeight:"100vh",display:"grid",placeItems:"center",background:theme.bg,color:theme.txt,padding:20}}>
      <div style={{width:"min(460px,100%)",background:theme.cardBg,border:`1px solid ${theme.cardBorder}`,
        borderRadius:22,boxShadow:theme.shadow,padding:18}}>
        <div style={{fontSize:18,fontWeight:1000}}>{APP_NAME}</div>
        <div style={{fontSize:12,color:theme.muted,marginTop:4}}>Logowanie (tryb demo) • v{APP_VER}</div>

        <div style={{marginTop:14,display:"grid",gap:10}}>
          <div>
            <div style={{fontSize:12,color:theme.muted,fontWeight:800,marginBottom:6}}>Użytkownik</div>
            <Select theme={theme} value={u} onChange={setU} options={[
              {value:"admin",label:"admin"},
              {value:"operator",label:"operator"},
              {value:"student",label:"student"},
              {value:"guest",label:"guest"}
            ]} />
          </div>
          <div>
            <div style={{fontSize:12,color:theme.muted,fontWeight:800,marginBottom:6}}>Hasło</div>
            <Input theme={theme} value={p} onChange={setP} type="password" />
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontSize:12,color:theme.bad,fontWeight:800}}>{err}</div>
            <Btn theme={theme} onClick={submit}>Zaloguj</Btn>
          </div>
          <div style={{fontSize:12,color:theme.muted,marginTop:8,lineHeight:1.35}}>
            Konta demo: <b>admin/admin123</b>, <b>operator/oper123</b>, <b>student/stud123</b>, <b>guest/guest</b>.
          </div>
        </div>
      </div>
    </div>
  );
}

function TopBar({theme,user,onLogout,dark,setDark,mb,onOpenWsConsole}){
  return (
    <div style={{position:"sticky",top:0,zIndex:50,background:theme.headerBg,borderBottom:`1px solid ${theme.cardBorder}`,
      padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
      <div style={{display:"flex",flexDirection:"column"}}>
        <div style={{fontWeight:1000,letterSpacing:.2}}>{APP_NAME}</div>
        <div style={{fontSize:12,color:theme.muted}}>
          v{APP_VER} • {user.name} ({user.role}) • RTC: {mb.rtc}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",justifyContent:"flex-end"}}>
        <Led theme={theme} on={mb.wsConnected} label={mb.wsConnected?"WS CONNECTED":"WS OFF"} color={mb.wsConnected?theme.good:theme.warn} />
        <Led theme={theme} on={mb.regStatus==="RUN"} label={mb.regStatus==="RUN"?"REG RUN":"REG STOP"} color={theme.acc} />
        <Led theme={theme} on={mb.manualMode} label={mb.manualMode?"MAN":"AUTO"} color={mb.manualMode?theme.warn:theme.good} />
        <Btn theme={theme} kind="sec" onClick={onOpenWsConsole}>🛰 WS Console</Btn>
        <Btn theme={theme} kind="sec" onClick={()=>setDark(!dark)}>{dark?"☀️ Light":"🌙 Dark"}</Btn>
        <Btn theme={theme} kind="sec" onClick={onLogout}>Wyloguj</Btn>
      </div>
    </div>
  );
}

function Sidebar({theme,pages,ac,setAc}){
  return (
    <div style={{width:260,background:theme.sidebarBg,borderRight:`1px solid ${theme.cardBorder}`,padding:12,position:"sticky",top:0,height:"100vh",overflow:"auto"}}>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={{padding:"12px 12px",borderRadius:18,background:theme.cardBg,border:`1px solid ${theme.cardBorder}`}}>
          <div style={{fontWeight:1000}}>Menu</div>
          <div style={{fontSize:12,color:theme.muted,marginTop:2}}>Dostęp wg roli</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {pages.map(p=>{
            const active=ac===p.id;
            return (
              <button key={p.id} onClick={()=>setAc(p.id)} style={{textAlign:"left",cursor:"pointer",padding:"10px 12px",borderRadius:14,
                border:`1px solid ${active?"rgba(77,163,255,.55)":theme.cardBorder}`,
                background:active?"rgba(77,163,255,.14)":theme.cardBg,
                color:theme.txt,fontWeight:900}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span>{p.icon} {p.name}</span>
                  {p.badge && <ABadge theme={theme} text={p.badge.text} kind={p.badge.kind} />}
                </div>
                {p.desc && <div style={{fontSize:12,color:theme.muted,marginTop:4,fontWeight:700}}>{p.desc}</div>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MiniKV({k,v,theme}){
  return (
    <div style={{display:"flex",justifyContent:"space-between",gap:10,padding:"8px 10px",borderRadius:12,
      border:`1px solid ${theme.cardBorder}`,background:theme.chipBg}}>
      <div style={{fontSize:12,color:theme.muted,fontWeight:900}}>{k}</div>
      <div style={{fontSize:12,color:theme.txt,fontWeight:1000}}>{v}</div>
    </div>
  );
}

function SimpleTabs({theme,tab,setTab,tabs}){
  return (
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      {tabs.map(t=>{
        const a=tab===t.id;
        return (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{cursor:"pointer",padding:"8px 10px",borderRadius:999,
            border:`1px solid ${a?"rgba(77,163,255,.55)":theme.cardBorder}`,
            background:a?"rgba(77,163,255,.14)":theme.chipBg,
            color:theme.txt,fontWeight:900,fontSize:12}}>{t.label}</button>
        );
      })}
    </div>
  );
}

function DefaultDiagramSvg({theme,diagram}){
  const stroke=theme.grid;
  const fill="transparent";
  const tx=theme.sub;
  return (
    <svg width="100%" height="280" viewBox="0 0 920 280" style={{display:"block"}}>
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0" stopColor="rgba(77,163,255,.35)" />
          <stop offset="1" stopColor="rgba(40,209,124,.25)" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="904" height="264" rx="18" fill={fill} stroke={stroke} strokeWidth="2" />

      <rect x="40" y="58" width="160" height="70" rx="14" fill="url(#g)" stroke={stroke} />
      <text x="120" y="92" fill={tx} textAnchor="middle" fontSize="14" fontWeight="800">{diagram.gas}</text>

      <rect x="240" y="58" width="180" height="70" rx="14" fill="url(#g)" stroke={stroke} />
      <text x="330" y="92" fill={tx} textAnchor="middle" fontSize="14" fontWeight="800">{diagram.flow}</text>

      <rect x="460" y="40" width="210" height="110" rx="18" fill="url(#g)" stroke={stroke} />
      <text x="565" y="70" fill={tx} textAnchor="middle" fontSize="14" fontWeight="900">{diagram.oven}</text>
      <text x="565" y="98" fill={tx} textAnchor="middle" fontSize="12">PV/SP/MV</text>

      <rect x="720" y="58" width="160" height="70" rx="14" fill="url(#g)" stroke={stroke} />
      <text x="800" y="92" fill={tx} textAnchor="middle" fontSize="14" fontWeight="800">{diagram.measure}</text>

      <path d="M 200 93 L 240 93" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
      <path d="M 420 93 L 460 93" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
      <path d="M 670 93 L 720 93" stroke={stroke} strokeWidth="4" strokeLinecap="round" />

      <rect x="460" y="170" width="210" height="70" rx="14" fill="transparent" stroke={stroke} />
      <text x="565" y="200" fill={tx} textAnchor="middle" fontSize="14" fontWeight="800">{diagram.bridge}</text>
      <text x="565" y="222" fill={tx} textAnchor="middle" fontSize="12">R (sensor)</text>

      <path d="M 565 150 L 565 170" stroke={stroke} strokeWidth="4" strokeLinecap="round" />

      <rect x="40" y="170" width="160" height="70" rx="14" fill="transparent" stroke={stroke} />
      <text x="120" y="200" fill={tx} textAnchor="middle" fontSize="14" fontWeight="800">{diagram.pump}</text>

      <path d="M 40 93 C 10 93 10 205 40 205" stroke={stroke} strokeWidth="3" fill="none" />
      <path d="M 200 205 C 300 205 340 205 460 205" stroke={stroke} strokeWidth="3" fill="none" />
    </svg>
  );
}

function P1({theme,mb,hist,alog,diagram,customSvg}){
  const chartData=hist;
  const maxT=Math.max(200, mb.sp1+50);

  return (
    <div style={{display:"grid",gridTemplateColumns:"1.25fr .75fr",gap:14,alignItems:"start"}}>
      <div style={{display:"grid",gap:14}}>
        <Card theme={theme} title="Schemat stanowiska" subtitle="(diagram + przepływ procesu)">
          {customSvg
            ? <div style={{borderRadius:16,overflow:"hidden",border:`1px solid ${theme.cardBorder}`}} dangerouslySetInnerHTML={{__html:customSvg}} />
            : <DefaultDiagramSvg theme={theme} diagram={diagram} />
          }
        </Card>

        <Card theme={theme} title="Wykres temperatur i sterowania" subtitle="PV/SP/MV (ostatnie ~150 s)">
          <div style={{width:"100%",height:280}}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{top:10,right:20,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="4 4" />
                <XAxis
                    dataKey="t"
                    type="number"
                    scale="linear"
                    domain={["dataMin","dataMax"]}
                    tick={{fontSize:12}}
                    tickFormatter={(v)=> (v<1?`${Math.round(v*60)}s`:`${Number(v).toFixed(1)}m`)}
                  />
                <YAxis yAxisId="left" domain={[0,maxT]} tick={{fontSize:12}} />
                <YAxis yAxisId="right" orientation="right" domain={[0,100]} tick={{fontSize:12}} />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="pv1" name="PV1" strokeWidth={2} dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="pv2" name="PV2" strokeWidth={2} dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="sp1" name="SP1" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="mv" name="MV %" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div style={{display:"grid",gap:14}}>
        <Card theme={theme} title="Status" subtitle="Kluczowe wartości">
          <div style={{display:"grid",gap:10}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Gauge theme={theme} title="PV1" value={mb.pv1} min={0} max={300} sp={mb.sp1} unit="°C" warn={mb.sp1+20} danger={mb.sp1+50} />
              <Gauge theme={theme} title="MV" value={mb.manualMode?mb.mvManual:mb.mv} min={0} max={100} sp={null} unit="%" warn={85} danger={95} />
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <MiniKV theme={theme} k="Tryb" v={mb.manualMode?"MANUAL":"AUTO"} />
              <MiniKV theme={theme} k="Regulator" v={mb.regStatus} />
              <MiniKV theme={theme} k="Program" v={`${mb.progStatus} / stage ${mb.progStage}`} />
              <MiniKV theme={theme} k="Elapsed" v={`${mb.progElapsed}s`} />
              <MiniKV theme={theme} k="OutAnalog" v={`${fmt(mb.outAnalog,1)} V`} />
              <MiniKV theme={theme} k="LimitPower" v={`${mb.limitPower}%`} />
            </div>
          </div>
        </Card>

        <Card theme={theme} title="Alarmy" subtitle="Ostatnie zdarzenia">
          <div style={{display:"grid",gap:10}}>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <Led theme={theme} on={mb.alarmSTB} label="ALM STB" color={theme.warn} />
              <Led theme={theme} on={mb.alarmLATCH} label="LATCH" color={theme.bad} />
            </div>
            <div style={{maxHeight:220,overflow:"auto",display:"grid",gap:8}}>
              {alog.length===0 && <div style={{fontSize:12,color:theme.muted}}>Brak alarmów.</div>}
              {alog.slice().reverse().map((a,i)=> (
                <div key={i} style={{padding:"8px 10px",borderRadius:14,border:`1px solid ${theme.cardBorder}`,background:theme.chipBg}}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
                    <div style={{fontWeight:1000,fontSize:12,color:a.sev==="error"?theme.bad:theme.warn}}>{a.sev.toUpperCase()}</div>
                    <div style={{fontSize:12,color:theme.muted}}>{a.time}</div>
                  </div>
                  <div style={{marginTop:4,fontSize:12,color:theme.sub,fontWeight:800}}>{a.msg}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function P2({theme,mb,setMb,segs,setSegs,profileName,setProfileName,addLog,toast,sendCmd}){
  const profileSeries = useMemo(()=>{
    // Build a simple piecewise profile: ramp then hold for each segment.
    // X axis is minutes (float). Y axis is setpoint (°C).
    if(!segs || segs.length===0) return [];

    const pts=[];
    let tMin=0;
    let prevSp=Number.isFinite(+mb.sp1)?+mb.sp1:0;

    // start point
    pts.push({t:tMin, sp:prevSp, kind:"start"});

    for(const seg of segs){
      const target = Number.isFinite(+seg.sp) ? +seg.sp : prevSp;
      const rampCperMin = Math.max(0.0001, Number.isFinite(+seg.ramp) ? +seg.ramp : 1);
      const rampTimeMin = Math.abs(target - prevSp) / rampCperMin;

      // Add intermediate points on ramp so slope is visible
      if(rampTimeMin > 0){
        const tStart = tMin;
        const n = Math.max(2, Math.min(40, Math.ceil((rampTimeMin * 60) / 10))); // ~1 point per 10s, cap 40
        for(let i=1;i<=n;i++){
          const frac = i / n;
          const tt = tStart + rampTimeMin * frac;
          const sp = prevSp + (target - prevSp) * frac;
          pts.push({t:+tt.toFixed(3), sp:+sp.toFixed(3), kind: i===n ? "ramp_end" : "ramp"});
        }
        tMin = tStart + rampTimeMin;
      }else{
        // no ramp time (same sp)
        pts.push({t:+tMin.toFixed(3), sp:target, kind:"ramp_end"});
      }

      // hold
      const holdS = Math.max(0, Number.isFinite(+seg.hold) ? +seg.hold : 0);
      const holdMin = holdS / 60;
      if(holdMin > 0){
        const tHoldStart = tMin;
        const nHold = Math.max(1, Math.min(30, Math.ceil((holdS) / 15))); // ~1 point per 15s
        for(let i=1;i<=nHold;i++){
          const tt = tHoldStart + holdMin * (i / nHold);
          pts.push({t:+tt.toFixed(3), sp:target, kind: i===nHold ? "hold_end" : "hold"});
        }
        tMin = tHoldStart + holdMin;
      }else{
        pts.push({t:+tMin.toFixed(3), sp:target, kind:"hold_end"});
      }

      prevSp = target;
    }

    // For nicer axis ticks, map minutes to label string too
    return pts.map(p=>({
      ...p,
      tLabel: (p.t<1)?`${Math.round(p.t*60)}s`:`${p.t.toFixed(1)}m`
    }));
  },[segs,mb.sp1]);
  const setNum=(k,v)=>{
    const n=+v;
    setMb(m=>({ ...m, [k]: Number.isFinite(n)?n:m[k] }));
  };

  const exportProfile=()=>{
    const obj={profileName,segments:segs,ts:nowISO()};
    downloadJson(`profile_${profileName||"profil"}.json`,obj);
    addLog("export","Export profilu do JSON");
    toast("Eksport","Zapisano profil JSON");
  };

  const startProfile=()=>{
    setMb(m=>({ ...m, progStatus:"RUN", progStage:1, progElapsed:0 }));
    sendCmd?.("profile_command",{action:"start",profileName:profileName||"Profil_1",segments:segs});
    addLog("mode","START profilu segmentowego");
    toast("Profil","START");
  };
  const stopProfile=()=>{
    setMb(m=>({ ...m, progStatus:"STOP" }));
    sendCmd?.("profile_command",{action:"stop",profileName:profileName||"Profil_1"});
    addLog("mode","STOP profilu segmentowego");
    toast("Profil","STOP");
  };

  const toggleManual=()=>{
    const nm=!mb.manualMode;
    setMb(m=>({ ...m, manualMode:nm }));
    sendCmd?.("mode_command",{manualMode:nm});
    addLog("mode",`Tryb ${nm?"MANUAL":"AUTO"}`);
  };

  const toggleReg=()=>{
    const ns= mb.regStatus==="RUN"?"STOP":"RUN";
    setMb(m=>({ ...m, regStatus:ns }));
    sendCmd?.("mode_command",{regStatus:ns});
    addLog("mode",`Regulator: ${ns}`);
  };

  const setSP1=(v)=>{
    setNum("sp1",v);
    sendCmd?.("setpoint_command",{sp1:+v});
    addLog("setpoint",`SP1=${v}`);
  };

  const setMV=(v)=>{
    setNum("mvManual",v);
    sendCmd?.("manual_mv",{mvManual:+v});
    addLog("setpoint",`MVmanual=${v}`);
  };

  const autotune=()=>{
    const pid={pidPb:4.2,pidTi:95,pidTd:24};
    setMb(m=>({ ...m, ...pid }));
    sendCmd?.("pid_command",pid);
    addLog("mode","Autotune PID (demo)");
    toast("PID","Wysłano pid_command");
  };

  const clearLatch=()=>{
    setMb(m=>({ ...m, alarmLATCH:false }));
    sendCmd?.("alarm_clear",{latch:true});
    addLog("alarm","Kasowanie LATCH");
    toast("Alarm","Kasowanie LATCH");
  };

  const addSeg=()=>{
    setSegs(s=>[...s,{name:`E${s.length+1}`,sp:mb.sp1,ramp:3,hold:120}]);
  };
  const updSeg=(i,k,v)=>{
    setSegs(s=> s.map((x,idx)=> idx===i?{...x,[k]:k==="name"?v:+v}:x ));
  };
  const delSeg=(i)=> setSegs(s=> s.filter((_,idx)=>idx!==i));

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,alignItems:"start"}}>
      <Card theme={theme} title="Sterowanie temperaturą" subtitle="Tryby, setpoint, regulator">
        <div style={{display:"grid",gap:12}}>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <Btn theme={theme} kind={mb.manualMode?"warn":"good"} onClick={toggleManual}>{mb.manualMode?"MANUAL":"AUTO"}</Btn>
            <Btn theme={theme} kind={mb.regStatus==="RUN"?"good":"sec"} onClick={toggleReg}>{mb.regStatus==="RUN"?"Reg RUN":"Reg STOP"}</Btn>
            <Btn theme={theme} kind="sec" onClick={autotune}>Autotune PID</Btn>
            <Btn theme={theme} kind={mb.alarmLATCH?"bad":"sec"} onClick={clearLatch} disabled={!mb.alarmLATCH}>Clear LATCH</Btn>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>SP1 (°C)</div>
              <Input theme={theme} value={mb.sp1} onChange={setSP1} type="number" step="0.1" />
              <input style={{width:"100%",marginTop:8}} type="range" min="0" max="300" step="0.5" value={mb.sp1} onChange={(e)=>setSP1(e.target.value)} />
            </div>
            <div>
              <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>MV manual (%)</div>
              <Input theme={theme} value={mb.mvManual} onChange={setMV} type="number" step="1" />
              <input style={{width:"100%",marginTop:8}} type="range" min="0" max="100" step="1" value={mb.mvManual} onChange={(e)=>setMV(e.target.value)} disabled={!mb.manualMode} />
              {!mb.manualMode && <div style={{fontSize:12,color:theme.muted,marginTop:6}}>Aktywne tylko w MANUAL.</div>}
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            <MiniKV theme={theme} k="PID Pb" v={fmt(mb.pidPb,2)} />
            <MiniKV theme={theme} k="PID Ti" v={fmt(mb.pidTi,0)} />
            <MiniKV theme={theme} k="PID Td" v={fmt(mb.pidTd,0)} />
          </div>
        </div>
      </Card>

      <Card theme={theme} title="Program segmentowy" subtitle="Ramp/hold • podgląd profilu SP(t)">
        <div style={{display:"grid",gap:12}}>
          <div style={{width:"100%",height:180,borderRadius:16,overflow:"hidden",border:`1px solid ${theme.cardBorder}`,background:theme.chipBg,padding:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{fontSize:12,color:theme.muted,fontWeight:900}}>Wykres profilu: SP vs czas</div>
              <div style={{fontSize:12,color:theme.muted}}>czas: min / s • SP: °C</div>
            </div>
            <div style={{width:"100%",height:140}}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={profileSeries} margin={{top:6,right:14,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="4 4" />
                  <XAxis dataKey="t" tick={{fontSize:12}} />
                  <YAxis tick={{fontSize:12}} />
                  <Tooltip
                    formatter={(v)=>`${fmt(v,1)} °C`}
                    labelFormatter={(l)=> (Number(l)<1?`t = ${Math.round(Number(l)*60)} s`:`t = ${Number(l).toFixed(2)} min`)}
                  />
                  <Legend />
                  <Line type="linear" dataKey="sp" name="SP (profil)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Nazwa profilu</div>
              <Input theme={theme} value={profileName} onChange={setProfileName} />
            </div>
            <div style={{display:"flex",gap:10,alignItems:"flex-end",justifyContent:"flex-end"}}>
              <Btn theme={theme} kind="sec" onClick={exportProfile}>Eksport JSON</Btn>
              <Btn theme={theme} kind={mb.progStatus==="RUN"?"warn":"good"} onClick={mb.progStatus==="RUN"?stopProfile:startProfile}>
                {mb.progStatus==="RUN"?"STOP":"START"}
              </Btn>
            </div>
          </div>

          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <ABadge theme={theme} kind={mb.progStatus==="RUN"?"good":"info"} text={`Status: ${mb.progStatus}`} />
            <ABadge theme={theme} kind="info" text={`Stage: ${mb.progStage}`} />
            <ABadge theme={theme} kind="info" text={`Elapsed: ${mb.progElapsed}s`} />
          </div>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontWeight:1000}}>Segmenty</div>
            <Btn theme={theme} kind="sec" onClick={addSeg} small>+ Dodaj</Btn>
          </div>

          <div style={{display:"grid",gap:8,maxHeight:280,overflow:"auto"}}>
            {segs.map((s,i)=>(
              <div key={i} style={{padding:"10px 10px",borderRadius:16,border:`1px solid ${theme.cardBorder}`,background:theme.chipBg}}>
                <div style={{display:"grid",gridTemplateColumns:"1.2fr .8fr .8fr .8fr auto",gap:8,alignItems:"center"}}>
                  <Input theme={theme} value={s.name} onChange={(v)=>updSeg(i,"name",v)} />
                  <Input theme={theme} value={s.sp} onChange={(v)=>updSeg(i,"sp",v)} type="number" />
                  <Input theme={theme} value={s.ramp} onChange={(v)=>updSeg(i,"ramp",v)} type="number" />
                  <Input theme={theme} value={s.hold} onChange={(v)=>updSeg(i,"hold",v)} type="number" />
                  <Btn theme={theme} kind="sec" onClick={()=>delSeg(i)} small>Usuń</Btn>
                </div>
                <div style={{fontSize:12,color:theme.muted,marginTop:6,fontWeight:800}}>
                  Kolumny: nazwa • SP(°C) • rampa(°C/min) • hold(s)
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function P3({theme,sample,setSample,addLog,toast,sendCmd}){
  const set=(k,v)=> setSample(s=>({ ...s, [k]:v }));
  const save=()=>{
    addLog("data","Zapis danych próbki/procesu (demo)");
    sendCmd?.("sample_info",sample);
    toast("Próbka","Wysłano sample_info");
  };

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,alignItems:"start"}}>
      <Card theme={theme} title="Dane próbki" subtitle="Identyfikacja i materiał">
        <div style={{display:"grid",gap:10}}>
          <div>
            <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Sample ID</div>
            <Input theme={theme} value={sample.sampleId} onChange={(v)=>set("sampleId",v)} />
          </div>
          <div>
            <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Materiał</div>
            <Input theme={theme} value={sample.material} onChange={(v)=>set("material",v)} />
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Grubość (nm)</div>
              <Input theme={theme} value={sample.thicknessNm} onChange={(v)=>set("thicknessNm",v)} type="number" />
            </div>
            <div>
              <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Metoda</div>
              <Input theme={theme} value={sample.method} onChange={(v)=>set("method",v)} />
            </div>
          </div>
          <div>
            <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Notatki</div>
            <Textarea theme={theme} value={sample.notes} onChange={(v)=>set("notes",v)} rows={5} />
          </div>
          <div style={{display:"flex",justifyContent:"flex-end"}}>
            <Btn theme={theme} onClick={save}>💾 Zapisz</Btn>
          </div>
        </div>
      </Card>

      <Card theme={theme} title="Proces" subtitle="Gazy i parametry">
        <div style={{display:"grid",gap:10}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Gaz</div>
              <Input theme={theme} value={sample.gas} onChange={(v)=>set("gas",v)} />
            </div>
            <div>
              <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Przepływ (sccm)</div>
              <Input theme={theme} value={sample.flowSccm} onChange={(v)=>set("flowSccm",v)} type="number" />
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Ciśnienie (mbar)</div>
              <Input theme={theme} value={sample.pressureMbar} onChange={(v)=>set("pressureMbar",v)} type="number" />
            </div>
            <div>
              <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Czas (s)</div>
              <Input theme={theme} value={sample.durationS} onChange={(v)=>set("durationS",v)} type="number" />
            </div>
          </div>
          <div>
            <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Uwagi procesu</div>
            <Textarea theme={theme} value={sample.processNotes} onChange={(v)=>set("processNotes",v)} rows={5} />
          </div>
        </div>
      </Card>
    </div>
  );
}

function P4({theme,mb,setMb,diagram,setDiagram,customSvg,setCustomSvg,addLog,toast,connectWs,disconnectWs}){
  const [tab,setTab]=useState("ctrl");

  const setNum=(k,v)=>{
    const n=+v;
    setMb(m=>({ ...m, [k]: Number.isFinite(n)?n:m[k] }));
  };
  const setStr=(k,v)=> setMb(m=>({ ...m, [k]: v }));

  const updDiag=(k,v)=> setDiagram(d=>({ ...d, [k]:v }));

  const loadSvg=(file)=>{
    const fr=new FileReader();
    fr.onload=()=>{
      setCustomSvg(fr.result);
      addLog("config","Wczytano custom SVG diagram");
      toast("Diagram","Załadowano SVG");
    };
    fr.readAsText(file);
  };

  const doConnect=()=>{
    connectWs?.({manual:true});
    addLog("ws","Połącz WS");
    toast("WS","Łączenie...");
  };
  const doDisconnect=()=>{
    disconnectWs?.("manual");
    addLog("ws","Rozłącz WS");
    toast("WS","Rozłączono");
  };

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr",gap:14}}>
      <Card theme={theme} title="Konfiguracja" subtitle="Komunikacja kontrolera, diagram, WebSocket, DB">
        <div style={{display:"grid",gap:12}}>
          <SimpleTabs theme={theme} tab={tab} setTab={setTab} tabs={[
            {id:"ctrl",label:"Kontroler"},
            {id:"diag",label:"Diagram"},
            {id:"ws",label:"WebSocket"},
            {id:"db",label:"DB"}
          ]} />

          {tab==="ctrl" && (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <Card theme={theme} title="Modbus/Serial" subtitle="Adres, baud, format" >
                <div style={{display:"grid",gap:10}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div>
                      <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Modbus Addr</div>
                      <Input theme={theme} value={mb.modbusAddr} onChange={(v)=>setNum("modbusAddr",v)} type="number" />
                    </div>
                    <div>
                      <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Baud</div>
                      <Input theme={theme} value={mb.baudRate} onChange={(v)=>setNum("baudRate",v)} type="number" />
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Char format</div>
                    <Input theme={theme} value={mb.charFmt} onChange={(v)=>setStr("charFmt",v)} />
                  </div>
                </div>
              </Card>
              <Card theme={theme} title="Ethernet" subtitle="IP/port" >
                <div style={{display:"grid",gap:10}}>
                  <div>
                    <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>IP</div>
                    <Input theme={theme} value={mb.ethIP} onChange={(v)=>setStr("ethIP",v)} />
                  </div>
                  <div>
                    <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Port</div>
                    <Input theme={theme} value={mb.ethPort} onChange={(v)=>setNum("ethPort",v)} type="number" />
                  </div>
                </div>
              </Card>
              <Card theme={theme} title="MQTT (placeholder)" subtitle="Broker/topic" >
                <div style={{display:"grid",gap:10}}>
                  <div>
                    <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Broker</div>
                    <Input theme={theme} value={mb.mqttBroker} onChange={(v)=>setStr("mqttBroker",v)} />
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div>
                      <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Port</div>
                      <Input theme={theme} value={mb.mqttPort} onChange={(v)=>setNum("mqttPort",v)} type="number" />
                    </div>
                    <div>
                      <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Topic</div>
                      <Input theme={theme} value={mb.mqttTopic} onChange={(v)=>setStr("mqttTopic",v)} />
                    </div>
                  </div>
                </div>
              </Card>
              <Card theme={theme} title="Rejestrator (placeholder)" subtitle="Interwał / pamięć" >
                <div style={{display:"grid",gap:10}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div>
                      <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Interval (s)</div>
                      <Input theme={theme} value={mb.recInterval} onChange={(v)=>setNum("recInterval",v)} type="number" />
                    </div>
                    <div>
                      <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Mem used (%)</div>
                      <Input theme={theme} value={mb.memUsed} onChange={(v)=>setNum("memUsed",v)} type="number" />
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {tab==="diag" && (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <Card theme={theme} title="Etykiety diagramu" subtitle="Teksty na schemacie" >
                <div style={{display:"grid",gap:10}}>
                  {Object.keys(diagram).map(k=>(
                    <div key={k} style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:10,alignItems:"center"}}>
                      <div style={{fontSize:12,color:theme.muted,fontWeight:1000}}>{k}</div>
                      <Input theme={theme} value={diagram[k]} onChange={(v)=>updDiag(k,v)} />
                    </div>
                  ))}
                </div>
              </Card>
              <Card theme={theme} title="Własny SVG" subtitle="Upload i podgląd" >
                <div style={{display:"grid",gap:10}}>
                  <input type="file" accept="image/svg+xml" onChange={(e)=>e.target.files?.[0] && loadSvg(e.target.files[0])} />
                  <div style={{fontSize:12,color:theme.muted}}>Wczytany SVG jest renderowany przez dangerouslySetInnerHTML (w produkcji dodaj sanitizację).</div>
                  {customSvg && <div style={{borderRadius:16,overflow:"hidden",border:`1px solid ${theme.cardBorder}`}} dangerouslySetInnerHTML={{__html:customSvg}} />}
                  <div style={{display:"flex",justifyContent:"flex-end"}}>
                    <Btn theme={theme} kind="sec" onClick={()=>setCustomSvg("")}>Wyczyść SVG</Btn>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {tab==="ws" && (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <Card theme={theme} title="WebSocket" subtitle="Połączenie z backendem LabVIEW" >
                <div style={{display:"grid",gap:10}}>
                  <div>
                    <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>WS URL</div>
                    <Input theme={theme} value={mb.wsUrl} onChange={(v)=>setStr("wsUrl",v)} />
                  </div>
                  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                    <Btn theme={theme} kind={mb.wsConnected?"sec":"good"} onClick={doConnect} disabled={mb.wsConnected}>🔌 Połącz</Btn>
                    <Btn theme={theme} kind={mb.wsConnected?"warn":"sec"} onClick={doDisconnect} disabled={!mb.wsConnected}>⏏ Rozłącz</Btn>
                    <Led theme={theme} on={mb.wsConnected} label={mb.wsConnected?"CONNECTED":"DISCONNECTED"} color={mb.wsConnected?theme.good:theme.warn} />
                  </div>
                  <div style={{fontSize:12,color:theme.muted,lineHeight:1.35}}>
                    Po połączeniu UI wysyła <b>hello</b>. Dane LV→WEB powinny przychodzić jako <b>measurement_update</b>/<b>status_update</b>/<b>alarm_event</b>/<b>state_snapshot</b>.
                  </div>
                </div>
              </Card>
              <Card theme={theme} title="DB (placeholder)" subtitle="Docelowo: zapis próbek/raportów" >
                <div style={{display:"grid",gap:10}}>
                  <div style={{fontSize:12,color:theme.muted}}>To jest placeholder UI. Zapisz konfigurację po stronie backendu.</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <Input theme={theme} value={"postgres"} onChange={()=>{}} />
                    <Input theme={theme} value={"localhost:5432"} onChange={()=>{}} />
                  </div>
                  <div style={{display:"flex",justifyContent:"flex-end"}}>
                    <Btn theme={theme} kind="sec" onClick={()=>toast("DB","Placeholder")}>Zapisz</Btn>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {tab==="db" && (
            <div style={{display:"grid",gridTemplateColumns:"1fr",gap:14}}>
              <Card theme={theme} title="DB" subtitle="Placeholder" >
                <div style={{fontSize:12,color:theme.muted}}>Ta zakładka jest placeholderem.</div>
              </Card>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function P5({theme,hist}){
  const [tab,setTab]=useState("lv2web");

  const exportHist=()=>{
    const rows=[
      ["t","pv1","pv2","sp1","ch3","mv","outA"],
      ...hist.map(x=>[x.t,x.pv1,x.pv2,x.sp1,x.ch3,x.mv,x.outA])
    ];
    downloadCsv("history.csv",rows);
  };

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr",gap:14}}>
      <Card theme={theme} title="Protokół JSON" subtitle="Kontrakt LV ↔ WEB + eksport CSV" actions={<Btn theme={theme} kind="sec" onClick={exportHist}>Eksport CSV (hist)</Btn>}>
        <div style={{display:"grid",gap:12}}>
          <SimpleTabs theme={theme} tab={tab} setTab={setTab} tabs={[
            {id:"lv2web",label:"LV → WEB"},
            {id:"web2lv",label:"WEB → LV"}
          ]} />
          {tab==="lv2web" && (
            <div style={{display:"grid",gap:10}}>
              {JSON_LV2WEB.map((x)=>(
                <div key={x.k} style={{padding:"10px 10px",borderRadius:16,border:`1px solid ${theme.cardBorder}`,background:theme.chipBg}}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
                    <div style={{fontWeight:1000}}>{x.k}</div>
                    <ABadge theme={theme} kind="info" text="RX" />
                  </div>
                  <div style={{fontSize:12,color:theme.muted,marginTop:4}}>{x.d}</div>
                  <pre style={{marginTop:8,whiteSpace:"pre-wrap",fontSize:12,color:theme.sub}}>{JSON.stringify(x.ex,null,2)}</pre>
                </div>
              ))}
            </div>
          )}
          {tab==="web2lv" && (
            <div style={{display:"grid",gap:10}}>
              {JSON_WEB2LV.map((x)=>(
                <div key={x.k} style={{padding:"10px 10px",borderRadius:16,border:`1px solid ${theme.cardBorder}`,background:theme.chipBg}}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
                    <div style={{fontWeight:1000}}>{x.k}</div>
                    <ABadge theme={theme} kind="good" text="TX" />
                  </div>
                  <div style={{fontSize:12,color:theme.muted,marginTop:4}}>{x.d}</div>
                  <pre style={{marginTop:8,whiteSpace:"pre-wrap",fontSize:12,color:theme.sub}}>{JSON.stringify(x.ex,null,2)}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function P6({theme,logs,clearLogs}){
  const [cat,setCat]=useState("all");
  const cats=useMemo(()=>{
    const s=new Set(logs.map(x=>x.cat));
    return ["all",...Array.from(s)];
  },[logs]);

  const list=useMemo(()=>{
    if(cat==="all") return logs;
    return logs.filter(x=>x.cat===cat);
  },[logs,cat]);

  const exportLogs=()=>{
    const rows=[
      ["time","user","cat","msg"],
      ...logs.map(l=>[l.time,l.user,l.cat,l.msg])
    ];
    downloadCsv("logs.csv",rows);
  };

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr",gap:14}}>
      <Card theme={theme} title="Logi akcji" subtitle="Kto co zmienił" actions={
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Btn theme={theme} kind="sec" onClick={exportLogs}>Eksport CSV</Btn>
          <Btn theme={theme} kind="sec" onClick={clearLogs}>Wyczyść</Btn>
        </div>
      }>
        <div style={{display:"grid",gap:12}}>
          <div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:10,alignItems:"center"}}>
            <div style={{fontSize:12,color:theme.muted,fontWeight:900}}>Filtr kategorii</div>
            <Select theme={theme} value={cat} onChange={setCat} options={cats.map(c=>({value:c,label:c}))} />
          </div>
          <div style={{maxHeight:520,overflow:"auto",display:"grid",gap:8}}>
            {list.length===0 && <div style={{fontSize:12,color:theme.muted}}>Brak logów.</div>}
            {list.slice().reverse().map((l,i)=>(
              <div key={i} style={{padding:"10px 10px",borderRadius:16,border:`1px solid ${theme.cardBorder}`,background:theme.chipBg}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
                  <div style={{fontWeight:1000,fontSize:12}}>{l.user} • {l.cat}</div>
                  <div style={{fontSize:12,color:theme.muted}}>{l.time}</div>
                </div>
                <div style={{marginTop:6,fontSize:12,color:theme.sub,fontWeight:800}}>{l.msg}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function P7({theme,reports,setReports,toast,addLog,sendCmd}){
  const blank={title:"",date:new Date().toISOString().slice(0,10),profile:"",sampleId:"",result:"",notes:"",photos:[]};
  const [draft,setDraft]=useState(blank);
  const [editIdx,setEditIdx]=useState(null);

  const set=(k,v)=> setDraft(d=>({ ...d, [k]:v }));

  const addPhoto=(file)=>{
    const fr=new FileReader();
    fr.onload=()=>{
      setDraft(d=>({ ...d, photos:[...d.photos,{name:file.name,dataUrl:fr.result}] }));
    };
    fr.readAsDataURL(file);
  };

  const save=()=>{
    if(editIdx===null){
      const rep={...draft};
      setReports(r=>[...r,rep]);
      sendCmd?.("report_create",rep);
      addLog("data","Utworzono raport");
      toast("Raport","Utworzono (report_create)");
    }else{
      const rep={...draft};
      setReports(r=>r.map((x,i)=> i===editIdx?rep:x ));
      sendCmd?.("report_update",rep);
      addLog("data","Zaktualizowano raport");
      toast("Raport","Zapisano (report_update)");
      setEditIdx(null);
    }
    setDraft(blank);
  };

  const edit=(idx)=>{
    setEditIdx(idx);
    setDraft(reports[idx]);
  };

  const del=(idx)=>{
    setReports(r=>r.filter((_,i)=>i!==idx));
    addLog("data","Usunięto raport");
    toast("Raport","Usunięto (lokalnie)");
  };

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,alignItems:"start"}}>
      <Card theme={theme} title="Raport" subtitle="Formularz + zdjęcia">
        <div style={{display:"grid",gap:10}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Tytuł</div>
              <Input theme={theme} value={draft.title} onChange={(v)=>set("title",v)} />
            </div>
            <div>
              <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Data</div>
              <Input theme={theme} value={draft.date} onChange={(v)=>set("date",v)} type="date" />
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Profil</div>
              <Input theme={theme} value={draft.profile} onChange={(v)=>set("profile",v)} />
            </div>
            <div>
              <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Sample ID</div>
              <Input theme={theme} value={draft.sampleId} onChange={(v)=>set("sampleId",v)} />
            </div>
          </div>
          <div>
            <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Wynik</div>
            <Input theme={theme} value={draft.result} onChange={(v)=>set("result",v)} />
          </div>
          <div>
            <div style={{fontSize:12,color:theme.muted,fontWeight:900,marginBottom:6}}>Notatki</div>
            <Textarea theme={theme} value={draft.notes} onChange={(v)=>set("notes",v)} rows={5} />
          </div>
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontWeight:1000}}>Zdjęcia</div>
              <input type="file" accept="image/*" onChange={(e)=>e.target.files?.[0] && addPhoto(e.target.files[0])} />
            </div>
            <div style={{marginTop:10,display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
              {draft.photos.map((p,i)=>(
                <div key={i} style={{borderRadius:16,overflow:"hidden",border:`1px solid ${theme.cardBorder}`}}>
                  <img src={p.dataUrl} alt={p.name} style={{width:"100%",height:140,objectFit:"cover"}} />
                  <div style={{padding:"6px 8px",fontSize:12,color:theme.muted,fontWeight:800}}>{p.name}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
            {editIdx!==null && <Btn theme={theme} kind="sec" onClick={()=>{setEditIdx(null);setDraft(blank);}}>Anuluj</Btn>}
            <Btn theme={theme} onClick={save}>{editIdx===null?"➕ Dodaj":"💾 Zapisz"}</Btn>
          </div>
        </div>
      </Card>

      <Card theme={theme} title="Lista raportów" subtitle="Kliknij aby edytować">
        <div style={{display:"grid",gap:8,maxHeight:620,overflow:"auto"}}>
          {reports.length===0 && <div style={{fontSize:12,color:theme.muted}}>Brak raportów.</div>}
          {reports.slice().reverse().map((r,idxRev)=>{
            const idx=reports.length-1-idxRev;
            return (
              <div key={idx} style={{padding:"10px 10px",borderRadius:16,border:`1px solid ${theme.cardBorder}`,background:theme.chipBg}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
                  <div style={{fontWeight:1000}}>{r.title||"(bez tytułu)"}</div>
                  <div style={{fontSize:12,color:theme.muted}}>{r.date}</div>
                </div>
                <div style={{marginTop:6,fontSize:12,color:theme.sub,fontWeight:800}}>
                  sample: {r.sampleId||"—"} • profil: {r.profile||"—"} • wynik: {r.result||"—"} • zdjęcia: {r.photos?.length||0}
                </div>
                <div style={{marginTop:10,display:"flex",gap:10,justifyContent:"flex-end"}}>
                  <Btn theme={theme} kind="sec" onClick={()=>edit(idx)} small>Edytuj</Btn>
                  <Btn theme={theme} kind="sec" onClick={()=>del(idx)} small>Usuń</Btn>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

export default function App(){
  const [dark,setDark]=useState(true);
  const theme=dark?TH.dark:TH.light;

  const [user,setUser]=useState(null);

  const [mb,setMb]=useState(()=>initMb());
  const [hist,setHist]=useState([]);
  const [alog,setAlog]=useState([]);
  const [logs,setLogs]=useState([]);
  const [toasts,setToasts]=useState([]);

  const [wsConsole,setWsConsole]=useState({rx:[],tx:[]});
  const [showWsConsole,setShowWsConsole]=useState(false);

  const [ac,setAc]=useState(1);

  const [segs,setSegs]=useState([
    {name:"E1",sp:80,ramp:2,hold:60},
    {name:"E2",sp:120,ramp:3,hold:120},
    {name:"E3",sp:60,ramp:4,hold:90}
  ]);
  const [profileName,setProfileName]=useState("Profil_1");

  const [sample,setSample]=useState({
    sampleId:"ZnO-001",material:"ZnO",thicknessNm:120,method:"",notes:"",
    gas:"NO2",flowSccm:100,pressureMbar:10,durationS:600,processNotes:""
  });

  const [diagram,setDiagram]=useState({
    gas:"Gazy",flow:"MFC / Przepływ",oven:"Piec / komora",measure:"Pomiary",bridge:"Mostek",pump:"Pompa" 
  });

  const [customSvg,setCustomSvg]=useState("");

  const [reports,setReports]=useState([]);

  const toast=useCallback((title,msg)=>{
    const id=Math.random().toString(36).slice(2);
    const t={id,title,msg,time:new Date().toLocaleTimeString()};
    setToasts(s=>[t,...s].slice(0,6));
    setTimeout(()=> setToasts(s=>s.filter(x=>x.id!==id)), 3500);
  },[]);

  const addLog=useCallback((cat,msg)=>{
    setLogs(s=>[
      ...s,
      {time:new Date().toLocaleTimeString(),msg,cat,user:user?.username||"?"}
    ].slice(-500));
  },[user]);

  const clearLogs=useCallback(()=>{
    setLogs([]);
    toast("Logi","Wyczyszczono");
  },[toast]);

  // ===== WebSocket implementation =====
  const wsRef=useRef(null);
  const wsUrlRef=useRef(mb.wsUrl);
  const wsLastMsgRef=useRef(Date.now());
  const wsReconnectRef=useRef({tries:0,timer:null});

  useEffect(()=>{ wsUrlRef.current = mb.wsUrl; },[mb.wsUrl]);

  const applyLvMessage=useCallback((msg)=>{
    const type = msg?.type || msg?.kind;
    const data = msg?.data ?? msg?.payload ?? msg;

    if(!type) return;

    wsLastMsgRef.current = Date.now();

    if(type==="measurement_update"){
      setMb(m=>({ ...m, ...data }));
      // history point
      const t=new Date();
      const label=`${String(t.getMinutes()).padStart(2,"0")}:${String(t.getSeconds()).padStart(2,"0")}`;
      setHist(h=>{
        const pv1=+((data.pv1??m.pv1)??0);
        const pv2=+((data.pv2??m.pv2)??0);
        const sp1=+((data.sp1??m.sp1)??0);
        const ch3=+((data.ch3??m.ch3)??0);
        const mv=+((data.mv??m.mv)??0);
        const outA=+((data.outAnalog??m.outAnalog)??0);
        const next=[...h,{t:label,pv1,pv2,sp1,ch3,mv,outA}].slice(-150);
        return next;
      });
      return;
    }

    if(type==="status_update"){
      setMb(m=>({ ...m, ...data }));
      return;
    }

    if(type==="alarm_event"){
      const sev = data?.sev || data?.severity || "warning";
      const msgText = data?.msg || data?.message || "alarm";
      const latch = !!data?.latch;
      setMb(m=>({ ...m, alarmSTB:true, alarmLATCH: latch ? true : m.alarmLATCH }));
      setAlog(a=>[...a,{time:new Date().toLocaleTimeString(),sev,msg:msgText}].slice(-100));
      return;
    }

    if(type==="state_snapshot" || type==="mb_snapshot"){
      setMb(m=>({ ...m, ...data }));
      return;
    }

  },[]);

  const disconnectWs=useCallback((reason="")=>{
    try{
      if(wsReconnectRef.current.timer){
        clearTimeout(wsReconnectRef.current.timer);
        wsReconnectRef.current.timer=null;
      }
      wsReconnectRef.current.tries=0;
      if(wsRef.current){
        wsRef.current.onopen=null;
        wsRef.current.onmessage=null;
        wsRef.current.onerror=null;
        wsRef.current.onclose=null;
        wsRef.current.close();
        wsRef.current=null;
      }
    }catch{}
    setMb(m=>({ ...m, wsConnected:false }));
    if(reason) addLog("ws",`WS disconnect: ${reason}`);
  },[addLog]);

  const connectWs=useCallback(({manual=false}={})=>{
    const url=wsUrlRef.current;
    if(!url) return;
    if(wsRef.current && (wsRef.current.readyState===0 || wsRef.current.readyState===1)) return;

    try{
      const ws=new WebSocket(url);
      wsRef.current=ws;

      ws.onopen=()=>{
        wsReconnectRef.current.tries=0;
        wsLastMsgRef.current=Date.now();
        setMb(m=>({ ...m, wsConnected:true }));
        addLog("ws",`WS connected: ${url}`);
        try{
          const hello={type:"hello",ts:nowISO(),user:user||null,app:APP_NAME,ver:APP_VER};
          ws.send(JSON.stringify(hello));
        }catch{}
      };

      ws.onmessage=(ev)=>{
        wsLastMsgRef.current=Date.now();
        let msg=null;
        try{ msg=JSON.parse(ev.data); }catch{ msg=ev.data; }
        if(typeof msg==="string"){
          // ignore non-JSON
          return;
        }

        // WS Console (RX)
        const rxType = msg?.type || msg?.kind || "(no type)";
        const rxText = JSON.stringify(msg,null,2);
        setWsConsole(s=>({
          ...s,
          rx:[{time:new Date().toLocaleTimeString(),type:rxType,jsonText:rxText},...s.rx].slice(0,80)
        }));

        applyLvMessage(msg);
      };

      ws.onerror=()=>{
        addLog("ws","WS error");
      };

      ws.onclose=()=>{
        setMb(m=>({ ...m, wsConnected:false }));
        const tries=wsReconnectRef.current.tries;
        const delay=clamp(1000*Math.pow(1.7,tries),1000,15000);
        wsReconnectRef.current.tries=tries+1;
        addLog("ws",`WS closed. Reconnect in ${Math.round(delay/1000)}s`);
        if(wsReconnectRef.current.timer) clearTimeout(wsReconnectRef.current.timer);
        wsReconnectRef.current.timer=setTimeout(()=>connectWs({manual:false}),delay);
      };

      if(manual) toast("WS","Łączenie...");
    }catch(e){
      addLog("ws",`WS connect error: ${String(e)}`);
      setMb(m=>({ ...m, wsConnected:false }));
    }
  },[applyLvMessage,addLog,toast,user]);

  const sendCmd=useCallback((type,data={},opts={})=>{
    const ws=wsRef.current;
    const payload={type,ts:nowISO(),user:user||null,data};
    const jsonText=JSON.stringify(payload,null,2);

    // WS Console (TX)
    setWsConsole(s=>({
      ...s,
      tx:[{time:new Date().toLocaleTimeString(),type,jsonText},...s.tx].slice(0,80)
    }));

    addLog("ws",`TX: ${type}`);
    if(ws && ws.readyState===1){
      try{ ws.send(JSON.stringify(payload)); }
      catch(e){ addLog("ws",`TX failed: ${String(e)}`); }
    }else{
      if(opts.silent!==true) toast("WS","Brak połączenia. (TX pominięte)");
    }
  },[addLog,toast,user]);

  // watchdog + optional demo simulation fallback
  useEffect(()=>{
    if(!user) return;

    const watchdog=setInterval(()=>{
      if(mb.wsConnected){
        const dt=Date.now()-wsLastMsgRef.current;
        if(dt>12000){
          addLog("ws","WS timeout >12s. Reconnect.");
          disconnectWs("timeout");
          connectWs({manual:false});
        }
      }
    },1500);

    return ()=>clearInterval(watchdog);
  },[user,mb.wsConnected,addLog,disconnectWs,connectWs]);

  // DEMO simulation only when NOT connected
  useEffect(()=>{
    if(!user) return;
    let t0=Date.now();
    let lastAlarm=false;

    const tick=setInterval(()=>{
      setMb(m=>{
        if(m.wsConnected) return ({...m, rtc:new Date().toLocaleString()});

        // simple plant + PID-ish demo
        const dt=1;
        const pv=m.pv1;
        const sp=m.sp1;
        const err=sp-pv;
        let mv=m.mv;

        if(m.regStatus==="RUN" && !m.manualMode){
          const kp=1/Math.max(0.5,m.pidPb);
          const ki=kp/Math.max(1,m.pidTi);
          const kd=kp*Math.max(0,m.pidTd);

          const I = clamp(m.pidI + ki*err*dt, -50, 50);
          const D = (err - m.pidPrevE);
          mv = clamp( mv + kp*err + I + kd*D, 0, m.limitPower );

          m = {...m, pidI:I, pidPrevE:err};
        }

        const mvUse = m.manualMode?m.mvManual:mv;

        // thermal response
        const ambient=24.5;
        const tau=18.0;
        const gain=2.4;
        const pvNext = pv + (-(pv-ambient)/tau + gain*(mvUse/100))*dt + (Math.random()-0.5)*0.12;

        const outAnalog = clamp((mvUse/100)*20,0,20);

        // program segments
        let progStage=m.progStage;
        let progElapsed=m.progElapsed;
        let progStatus=m.progStatus;
        let sp1=m.sp1;
        if(progStatus==="RUN" && segs.length>0){
          const idx=clamp(progStage-1,0,segs.length-1);
          const seg=segs[idx];
          progElapsed+=1;
          const startSp = (idx===0)?sp1:segs[idx-1].sp;
          const target=seg.sp;
          const rampPerS = (seg.ramp||1)/60;
          const rampTime = Math.abs(target-startSp)/Math.max(0.0001,rampPerS);
          if(progElapsed <= rampTime){
            const frac=progElapsed/rampTime;
            sp1 = startSp + (target-startSp)*frac;
          }else if(progElapsed <= rampTime + (seg.hold||0)){
            sp1 = target;
          }else{
            progStage +=1;
            progElapsed=0;
            if(progStage>segs.length){
              progStatus="STOP";
              progStage=0;
            }
          }
        }

        const alarmHi = pvNext >= (sp1 + 50);
        const alarmSTB = alarmHi;
        const alarmLATCH = m.alarmLATCH || (alarmHi && m.alarmSTB);

        if(alarmHi && !lastAlarm){
          setAlog(a=>[...a,{time:new Date().toLocaleTimeString(),sev:"warning",msg:`HI: PV=${fmt(pvNext,1)}°C` }].slice(-100));
        }
        lastAlarm = alarmHi;

        return {
          ...m,
          rtc:new Date().toLocaleString(),
          pv1:pvNext,
          pv2:pvNext-(Math.random()*0.8),
          ch3:12 + Math.sin((Date.now()-t0)/3000)*2,
          mv:mv,
          outAnalog,
          sp1,
          progStage,
          progElapsed,
          progStatus,
          alarmSTB,
          alarmLATCH
        };
      });

      setHist(h=>{
        const t=new Date();
        const label=`${String(t.getMinutes()).padStart(2,"0")}:${String(t.getSeconds()).padStart(2,"0")}`;
        const lastMb=mb;
        const next=[...h,{t:label,pv1:+lastMb.pv1,pv2:+lastMb.pv2,sp1:+lastMb.sp1,ch3:+lastMb.ch3,mv:+(lastMb.manualMode?lastMb.mvManual:lastMb.mv),outA:+lastMb.outAnalog}].slice(-150);
        return next;
      });

    },1000);

    return ()=>clearInterval(tick);
  },[user,mb,mb.wsConnected,segs]);

  const pagesAll=useMemo(()=>[
    {id:1,name:"Eksperyment",icon:"🧪",desc:"Monitoring i wykresy"},
    {id:2,name:"Ustawienia temp.",icon:"🌡️",desc:"Tryby, setpoint, profil"},
    {id:3,name:"Próbka i proces",icon:"🧾",desc:"Dane próbki"},
    {id:7,name:"Raporty",icon:"📄",desc:"Raporty + zdjęcia"},
    {id:4,name:"Konfiguracja",icon:"⚙️",desc:"Kontroler, WS, diagram"},
    {id:5,name:"Protokół JSON",icon:"🧩",desc:"Kontrakt LV↔WEB"},
    {id:6,name:"Logi",icon:"🧠",desc:"Historia akcji"}
  ],[]);

  const pages=useMemo(()=>{
    if(!user) return [];
    const allow=new Set(ROLE_ACCESS[user.role]||[1]);
    return pagesAll.filter(p=>allow.has(p.id));
  },[user,pagesAll]);

  useEffect(()=>{
    if(!user) return;
    if(!pages.some(p=>p.id===ac)) setAc(pages[0]?.id||1);
  },[user,pages,ac]);

  const onLogout=()=>{
    disconnectWs("logout");
    setUser(null);
    setAc(1);
    toast("Auth","Wylogowano");
  };

  useEffect(()=>{
    if(user){
      // optionally autoconnect? Keep manual.
      addLog("auth","Zalogowano");
    }
  },[user,addLog]);

  if(!user){
    return <LoginScreen theme={theme} onLogin={(u)=>{ setUser(u); setMb(m=>({ ...m, wsConnected:false })); }} />;
  }

  return (
    <div style={{minHeight:"100vh",background:theme.bg,color:theme.txt}}>
      <TopBar theme={theme} user={user} onLogout={onLogout} dark={dark} setDark={setDark} mb={mb} onOpenWsConsole={()=>setShowWsConsole(true)} />
      <div style={{display:"grid",gridTemplateColumns:"260px 1fr"}}>
        <Sidebar theme={theme} pages={pages} ac={ac} setAc={setAc} />
        <div style={{padding:14}}>
          {ac===1 && <P1 theme={theme} mb={mb} hist={hist} alog={alog} diagram={diagram} customSvg={customSvg} />}
          {ac===2 && <P2 theme={theme} mb={mb} setMb={setMb} segs={segs} setSegs={setSegs} profileName={profileName} setProfileName={setProfileName} addLog={addLog} toast={toast} sendCmd={sendCmd} />}
          {ac===3 && <P3 theme={theme} sample={sample} setSample={setSample} addLog={addLog} toast={toast} sendCmd={sendCmd} />}
          {ac===4 && <P4 theme={theme} mb={mb} setMb={setMb} diagram={diagram} setDiagram={setDiagram} customSvg={customSvg} setCustomSvg={setCustomSvg} addLog={addLog} toast={toast} connectWs={connectWs} disconnectWs={disconnectWs} />}
          {ac===5 && <P5 theme={theme} hist={hist} />}
          {ac===6 && <P6 theme={theme} logs={logs} clearLogs={clearLogs} />}
          {ac===7 && <P7 theme={theme} reports={reports} setReports={setReports} toast={toast} addLog={addLog} sendCmd={sendCmd} />}
        </div>
      </div>
      <WsConsole
        open={showWsConsole}
        onClose={()=>setShowWsConsole(false)}
        theme={theme}
        wsConsole={wsConsole}
        clearConsole={()=>setWsConsole({rx:[],tx:[]})}
      />
      <Toasts toasts={toasts} theme={theme} />
    </div>
  );
}
