"use client";

import { useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  ShieldCheck,
  User2,
  UserCog,
  UserX,
  CheckCircle2,
  AlertCircle,
  Lock,
  Search,
  Filter,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { buildApiUrl } from "../../../../lib/api";
import { getToken, clearToken } from "../../../../lib/auth";
import { getErrorMessage, getResponseError } from "../../../../lib/error";

type UserItem = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "inactive";
  created_at?: string | null;
  updated_at?: string | null;
  last_login_at?: string | null;
};

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role?: string;
  status?: string;
};

type NoticeState = {
  type: "success" | "error";
  message: string;
} | null;

type RoleFilter = "all" | "user" | "admin";
type StatusFilter = "all" | "active" | "inactive";
type SortDirection = "asc" | "desc";
type SortKey =
  | "name"
  | "email"
  | "role"
  | "status"
  | "created_at"
  | "last_login_at";

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getRoleBadgeClass(role: string) {
  return role === "admin"
    ? "border border-amber-200 bg-amber-50 text-amber-700"
    : "border border-blue-200 bg-blue-50 text-blue-700";
}

function getStatusBadgeClass(status: string) {
  return status === "active"
    ? "border border-green-200 bg-green-50 text-green-700"
    : "border border-red-200 bg-red-50 text-red-700";
}

function parseDateValue(value?: string | null) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, "id", { sensitivity: "base" });
}

