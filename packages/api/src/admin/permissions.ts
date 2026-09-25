/** Papéis do painel e o que cada um pode fazer. Toda ação é checada no servidor. */

export type StaffRole = "owner" | "admin" | "support" | "finance" | "viewer";

export type Permission =
  | "read"
  | "notes"
  | "household.suspend"
  | "user.ban"
  | "plan.write"
  | "subscription.write"
  | "flags.write"
  | "lgpd.handle"
  | "lgpd.delete"
  | "staff.manage";

const ALL: Permission[] = [
  "read",
  "notes",
  "household.suspend",
  "user.ban",
  "plan.write",
  "subscription.write",
  "flags.write",
  "lgpd.handle",
  "lgpd.delete",
  "staff.manage",
];

export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  owner: ALL,
  admin: ALL.filter((p) => p !== "staff.manage"),
  support: ["read", "notes", "lgpd.handle"],
  finance: ["read", "notes", "plan.write", "subscription.write"],
  viewer: ["read"],
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  support: "Suporte",
  finance: "Financeiro",
  viewer: "Somente leitura",
};

export const isStaffRole = (v: string): v is StaffRole => v in ROLE_PERMISSIONS;

export const can = (role: StaffRole, p: Permission): boolean =>
  ROLE_PERMISSIONS[role].includes(p);
