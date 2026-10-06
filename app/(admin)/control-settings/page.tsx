import { requireAdmin, getAccessibleStores } from "@/lib/session";
import {
  CONTROL_SETTING_ITEMS,
  CONTROL_LEVEL_LABELS,
  STORE_TYPE_LABELS,
  fetchControlSettings,
  resolveControlLevel,
  type ControlLevel,
} from "@/lib/control-settings";
import { setControlLevel, removeControlSetting, setStoreType } from "./actions";
import AutoSubmitSelect from "./AutoSubmitSelect";

const LEVELS: ControlLevel[] = ["hq_fixed", "hq_default_store_adjust", "store_free"];

function LevelSelect({
  settingKey,
  scopeType,
  scopeValue,
  current,
  placeholder,
}: {
  settingKey: string;
  scopeType: "global" | "store_type" | "store";
  scopeValue: string;
  current: ControlLevel | null;
  placeholder: string;
}) {
  return (
    <form action={setControlLevel} className="inline-block">
      <input type="hidden" name="setting_key" value={settingKey} />
      <input type="hidden" name="scope_type" value={scopeType} />
      <input type="hidden" name="scope_value" value={scopeValue} />
      <AutoSubmitSelect
        name="control_level"
        defaultValue={current ?? ""}
        className="rounded border border-zinc-300 px-2 py-1 text-xs"
        options={[{ value: "", label: placeholder }, ...LEVELS.map((l) => ({ value: l, label: CONTROL_LEVEL_LABELS[l] }))]}
      />
    </form>
  );
}

