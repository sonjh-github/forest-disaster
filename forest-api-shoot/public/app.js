const $ = (selector) => document.querySelector(selector);
const state = {
  key: "", tests: [], health: null, gradualMode: false, continuous: false, continuousTimer: null, continuousCycle: 0,
  filters: { domain: "all", category: "all" }, results: new Map(), selected: new Set(),
};
const domainLabels = { common: "공통", wildfire: "산불", landslide: "산사태" };
const directionLabels = { INBOUND: "결과 수신", OUTBOUND: "외부 호출", BIDIRECTIONAL: "양방향" };

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", "x-simulator-key": state.key, ...options.headers },
    signal: AbortSignal.timeout(5_500),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || "요청을 처리하지 못했습니다.");
  return payload;
}

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  setTimeout(() => element.classList.remove("show"), 2400);
}

function filteredTests() {
  return state.tests.filter((test) =>
    (state.filters.domain === "all" || test.domain === state.filters.domain)
    && (state.filters.category === "all" || test.category === state.filters.category));
}

function renderOverview() {
  $("#totalCount").textContent = state.tests.length;
  $("#communicationCount").textContent = state.tests.filter((test) => test.category === "communication").length;
  $("#aiCount").textContent = state.tests.filter((test) => test.category === "ai").length;
}

function resultText(result) {
  if (!result) return "테스트 대기 중";
  if (result.status === "running") return "요청 처리 중 · 최대 5초";
  if (result.status === "pass") return `정상 처리: 예 · HTTP ${result.httpStatus ?? 200} · ${result.durationMs ?? 0}ms`;
  return `정상 처리: 아니오 · ${result.message}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

function renderSelection() {
  $("#selectedCount").textContent = `${state.selected.size}개 선택`;
  $("#runSelectedBtn").disabled = state.selected.size === 0 || state.continuous;
  $("#continuousBtn").disabled = state.selected.size === 0;
  $("#continuousBtn").textContent = state.continuous ? "지속 테스트 중지" : "지속 테스트 시작";
  $("#continuousBtn").classList.toggle("active", state.continuous);
  document.querySelectorAll("[data-condition]").forEach((button) => { button.disabled = state.selected.size === 0 || state.continuous; });
}

function testCard(test) {
  const result = state.results.get(test.id);
  const resultClass = result?.status === "pass" ? "pass" : result?.status === "fail" ? "fail" : result?.status === "running" ? "running" : "";
  const selected = state.selected.has(test.id);
  const payload = result?.request ? `<details class="payload-panel"><summary>보낸 JSON 데이터 보기</summary><pre>${escapeHtml(JSON.stringify(result.request, null, 2))}</pre></details>` : "";
  return `<article class="test-card ${resultClass} ${selected ? "selected" : ""}" data-test-id="${test.id}">
    <div class="card-head">
      <div class="test-title"><label class="card-select" title="선택 실행에 포함"><input type="checkbox" data-select-id="${test.id}" ${selected ? "checked" : ""}><span>✓</span></label><span class="type-icon">${test.category === "ai" ? "AI" : "통신"}</span><div><h3>${test.name}</h3><span class="capability-id" title="${test.id}">${test.id}</span></div></div>
      <span class="domain-tag">${domainLabels[test.domain] ?? test.domain}</span>
    </div>
    <div class="direction"><span>연동 방향</span><strong>${directionLabels[test.direction] ?? test.direction}</strong></div>
    <div class="test-result">${resultText(result)}</div>
    ${payload}
    ${test.modes.includes("invoke") ? `<div class="test-actions"><button data-action="test" data-mode="invoke" data-id="${test.id}">외부 호출 점검</button></div>` : ""}
  </article>`;
}

function renderTests() {
  const tests = filteredTests();
  $("#testGrid").className = "domain-sections";
  $("#testGrid").innerHTML = ["common", "wildfire", "landslide"].map((domain) => {
    const domainTests = tests.filter((test) => test.domain === domain);
    if (!domainTests.length) return "";
    const allDomainTests = state.tests.filter((test) => test.domain === domain);
    const allSelected = allDomainTests.every((test) => state.selected.has(test.id));
    return `<section class="domain-section" data-domain="${domain}">
      <h2 class="domain-heading"><span>${domainTests.length}</span>${domainLabels[domain]} 기능
        <button type="button" class="domain-select-all ${allSelected ? "selected" : ""}" data-domain-select="${domain}">${allSelected ? "전체 해제" : "전체 선택"}</button>
      </h2>
      <div class="test-grid">${domainTests.map(testCard).join("")}</div>
    </section>`;
  }).join("");
  renderSelection();
}

async function runTest(id, mode) {
  state.results.set(id, { status: "running" });
  renderTests();
  try {
    const payload = await api(`/v1/integration-tests/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify({ mode }) });
    state.results.set(id, { status: "pass", httpStatus: payload.data.status ?? 200, durationMs: payload.data.durationMs ?? 0, request: payload.data.request });
    $("#lastSummary").textContent = "1건 성공";
  } catch (error) {
    state.results.set(id, { status: "fail", message: error.message });
    $("#lastSummary").textContent = "1건 실패";
  }
  renderTests();
}

