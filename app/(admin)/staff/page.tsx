import { requireAdmin, getAccessibleStores } from "@/lib/session";
import { updateStaff, deleteStaff } from "./actions";
import StaffForm from "./StaffForm";
import type { UserRole } from "@/lib/types";

type StaffRow = {
  id: string;
  role: UserRole;
  store_id: string | null;
  name: string | null;
  email: string | null;
  stores: { name: string } | null;
};

export default async function StaffPage() {
  const { supabase } = await requireAdmin();

  const [{ data }, stores] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, store_id, name, email, stores(name)")
      .order("email"),
    getAccessibleStores(supabase),
  ]);

  const staff = (data ?? []) as unknown as StaffRow[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">직원관리</h1>
        <p className="text-sm text-zinc-500">
          관리자/직원 계정을 생성하고 매장을 배정합니다.
        </p>
      </div>

      <StaffForm stores={stores} />

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-base">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              <th className="px-3 py-2">이메일</th>
              <th className="px-3 py-2">이름</th>
              <th className="px-3 py-2">역할</th>
              <th className="px-3 py-2">매장</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => {
              const formId = `edit-${s.id}`;
              return (
                <tr key={s.id} className="border-t border-zinc-100">
                  <td className="px-3 py-2 text-zinc-500">{s.email ?? "-"}</td>
                  <td className="px-3 py-2">{s.name ?? "-"}</td>
                  <td className="px-2 py-1">
                    <select
                      form={formId}
                      name="role"
                      defaultValue={s.role}
                      className="rounded border border-zinc-200 px-2 py-1"
                    >
                      <option value="staff">직원</option>
                      <option value="admin">관리자</option>
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <select
                      form={formId}
                      name="store_id"
                      defaultValue={s.store_id ?? ""}
                      className="rounded border border-zinc-200 px-2 py-1"
                    >
                      <option value="">매장 미배정</option>
                      {stores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-3">
                      <input type="hidden" form={formId} name="id" value={s.id} />
                      <button
                        type="submit"
                        form={formId}
                        className="text-zinc-600 hover:text-zinc-900"
                      >
                        저장
                      </button>
                      <form action={deleteStaff}>
                        <input type="hidden" name="id" value={s.id} />
                        <button
                          type="submit"
                          className="text-red-500 hover:text-red-700"
                        >
                          삭제
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {staff.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-zinc-400">
                  등록된 계정이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {staff.map((s) => (
        <form key={s.id} id={`edit-${s.id}`} action={updateStaff} className="hidden" />
      ))}
    </div>
  );
}