export default async function ControlSettingsPage() {
  const { supabase } = await requireAdmin();
  const [stores, settings] = await Promise.all([
    getAccessibleStores(supabase),
    fetchControlSettings(supabase),
  ]);

  const storeOverrides = settings.filter((s) => s.scope_type === "store");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">정책 설정</h1>
        <p className="text-sm text-zinc-500">
          항목마다 본사가 고정할지, 본사 기본값에 점포가 조정하게 할지, 점포에 완전히 맡길지
          정해두는 화면이에요(기술 인수인계서 2-1 참고).
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        ⚠️ 지금은 관리자 역할 하나가 모든 매장을 다 고칠 수 있어서, 여기서 "① 본사 고정"으로
        정해도 실제로 점포 수정이 막히진 않아요. 본사/직영점/가맹점 관리자가 역할로 나뉘면
        그 화면들이 이 설정을 확인해서 바로 작동하게 만들 거예요 — 지금은 정책을 미리
        정하고 기록해두는 용도예요.
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-zinc-700">매장 유형</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full whitespace-nowrap text-base">
            <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
              <tr>
                <th className="px-4 py-3">매장</th>
                <th className="px-4 py-3">유형</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">{s.name}</td>
                  <td className="px-4 py-3">
                    <form action={setStoreType} className="inline-block">
                      <input type="hidden" name="store_id" value={s.id} />
                      <AutoSubmitSelect
                        name="store_type"
                        defaultValue={s.store_type}
                        className="rounded border border-zinc-300 px-2 py-1 text-sm"
                        options={[
                          { value: "direct", label: "직영점" },
                          { value: "franchise", label: "가맹점" },
                        ]}
                      />
                    </form>
                  </td>
                </tr>
              ))}
              {stores.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-zinc-400">
                    등록된 매장이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-zinc-700">항목별 통제 수준</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full whitespace-nowrap text-base">
            <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
              <tr>
                <th className="px-4 py-3">항목</th>
                <th className="px-4 py-3">전체 기본</th>
                <th className="px-4 py-3">직영점</th>
                <th className="px-4 py-3">가맹점</th>
                <th className="px-4 py-3">지금 적용(예시 매장 1개)</th>
              </tr>
            </thead>
            <tbody>
              {CONTROL_SETTING_ITEMS.map((item) => {
                const globalRow = settings.find(
                  (s) => s.setting_key === item.key && s.scope_type === "global"
                );
                const directRow = settings.find(
                  (s) =>
                    s.setting_key === item.key &&
                    s.scope_type === "store_type" &&
                    s.scope_value === "direct"
                );
                const franchiseRow = settings.find(
                  (s) =>
                    s.setting_key === item.key &&
                    s.scope_type === "store_type" &&
                    s.scope_value === "franchise"
                );
                const sampleStore = stores[0];
                const effective = sampleStore
                  ? resolveControlLevel(settings, item.key, sampleStore)
                  : null;
                return (
                  <tr key={item.key} className="border-t border-zinc-100">
                    <td className="px-4 py-3 font-medium">{item.label}</td>
                    <td className="px-4 py-3">
                      <LevelSelect
                        settingKey={item.key}
                        scopeType="global"
                        scopeValue=""
                        current={globalRow?.control_level ?? null}
                        placeholder="점포 자율(기본)"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <LevelSelect
                        settingKey={item.key}
                        scopeType="store_type"
                        scopeValue="direct"
                        current={directRow?.control_level ?? null}
                        placeholder="전체 기본 따름"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <LevelSelect
                        settingKey={item.key}
                        scopeType="store_type"
                        scopeValue="franchise"
                        current={franchiseRow?.control_level ?? null}
                        placeholder="전체 기본 따름"
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {sampleStore
                        ? `${sampleStore.name}: ${CONTROL_LEVEL_LABELS[effective!]}`
                        : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          "취급 상품 범위"(점포 자체 상품 등록)는 제한 없이 점포 자율로 이미 확정돼서 이
          목록에는 없어요.
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-zinc-700">매장별 예외</h2>
        <p className="mb-2 text-xs text-zinc-400">
          특정 매장 하나만 위 기본값과 다르게 두고 싶을 때 씁니다. 매장별 예외가 있으면
          매장 유형·전체 기본보다 우선 적용돼요.
        </p>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <form action={setControlLevel} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="scope_type" value="store" />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">항목</label>
              <select
                name="setting_key"
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
              >
                {CONTROL_SETTING_ITEMS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">매장</label>
              <select
                name="scope_value"
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">통제 수준</label>
              <select
                name="control_level"
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {CONTROL_LEVEL_LABELS[l]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded bg-[#C8075F] px-4 py-1.5 text-sm text-white hover:bg-[#a80650]"
            >
              예외 추가
            </button>
          </form>
        </div>

        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full whitespace-nowrap text-base">
            <thead className="bg-zinc-50 text-left text-sm text-zinc-500">
              <tr>
                <th className="px-4 py-3">항목</th>
                <th className="px-4 py-3">매장</th>
                <th className="px-4 py-3">통제 수준</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {storeOverrides.map((row) => {
                const item = CONTROL_SETTING_ITEMS.find((i) => i.key === row.setting_key);
                const store = stores.find((s) => s.id === row.scope_value);
                return (
                  <tr key={row.id} className="border-t border-zinc-100">
                    <td className="px-4 py-3">{item?.label ?? row.setting_key}</td>
                    <td className="px-4 py-3">{store?.name ?? row.scope_value}</td>
                    <td className="px-4 py-3">{CONTROL_LEVEL_LABELS[row.control_level]}</td>
                    <td className="px-4 py-3">
                      <form action={removeControlSetting}>
                        <input type="hidden" name="id" value={row.id} />
                        <button type="submit" className="text-xs text-red-500 hover:text-red-700">
                          삭제
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {storeOverrides.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-400">
                    등록된 매장별 예외가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-zinc-700">참고 · 2-1-a 통제 수준 3단계</h2>
        <ul className="flex flex-col gap-1 text-sm text-zinc-600">
          <li>
            <b>{STORE_TYPE_LABELS.direct}</b>/<b>{STORE_TYPE_LABELS.franchise}</b> 구분은 매장
            유형 범위에 쓰여요.
          </li>
          <li>{CONTROL_LEVEL_LABELS.hq_fixed} — 본사만 수정, 점포는 조회만.</li>
          <li>{CONTROL_LEVEL_LABELS.hq_default_store_adjust} — 본사가 기본값을 배포하고 점포가 그 범위 안에서 조정(또는 요청→승인).</li>
          <li>{CONTROL_LEVEL_LABELS.store_free} — 점포가 자유롭게 수정, 본사는 조회만.</li>
        </ul>
      </div>
    </div>
  );
}
