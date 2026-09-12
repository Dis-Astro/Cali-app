# Super Power Gym — checklist unica

Aggiornamento: 11 settembre 2026. Non confondere codice locale, test, pubblicazione e installazione.

## Inventario iniziale
Inventario storico: per lo stato corrente leggere l'ultima sezione del registro; non ripetere le verifiche già superate senza una modifica pertinente.
- Implementato: ruoli cliente/coach/admin, schede, commenti e valutazioni, timer, video nativo, corsi e gestione presenze. Esistenza nel codice non equivale a collaudo completo.
- Difettoso: aggiornamenti concorrenti della coda offline; invio della coda senza filtro account; promemoria con scadenza fissa non coerente con la lezione.
- Incompleto: regole corsi unificate lato server anche per staff; notifiche affidabili oltre le lezioni caricate; fonte unica web/iOS.
- Non verificato: permessi effettivi del database reale, backup/ripristino, tutti i flussi su iPhone e produzione.

## Ordine di lavoro e criteri di chiusura
- [ ] Sicurezza: matrice permessi per ruolo, verifica RLS/funzioni, sessioni e cambio account, dati locali e dipendenze.
- [ ] Offline: nessuna perdita con accodamenti concorrenti o durante invio; inviare solo dati dell'utente autenticato; recupero dopo riavvio; idempotenza server.
- [ ] Corsi: capienza atomica anche per staff, storico corretto, scadenze e fuso coerenti, conferme/rinunce e contatori verificati.
- [ ] Allenamento: timer, audio, valutazioni arretrate, riprese e galleria; test dei permessi negati e delle interruzioni su dispositivo.
- [ ] Rilascio: fonte unica, ambienti separati, migrazioni additive, backup e ripristino verificati, test completi, build iOS e collaudo reale.

## Vincoli di rilascio
- Accesso al Supabase di produzione non disponibile nelle verifiche precedenti: riconfermare prima di qualsiasi intervento remoto.
- Obiettivo chiarito dall'utente: migrare dal database gestito da Lovable a un ambiente definitivo sotto il suo controllo. Esportazione completa autorizzata, trasferimento di account/dati/file, recupero degli aggiornamenti intervenuti, collaudo e passaggio coordinato web/iOS prima di dismettere il vecchio. Tenere separati test e nuova produzione; non puntare il sito a uno staging incompleto. Verificare accesso al progetto Lovable/export disponibile.
- Non modificare firma/identificativi Xcode, eliminare branch o pubblicare modifiche al database senza le verifiche previste.
- Produzione, GitHub e dispositivo non aggiornati da questa sessione finché non indicato esplicitamente qui.

## Registro delle verifiche
- Stato iniziale: main pulito, commit 403813d. Sei file di test esistenti; copertura critica da ampliare.

### Blocco locale del 5 settembre
- [x] Coda: transazioni di scrittura coordinate; revisioni distinte impediscono che una risposta vecchia cancelli una nota nuova; operazioni filtrate sull'utente autenticato prima dell'invio.
- [x] Login: risposte tardive del profilo/sessione non ripristinano l'account dopo logout o cambio utente; ripristino offline coperto da test.
- [x] Corsi: conteggi distinti per confermati e in attesa; storico basato sulle prenotazioni registrate, non sulle assegnazioni attuali; errori di caricamento non diventano zeri fittizi.
- [x] Orari: corrispondenza posti fissi in Europe/Rome; promemoria basati sulla scadenza della lezione; anche venerdì, sabato e domenica visibili.
- [x] Promemoria: consenso separato per account, cancellazione al logout e quando non rimangono lezioni. Dopo l'aggiornamento occorre riattivarli con “Avvisami”. Restano notifiche locali, non un servizio push centralizzato.
- [x] Video: test del pulsante normale e compatto, permessi negati, annullamento e conferma del salvataggio; nessun messaggio di successo senza conferma della galleria.
- [x] Dipendenze: aggiornamenti mirati del lockfile; audit npm passa da 3 segnalazioni a 0. Non equivale a certificazione di sicurezza dell'app.
- [x] Installazione dipendenze in CI resa ripetibile con npm ci; nessuna pipeline remota avviata.
- [x] Verifica finale dopo installazione pulita npm ci: 40 test passati in 11 file; controllo TypeScript passato; lint senza errori (41 avvisi preesistenti da valutare); build web passata anche con gli ultimi aggiornamenti promemoria.
- [x] Build iOS per simulatore riuscita con gli asset web aggiornati. Il download dei componenti nativi ha richiesto alcuni minuti. Capacitor Swift riallineato alla versione 8.3.1 bloccata nelle dipendenze JavaScript (il precedente Package.swift indicava 8.5.0). Firma e identificativi non modificati.
- [ ] Database: aggiunta migrazione 20260905090000_protect_profile_identity.sql contro auto-promozione e cambio identità. Script di regressione supabase/tests/profile_identity.sql preparato, NON eseguito né applicato al database reale.

