import {
  Building2,
  Car,
  FileArchive,
  IdCard,
  ShieldCheck,
  UsersRound
} from "lucide-react";

export const societyOperationModules = [
  { title: "Dashboard & Settings", category: "Society Admin Core", icon: Building2, owner: "Society Admin", status: "Live", features: ["Dashboard overview", "Society settings"] },
  { title: "Resident & Flat Management", category: "Resident Administration", icon: UsersRound, owner: "Society Admin", status: "Live", features: ["Resident management", "Flat management", "Tower/block management"] },
  { title: "Guard & Gate Control", category: "Security Administration", icon: ShieldCheck, owner: "Society Admin + Guard", status: "Live", features: ["Guard management", "Gate management", "User role management"] },
  { title: "Visitor & QR Pass Monitoring", category: "Visitor Security", icon: IdCard, owner: "Society Admin + Resident + Guard", status: "Live", features: ["Visitor monitoring", "QR pass management", "Search visitor records"] },
  { title: "Vehicle Intelligence", category: "Vehicle Administration", icon: Car, owner: "Society Admin + Resident + Guard", status: "Live", features: ["Vehicle monitoring", "Vehicle database management"] },
  { title: "Reports & Security Logs", category: "Audit and Reporting", icon: FileArchive, owner: "Society Admin", status: "Live", features: ["Export reports", "Security log monitoring"] }
];
