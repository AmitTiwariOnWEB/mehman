/* Web portal feature groups - drives sidebar menu + AdminFeaturePage routing */

/* -- Super Admin (SaaS owner) menu -- */
export const superAdminGroups = {
  saas: {
    title: "SaaS Overview",
    features: ["SaaS Dashboard", "Onboard Client", "Subscriptions"]
  },
  clients: {
    title: "Client Management",
    features: ["Client Accounts", "Client Admins"]
  }
};

/* -- Society Admin menu -- */
export const featureGroups = {
  overview: {
    title: "Command Center",
    features: ["Dashboard", "Inbox & Approvals", "Operations Console"]
  },
  security: {
    title: "Access & Security",
    features: [
      "Visitor Monitoring",
      "QR Pass Management",
      "Gate Management",
      "Guard Management",
      "Vehicle Monitoring",
      "Vehicle Database",
      "Search Records",
      "Security Logs"
    ]
  },
  people: {
    title: "People & Directory",
    features: ["People Management", "Household Records", "Society Directory"]
  },
  services: {
    title: "Services & Billing",
    features: [
      "Announcements",
      "Complaints & Feedback",
      "Maintenance Requests",
      "Maintenance Billing",
      "Amenities Booking",
      "Voting System"
    ]
  },
  reports: {
    title: "Reports & Admin",
    features: ["Export Reports", "Society Settings"]
  }
};

/* Mobile-only catalogs */
export const securityGuardFeatures = [
  "Visitor entry creation",
  "Visitor check-in/check-out",
  "Guest vehicle entry",
  "Guest vehicle exit",
  "Visitor photo capture",
  "Delivery entry management",
  "Staff/maid entry",
  "Gate pass generation",
  "QR gate pass scanning",
  "Multiple gate support",
  "Temporary visitor pass",
  "Emergency SOS",
  "Facility report"
];

export const residentFeatures = [
  "Approve visitors",
  "Reject visitors",
  "Pre-approve guests",
  "Generate visitor gate pass",
  "View visitor history",
  "Family members",
  "Personal vehicles",
  "Register guest vehicles",
  "Delivery approval",
  "View entry/exit history",
  "Complaints",
  "Maintenance request",
  "Society announcements"
];

export const superAdminFeatures = [
  "Client onboarding",
  "Client admin account provisioning",
  "Client operations support"
];