### Rischi ancora aperti: non certificare come versione definitiva
1. Le migrazioni originarie permettono al proprietario di aggiornare il profilo senza protezione esplicita del ruolo: la migrazione preparata va collaudata e applicata con priorità. Verificare prima eventuali protezioni già presenti sul server.
2. Le scritture staff sui corsi non hanno ancora tutte le garanzie atomiche della procedura cliente; servono test su PostgreSQL di prenotazioni simultanee e assegnazioni fisse concorrenti.
3. La coda mantiene il formato precedente per non perdere note esistenti. Non è ancora garantita l'idempotenza tra dispositivi diversi; il totale visualizzato della coda e i metadati non sono ancora separati per account. Preferences non è un archivio cifrato.
4. L'orario delle regole è italiano, ma alcune etichette e l'intervallo settimanale usano ancora il fuso del dispositivo. Le disponibilità occasionali vanno distinte dai posti totali riservati ai fissi.
5. Restano da verificare tutti i permessi per coach/clienti e i flussi reali (audio, camera, interruzioni, galleria e revoca sessione). I test video simulano il servizio nativo, non una ripresa reale.
6. Non è stata modificata la configurazione di pubblicazione dei due repository: la fonte unica richiede coordinare il repository collegato al sito, senza interromperlo.

## Istruzioni operative attuali
- Coach: Calendario → Turni e presenze. “Confermati / presenti” conta le risposte positive; “Da confermare” conta chi deve ancora rispondere. Aprire “Gestisci posti fissi e occasionali” nelle lezioni future per assegnare la ricorrenza. Lo storico non inventa risposte mancanti.
- Cliente corso: nella scheda settimanale usare “Partecipo” / “Non partecipo” oppure prenotare un posto occasionale; rispettare la scadenza della singola lezione. “Avvisami” abilita i promemoria locali, non conferma automaticamente la presenza.
- Amministratore: verificare la configurazione dei posti fissi/occasionali prima delle assegnazioni. Non pubblicare le migrazioni senza test su staging, inventario delle regole reali, backup verificato e piano di ripristino.
- Ripristino: conservare la versione precedente dell'app; preferire una correzione additiva del database. Non rimuovere la protezione dei ruoli per effettuare un rollback dell'interfaccia.
- Accessi necessari: account autorizzato al Supabase di produzione e iPhone di Roberto raggiungibile/sbloccato. Il 5 settembre devicectl lo rileva come unavailable; non usare l'iPad di un altro utente come sostituto.

