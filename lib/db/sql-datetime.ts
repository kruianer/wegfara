/** Wandelt einen timestamp-Wert aus der DB in "YYYY-MM-DDTHH:mm" (lokale Reisezeit, ohne Zeitzone). */
export function toIsoDateTimeString(value: unknown): string {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    const hours = String(value.getHours()).padStart(2, "0");
    const minutes = String(value.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
  return String(value).slice(0, 16).replace(" ", "T");
}