async function runAll() {
  const button = $("#runAllBtn");
  button.disabled = true;
  state.tests.filter((test) => test.modes.includes("result")).forEach((test) => state.results.set(test.id, { status: "running" }));
  renderTests();
  try {
    const payload = await api("/v1/integration-tests/run-all", { method: "POST", body: JSON.stringify({ mode: "result" }) });
    payload.data.forEach((result) => state.results.set(result.id, result.ok
      ? { status: "pass", httpStatus: result.status ?? 200, durationMs: result.durationMs ?? 0, request: result.request }
      : { status: "fail", message: result.error }));
    $("#lastSummary").textContent = `${payload.summary.passed} 성공 · ${payload.summary.failed} 실패`;
    if (payload.fleetPulse?.ok) {
      const assets = payload.fleetPulse.targets?.assets ?? 0;
      const personnel = payload.fleetPulse.targets?.personnel ?? 0;
      toast(`전체 테스트 완료 · 장비 ${assets}대, 인원 ${personnel}명 통신 전송`);
    } else {
      toast(`연동 테스트 완료 · 장비 통신 요청 실패: ${payload.fleetPulse?.error ?? "모사 서버 연결 오류"}`);
    }
  } catch (error) {
    state.tests.forEach((test) => state.results.set(test.id, { status: "fail", message: error.message }));
    $("#lastSummary").textContent = "전체 실행 실패";
    toast(error.message);
  } finally {
    button.disabled = false;
    renderTests();
  }
}

async function runSelected({ condition = null } = {}) {
  const ids = [...state.selected];
  if (!ids.length) return;
  const button = $("#runSelectedBtn");
  button.disabled = true;
  ids.forEach((id) => state.results.set(id, { status: "running" }));
  renderTests();
  try {
    const payload = await api("/v1/integration-tests/run-selected", {
      method: "POST",
      body: JSON.stringify({
        ids,
        mode: "result",
        variationMode: state.gradualMode ? "gradual" : "fixed",
        condition,
        cycle: state.continuousCycle,
      }),
    });
    payload.data.forEach((result) => state.results.set(result.id, result.ok
      ? { status: "pass", httpStatus: result.status ?? 200, durationMs: result.durationMs ?? 0, request: result.request }
      : { status: "fail", message: result.error }));
    $("#lastSummary").textContent = `${payload.summary.passed} 성공 · ${payload.summary.failed} 실패`;
    if (!state.continuous) toast(`선택한 ${payload.summary.total}개 기능 실행 완료`);
  } catch (error) {
    ids.forEach((id) => state.results.set(id, { status: "fail", message: error.message }));
    $("#lastSummary").textContent = "선택 실행 실패";
    toast(error.message);
  } finally {
    renderTests();
  }
}