## Timer — revisione del 7 settembre
**Superata dalla verifica diretta del 9–10 settembre:** il doppio avvio e l'assenza del riposo finale Tabata erano stati interpretati erroneamente. I dettagli sotto documentano la vecchia revisione, non il comportamento attuale.
Riferimento funzionale studiato: https://smartwod.app/ e https://smartwod.app/custom-workout-timer (documentazione pubblica; non collaudo diretto della loro app).
- [x] Scelta immediata AMRAP, FOR TIME, EMOM, Tabata; mantenuto countdown per recupero. Configurazione distinta dalla scelta modalità.
- [x] Avvio fissato fuori dall'area a scorrimento, con preparazione di 10 secondi senza un secondo pulsante di partenza.
- [x] Selezione minuti/secondi senza tastiera, precisione al secondo (nessun arrotondamento a 10 secondi).
- [x] Ultime impostazioni salvate separatamente per modalità, con validazione e ripiego sicuro se lo storage non funziona.
- [x] Note esercizio richiudibili, cifre grandi, layout orizzontale con comandi laterali; pausa, ripresa e conclusione disponibili in tutte le modalità.
- [x] Preparazione basata sull'orologio reale; nessuna partenza tardiva dopo annullamento/smontaggio; verificato anche React StrictMode.
- [x] Tabata: cicli completi lavoro/recupero, incluso l'ultimo recupero. Il classico 20/10 × 8 dura 4:00; prima terminava a 3:50.
- [x] Ripristino solo con configurazione coerente: non recuperare il tempo di una durata diversa. Pausa esclusa dal conteggio. Stato legacy privo di configurazione non viene ripreso automaticamente.
- [x] Apertura valutazione esercizio una sola volta a fine timer; registrazione video mantenuta dal timer. Il timer isolato senza esercizio conserva il riepilogo finale.
- [x] Verifica visiva locale a 375×667 e 667×375: avvio raggiungibile e comandi in orizzontale visibili. Test automatici per configurazione, avvio, pausa/ripresa, annullamento, valutazione e persistenza.
- [x] Controllo completo TypeScript/lint/test/build web superato. Nessun nuovo avviso nei file timer; restano gli avvisi precedenti del progetto.
- [x] Verifica finale: 49 test superati in 13 file, build web e iOS simulatore riuscite con gli asset aggiornati. Anteprima locale isolata in build/timer-preview.html, esclusa dalla pubblicazione; server solo su 127.0.0.1:5173. Nessun dato cliente modificato dai test del timer.
- [ ] Collaudo audio, fotocamera, blocco schermo e interruzioni telefoniche su iPhone reale (ancora unavailable il 7 settembre).
- Limiti espliciti: non è una replica integrale di SmartWOD. MIX, preset nominati, Apple Watch, TV e audio garantito con app sospesa non implementati da questa revisione. Nessuna promessa di parità in background senza lavoro nativo e collaudo.
- Pubblicazione sito e migrazione database non eseguite con questa revisione del timer.

### Segnalazione duplicati e AMRAP — 7 settembre
- [x] Simulatore iPhone 17 Pro 2D75E861: identificata copia it.superpowergym.app con asset del 31 agosto e copia dev.rdisante del 7 settembre. Rimossa solo la prima dopo copia e confronto integrale di app e contenitore dati in build/backup-simulator-old-20260907 (locale, esclusa da Git, cartella privata). Backup recuperabile, non sincronizzato automaticamente con l'altra app.
- [x] AMRAP: spiegazione dei giri prima dell'avvio, etichetta “Giri completati”, conteggio disabilitato durante preparazione e dopo conclusione. Test dedicato superato; controllo completo TypeScript/lint/test/build web superato.
- [ ] Duplicato iPhone reale: non ispezionabile né rimosso perché iPhone di Roberto non raggiungibile. Occorre identificarne i contenitori e proteggere eventuali note offline prima della disinstallazione.
- [ ] La segnalazione “non è andata a buon fine” non identifica ancora un errore riproducibile: non considerarla risolta dalla sola build. L'anteprima timer non è la webapp pubblicata né il collaudo autenticato dell'app.

