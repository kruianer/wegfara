// Vorerst genau ein Account, fest hinterlegt (siehe Constraints in
// req-001). Muss mit der ID aus migrations/0002_seed_demo_data.sql
// uebereinstimmen.
//
// Seit req-016 ist dieser Wert kein Zugang mehr: welche Reisedaten jemand
// sieht, ergibt sich aus dem Account der angemeldeten Person
// (`session.participant.accountId`), nicht aus einer festen ID im Code.
// Was hier bleibt, sind Angaben ueber den Betreiber selbst.
export const ACCOUNT_ID = "eb873b95-257b-49c6-b08f-1709d6ad3b94";
export const ACCOUNT_NAME = "Uwe Kremmel";
export const ACCOUNT_EMAIL = "uwe@kremmel.org";
