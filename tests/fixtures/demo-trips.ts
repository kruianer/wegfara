import type { Trip } from "@/lib/trips/types";

// Spiegelt migrations/0002_seed_demo_data.sql, ohne von der DB abzuhaengen.
export const DEMO_TRIPS: Trip[] = [
  {
    id: "d5fda5ea-65e7-4b47-8096-62618599a288",
    title: "Süditalien Rundreise",
    startDate: "2026-07-18",
    endDate: "2026-07-23",
    mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
    description: "",
    state: "in_planung",
  },
  {
    id: "4b5f95d6-5ad3-4049-b71c-0b90fef8e950",
    title: "Wien Städtereise",
    startDate: "2026-10-09",
    endDate: "2026-10-11",
    mainPlace: { name: "Wien", lat: 48.2082, lng: 16.3738 },
    description: "",
    state: "in_planung",
  },
  {
    id: "72d68515-6bb1-4723-95d9-2a04fb65e5ca",
    title: "Alpen-Adria-Radtour",
    startDate: "2026-05-25",
    endDate: "2026-05-31",
    mainPlace: { name: "Villach", lat: 46.6103, lng: 13.8558 },
    description: "",
    state: "in_planung",
  },
];