### Correzione ripetizioni AMRAP — 7 settembre
- [x] Aggiunto “Ripetizioni per serie” (1–200, selettore senza tastiera), distinto dai giri completati. Il valore scelto appare prima dell'avvio e durante preparazione, lavoro e pausa; ricordato nelle impostazioni AMRAP.
- [x] Compatibilità con impostazioni precedenti: tempi conservati, valore ripetizioni predefinito 10 se assente/non valido. Nessun ripristino di un AMRAP con obiettivo ripetizioni diverso.
- [x] Test del flusso completo selezione 15 rep → preparazione → conteggio giri → pausa, persistenza/valori non validi e ripristino. 53 test superati in 13 file; TypeScript, lint (0 errori, 41 avvisi preesistenti), build web e build iOS superati.
- [x] Verifica visiva browser a 375×667: campo ripetizioni e avvio visibili, 15 rep visibili nel timer in pausa. App aggiornata e avviata nel simulatore esistente, senza seconda installazione.
- [ ] Non pubblicato sul sito né installato sull'iPhone reale, ancora irraggiungibile. Nessuna modifica database.

## Candidata installata su iPhone — 8 settembre
- [x] Timer: ripetizioni AMRAP selezionabili; giri completati salvati con il timer e recuperati dopo riavvio, senza includere il tempo in pausa. Ripristino separato per utente/esercizio; cronometro mostra solo secondi realmente trascorsi; niente feedback audio tardivo dopo chiusura.
- [x] Offline: conteggi/metadati separati per account, invio coordinato tra schede browser, ripresa dopo autenticazione; coda illeggibile conservata e segnalata invece di sovrascriverla. Upsert sulla chiave univoca prevista dallo schema, con conferma della riga restituita prima di rimuovere la nota dalla coda. Resta da verificare il vincolo sul database reale; conflitti di contenuto fra dispositivi diversi restano last-writer-wins.
- [x] Corsi: pending distinto da confermato con pulsante Partecipo, disponibilità per categoria, errori di caricamento espliciti; calendario/scadenze Europe/Rome e aggiornamento al cambio giorno; protezione dalle risposte tardive per un altro account. Test componenti cliente/coach e calcolo posti.
- [x] Build: controllo coerenza URL/progetto/chiave pubblica, identificativo versione in login/Aiuto e build-info.json senza segreti. Il database della build resta quello attuale dvjhcdmuuuwepayaatup; nessun passaggio a staging implicito.
- [x] Verifica finale locale: 103 test superati in 18 file, TypeScript superato, lint 0 errori e 41 avvisi preesistenti, build web e build iPhone firmata riuscite.
- [x] Installata e avviata su iPhone di Roberto (iPhone 13) l'8 settembre alle 15:02, aggiornando it.superpowergym.app.dev.rdisante con team R79HPK63WH invariato. Xcode rilevava una sola copia Super Power Gym, quindi nessuna disinstallazione sul telefono. Identificativo build 60fe079adc97-local, generata 2026-09-08T13:00:58.060Z.
- [x] Verifica avvio reale: dopo un primo controllo senza processo (causa non determinata), riapertura con diagnostica conferma WebView caricata e processo attivo; nessun indicatore fatal/TypeError/ReferenceError nei log osservati. Log diagnostici locali esclusi da Git e con permessi limitati. Non equivale a prova completa dei flussi.
- [x] Utente conferma “funziona” aprendo l'app dall'icona sull'iPhone (8 settembre). Il controllo filtrato sul percorso del processo non basta a diagnosticare un crash; nessun crash attribuito all'app sulla sola assenza dall'elenco.
- [ ] Collaudo utente su iPhone: AMRAP e pausa/ripresa, audio, video e salvataggio Foto, riapertura offline con scheda/note. Avvio del processo non equivale al collaudo di questi flussi.
- [ ] Sicurezza database: preparata migrazione 20260908090000_workout_completion_ownership.sql per vietare valutazioni su esercizi di altri clienti; regressioni SQL profili/proprietà ampliate. NON eseguite/applicate: PostgreSQL locale assente e accesso/export originale da completare.
- [ ] Produzione: sito, GitHub e database NON aggiornati da questa installazione. Restano aperti autorizzazioni reali, concorrenza staff sui corsi, backup/ripristino, trasferimento Lovable e coordinamento fonte unica web/iOS. Non dichiarare concluso il rilascio definitivo.

