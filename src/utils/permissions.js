import { PermissionsBitField } from "discord.js";

export function isOwner(userId, ownerId) {
  if (!ownerId) return false;
  return String(userId) === String(ownerId);
}

export function hasAdmin(member) {
  if (!member) return false;
  try {
    return member.permissions?.has?.(PermissionsBitField.Flags.Administrator) || false;
  } catch {
    return false;
  }
}

export function check(requiredPermissions = [], member, ownerId) {
  if (!requiredPermissions || requiredPermissions.length === 0) return true;
  // Owner bypass
  if (requiredPermissions.includes("OWNER")) {
    const id = member?.user?.id ?? member?.id;
    if (isOwner(id, ownerId)) return true;
  }
  if (requiredPermissions.includes("ADMIN") && hasAdmin(member)) return true;
  // Add more granular permission checks here later
  return false;
}
