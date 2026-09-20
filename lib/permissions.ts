import "server-only";

import { query, withTransaction } from "@/lib/db";
import type { Role } from "@/lib/types";

export type PermissionItem = {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
  sort_order: number;
};

export type RolePermissionMatrix = Record<Role, string[]>;

let cachedPermissions: PermissionItem[] | null = null;
let cachedMatrix: RolePermissionMatrix | null = null;
let lastCachedAt = 0;
const CACHE_TTL_MS = 60_000; // 1 phút

export function invalidatePermissionCache() {
  cachedPermissions = null;
  cachedMatrix = null;
  lastCachedAt = 0;
}

export async function getAllPermissions(): Promise<PermissionItem[]> {
  const now = Date.now();
  if (cachedPermissions && now - lastCachedAt < CACHE_TTL_MS) {
    return cachedPermissions;
  }

  const result = await query<PermissionItem>(
    `select id, code, name, module, description, sort_order
     from permissions
     order by sort_order asc, code asc`
  );

  cachedPermissions = result.rows;
  lastCachedAt = now;
  return cachedPermissions;
}

export async function getRolePermissionMatrix(): Promise<RolePermissionMatrix> {
  const now = Date.now();
  if (cachedMatrix && now - lastCachedAt < CACHE_TTL_MS) {
    return cachedMatrix;
  }

  const result = await query<{ role: Role; permission_code: string }>(
    `select rp.role, p.code as permission_code
     from role_permissions rp
     join permissions p on p.id = rp.permission_id`
  );

  const matrix: RolePermissionMatrix = {
    admin: [],
    dispatcher: [],
    team_lead: [],
    technician: [],
    accountant: [],
  };

  for (const row of result.rows) {
    if (matrix[row.role]) {
      matrix[row.role].push(row.permission_code);
    }
  }

  cachedMatrix = matrix;
  lastCachedAt = now;
  return matrix;
}

export async function getUserPermissions(role: Role): Promise<string[]> {
  if (role === "admin") {
    // Admin luôn có tất cả các quyền
    const all = await getAllPermissions();
    return all.map((p) => p.code);
  }

  const matrix = await getRolePermissionMatrix();
  return matrix[role] ?? [];
}

export async function hasPermission(role: Role, permissionCode: string): Promise<boolean> {
  if (role === "admin") return true;
  const permissions = await getUserPermissions(role);
  return permissions.includes(permissionCode);
}

export async function updateRolePermissionMatrix(
  roleUpdates: Record<Role, string[]>
): Promise<RolePermissionMatrix> {
  const allPermissions = await getAllPermissions();
  const permCodeToId = new Map(allPermissions.map((p) => [p.code, p.id]));
  const permIdSet = new Set(allPermissions.map((p) => p.id));

  await withTransaction(async (client) => {
    for (const [roleKey, items] of Object.entries(roleUpdates)) {
      const role = roleKey as Role;
      if (role === "admin") continue; // Luôn giữ toàn quyền cho Admin

      // Xóa các quyền cũ của role này
      await client.query(`delete from role_permissions where role = $1`, [role]);

      // Map item (có thể là id hoặc code) sang id
      const targetIds = items
        .map((item) => permCodeToId.get(item) ?? (permIdSet.has(item) ? item : null))
        .filter((id): id is string => Boolean(id));

      for (const permId of targetIds) {
        await client.query(
          `insert into role_permissions (role, permission_id)
           values ($1, $2)
           on conflict do nothing`,
          [role, permId]
        );
      }
    }
  });

  invalidatePermissionCache();
  return getRolePermissionMatrix();
}