## Candidata del 10 settembre — verifica diretta SmartWOD
- Riferimento: app ufficiale SmartWOD Timer 1.46.4 (802), installata dal Mac App Store e osservata direttamente. Nessuna estrazione di sorgenti, asset o elusione di funzioni a pagamento. Verificati home, configurazioni, selettori, partenza, pausa/ripresa, FOR TIME con recupero e ingresso nel costruttore MIX.
- [x] AMRAP: durate individuali e riposi solo tra set, anche zero; aggiunta/rimozione set. Obiettivo ripetizioni facoltativo mantenuto come personalizzazione SPG, distinto dai set e dai round completati.
- [x] EMOM: intervallo e durata complessiva distinti, ultimo intervallo eventualmente parziale, set e recuperi, Death By senza limite con conclusione esplicita.
- [x] Tabata: 20/10 × 8 termina a **3:50**, come nell'app osservata; 3 set con 2 minuti di recupero durano **15:30**. Nessun recupero dopo l'ultimo round/set.
- [x] FOR TIME: conteggio crescente, cap facoltativo, set/recuperi e segnale periodico. Swipe conclude solo il set corrente; tempo del set concluso e riposo conservati nel ripristino dopo pausa/riavvio.
- [x] MIX: blocchi lavoro/riposo e quattro modalità, etichette, riordino, duplicazione, ripetizione del blocco o dell'intera sequenza; preset nominati sul dispositivo separati per account. Limite esplicito di complessità evita sequenze che bloccano l'interfaccia.
- [x] Interazione: configurazione → schermata pronta → Play → 10 secondi di preparazione; tap sul quadrante per pausa/ripresa senza nuova preparazione; avvio fisso, selettori a scorrimento senza tastiera numerica, video dal timer e valutazione solo alla conclusione dell'intera sequenza.
- [x] Prova browser 375×667 e 667×375: configurazione compatta, selettori, preparazione, conclusione AMRAP con callback valutazione e swipe FOR TIME verificati. Corretta discrepanza secondi/millisecondi nelle etichette dei selettori e aggiunto test.
- [x] Persistenza: impronta configurazione indipendente dall'ordine delle proprietà; timer separato per account/esercizio; ripristino degli anticipi FOR TIME; wake lock tardivo rilasciato se il timer è già in pausa; audio muto rispettato anche durante preparazione.
- [x] Privacy nativa: disabilitato logging dei payload del bridge Capacitor, che possono includere contenuti Preferences. Non cambia firma, identificativo o archivio dati.
- [x] Test locali: **116 test in 18 file superati**, TypeScript superato. Comprendono timer, sessioni, coda offline, cambio account, corsi, permessi video simulati e configurazione ambiente. Non equivalgono a test SQL o collaudo hardware.
- [ ] Non certificare parità integrale SmartWOD: raggruppamenti MIX annidati, Watch/TV e audio con app sospesa non implementati/verificati. I video reali, le interruzioni telefoniche e il blocco schermo richiedono collaudo iPhone.
- [ ] Rilascio definitivo ancora aperto: accesso/export del database originale Lovable, verifica RLS e concorrenza staff su PostgreSQL, backup/ripristino, migrazione con recupero aggiornamenti e riallineamento del sito. Nessun database cambiato o dismesso, nessun dato o branch cancellato.
- [ ] iPhone di Roberto non raggiungibile il 10 settembre: l'installazione dell'8 settembre NON contiene questa revisione.
- [x] Candidata compilata `9ae58118c3f7`, generata il 10 settembre alle 08:56:56 UTC: build web, iOS simulatore e iPhone firmata riuscite; firma verificata e build-info identico nei tre pacchetti. Identificativo `it.superpowergym.app.dev.rdisante` invariato. Applicazione pronta in `build/DerivedDataDevice/Build/Products/Debug-iphoneos/App.app`.
- [x] Installata e avviata sul simulatore iPhone 17 Pro esistente, senza duplicare app: home autenticata visibile con sessione mantenuta. Non equivale a collaudo completo del timer con fotocamera/audio su hardware.
- [x] Codice pubblicato su GitHub nel ramo `codex/consolidamento-affidabilita-2026-09-05`, senza merge su main né build remote avviate dall'agente. Il sito superpowergym.it e il repository separato collegato al sito non sono aggiornati da questo push.

