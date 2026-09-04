-- Dokumente einer Reise (req-034): Tickets, Buchungsbestaetigungen,
-- Mietwagenvertraege. Sie liegen heute im Postfach verstreut und gehoeren
-- dorthin, wo die Reise geplant und begleitet wird.
--
-- Nach der Regel aus delivery/stack.md liegt die **Datei** im
-- Bildverzeichnis und dieser Datensatz in der Datenbank: kein Dokument
-- ohne Datensatz, kein Datensatz ohne Datei. Die Datenbank ist die
-- Wahrheit, das Dateisystem nur der Ablageort.
--
-- Die Mandantentrennung laeuft ueber die Reise, wie bei poi, activity und
-- expense: ein Dokument haengt an einer Reise, die Reise am Account. Ein
-- Dokument ohne Reise gibt es nicht (req-034, "Nicht Teil").
create table document (
  id uuid primary key,
  trip_id uuid not null references trip (id),
  -- Der angezeigte Name. Beim Ablegen ist es der Name der hochgeladenen
  -- Datei; geaendert wird er spaeter frei. Er bestimmt **nie** den
  -- Ablageort auf dem Server (req-034, Constraints) -- dafuer steht
  -- file_name daneben, den die Anwendung selbst vergibt.
  name text not null,
  -- Der Name der Datei in der Ablage, von der Anwendung vergeben
  -- (Zufallskennung + Endung). Eindeutig: zwei Datensaetze duerfen nie auf
  -- dieselbe Datei zeigen, sonst raeumte das Entfernen des einen die Datei
  -- des anderen weg.
  file_name text not null,
  content_type text not null,
  size_bytes integer not null,
  -- Seitenzahl einer PDF-Datei, damit sich in der Vollbildansicht blaettern
  -- laesst. Bei Bildern und bei nicht lesbaren PDF-Dateien leer.
  page_count integer,
  -- Ein Dokument gehoert zur Reise; zusaetzlich kann es mit einem POI oder
  -- einem Transfer dieser Reise verknuepft sein -- nie mit beidem. Beide
  -- Verknuepfungen loesen sich, wenn ihr Ziel verschwindet: das Dokument
  -- bleibt, es haengt an der Reise.
  poi_id uuid references poi (id) on delete set null,
  transfer_id uuid references transfer (id) on delete set null,
  -- Wer das Dokument abgelegt hat. Wird die Person aus dem Account
  -- entfernt, bleibt das Dokument -- ein Ticket verliert seinen Wert nicht,
  -- weil jemand die Gruppe verlassen hat.
  uploaded_by uuid references participant (id) on delete set null,
  created_at timestamptz not null,
  constraint document_size_positive check (size_bytes > 0),
  -- Erlaubt sind Bilder und PDF-Dateien (req-034). Die Liste steht auch in
  -- lib/documents/validate.ts -- hier als letzte Absicherung des Schemas.
  constraint document_content_type_valid check (
    content_type in (
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/heic',
      'image/heif'
    )
  ),
  constraint document_single_link check (poi_id is null or transfer_id is null)
);

create index document_trip_id_idx on document (trip_id);
create unique index document_file_name_key on document (file_name);
