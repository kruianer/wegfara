import type { Transfer } from "@/lib/transfers/types";

// Spiegelt migrations/0009_seed_transfers.sql, ohne von der DB abzuhaengen.
export const DEMO_TRANSFERS: Transfer[] = [
  {
    id: "794bb711-2d4e-4be9-8777-61d4477bcd1c",
    tripId: "d5fda5ea-65e7-4b47-8096-62618599a288",
    fromActivityId: "6460c010-7440-4c0a-a598-197b306cacf1",
    toActivityId: "384d0b94-df7f-44b3-8bcf-013b41a6d265",
    mode: "fuss",
    title: "Spaziergang zum Hafen",
    durationMin: 8,
    distanceKm: 0.4,
  },
  {
    id: "4879b2a4-d673-4d70-97c2-f5d0cb505f04",
    tripId: "d5fda5ea-65e7-4b47-8096-62618599a288",
    fromActivityId: "384d0b94-df7f-44b3-8bcf-013b41a6d265",
    toActivityId: "deaacefe-9cc1-4835-9be5-5b23a231720c",
    mode: "auto",
    title: "Fahrt zum Aussichtspunkt",
    durationMin: 12,
    distanceKm: 4.2,
  },
  {
    id: "0d1ff257-e95a-4622-8643-72524c0c6cb0",
    tripId: "d5fda5ea-65e7-4b47-8096-62618599a288",
    fromActivityId: "deaacefe-9cc1-4835-9be5-5b23a231720c",
    toActivityId: "6d0ed984-d2dc-48a5-b298-780ceabd9f6f",
    mode: "bus",
    title: "Bus zum Hotel",
    durationMin: 10,
    distanceKm: 1.1,
  },
  {
    id: "f7c977e1-ad68-4ed0-8a1b-83f421bd3c8b",
    tripId: "d5fda5ea-65e7-4b47-8096-62618599a288",
    fromActivityId: "c754341c-0bb1-45dc-84f4-ea26fbe88eaf",
    toActivityId: "9a372af3-1719-49e1-8a00-cda91d8e1bbd",
    mode: "boot",
    title: "Bootsfahrt zurück nach Positano",
    durationMin: 60,
    distanceKm: 18.5,
  },
];
