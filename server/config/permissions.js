// RBAC (role based access control) lives in this one file.
// Every route asks "may this role do this action?" here, and never compares role names on its own.
// To change who can do what, only this file changes.

export const roles = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

// roles that can be given to someone else (there is only one OWNER, the creator of the workspace)
export const assignableRoles = ["ADMIN", "MEMBER", "VIEWER"];

// a bigger number means more power
const roleRank = {
    OWNER : 4,
    ADMIN : 3,
    MEMBER : 2,
    VIEWER : 1
};

// the permission matrix : action --> roles that may do it
// (document and chat actions are added here in later phases)
export const permissions = {
    "workspace:view" : ["OWNER", "ADMIN", "MEMBER", "VIEWER"],
    "workspace:update" : ["OWNER", "ADMIN"],
    "workspace:delete" : ["OWNER"],

    "member:view" : ["OWNER", "ADMIN", "MEMBER", "VIEWER"],
    "member:changeRole" : ["OWNER", "ADMIN"],
    "member:remove" : ["OWNER", "ADMIN"],

    "invite:create" : ["OWNER", "ADMIN"],
    "invite:view" : ["OWNER", "ADMIN"],
    "invite:revoke" : ["OWNER", "ADMIN"]
};

export const can = (role, permission)=>{
    return permissions[permission]?.includes(role) ?? false;
}

// Hierarchy rule : you can only manage people who rank BELOW you.
// So an ADMIN cannot remove another ADMIN, and nobody can touch the OWNER.
export const outranks = (roleA, roleB)=>{
    return roleRank[roleA] > roleRank[roleB];
}
