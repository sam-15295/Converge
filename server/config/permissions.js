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
    "invite:revoke" : ["OWNER", "ADMIN"],

    "document:view" : ["OWNER", "ADMIN", "MEMBER", "VIEWER"],
    "document:create" : ["OWNER", "ADMIN", "MEMBER"],
    "document:edit" : ["OWNER", "ADMIN", "MEMBER"],

    // deleting depends on WHO CREATED the document as well :
    //   document:delete    --> may delete any document
    //   document:deleteOwn --> may delete only the documents they created themselves
    "document:delete" : ["OWNER", "ADMIN"],
    "document:deleteOwn" : ["OWNER", "ADMIN", "MEMBER"]
};

export const can = (role, permission)=>{
    return permissions[permission]?.includes(role) ?? false;
}

// Hierarchy rule : you can only manage people who rank BELOW you.
// So an ADMIN cannot remove another ADMIN, and nobody can touch the OWNER.
export const outranks = (roleA, roleB)=>{
    return roleRank[roleA] > roleRank[roleB];
}

// Everything a role may do, and the roles it may hand out. The API sends these to the frontend so the
// screen can hide buttons the user could not use anyway. Only a convenience : the backend checks again on every request.
export const permissionsOf = (role)=>{
    return Object.keys(permissions).filter((permission)=> can(role, permission));
}

export const rolesBelow = (role)=>{
    return assignableRoles.filter((assignable)=> outranks(role, assignable));
}