function SortButton({
  label,
  sortKey,
  activeSortKey,
  direction,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey;
  direction: SortDirection;
  onClick: (key: SortKey) => void;
}) {
  const isActive = activeSortKey === sortKey;

  return (
    <button
      type="button"
      onClick={() => onClick(sortKey)}
      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:text-slate-700"
    >
      <span>{label}</span>
      {isActive ? (
        direction === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-70" />
      )}
    </button>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  async function fetchCurrentUser(token: string) {
    const res = await fetch(buildApiUrl("/api/me"), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      clearToken();
      window.location.assign("/login?redirect=/admin/users");
      return null;
    }

    if (!res.ok) {
      throw new Error("Gagal memuat user aktif.");
    }

    const json = await res.json().catch(() => ({}));
    return json?.user ?? null;
  }

  async function fetchUsers(showRefreshState = false) {
    const token = getToken();

    if (!token) {
      clearToken();
      window.location.assign("/login?redirect=/admin/users");
      return;
    }

    if (showRefreshState) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const me = await fetchCurrentUser(token);
      if (me) {
        setCurrentUser(me);
      }

      const res = await fetch(buildApiUrl("/api/admin/users"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        clearToken();
        window.location.assign("/login?redirect=/admin/users");
        return;
      }

      if (res.status === 403) {
        window.location.assign("/dashboard");
        return;
      }

      const json = await res.json().catch(() => []);

      if (!res.ok) {
        throw new Error(getResponseError(json, "Gagal memuat data pengguna."));
      }

      setUsers(Array.isArray(json) ? json : []);
    } catch (err: unknown) {
      setNotice({
        type: "error",
        message: getErrorMessage(err, "Terjadi kesalahan saat memuat data pengguna."),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !keyword ||
        user.name.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword);

      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" || user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const sortedUsers = useMemo(() => {
    const result = [...filteredUsers];

    result.sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case "name":
          comparison = compareText(a.name, b.name);
          break;
        case "email":
          comparison = compareText(a.email, b.email);
          break;
        case "role":
          comparison = compareText(a.role, b.role);
          break;
        case "status":
          comparison = compareText(a.status, b.status);
          break;
        case "created_at":
          comparison = parseDateValue(a.created_at) - parseDateValue(b.created_at);
          break;
        case "last_login_at":
          comparison =
            parseDateValue(a.last_login_at) - parseDateValue(b.last_login_at);
          break;
        default:
          comparison = 0;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [filteredUsers, sortKey, sortDirection]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, statusFilter, sortKey, sortDirection, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  const paginatedUsers = useMemo(() => {
    return sortedUsers.slice(startIndex, endIndex);
  }, [sortedUsers, startIndex, endIndex]);

  const summary = useMemo(() => {
    const total = sortedUsers.length;
    const totalAdmin = sortedUsers.filter((u) => u.role === "admin").length;
    const totalActive = sortedUsers.filter((u) => u.status === "active").length;
    const totalInactive = sortedUsers.filter((u) => u.status === "inactive").length;

    return {
      total,
      totalAdmin,
      totalActive,
      totalInactive,
    };
  }, [sortedUsers]);

  const hasActiveFilter = useMemo(() => {
    return (
      searchTerm.trim() !== "" || roleFilter !== "all" || statusFilter !== "all"
    );
  }, [searchTerm, roleFilter, statusFilter]);

  function resetFilters() {
    setSearchTerm("");
    setRoleFilter("all");
    setStatusFilter("all");
  }

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(
      nextKey === "created_at" || nextKey === "last_login_at" ? "desc" : "asc"
    );
  }

  async function handleRoleChange(userId: string, nextRole: "user" | "admin") {
    const token = getToken();

    if (!token) {
      clearToken();
      window.location.assign("/login?redirect=/admin/users");
      return;
    }

    setNotice(null);
    setUpdatingRoleId(userId);

    try {
      const res = await fetch(buildApiUrl(`/api/admin/users/${userId}/role`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: nextRole }),
      });

      const json = await res.json().catch(() => ({}));

      if (res.status === 401) {
        clearToken();
        window.location.assign("/login?redirect=/admin/users");
        return;
      }

      if (!res.ok) {
        throw new Error(getResponseError(json, "Gagal memperbarui role pengguna."));
      }

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, role: nextRole } : user
        )
      );

      setNotice({
        type: "success",
        message: "Role pengguna berhasil diperbarui.",
      });
    } catch (err: unknown) {
      setNotice({
        type: "error",
        message: getErrorMessage(err, "Terjadi kesalahan saat memperbarui role."),
      });
    } finally {
      setUpdatingRoleId(null);
    }
  }

  async function handleStatusChange(
    userId: string,
    nextStatus: "active" | "inactive"
  ) {
    const token = getToken();

    if (!token) {
      clearToken();
      window.location.assign("/login?redirect=/admin/users");
      return;
    }

    setNotice(null);
    setUpdatingStatusId(userId);

    try {
      const res = await fetch(buildApiUrl(`/api/admin/users/${userId}/status`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const json = await res.json().catch(() => ({}));

      if (res.status === 401) {
        clearToken();
        window.location.assign("/login?redirect=/admin/users");
        return;
      }

      if (!res.ok) {
        throw new Error(getResponseError(json, "Gagal memperbarui status pengguna."));
      }

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, status: nextStatus } : user
        )
      );

      setNotice({
        type: "success",
        message: "Status pengguna berhasil diperbarui.",
      });
    } catch (err: unknown) {
      setNotice({
        type: "error",
        message: getErrorMessage(err, "Terjadi kesalahan saat memperbarui status."),
      });
    } finally {
      setUpdatingStatusId(null);
    }
  }

  return (
    <main className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">
              USERS
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Manajemen Pengguna
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
              Lihat daftar pengguna, ubah role, dan atur status akun yang dapat
              mengakses sistem.
            </p>
          </div>

          <button
            type="button"
            onClick={() => fetchUsers(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Memuat ulang..." : "Refresh"}
          </button>
        </div>
      </section>

      {notice ? (
        <div
          className={
            notice.type === "success"
              ? "rounded-2xl border border-green-200 bg-green-50 p-4"
              : "rounded-2xl border border-red-200 bg-red-50 p-4"
          }
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white p-2 shadow-sm">
              {notice.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
            </div>
            <div>
              <p
                className={
                  notice.type === "success"
                    ? "text-sm font-semibold text-green-800"
                    : "text-sm font-semibold text-red-800"
                }
              >
                {notice.type === "success" ? "Berhasil" : "Terjadi kesalahan"}
              </p>
              <p
                className={
                  notice.type === "success"
                    ? "mt-1 text-sm text-green-700"
                    : "mt-1 text-sm text-red-700"
                }
              >
                {notice.message}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                Pencarian
              </label>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari nama atau email pengguna"
                  className="w-full border-0 bg-transparent p-0 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                Filter Role
              </label>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3">
                <Filter className="h-4 w-4 shrink-0 text-slate-400" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                  className="w-full border-0 bg-transparent p-0 text-sm text-slate-900 outline-none"
                >
                  <option value="all">Semua role</option>
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                Filter Status
              </label>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3">
                <Filter className="h-4 w-4 shrink-0 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as StatusFilter)
                  }
                  className="w-full border-0 bg-transparent p-0 text-sm text-slate-900 outline-none"
                >
                  <option value="all">Semua status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasActiveFilter}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            Reset Filter
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Menampilkan{" "}
          <span className="font-semibold text-slate-900">{sortedUsers.length}</span>{" "}
          pengguna
          {hasActiveFilter
            ? " berdasarkan filter aktif."
            : " dari seluruh data pengguna."}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Total Pengguna</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">
                {summary.total}
              </p>
            </div>
            <div className="rounded-2xl bg-blue-50 p-3">
              <User2 className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Admin</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">
                {summary.totalAdmin}
              </p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3">
              <ShieldCheck className="h-5 w-5 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Active</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">
                {summary.totalActive}
              </p>
            </div>
            <div className="rounded-2xl bg-green-50 p-3">
              <UserCog className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Inactive</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">
                {summary.totalInactive}
              </p>
            </div>
            <div className="rounded-2xl bg-red-50 p-3">
              <UserX className="h-5 w-5 text-red-600" />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-bold text-slate-900">Daftar Pengguna</h2>
          <p className="mt-1 text-sm text-slate-500">
            Klik header kolom untuk mengurutkan data pengguna.
          </p>
        </div>

        {loading ? (
          <div className="px-6 py-10 text-sm text-slate-500">
            Memuat data pengguna...
          </div>
        ) : paginatedUsers.length === 0 ? (
          <div className="px-6 py-10 text-sm text-slate-500">
            Tidak ada pengguna yang cocok dengan filter saat ini.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-6 py-4">
                      <SortButton
                        label="Pengguna"
                        sortKey="name"
                        activeSortKey={sortKey}
                        direction={sortDirection}
                        onClick={handleSort}
                      />
                    </th>
                    <th className="px-6 py-4">
                      <SortButton
                        label="Role"
                        sortKey="role"
                        activeSortKey={sortKey}
                        direction={sortDirection}
                        onClick={handleSort}
                      />
                    </th>
                    <th className="px-6 py-4">
                      <SortButton
                        label="Status"
                        sortKey="status"
                        activeSortKey={sortKey}
                        direction={sortDirection}
                        onClick={handleSort}
                      />
                    </th>
                    <th className="px-6 py-4">
                      <SortButton
                        label="Created"
                        sortKey="created_at"
                        activeSortKey={sortKey}
                        direction={sortDirection}
                        onClick={handleSort}
                      />
                    </th>
                    <th className="px-6 py-4">
                      <SortButton
                        label="Last Login"
                        sortKey="last_login_at"
                        activeSortKey={sortKey}
                        direction={sortDirection}
                        onClick={handleSort}
                      />
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedUsers.map((user) => {
                    const roleUpdating = updatingRoleId === user.id;
                    const statusUpdating = updatingStatusId === user.id;

                    const isCurrentUser = currentUser?.id === user.id;
                    const disableRoleSelect = roleUpdating || isCurrentUser;
                    const disableStatusSelect = statusUpdating || isCurrentUser;

                    return (
                      <tr
                        key={user.id}
                        className="border-t border-slate-200 align-top"
                      >
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {user.name}
                              {isCurrentUser ? (
                                <span className="ml-2 inline-flex rounded-full border border-[var(--color-primary)]/20 bg-[var(--color-primary-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                                  Anda
                                </span>
                              ) : null}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {user.email}
                            </p>
                            <p className="mt-2 text-xs text-slate-400">
                              ID: {user.id}
                            </p>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-3">
                            <span
                              className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${getRoleBadgeClass(
                                user.role
                              )}`}
                            >
                              {user.role === "admin" ? "Administrator" : "User"}
                            </span>

                            <select
                              value={user.role}
                              disabled={disableRoleSelect}
                              onChange={(e) =>
                                handleRoleChange(
                                  user.id,
                                  e.target.value as "user" | "admin"
                                )
                              }
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-3">
                            <span
                              className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(
                                user.status
                              )}`}
                            >
                              {user.status === "active" ? "Active" : "Inactive"}
                            </span>

                            <select
                              value={user.status}
                              disabled={disableStatusSelect}
                              onChange={(e) =>
                                handleStatusChange(
                                  user.id,
                                  e.target.value as "active" | "inactive"
                                )
                              }
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-600">
                          {formatDateTime(user.created_at)}
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-600">
                          {formatDateTime(user.last_login_at)}
                        </td>

                        <td className="px-6 py-4">
                          <div className="text-xs text-slate-500">
                            {isCurrentUser ? (
                              <div className="inline-flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>
                                  Role dan status akun yang sedang digunakan
                                  dikunci untuk mencegah self-lock.
                                </span>
                              </div>
                            ) : roleUpdating || statusUpdating ? (
                              "Menyimpan perubahan..."
                            ) : (
                              "Perubahan tersimpan otomatis saat dipilih."
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-4 border-t border-slate-200 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="text-sm text-slate-600">
                  Menampilkan{" "}
                  <span className="font-semibold text-slate-900">
                    {sortedUsers.length === 0 ? 0 : startIndex + 1}
                  </span>{" "}
                  -{" "}
                  <span className="font-semibold text-slate-900">
                    {Math.min(endIndex, sortedUsers.length)}
                  </span>{" "}
                  dari{" "}
                  <span className="font-semibold text-slate-900">
                    {sortedUsers.length}
                  </span>{" "}
                  pengguna
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600">Rows per page</label>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[var(--color-primary)]"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </button>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                  Halaman {safeCurrentPage} / {totalPages}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={safeCurrentPage >= totalPages}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
