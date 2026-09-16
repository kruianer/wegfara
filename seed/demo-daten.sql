-- Demo-Daten (req-064): dieselben drei Reisen, POIs, Programmpunkte und
-- Transfers, die bis dahin aus den Migrationen kamen -- und die dort
-- gestrichen wurden, damit eine frische Umgebung leer ist.
--
-- Diese Datei wird nie von selbst eingespielt. Sie liest, wer sie
-- ausdruecklich ruft: `npm run seed:demo` fuer eine frische dev-Umgebung
-- (siehe scripts/seed-demo.mjs) und tests/test-db.ts fuer die Testsuite.
--
-- Sie setzt das Schema aller Migrationen und den Account aus
-- migrations/0002_seed_demo_data.sql voraus. Jede Anweisung darf mehrfach
-- laufen, ohne Vorhandenes zu veraendern -- eine Umgebung, die die Daten
-- schon hat, bleibt unberuehrt.

-- Die drei Reisen (zuvor migrations/0002_seed_demo_data.sql).
insert into trip (id, account_id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng) values
  ('d5fda5ea-65e7-4b47-8096-62618599a288', 'eb873b95-257b-49c6-b08f-1709d6ad3b94', 'Süditalien Rundreise', '2026-07-18', '2026-07-23', 'Amalfi', 40.6340, 14.6027),
  ('4b5f95d6-5ad3-4049-b71c-0b90fef8e950', 'eb873b95-257b-49c6-b08f-1709d6ad3b94', 'Wien Städtereise', '2026-10-09', '2026-10-11', 'Wien', 48.2082, 16.3738),
  ('72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'eb873b95-257b-49c6-b08f-1709d6ad3b94', 'Alpen-Adria-Radtour', '2026-05-25', '2026-05-31', 'Villach', 46.6103, 13.8558)
on conflict (id) do nothing;

-- Programmpunkte der drei Reisen (zuvor migrations/0004_seed_activities.sql).
-- Der 20.07. (Sueditalien) und der 29.05. (Alpen-Adria) bleiben absichtlich
-- ohne Programmpunkte, damit der Hinweis "Noch nichts geplant" pruefbar ist.
insert into activity (id, trip_id, type, title, short_text, long_text, start_at, end_at, lat, lng) values
  -- Suditalien Rundreise, 18.-23.07.2026
  ('6460c010-7440-4c0a-a598-197b306cacf1', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'sehenswuerdigkeit', 'Dom von Amalfi', 'Treppenaufgang und maurisch gepraegter Kreuzgang direkt am Hauptplatz.', 'Der Dom Sant''Andrea thront ueber einer breiten Freitreppe mitten in Amalfi. Sehenswert ist vor allem der Kreuzgang "Chiostro del Paradiso" mit seinen verschlungenen Bogengaengen maurischen Ursprungs. Am fruehen Vormittag ist deutlich weniger los als am Nachmittag.', '2026-07-18 10:00', '2026-07-18 12:30', 40.6343, 14.6027),
  ('384d0b94-df7f-44b3-8bcf-013b41a6d265', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'restaurant', 'Mittagessen bei La Marinella', 'Frischer Fisch mit Blick auf den kleinen Hafen von Amalfi.', 'Kleines, familiengefuehrtes Lokal direkt an der Uferpromenade. Empfehlenswert sind die Scialatielli ai frutti di mare und der lokale Weisswein von der Amalfikueste. Reservierung fuer die Mittagszeit ist nicht noetig.', '2026-07-18 13:00', '2026-07-18 14:30', 40.6335, 14.6025),
  ('deaacefe-9cc1-4835-9be5-5b23a231720c', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'weltkulturerbe', 'Aussichtspunkt Amalfikueste', 'Panoramablick auf die Steilkueste, Teil des UNESCO-Welterbes.', 'Die Costiera Amalfitana zaehlt seit 1997 zum UNESCO-Weltkulturerbe. Von diesem Aussichtspunkt reicht der Blick ueber die Terrassenlandschaft bis nach Positano. Am besten am spaeten Nachmittag, wenn das Licht flacher steht.', '2026-07-18 15:00', '2026-07-18 16:30', 40.6270, 14.5970),
  ('6d0ed984-d2dc-48a5-b298-780ceabd9f6f', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'hotel', 'Check-in Hotel Luna Convento', 'Ehemaliges Kloster mit Zimmern zum Meer.', 'Das Hotel liegt in einem umgebauten Kloster aus dem 13. Jahrhundert direkt oberhalb der Kueste. Rezeption ist bis 22 Uhr besetzt, ein fruehes Check-in ist auf Anfrage moeglich.', '2026-07-18 17:00', '2026-07-18 18:00', 40.6336, 14.6021),

  ('88299abd-b4c7-4459-8a47-cb1b919c41a2', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'aktivitaet', 'Bootstour nach Capri', 'Ganztagesausflug per Boot inklusive Blauer Grotte.', 'Die Fahrt startet im Hafen von Amalfi und fuehrt an der Kueste entlang nach Capri. Je nach Wetterlage und Wasserstand ist ein Abstecher zur Blauen Grotte moeglich. Sonnenschutz und feste Schuhe fuer die Landgaenge einpacken.', '2026-07-19 09:00', '2026-07-19 13:00', 40.5532, 14.2429),
  ('c754341c-0bb1-45dc-84f4-ea26fbe88eaf', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'restaurant', 'Lunch in Marina Grande', 'Einfache Trattoria direkt am Anleger von Capri.', 'Unaufwaendiges Lokal fuer die Mittagspause zwischen Bootstour und Rueckfahrt. Gute Auswahl an gegrilltem Fisch und kalten Vorspeisen.', '2026-07-19 13:30', '2026-07-19 14:30', 40.5590, 14.2400),
  ('9a372af3-1719-49e1-8a00-cda91d8e1bbd', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'aktivitaet', 'Abendlicher Stadtbummel in Positano', 'Gassen, Boutiquen und ein spaeter Espresso am Hafen.', 'Positano zeigt sich am Abend von seiner ruhigeren Seite, wenn die Tagesgaeste abgereist sind. Der Spaziergang fuehrt von der Kirche Santa Maria Assunta hinunter zum Strand Spiaggia Grande. Der Rueckweg zum Auto zieht sich bis kurz nach Mitternacht.', '2026-07-19 22:00', '2026-07-20 00:30', 40.6280, 14.4849),

  ('58ccb947-6c2e-4b18-a9cc-47461e47140d', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'weltkulturerbe', 'Ausgrabungen von Pompeji', 'Die vom Vesuv verschuettete Roemerstadt, UNESCO-Welterbe seit 1997.', 'Pompeji zaehlt zu den bedeutendsten archaeologischen Staetten Europas. Ein Rundgang ueber das weitlaeufige Gelaende dauert je nach Tempo zwei bis drei Stunden. Im Hochsommer lohnt sich ein frueher Start wegen der Hitze.', '2026-07-21 09:30', '2026-07-21 12:30', 40.7509, 14.4989),
  ('7052adca-7b5f-4a16-85bd-ca0f4513566e', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'restaurant', 'Abendessen in Sorrent', 'Terrasse mit Blick auf den Golf von Neapel.', 'Ruhiges Lokal etwas abseits der Hauptpromenade mit Fokus auf Zitronen- und Fischgerichten aus der Region. Reservierung fuer den Abend empfohlen.', '2026-07-21 19:30', '2026-07-21 21:00', 40.6263, 14.3757),

  ('8737ced0-85bc-4f4b-a1a6-bcbfd80b631b', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'sehenswuerdigkeit', 'Gaerten der Villa Rufolo in Ravello', 'Terrassengaerten hoch ueber der Kueste, Inspiration fuer Wagners "Parsifal".', 'Die Villa Rufolo liegt oberhalb von Ravello und bietet einen der bekanntesten Ausblicke der Amalfikueste. Die Gaerten sind Schauplatz der jaehrlichen Musikfestspiele. Der Aufstieg vom Parkplatz dauert etwa zehn Minuten.', '2026-07-22 10:00', '2026-07-22 11:30', 40.6497, 14.6114),
  ('51bad801-95b1-4bc9-ade3-74b159058093', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'aktivitaet', 'Wanderung Sentiero degli Dei', 'Der "Weg der Goetter" entlang der Steilkueste zwischen Bomerano und Positano.', 'Einer der bekanntesten Kuestenwanderwege Italiens mit durchgehendem Blick auf Capri und die Steilkueste. Die Strecke ist gut markiert, aber teils ausgesetzt — festes Schuhwerk ist Pflicht. Genug Wasser mitnehmen, da es unterwegs keine Versorgung gibt.', '2026-07-22 13:00', '2026-07-22 16:30', 40.6206, 14.5309),

  ('9ac520c1-6d71-4ee4-a33f-4773a29dabab', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'hotel', 'Check-out und Transfer zum Flughafen Neapel', 'Abreisetag: Zimmeruebergabe und Fahrt zum Flughafen.', 'Check-out ist bis 10 Uhr moeglich, Gepaeck kann bei Bedarf an der Rezeption zwischengelagert werden. Die Fahrt zum Flughafen Neapel dauert je nach Verkehr etwa 70 bis 90 Minuten.', '2026-07-23 09:00', '2026-07-23 10:30', 40.6336, 14.6021),

  -- Wien Staedtereise, 09.-11.10.2026
  ('e563305e-2df4-4deb-b87d-33402c5c68f2', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', 'sehenswuerdigkeit', 'Stephansdom', 'Wiens gotisches Wahrzeichen mit dem markanten Ziegeldach.', 'Der Stephansdom ist das Herzstueck der Wiener Altstadt. Der Aufstieg auf den Sued- oder Nordturm bietet einen weiten Blick ueber die Stadt. Fuehrungen durch die Katakomben starten stuendlich.', '2026-10-09 10:00', '2026-10-09 11:30', 48.2085, 16.3731),
  ('c9828394-5f47-4bf6-a715-a83a3e34d25a', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', 'hotel', 'Check-in Hotel Am Stephansplatz', 'Zentral gelegenes Hotel direkt neben dem Dom.', 'Kurze Wege in alle Richtungen der Innenstadt. Fruehes Check-in ist nach Verfuegbarkeit moeglich, Gepaeckaufbewahrung steht in jedem Fall zur Verfuegung.', '2026-10-09 12:00', '2026-10-09 13:00', 48.2081, 16.3733),
  ('9ac32ffd-35d9-4745-8448-a04c1faee86d', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', 'restaurant', 'Abendessen bei Figlmueller', 'Traditionshaus fuer das klassische Wiener Schnitzel.', 'Bekannt fuer besonders grosse, duenn geklopfte Schnitzel. Es gibt keine Reservierung fuer kleine Gruppen; etwas Wartezeit am Abend einplanen.', '2026-10-09 19:00', '2026-10-09 20:30', 48.2094, 16.3736),

  ('d4f966f7-215e-4e2b-96a3-2414071168e2', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', 'weltkulturerbe', 'Schloss Schoenbrunn', 'Barocke Sommerresidenz der Habsburger, UNESCO-Welterbe seit 1996.', 'Schloss und Schlosspark Schoenbrunn zaehlen zu den meistbesuchten Sehenswuerdigkeiten Oesterreichs. Neben den Prunkraeumen lohnt ein Abstecher zum Palmenhaus und zur Gloriette. Zeitfenster-Tickets vorab online sichern.', '2026-10-10 09:30', '2026-10-10 12:00', 48.1858, 16.3122),
  ('41d6923d-098a-406a-a1a6-8528dab0f56d', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', 'aktivitaet', 'Bummel ueber den Naschmarkt', 'Wiens groesster Markt mit Standln, Delikatessen und Streetfood.', 'Der Naschmarkt erstreckt sich ueber knapp einen Kilometer zwischen Karlsplatz und Kettenbruecke. Samstags kommt zusaetzlich ein Flohmarkt am westlichen Ende dazu.', '2026-10-10 13:00', '2026-10-10 14:30', 48.1974, 16.3651),
  ('9fd9e520-4fbc-46ab-b404-49084b60f676', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', 'restaurant', 'Heuriger in Grinzing', 'Wiener Weinlokal am Stadtrand mit Buffet und Hausweinen.', 'Grinzing liegt am Rand des Wienerwalds und ist mit der Strassenbahn gut erreichbar. Das Buffet wird nach Gewicht abgerechnet, dazu gibt es die hauseigenen Weine aus den umliegenden Weingaerten.', '2026-10-10 19:00', '2026-10-10 21:00', 48.2497, 16.3316),

  ('2861c181-d38e-4f9b-ac05-13e1b9bbe9ff', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', 'aktivitaet', 'Spaziergang im Prater', 'Grosser Wiener Park mit dem historischen Riesenrad.', 'Der Prater ist grossteils frei zugaenglich, der Wurstelprater mit Riesenrad und Fahrgeschaeften liegt am noerdlichen Ende. Ein Spaziergang durch die Hauptallee eignet sich gut fuer den letzten Vormittag vor der Abreise.', '2026-10-11 09:00', '2026-10-11 11:00', 48.2166, 16.3958),
  ('321ee773-d0f0-472d-b5ec-0f54d45ba457', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', 'hotel', 'Check-out', 'Zimmeruebergabe vor der Rueckreise.', 'Check-out ist bis 12 Uhr moeglich. Gepaeck kann bei Bedarf bis zur Abfahrt an der Rezeption bleiben.', '2026-10-11 11:30', '2026-10-11 12:00', 48.2081, 16.3733),

  -- Alpen-Adria-Radtour, 25.-31.05.2026
  ('8de1c39d-7a24-407b-99bc-35a8a316d152', '72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'hotel', 'Check-in in Villach', 'Ausgangspunkt der Radtour am Ufer der Drau.', 'Das Hotel liegt in unmittelbarer Naehe zum Radweg und bietet einen abschliessbaren Fahrradkeller. Rezeption ist bis 20 Uhr besetzt.', '2026-05-25 15:00', '2026-05-25 15:30', 46.6103, 13.8558),
  ('b0fd4a25-7bb0-44cc-b378-d475694a03fd', '72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'aktivitaet', 'Einrollen am Faaker See', 'Kurze Proberunde zum Einstellen der Raeder.', 'Eine flache Runde von rund einer Stunde, um Sattelposition und Gepaeck vor der eigentlichen Etappe noch einmal zu pruefen. Der Faaker See gilt als einer der waermsten Baggerseen Kaerntens.', '2026-05-25 16:00', '2026-05-25 17:30', 46.5675, 13.9214),

  ('c2dcf86b-2e52-4b5b-8731-591c86cab534', '72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'aktivitaet', 'Etappe Villach – Faak am See', 'Erste Etappe entlang des Alpe-Adria-Radwegs.', 'Rund 20 flache Kilometer auf gut ausgebautem Radweg. Die Strecke folgt weitgehend der Drau und bietet mehrere Rastmoeglichkeiten mit Seeblick.', '2026-05-26 09:00', '2026-05-26 12:00', 46.5675, 13.9214),
  ('b19fcbf2-e422-48a6-b2c6-ad6d93c82833', '72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'restaurant', 'Mittagessen am Faaker See', 'Seehuette mit Terrasse direkt am Wasser.', 'Einfache, deftige Kaernter Kueche mit Blick auf den See. Gute Gelegenheit fuer eine laengere Pause nach der ersten Etappe.', '2026-05-26 12:30', '2026-05-26 13:30', 46.5680, 13.9230),
  ('a2c02258-25dc-4c05-8931-9207949572df', '72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'hotel', 'Check-in in Faak am See', 'Uebernachtung direkt am Etappenziel.', 'Kleines Gasthaus mit Fahrradabstellraum und Waschmoeglichkeit fuer die Radbekleidung.', '2026-05-26 16:00', '2026-05-26 16:30', 46.5675, 13.9214),

  ('d5d6c7f5-f301-471c-a628-1908a9e15c60', '72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'aktivitaet', 'Etappe Faak am See – Tarvisio', 'Grenzueberquerung nach Italien mit leichtem Anstieg.', 'Die Etappe fuehrt ueber die Grenze bei Arnoldstein nach Tarvisio und damit erstmals ueber italienisches Gebiet. Ein kurzer Anstieg kurz vor der Grenze ist die einzige nennenswerte Steigung des Tages.', '2026-05-27 09:00', '2026-05-27 13:00', 46.5107, 13.5817),
  ('b71d3faa-671f-42e6-8b31-0ac77de85050', '72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'restaurant', 'Abendessen in Tarvisio', 'Erste italienische Kueche der Tour.', 'Kleines Lokal in der Altstadt von Tarvisio mit Fokus auf Kaernten-Friaul-Grenzkueche — halb oesterreichisch, halb italienisch.', '2026-05-27 19:00', '2026-05-27 20:30', 46.5107, 13.5817),

  ('a4002abe-3dc9-4435-9c13-f5f5a1693258', '72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'weltkulturerbe', 'Langobarden-Tempietto in Cividale del Friuli', 'Fruehmittelalterliches Bauwerk, Teil des UNESCO-Welterbes "Langobarden in Italien".', 'Der Tempietto Longobardo zaehlt zu den bedeutendsten erhaltenen Zeugnissen langobardischer Kunst und ist Teil der seriellen UNESCO-Welterbestaette "Langobarden in Italien, Orte der Macht (568–774 n. Chr.)". Cividale selbst liegt malerisch ueber der Schlucht des Natisone.', '2026-05-28 10:00', '2026-05-28 12:00', 46.0937, 13.4267),
  ('8ef1e2fc-fb8d-4622-8f64-02dc2fa09826', '72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'restaurant', 'Mittagessen in Cividale', 'Friulanische Kueche in der Altstadt.', 'Traditionelles Lokal nahe dem Domplatz mit Fokus auf Frico und friulanischen Weinen.', '2026-05-28 12:30', '2026-05-28 13:30', 46.0937, 13.4267),
  ('288cb6f1-51bd-41e2-81e7-c316c154bb0d', '72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'aktivitaet', 'Weiterfahrt nach Udine', 'Flache Etappe durch das friulanische Huegelland.', 'Rund 18 Kilometer ueberwiegend auf ruhigen Nebenstrassen. Udine bietet am Etappenziel eine sehenswerte Altstadt fuer den Abend.', '2026-05-28 14:30', '2026-05-28 17:00', 46.0693, 13.2346),

  ('ae54ea87-6bbd-46bd-8f71-4305233c40c5', '72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'aktivitaet', 'Etappe Udine – Grado', 'Letzte lange Etappe Richtung Adria.', 'Die Strecke fuehrt durch die friulanische Tiefebene bis an die Kueste. Nach mehreren Tagen im Huegelland ist dies die flachste Etappe der Tour.', '2026-05-30 09:00', '2026-05-30 13:00', 45.6822, 13.3861),
  ('259d4c43-0174-4538-b6c0-032b9f33dba6', '72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'restaurant', 'Fischrestaurant in Grado', 'Frischer Fisch direkt am Hafen der Adria-Inselstadt.', 'Grado liegt auf einer Lagunen-Insel und ist fuer seine Fischkueche bekannt. Das Lokal liegt direkt am alten Hafenbecken.', '2026-05-30 13:30', '2026-05-30 14:30', 45.6822, 13.3861),
  ('fbf67ef0-ac90-41f9-aec6-96157c782c13', '72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'hotel', 'Check-in in Grado', 'Letzte Uebernachtung der Tour, direkt am Meer.', 'Kleines Hotel in Strandnaehe mit gesichertem Fahrradabstellplatz.', '2026-05-30 16:00', '2026-05-30 16:30', 45.6822, 13.3861),

  ('b084f13a-a0ec-4b53-853f-82c95dd714ff', '72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'aktivitaet', 'Rueckfahrt nach Villach', 'Rueckreise per Zug mit Fahrradmitnahme.', 'Statt der langen Ruecketappe im Sattel geht es per Regionalzug mit Fahrradabteil zurueck nach Villach. Reservierung fuer die Fahrradstellplaetze vorab empfohlen.', '2026-05-31 09:00', '2026-05-31 12:00', 46.6103, 13.8558),
  ('2786cb5f-cae8-41a7-b223-b246dd1354d5', '72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'restaurant', 'Abschluss-Mittagessen in Villach', 'Gemeinsamer Ausklang der Tour.', 'Lokal in der Villacher Innenstadt, kurzer Fussweg vom Bahnhof. Guter Abschluss vor der individuellen Heimreise.', '2026-05-31 12:30', '2026-05-31 13:30', 46.6103, 13.8558)
on conflict (id) do nothing;

-- Eine Gruppe aus drei zeitgleichen Alternativen am Nachmittag des 21.07.
-- der Sueditalien Rundreise (zuvor migrations/0006_seed_option_group.sql).
insert into activity (id, trip_id, type, title, short_text, long_text, start_at, end_at, lat, lng) values
  ('1a2b3c4d-0001-4a11-8b11-9f1c2d3e4f01', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'sehenswuerdigkeit', 'Ausgrabungen von Herculaneum', 'Kompaktere und besser erhaltene Nachbarstadt Pompejis.', 'Herculaneum wurde beim selben Vesuv-Ausbruch im Jahr 79 verschuettet wie Pompeji, ist aber deutlich kleiner und dadurch in einem Nachmittag gut zu erkunden. Viele Holzbalken und sogar Lebensmittelreste sind erhalten geblieben.', '2026-07-21 13:30', '2026-07-21 15:00', 40.8065, 14.3486),
  ('1a2b3c4d-0002-4a11-8b11-9f1c2d3e4f02', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'aktivitaet', 'Aufstieg zum Vesuv', 'Wanderung zum Kraterrand mit Blick ueber den Golf von Neapel.', 'Der markierte Weg fuehrt in rund 45 Minuten vom Parkplatz zum Kraterrand des Vesuv. Bei klarer Sicht reicht der Blick bis Neapel und Capri. Festes Schuhwerk ist Pflicht, am Kraterrand kann der Wind kraeftig sein.', '2026-07-21 13:30', '2026-07-21 15:00', 40.8225, 14.4262),
  ('1a2b3c4d-0003-4a11-8b11-9f1c2d3e4f03', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'aktivitaet', 'Bootsausflug zu den Phlegraeischen Feldern', 'Fahrt entlang der vulkanischen Kueste westlich von Neapel.', 'Die Phlegraeischen Felder sind ein aktives Vulkangebiet mit Kratern, heissen Quellen und Schwefeldaempfen direkt an der Kueste. Der Ausflug per Boot zeigt die Kueste vom Wasser aus, inklusive kurzem Stopp zum Baden.', '2026-07-21 13:30', '2026-07-21 15:00', 40.8272, 14.0855)
on conflict (id) do nothing;

-- Ausgangspunkt der Anreise und Rueckreiseziel als gewoehnliche
-- Programmpunkte (zuvor migrations/0017_seed_an_und_abreise.sql).
insert into activity (id, trip_id, type, title, short_text, long_text, start_at, end_at, lat, lng) values
  -- Süditalien Rundreise: Ausgangspunkt der Anreise und Rückreiseziel
  ('ef2aebad-92fd-4990-a08f-a942d211ebf5', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'stadt_dorf', 'Wien', 'Ausgangspunkt der Anreise, Abflug ab Wien-Schwechat.', 'Treffpunkt am Flughafen Wien-Schwechat. Der Weg zum Flughafen ist nicht Teil des Plans; ab hier zählt der Flug nach Neapel als erster Weg des Reisetages.', '2026-07-18 06:00', '2026-07-18 07:00', 48.2082, 16.3738),
  ('30333adc-2838-492b-b1e3-4e44e2a809c0', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'stadt_dorf', 'Wien', 'Rückreiseziel, Ankunft in Wien-Schwechat.', 'Ankunft am Flughafen Wien-Schwechat. Damit endet der gemeinsame Teil der Reise; die Heimwege der Teilnehmer sind nicht Teil des Plans.', '2026-07-23 14:00', '2026-07-23 15:00', 48.2082, 16.3738),

  -- Wien Städtereise: Ausgangspunkt der Anreise und Rückreiseziel
  ('59f7db1c-f1ab-4cbe-847d-1f29125b6282', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', 'stadt_dorf', 'Salzburg', 'Ausgangspunkt der Anreise, Abfahrt am Hauptbahnhof.', 'Start am Salzburger Hauptbahnhof. Der Railjet nach Wien fährt stündlich; Sitzplatzreservierung ist am Wochenende empfehlenswert.', '2026-10-09 06:30', '2026-10-09 07:00', 47.8095, 13.0550),
  ('c0a0ef04-ad7b-437e-b38b-d3d9d05624ee', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', 'stadt_dorf', 'Salzburg', 'Rückreiseziel, Ankunft am Hauptbahnhof.', 'Ankunft am Salzburger Hauptbahnhof. Von dort ist die Altstadt in einer Viertelstunde mit dem Obus erreichbar.', '2026-10-11 15:00', '2026-10-11 15:30', 47.8095, 13.0550)
on conflict (id) do nothing;

-- Transfers aller vier Verkehrsmittel an der Sueditalien-Rundreise
-- (zuvor migrations/0009_seed_transfers.sql).
insert into transfer (id, trip_id, from_activity_id, to_activity_id, mode, title, duration_min, distance_km) values
  ('794bb711-2d4e-4be9-8777-61d4477bcd1c', 'd5fda5ea-65e7-4b47-8096-62618599a288', '6460c010-7440-4c0a-a598-197b306cacf1', '384d0b94-df7f-44b3-8bcf-013b41a6d265', 'fuss', 'Spaziergang zum Hafen', 8, 0.4),
  ('4879b2a4-d673-4d70-97c2-f5d0cb505f04', 'd5fda5ea-65e7-4b47-8096-62618599a288', '384d0b94-df7f-44b3-8bcf-013b41a6d265', 'deaacefe-9cc1-4835-9be5-5b23a231720c', 'auto', 'Fahrt zum Aussichtspunkt', 12, 4.2),
  ('0d1ff257-e95a-4622-8643-72524c0c6cb0', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'deaacefe-9cc1-4835-9be5-5b23a231720c', '6d0ed984-d2dc-48a5-b298-780ceabd9f6f', 'bus', 'Bus zum Hotel', 10, 1.1),
  ('f7c977e1-ad68-4ed0-8a1b-83f421bd3c8b', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'c754341c-0bb1-45dc-84f4-ea26fbe88eaf', '9a372af3-1719-49e1-8a00-cda91d8e1bbd', 'boot', 'Bootsfahrt zurück nach Positano', 60, 18.5)
on conflict (id) do nothing;

-- Der Zielpunkt eines der Transfers bekommt bewusst keine Position, damit
-- sich auch der Fall "keine Route-Schaltflaeche" pruefen laesst.
update activity set lat = null, lng = null
  where id = '9a372af3-1719-49e1-8a00-cda91d8e1bbd'; -- Abendlicher Stadtbummel in Positano

-- An- und Abreise als Transfer, dazu eine Faehre zwischen zwei
-- Programmpunkten (zuvor migrations/0017_seed_an_und_abreise.sql).
insert into transfer (id, trip_id, from_activity_id, to_activity_id, mode, title, duration_min, distance_km) values
  -- Anreise und Abreise der Süditalien-Rundreise
  ('27f82c9d-dbb6-40bc-aeb0-33079b8a51fe', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'ef2aebad-92fd-4990-a08f-a942d211ebf5', '6460c010-7440-4c0a-a598-197b306cacf1', 'flug', 'Flug Wien–Neapel', 105, 815.0),
  ('cbfe46be-dd44-4cdd-b3db-6a516d393732', 'd5fda5ea-65e7-4b47-8096-62618599a288', '9ac520c1-6d71-4ee4-a33f-4773a29dabab', '30333adc-2838-492b-b1e3-4e44e2a809c0', 'flug', 'Flug Neapel–Wien', 105, 815.0),
  -- Fähre am zweiten Reisetag, zurück zum Anleger von Capri
  ('e7edab3d-4355-4f2e-a598-720e3d0180cd', 'd5fda5ea-65e7-4b47-8096-62618599a288', '88299abd-b4c7-4459-8a47-cb1b919c41a2', 'c754341c-0bb1-45dc-84f4-ea26fbe88eaf', 'faehre', 'Fähre nach Marina Grande', 15, 1.4),
  -- Anreise und Abreise der Wien-Städtereise
  ('5a7ce065-e7c4-4572-8e2c-777118a27fc3', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', '59f7db1c-f1ab-4cbe-847d-1f29125b6282', 'e563305e-2df4-4deb-b87d-33402c5c68f2', 'bahn', 'Railjet Salzburg–Wien', 155, 295.0),
  ('bf23a2b2-8bf2-4d2b-ab92-9f2484dc63aa', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', '321ee773-d0f0-472d-b5ec-0f54d45ba457', 'c0a0ef04-ad7b-437e-b38b-d3d9d05624ee', 'bahn', 'Railjet Wien–Salzburg', 155, 295.0)
on conflict (id) do nothing;

-- POIs der drei Reisen (zuvor migrations/0011_seed_pois.sql). Die zwoelf
-- POIs der Sueditalien Rundreise entsprechen 1:1 den Demo-Daten aus
-- delivery/design/planer/Reiseplaner v4.dc.html (State.pois). Die Nummer je
-- Reise stand zuvor in migrations/0014_poi_number.sql; sie steht hier gleich
-- in der Zeile, weil die Spalte inzwischen gefuellt sein muss.
insert into poi (id, trip_id, name, ort, type, lat, lng, status, web, number) values
  -- Suditalien Rundreise
  ('8239130e-73ab-4d3f-a52a-0829a65ef7e3', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Altstadt & Spaccanapoli', 'Neapel', 'stadt_dorf', 40.8518, 14.2681, 'gesetzt', 'https://www.visitnaples.eu', 1),
  ('462f6811-13cc-4247-99aa-8b9693955ab7', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Ausgrabungsstätte Pompeji', 'Pompei', 'sehenswuerdigkeit', 40.7489, 14.4989, 'gesetzt', 'https://pompeiisites.org', 2),
  ('f5901c9b-e7a3-4c19-b636-3a86e16c3d91', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Trattoria da Nennella', 'Neapel', 'restaurant', 40.8467, 14.2497, 'wahrscheinlich', null, 3),
  ('ddf861cc-d73a-40f3-8fc6-1996b2aa8e62', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Positano & Amalfiküste', 'Positano', 'stadt_dorf', 40.6280, 14.4850, 'wahrscheinlich', null, 4),
  ('b6652937-9196-4a63-ab17-5edfdda66642', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Villa Rufolo', 'Ravello', 'sehenswuerdigkeit', 40.6490, 14.6120, 'weiss_nicht', 'https://www.villarufolo.com', 5),
  ('bef01b0c-5c57-47a8-9e61-7dcedf5adf1d', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Griechische Tempel', 'Paestum', 'sehenswuerdigkeit', 40.4203, 15.0055, 'wenn_zeit', 'https://museopaestum.cultura.gov.it', 6),
  ('4137c2d0-0bc9-41bb-998a-2cf9eaac4edf', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Sassi di Matera', 'Matera', 'sehenswuerdigkeit', 40.6664, 16.6104, 'gesetzt', 'https://www.materaturismo.it', 7),
  ('264b8e02-6db1-40b5-9d33-c162d995becb', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Trulli-Viertel Rione Monti', 'Alberobello', 'sehenswuerdigkeit', 40.7847, 17.2376, 'wahrscheinlich', null, 8),
  ('a8fdda3c-af88-48f8-a41a-041d0f7775c5', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Lama Monachile', 'Polignano a Mare', 'strand', 40.9964, 17.2205, 'wahrscheinlich', null, 9),
  ('faa7f937-7f96-4162-ba25-64875d0bde27', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Grotte di Castellana', 'Castellana Grotte', 'aktivitaet', 40.8697, 17.1631, 'weiss_nicht', 'https://www.grottedicastellana.it', 10),
  ('574fdc61-18fd-40b4-8ebc-68b99acef511', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Weiße Altstadt', 'Ostuni', 'stadt_dorf', 40.7290, 17.5786, 'wenn_zeit', null, 11),
  ('097a64c2-0a50-4401-a976-a42d94d88815', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Barock-Altstadt', 'Lecce', 'stadt_dorf', 40.3529, 18.1743, 'auf_keinen_fall', null, 12),

  -- Wien Staedtereise
  ('25667132-5130-4e9a-b96b-cef44ff8da53', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', 'Stephansdom', 'Wien', 'sehenswuerdigkeit', 48.2085, 16.3731, 'gesetzt', null, 1),
  ('9faf3dd7-08fa-4c48-8390-944a987a2f9a', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', 'Schloss Schönbrunn', 'Wien', 'weltkulturerbe', 48.1858, 16.3122, 'gesetzt', 'https://www.schoenbrunn.at', 2),
  ('7a44303e-d0e4-4b5b-a9ab-0711686f8168', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', 'Naschmarkt', 'Wien', 'aktivitaet', 48.1974, 16.3651, 'wahrscheinlich', null, 3),
  ('a59a0565-f0be-4403-9f14-3b2e151ca6fe', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', 'Hotel Am Stephansplatz', 'Wien', 'hotel', 48.2081, 16.3733, 'gesetzt', null, 4),

  -- Alpen-Adria-Radtour
  ('71df42c9-aefe-4749-8bff-804e054e2666', '72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'Faaker See', 'Faak am See', 'strand', 46.5675, 13.9214, 'wahrscheinlich', null, 1),
  ('99849e53-22cd-4d6c-85b5-e1ed737583d9', '72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'Altstadt Villach', 'Villach', 'stadt_dorf', 46.6103, 13.8558, 'gesetzt', null, 2),
  ('0b872a41-818f-48e4-bcef-6343b9ab216e', '72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'Langobarden-Tempietto', 'Cividale del Friuli', 'weltkulturerbe', 46.0937, 13.4267, 'wenn_zeit', null, 3),
  ('147b0c81-9e5e-403d-9103-d28548d4efb4', '72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'Lagune von Grado', 'Grado', 'strand', 45.6822, 13.3861, 'weiss_nicht', null, 4)
on conflict (id) do nothing;

-- Die vier Buchungsfaelle aus req-005 an vier Programmpunkten der
-- Sueditalien-Rundreise (zuvor migrations/0007_activity_booking.sql).
update activity set booked = true
  where id = '6460c010-7440-4c0a-a598-197b306cacf1'; -- Dom von Amalfi
update activity set booking_url = 'https://www.ristorantelamarinella.it'
  where id = '384d0b94-df7f-44b3-8bcf-013b41a6d265'; -- Mittagessen bei La Marinella
update activity set booking_email = 'info@lunaconvento.it'
  where id = '6d0ed984-d2dc-48a5-b298-780ceabd9f6f'; -- Check-in Hotel Luna Convento
update activity set booking_phone = '+39 089 871483'
  where id = 'deaacefe-9cc1-4835-9be5-5b23a231720c'; -- Aussichtspunkt Amalfikueste

-- Programmpunkte, die aus einem POI entstanden sind (zuvor
-- migrations/0012_activity_poi_link.sql).
update activity set poi_id = '462f6811-13cc-4247-99aa-8b9693955ab7' -- Ausgrabungsstaette Pompeji
  where id = '58ccb947-6c2e-4b18-a9cc-47461e47140d'; -- Ausgrabungen von Pompeji
update activity set poi_id = 'b6652937-9196-4a63-ab17-5edfdda66642' -- Villa Rufolo
  where id = '8737ced0-85bc-4f4b-a1a6-bcbfd80b631b'; -- Gaerten der Villa Rufolo in Ravello

update activity set poi_id = '25667132-5130-4e9a-b96b-cef44ff8da53' -- Stephansdom
  where id = 'e563305e-2df4-4deb-b87d-33402c5c68f2'; -- Stephansdom
update activity set poi_id = '9faf3dd7-08fa-4c48-8390-944a987a2f9a' -- Schloss Schoenbrunn
  where id = 'd4f966f7-215e-4e2b-96a3-2414071168e2'; -- Schloss Schoenbrunn
update activity set poi_id = '7a44303e-d0e4-4b5b-a9ab-0711686f8168' -- Naschmarkt
  where id = '41d6923d-098a-406a-a1a6-8528dab0f56d'; -- Bummel ueber den Naschmarkt
update activity set poi_id = 'a59a0565-f0be-4403-9f14-3b2e151ca6fe' -- Hotel Am Stephansplatz
  where id = 'c9828394-5f47-4bf6-a715-a83a3e34d25a'; -- Check-in Hotel Am Stephansplatz

update activity set poi_id = '0b872a41-818f-48e4-bcef-6343b9ab216e' -- Langobarden-Tempietto
  where id = 'a4002abe-3dc9-4435-9c13-f5f5a1693258'; -- Langobarden-Tempietto in Cividale del Friuli

-- Der Betreiber ist Reiseleiter aller drei Reisen: eine Reise hat immer
-- mindestens einen (zuvor migrations/0020_trip_participant.sql). Die Aliase
-- halten die beiden id-Spalten auseinander; ohne sie greift die
-- Fremdschluesselpruefung des Test-Doubles (pg-mem) auf die falsche zu.
insert into trip_participant (trip_id, participant_id, role)
select t.id as trip_id, p.id as participant_id, 'reiseleiter' as role
from trip t
join participant p on p.account_id = t.account_id
where p.login_enabled
on conflict do nothing;
