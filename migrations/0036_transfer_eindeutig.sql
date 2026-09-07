-- req-052: Zwischen zwei Programmpunkten gibt es genau einen Transfer. Wo
-- schon einer liegt, oeffnet das "+" im Zeitstrahl den vorhandenen zum
-- Aendern; ein zweiter entsteht dort nicht. Der Index haelt die Regel auch
-- dann, wenn zwei Anfragen gleichzeitig ankommen.
create unique index if not exists transfer_paar_idx
  on transfer (from_activity_id, to_activity_id);