### Uso rapido della candidata
- Cliente: Timer → modalità → tempi/set → AVVIA IL TIMER → Play. Toccare il quadrante per pausa/ripresa; FOR TIME e Death By terminano con lo scorrimento in basso. Nell'esercizio, al termine si apre la valutazione. Video apre la registrazione nativa con salvataggio in Foto, subordinato ai permessi.
- Coach: Calendario → Turni e presenze; distinti confermati, da confermare e disponibilità per fissi/occasionali. Gestisci posti fissi e occasionali per le assegnazioni; le conferme del cliente restano esplicite.
- Amministratore: la candidata non abilita il cambio database. Prima della produzione servono backup verificato, staging completo con autorizzazioni e concorrenza collaudate, passaggio coordinato web/iOS e conservazione del vecchio ambiente per ripristino. Non condividere chiavi o esportazioni in chat.

## Candidata del 12 settembre — MIX e accessi verificati
- [x] Installata sull'iPhone di Roberto il 12 settembre alle 11:01 la candidata `e4bdeb156ef9`, aggiornando `it.superpowergym.app.dev.rdisante` senza disinstallazione.
- [ ] Avvio remoto rifiutato da iOS per sicurezza (firma/entitlements/fiducia del profilo). Firma locale valida, application-identifier corretto, profilo valido fino al 19 settembre 2026 08:55 UTC. Occorre aprire dall'icona e verificare l'eventuale richiesta di autorizzazione sviluppatore sul telefono; non attribuire ancora l'errore a un crash dell'app. Collaudo hardware non eseguito.
- [x] MIX: gruppi ripetibili annidati, etichette e modifica ricorsiva, conservati nei preset. Limiti: 3 livelli di gruppi, 80 nodi, 5000 intervalli espansi; rifiutati gruppi vuoti, cicli e configurazioni eccessive. Test di durata, confini, persistenza e creazione nell'interfaccia.
- [x] Verifica completa: 119 test in 18 file superati, TypeScript superato, lint 0 errori e 41 avvisi preesistenti.
- [x] Dashboard autenticata: staging `fyrzzuswjgtwoctovker` accessibile e con tabelle presenti. L'apertura del progetto originale `dvjhcdmuuuwepayaatup` reindirizza all'organizzazione, che non lo elenca. L'accesso allo staging NON dà accesso al database della webapp. Nessuna modifica remota eseguita.
- [ ] Servono accesso/export autorizzato del progetto originale Lovable, backup con ripristino provato, confronto dello schema e passaggio coordinato del sito e dell'app. Non dismettere il vecchio progetto prima di questi controlli.
- [ ] iPhone di Roberto non raggiungibile al controllo del 12 settembre. Audio durante sospensione/blocco schermo, video e interruzioni ancora da collaudare; parità integrale SmartWOD NON certificata. Watch/TV non sono requisiti del rilascio iPhone.
- [x] Anteprima ripristinata in una nuova scheda locale: creazione gruppo 3×1 minuto = 03:00, aggiunta gruppo interno 3×1 minuto = 12:00 complessivi, apertura schermata pronta con Play e durata corretta verificata anche visivamente. Non è un collaudo completo su schermo iPhone.
- [x] Codice `e4bdeb156ef9` pubblicato sul ramo di consolidamento; build web e simulatore riuscite. Aggiornata e avviata la stessa app nel simulatore iPhone 17 Pro, senza duplicazione. Nessun rilascio del sito o modifica del database.
- [x] Accesso Apple Developer ripristinato dall'utente il 12 settembre. Build iPhone riuscita dopo recupero automatico del profilo; firma verificata, team `R79HPK63WH` e identificativo `it.superpowergym.app.dev.rdisante` invariati. Pacchetto aggiornato `build/DerivedDataDevice/Build/Products/Debug-iphoneos/App.app`, revisione `e4bdeb156ef9`, con nuovi gruppi MIX. Non ancora installato: iPhone di Roberto ancora non raggiungibile al controllo successivo alla build.