function stopContinuous() {
  state.continuous = false;
  if (state.continuousTimer) clearTimeout(state.continuousTimer);
  state.continuousTimer = null;
  renderSelection();
  toast(`지속 테스트 중지 · ${state.continuousCycle}회 실행`);
}

async function continuousCycle() {
  if (!state.continuous || !state.selected.size) return stopContinuous();
  state.continuousCycle += 1;
  $("#lastSummary").textContent = `지속 테스트 ${state.continuousCycle}회 실행 중`;
  await runSelected();
  if (state.continuous) state.continuousTimer = setTimeout(continuousCycle, 1_000);
}

function toggleContinuous() {
  if (state.continuous) return stopContinuous();
  if (!state.selected.size) return;
  state.continuous = true;
  state.continuousCycle = 0;
  renderSelection();
  toast("선택 기능 지속 테스트 시작");
  void continuousCycle();
}

function toggleGradualMode() {
  state.gradualMode = !state.gradualMode;
  const button = $("#gradualModeBtn");
  button.textContent = `미세 변화 모드 ${state.gradualMode ? "켬" : "끔"}`;
  button.classList.toggle("active", state.gradualMode);
  button.setAttribute("aria-pressed", String(state.gradualMode));
}

async function refresh() {
  try {
    state.health = await fetch("/health", { signal: AbortSignal.timeout(5_000) }).then((response) => response.json());
    $("#connection").classList.add("online");
    $("#connection").lastChild.textContent = "연결됨";
    if (!state.health.requiresControlKey || state.key) {
      const testPayload = await api("/v1/integration-tests");
      state.tests = testPayload.data;
      if (!state.health.requiresControlKey) $("#authPanel").hidden = true;
      renderOverview(); renderTests();
    }
  } catch {
    $("#connection").classList.remove("online");
    $("#connection").lastChild.textContent = "연결 오류";
  }
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.filterGroup) {
    state.filters[button.dataset.filterGroup] = button.dataset.filter;
    document.querySelectorAll(`[data-filter-group="${button.dataset.filterGroup}"]`).forEach((item) => item.classList.toggle("active", item === button));
    renderTests();
  }
  if (button.dataset.action === "test") {
    button.disabled = true;
    await runTest(button.dataset.id, button.dataset.mode);
  }
  if (button.dataset.domainSelect) {
    const ids = state.tests.filter((test) => test.domain === button.dataset.domainSelect).map((test) => test.id);
    const allSelected = ids.every((id) => state.selected.has(id));
    ids.forEach((id) => allSelected ? state.selected.delete(id) : state.selected.add(id));
    if (!state.selected.size && state.continuous) stopContinuous();
    renderTests();
  }
  if (button.dataset.condition) {
    button.disabled = true;
    await runSelected({ condition: button.dataset.condition });
    toast(`${button.textContent} 상황 테스트 완료`);
  }
});

document.addEventListener("change", (event) => {
  const checkbox = event.target.closest("input[data-select-id]");
  if (!checkbox) return;
  if (checkbox.checked) state.selected.add(checkbox.dataset.selectId);
  else state.selected.delete(checkbox.dataset.selectId);
  renderTests();
});

$("#runAllBtn").addEventListener("click", runAll);
$("#runSelectedBtn").addEventListener("click", runSelected);
$("#continuousBtn").addEventListener("click", toggleContinuous);
$("#gradualModeBtn").addEventListener("click", toggleGradualMode);
$("#clearSelectionBtn").addEventListener("click", () => { state.selected.clear(); if (state.continuous) stopContinuous(); renderTests(); });
$("#connectBtn").addEventListener("click", async () => {
  state.key = $("#controlKey").value.trim();
  await refresh();
  $("#authMessage").textContent = state.tests.length ? "연결되었습니다." : "제어 키를 확인해 주세요.";
});
$("#controlKey").addEventListener("keydown", (event) => { if (event.key === "Enter") $("#connectBtn").click(); });

refresh();
setInterval(refresh, 5_000);
