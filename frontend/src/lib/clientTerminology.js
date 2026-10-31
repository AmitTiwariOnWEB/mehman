export const getClientType = (sessionOrUser) => {
  const user = sessionOrUser?.user || sessionOrUser;
  return user?.company?.clientType === "CORPORATE" ? "CORPORATE" : "SOCIETY";
};

export const getClientTerms = (sessionOrUser) => {
  const isCorporate = getClientType(sessionOrUser) === "CORPORATE";

  return {
    isCorporate,
    clientType: isCorporate ? "CORPORATE" : "SOCIETY",
    client: isCorporate ? "Corporate" : "Society",
    clientLower: isCorporate ? "corporate" : "society",
    clientPlural: isCorporate ? "Corporate Clients" : "Society Clients",
    adminRole: isCorporate ? "Admin" : "Society Admin",
    resident: isCorporate ? "Office" : "Resident",
    residentPlural: isCorporate ? "Offices" : "Residents",
    residentLower: isCorporate ? "office" : "resident",
    residentPluralLower: isCorporate ? "offices" : "residents",
    unit: isCorporate ? "Office" : "Flat",
    unitLower: isCorporate ? "office" : "flat",
    unitPlural: isCorporate ? "Offices" : "Flats",
    unitPluralLower: isCorporate ? "offices" : "flats",
    tower: isCorporate ? "Building" : "Tower / Wing",
    structure: isCorporate ? "Offices & Floors" : "Flats & Towers",
    householdRecords: isCorporate ? "Office Records" : "Household Records"
  };
};

export const getRoleLabel = (role, sessionOrUser) => {
  const terms = getClientTerms(sessionOrUser);
  const labels = {
    SUPER_ADMIN: "Super Admin",
    SOCIETY_ADMIN: terms.adminRole,
    FLAT_OWNER: terms.resident,
    SECURITY_GUARD: "Security Guard",
    RECEPTIONIST: "Receptionist"
  };
  return labels[role] || role;
};
