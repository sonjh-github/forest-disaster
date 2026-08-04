import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { forestApi, invalidateAssetCatalog, type ApiRecord } from "../../http-api";

const ASSET_TYPES = [
  ["UAV", "무인기"],
  ["MAIN_RELAY_DRONE", "주 중계 드론"],
  ["SERVICE_RELAY_DRONE", "서비스 중계 드론"],
  ["GCS", "드론 지상통제장치(GCS)"],
  ["RTK_TERMINAL", "대원 RTK 단말"],
  ["PERSONNEL_TERMINAL", "대원 통합단말"],
  ["RTK_BASE_LPWA_GATEWAY", "이동형 RTK 기준국·LPWA 게이트웨이"],
  ["TVWS_BASE_STATION", "TVWS 기지국"],
  ["TVWS_CPE", "TVWS CPE"],
  ["LTE_GATEWAY", "LTE 게이트웨이"],
  ["PRIVATE_5G_NTN_GATEWAY", "이음5G·저궤도위성 게이트웨이"],
  ["RADIO_GATEWAY_400MHZ", "400MHz 무전 게이트웨이"],
  ["COMMAND_VEHICLE", "현장지휘차량"],
  ["FIXED_RELAY", "고정형 임시 중계기"],
  ["MOBILE_RELAY", "이동 중계기"],
  ["REF_AP", "기준 AP"],
  ["ROVER_AP", "이동 AP"],
  ["RSSI_DETECTOR", "RSSI 탐지기"],
  ["IR_UWB_GPR", "IR-UWB·GPR 탐지장비"],
] as const;

const CAPABILITIES = ["GNSS", "RTK", "NTRIP", "RTCM", "LPWA", "WIFI", "LTE", "TVWS", "PRIVATE_5G", "LEO_NTN", "400MHZ", "EOIR", "GCS", "IR_UWB", "GPR"];
const TYPE_DEFAULTS: Record<string, string[]> = {
  UAV: ["GNSS", "LTE", "EOIR"], MAIN_RELAY_DRONE: ["GNSS", "LTE", "PRIVATE_5G"], SERVICE_RELAY_DRONE: ["GNSS", "LTE"],
  GCS: ["GCS", "LTE"], RTK_TERMINAL: ["GNSS", "RTK", "LPWA"], PERSONNEL_TERMINAL: ["GNSS", "WIFI", "LTE", "LPWA"],
  RTK_BASE_LPWA_GATEWAY: ["GNSS", "RTK", "NTRIP", "RTCM", "LPWA", "LTE"], TVWS_BASE_STATION: ["TVWS", "LTE"], TVWS_CPE: ["TVWS", "WIFI"],
  LTE_GATEWAY: ["LTE"], PRIVATE_5G_NTN_GATEWAY: ["PRIVATE_5G", "LEO_NTN", "LTE"], RADIO_GATEWAY_400MHZ: ["400MHZ"],
  COMMAND_VEHICLE: ["LTE", "TVWS", "PRIVATE_5G", "LEO_NTN"], FIXED_RELAY: ["LTE", "WIFI"], MOBILE_RELAY: ["LTE", "WIFI"],
  REF_AP: ["WIFI"], ROVER_AP: ["WIFI", "LTE"], RSSI_DETECTOR: ["WIFI", "LTE"], IR_UWB_GPR: ["IR_UWB", "GPR", "LTE"],
};

type AssetForm = {
  assetCode: string; assetType: string; assetName: string; ownerOrgCode: string;
  manufacturer: string; modelName: string; serialNumber: string; capabilities: string[];
};

const initialForm = (): AssetForm => ({
  assetCode: "", assetType: "UAV", assetName: "", ownerOrgCode: "", manufacturer: "",
  modelName: "", serialNumber: "", capabilities: [...TYPE_DEFAULTS.UAV],
});