## Database — chiusura verifiche locali dell'11 settembre
- [x] Superato il limite tecnico precedente: predisposto PostgreSQL reale locale isolato, accessibile solo su loopback, con dati sintetici. Strumenti di test separati in `build/server-tests`, senza aggiungere dipendenze all'app. Database arrestato automaticamente al termine; nessuna connessione alla produzione.
- [x] Nuova migrazione additiva `20260911090000_course_capacity_guards.sql`: controlli di capienza anche sulle scritture dirette staff, blocco prenotazioni concorrenti cliente/staff, limiti totale/fissi/occasionali, iscrizione, identità immutabile della prenotazione e gruppo di giorni. Non cambia API e non riscrive dati.
- [x] Assegnazioni fisse serializzate con le modifiche alla capienza del turno; riduzioni di capienza del turno/corso rifiutate se incompatibili con posti occupati o configurati. Correzioni di presenza e rinunce conservate. Riattivazione dei turni rivalida le assegnazioni fisse.
- [x] `scripts/test-course-database.mjs`: **11 scenari superati** su PostgreSQL 18.4. Nove scenari corsi (cinque con due connessioni e attesa del lock verificata) più esecuzione degli script SQL `profile_identity.sql` e `workout_completion_ownership.sql` prima solo preparati. Verificate auto-promozione, isolamento, valutazioni arretrate/upsert e permessi staff conservati.
- [x] Le regressioni sicurezza usano DDL/RLS originali e le migrazioni pertinenti, con schema auth minimo; Storage, servizi Supabase e migrazioni estranee non simulati. Questo test NON è un ripristino della produzione e NON certifica le autorizzazioni oggi presenti sul server.
- [x] Lint dello script superato; codice app invariato rispetto alla candidata `9ae58118c3f7` già verificata con 116 test e build iOS/web. Nessuna build mobile ripetuta per modifiche esclusivamente SQL/test.
- [ ] Le tre migrazioni di sicurezza/capienza NON applicate al database reale. L'11 settembre la dashboard del progetto originale `dvjhcdmuuuwepayaatup` reindirizza al login: richiesto accesso dell'utente senza condivisione di password/chiavi. Serve poi inventario schema reale, backup/ripristino, confronto con queste migrazioni e collaudo su copia prima del passaggio.
- [ ] iPhone di Roberto ancora `unavailable`; nessuna installazione su dispositivi di altre persone. Restano migrazione Lovable, coordinamento sito/repository, collaudo hardware e limiti SmartWOD elencati sopra.
- Riproduzione: installare separatamente `embedded-postgres@18.4.0-beta.17` e `pg@8.16.3` con `npm install --prefix build/server-tests`; consentire lo script di installazione del pacchetto binario ufficiale della piattaforma; eseguire `node scripts/test-course-database.mjs`. Porta locale 55439, nessun URL/credenziale remoto accettato. Riferimento strumento: https://github.com/leinelissen/embedded-postgres.
