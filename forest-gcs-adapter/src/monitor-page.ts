export const monitorPage = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="icon" href="data:,">
  <title>산림재난 드론 연계 인스턴스</title>
  <style>
    :root{color-scheme:dark;--bg:#07130f;--panel:#10251d;--line:#28503f;--muted:#96afa4;--text:#f4fbf7;--green:#39d98a;--cyan:#55ddea;--red:#ff7b7b}
    *{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 50% -20%,#1a4936 0,var(--bg) 45%);color:var(--text);font-family:system-ui,"Noto Sans KR",sans-serif;min-height:100vh}
    main{width:min(1260px,100%);margin:auto;padding:24px}header{display:flex;justify-content:space-between;gap:18px;align-items:center;margin-bottom:18px}
    h1{margin:0;font-size:clamp(24px,3vw,38px);letter-spacing:-.04em}p{color:var(--muted);margin:7px 0 0}.badge{padding:10px 15px;border:1px solid var(--line);border-radius:999px;background:#122b21;font-weight:800}
    .ok{color:var(--green)}.bad{color:var(--red)}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.card{background:linear-gradient(145deg,#143126,#0b1d16);border:1px solid var(--line);border-radius:18px;padding:20px;min-height:150px}
    .wide{grid-column:span 2}.label{font-size:13px;color:var(--muted);margin-bottom:8px}.value{font-size:28px;font-weight:850;word-break:break-all}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:14px}.metric .value{font-size:24px}
    a{color:var(--cyan);text-decoration:none;font-weight:750}.links{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}.links a{border:1px solid var(--line);border-radius:10px;padding:9px 12px;background:#0d221a}
    footer{color:var(--muted);font-size:13px;margin-top:16px}@media(max-width:800px){header{align-items:flex-start;flex-direction:column}.grid{grid-template-columns:1fr}.wide{grid-column:auto}.metrics{grid-template-columns:repeat(2,1fr)}}
  </style>
</head>
<body><main>
  <header><div><h1>드론 연계 인스턴스</h1><p>MAVLink → GCS 어댑터 → 산림재난 서버 → 통합상황판</p></div><div id="overall" class="badge">연결 확인 중</div></header>
  <section class="grid">
    <article class="card wide"><div class="label">기체</div><div id="asset" class="value">텔레메트리 대기 중</div><div class="metrics">
      <div class="metric"><div class="label">위도</div><div id="lat" class="value">-</div></div>
      <div class="metric"><div class="label">경도</div><div id="lon" class="value">-</div></div>
      <div class="metric"><div class="label">고도</div><div id="alt" class="value">-</div></div>
      <div class="metric"><div class="label">배터리</div><div id="battery" class="value">-</div></div>
    </div></article>
    <article class="card"><div class="label">백엔드 연계</div><div id="backend" class="value">확인 중</div><div id="event" class="label"></div></article>
    <article class="card wide"><div class="label">연결 대상</div><div class="links"><a id="web" target="_blank">통합상황판</a><a id="api" target="_blank">백엔드 상태</a><a id="sim" target="_blank">모사 시스템</a></div></article>
    <article class="card"><div class="label">마지막 서버 반영</div><div id="sent" class="value">-</div></article>
  </section>
  <footer id="updated">상태 갱신 대기 중</footer>
</main>
<script>
  const el=(id)=>document.getElementById(id);
  const n=(v,d=5)=>Number.isFinite(v)?Number(v).toFixed(d):"-";
  async function refresh(){
    try{
      const [healthResponse,telemetryResponse]=await Promise.all([fetch("/bridge/status",{cache:"no-store"}),fetch("/telemetry",{cache:"no-store"})]);
      const bridge=(await healthResponse.json()).data;
      const item=(await telemetryResponse.json()).data?.[0];
      el("overall").textContent=bridge.connected?"서버 연계 정상":"서버 연계 점검";
      el("overall").className="badge "+(bridge.connected?"ok":"bad");
      el("backend").textContent=bridge.connected?"정상 연결":"연결 실패";
      el("event").textContent=bridge.lastError||("이벤트 "+(bridge.eventId||"-"));
      el("sent").textContent=bridge.lastSuccessAt?new Date(bridge.lastSuccessAt).toLocaleTimeString("ko-KR"):"전송 대기";
      el("web").href=bridge.webUrl;el("api").href=bridge.apiUrl+"/health";el("sim").href=bridge.simulatorUrl;
      if(item){const a=item.attributes||{},c=item.geometry?.coordinates||[];el("asset").textContent=item.assetId+" · "+(item.source||a.source||"-");el("lat").textContent=n(c[1]??a.lat);el("lon").textContent=n(c[0]??a.lon);el("alt").textContent=n(c[2]??a.altitudeM,1)+" m";el("battery").textContent=Number.isFinite(a.batteryPercent)?a.batteryPercent+"%":"-"}
      el("updated").textContent="마지막 화면 갱신: "+new Date().toLocaleTimeString("ko-KR");
    }catch(error){el("overall").textContent="인스턴스 오류";el("overall").className="badge bad"}
  }
  refresh();setInterval(refresh,1500);
</script></body></html>`;