function value(asset: ApiRecord, key: string) { return asset[key] == null || asset[key] === "" ? "-" : String(asset[key]); }
function typeLabel(type: unknown) { return ASSET_TYPES.find(([id]) => id === type)?.[1] ?? String(type ?? "기타 장비").replaceAll("_", " "); }
function statusLabel(status: unknown) {
  return ({ REGISTERED: "등록", READY: "대기", ACTIVE: "운용", SUSPENDED: "정지", LOST: "분실", RETIRED: "폐기" } as Record<string, string>)[String(status)] ?? String(status ?? "확인 필요");
}

export default function AssetRegistryModal({ onClose, onRegistered }: { onClose: () => void; onRegistered?: () => void }) {
  const [assets, setAssets] = useState<ApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [form, setForm] = useState<AssetForm>(initialForm);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const result = await forestApi.assets(200);
      setAssets(result.data);
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "자산 원장을 불러오지 못했습니다." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAssets(); }, [loadAssets]);

  const filteredAssets = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("ko-KR");
    return assets.filter((asset) => {
      if (typeFilter !== "ALL" && asset.assetType !== typeFilter) return false;
      if (!keyword) return true;
      return [asset.assetCode, asset.assetName, asset.serialNumber, asset.modelName, asset.assetId, asset.ownerOrgCode]
        .some((item) => String(item ?? "").toLocaleLowerCase("ko-KR").includes(keyword));
    });
  }, [assets, query, typeFilter]);

  const updateType = (assetType: string) => setForm((current) => ({
    ...current, assetType, capabilities: [...(TYPE_DEFAULTS[assetType] ?? ["LTE"])],
  }));
  const toggleCapability = (capability: string) => setForm((current) => ({
    ...current,
    capabilities: current.capabilities.includes(capability)
      ? current.capabilities.filter((item) => item !== capability)
      : [...current.capabilities, capability],
  }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!form.assetCode.trim() || !form.assetName.trim() || !form.serialNumber.trim()) {
      setMessage({ kind: "error", text: "자산관리번호, 자산명, 시리얼번호는 필수입니다." });
      return;
    }
    if (!form.capabilities.length) {
      setMessage({ kind: "error", text: "장비 기능을 한 개 이상 선택해 주세요." });
      return;
    }
    setSaving(true);
    try {
      const result = await forestApi.registerAsset({
        assetCode: form.assetCode.trim(), assetType: form.assetType, assetName: form.assetName.trim(),
        ownerOrgCode: form.ownerOrgCode.trim() || null, modelName: form.modelName.trim() || null,
        serialNumber: form.serialNumber.trim(), capabilities: form.capabilities,
        specifications: { manufacturer: form.manufacturer.trim() || null },
      });
      invalidateAssetCatalog();
      setForm(initialForm());
      setMessage({ kind: "success", text: `${value(result.data, "assetCode")} 등록 완료 · 통합 UUID가 발급되었습니다.` });
      await loadAssets();
      onRegistered?.();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "자산 등록에 실패했습니다." });
    } finally {
      setSaving(false);
    }
  };

  return <div className="asset-registry-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="asset-registry-modal" role="dialog" aria-modal="true" aria-labelledby="asset-registry-title" onMouseDown={(event) => event.stopPropagation()}>
      <header className="asset-registry-header">
        <div><small>GLOBAL ASSET REGISTRY</small><h2 id="asset-registry-title">통합 자산 등록·관리</h2><p>장비를 사건과 무관한 전역 자산 원장에 먼저 등록합니다.</p></div>
        <button type="button" onClick={onClose} aria-label="자산 등록 화면 닫기">×</button>
      </header>
      <div className="asset-boundary-guide">
        <div><b>① 자산 등록</b><span>자산관리번호·시리얼을 확인하고 UUID 발급</span></div><i>→</i>
        <div><b>② 사건 배치</b><span>필요한 사건에 임무와 기간을 지정해 투입</span></div><i>→</i>
        <div><b>③ 상태 수집</b><span>배치된 자산의 위치·통신·운용상태 기록</span></div>
      </div>
      <div className="asset-registry-body">
        <section className="asset-catalog-panel" aria-label="등록 자산 원장">
          <header><div><small>등록 자산 원장</small><strong>{assets.length}대</strong></div><span>사건 미배치 자산도 포함</span></header>
          <div className="asset-catalog-filter">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="자산명·관리번호·시리얼·UUID 검색" aria-label="자산 검색" />
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="자산 유형 필터">
              <option value="ALL">전체 유형</option>{ASSET_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
          <div className="asset-catalog-list">
            {filteredAssets.map((asset) => <article key={value(asset, "assetId")} className="asset-catalog-row">
              <div><span>{typeLabel(asset.assetType)}</span><em data-status={value(asset, "status")}>{statusLabel(asset.status)}</em></div>
              <strong>{value(asset, "assetName")}</strong><small>{value(asset, "assetCode")} · {value(asset, "modelName")}</small>
              <dl><div><dt>시리얼</dt><dd>{value(asset, "serialNumber")}</dd></div><div><dt>통합 UUID</dt><dd>{value(asset, "assetId")}</dd></div><div><dt>관리기관</dt><dd>{value(asset, "ownerOrgCode")}</dd></div></dl>
            </article>)}
            {!loading && filteredAssets.length === 0 && <p className="asset-catalog-empty">조건에 맞는 등록 자산이 없습니다.</p>}
            {loading && <p className="asset-catalog-empty">자산 원장을 불러오는 중입니다.</p>}
          </div>
        </section>
        <form className="asset-registration-form" onSubmit={submit}>
          <header><small>신규 자산</small><strong>자산 사전등록</strong><span>사건을 선택하지 않고 원장에 등록합니다.</span></header>
          <div className="asset-form-grid">
            <label><span>자산관리번호 <b>필수</b></span><input value={form.assetCode} onChange={(event) => setForm({ ...form, assetCode: event.target.value })} placeholder="예: UAV-ULSAN-001" required /></label>
            <label><span>자산 유형 <b>필수</b></span><select value={form.assetType} onChange={(event) => updateType(event.target.value)}>{ASSET_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
            <label className="wide"><span>자산명 <b>필수</b></span><input value={form.assetName} onChange={(event) => setForm({ ...form, assetName: event.target.value })} placeholder="운영자가 식별할 장비명" required /></label>
            <label><span>제조사</span><input value={form.manufacturer} onChange={(event) => setForm({ ...form, manufacturer: event.target.value })} placeholder="제조사명" /></label>
            <label><span>모델명</span><input value={form.modelName} onChange={(event) => setForm({ ...form, modelName: event.target.value })} placeholder="제품 모델명" /></label>
            <label><span>시리얼번호 <b>필수</b></span><input value={form.serialNumber} onChange={(event) => setForm({ ...form, serialNumber: event.target.value })} placeholder="장비 실물 시리얼" required /></label>
            <label><span>관리기관 코드</span><input value={form.ownerOrgCode} onChange={(event) => setForm({ ...form, ownerOrgCode: event.target.value })} placeholder="예: FOREST-ICT" /></label>
          </div>
          <fieldset><legend>장비 기능 <b>필수</b></legend><div className="asset-capability-grid">{CAPABILITIES.map((capability) => <label key={capability} data-selected={form.capabilities.includes(capability)}><input type="checkbox" checked={form.capabilities.includes(capability)} onChange={() => toggleCapability(capability)} /><span>{capability}</span></label>)}</div></fieldset>
          <aside><strong>식별 원칙</strong><span>UUID는 시스템 통합키로 자동 발급합니다. 자산관리번호와 시리얼번호는 실물 대조 및 증빙용으로 함께 유지합니다.</span></aside>
          {message && <p className="asset-form-message" data-kind={message.kind} role="status">{message.text}</p>}
          <footer><button type="button" onClick={() => { setForm(initialForm()); setMessage(null); }}>입력 초기화</button><button type="submit" disabled={saving}>{saving ? "등록 처리 중…" : "자산 등록 및 UUID 발급"}</button></footer>
        </form>
      </div>
    </section>
  </div>;
}
