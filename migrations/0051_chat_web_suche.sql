-- Der Chat darf im Web suchen (req-092): eine Antwort, die auf einer Suche
-- beruht, nennt ihre Quellen, und eine gescheiterte Suche ihren Grund.
--
-- Beides gehoert zur Antwort und ueberdauert mit ihr das Neuladen der Seite.
-- Eine Antwort ohne Suche hat keine Quellen und keinen Grund -- es steht
-- dann nichts darunter.

-- Warum eine Suche waehrend der Antwort scheiterte. Die Antwort bleibt
-- trotzdem stehen; der Grund steht dabei. Leer heisst: keine Suche ist
-- gescheitert.
alter table chat_nachricht add column suche_fehler text;

alter table chat_nachricht add constraint chat_nachricht_suche_fehler_valid check (
  suche_fehler is null
  or (rolle = 'ki' and suche_fehler in ('grenze', 'ueberlastet', 'dienst', 'anfrage'))
);

-- Die Quellen einer Antwort, in der Reihenfolge, in der die Antwort sie
-- nennt. Sie kommen aus der Antwort des Dienstes -- keine Adresse wird
-- erfunden oder aus dem Text geraten.
--
-- Die Mandantentrennung laeuft ueber die Nachricht und damit ueber die
-- Reise, wie bei chat_nachricht selbst. Mit der Nachricht verschwinden ihre
-- Quellen.
create table chat_quelle (
  id uuid primary key,
  chat_nachricht_id uuid not null references chat_nachricht (id) on delete cascade,
  position integer not null,
  url text not null,
  titel text not null,
  constraint chat_quelle_position_unique unique (chat_nachricht_id, position)
);

create index chat_quelle_nachricht_idx on chat_quelle (chat_nachricht_id);
