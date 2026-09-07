# Super Power Gym — checklist unica

Aggiornamento: 7 settembre 2026. Non confondere codice locale, test, pubblicazione e installazione.

## Inventario iniziale
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
