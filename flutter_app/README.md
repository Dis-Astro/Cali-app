# Power Gym Client - Flutter iOS

Prima versione Flutter della webapp cliente Power Gym.

## Cosa replica dalla webapp

- Login Supabase con email e password.
- Sessione persistente con storage sicuro.
- Scheda corrente, archivio schede e dettaglio giorno.
- Commenti e valutazioni cliente per esercizio/settimana.
- Consultazione offline dei dati gia scaricati.
- Salvataggio locale dei feedback offline con sincronizzazione al ritorno della connessione.

## Configurazione

Il progetto usa gli stessi valori Supabase della webapp. Sono impostati anche come fallback in `lib/core/config/supabase_config.dart`.

In produzione e preferibile passare i valori con `--dart-define`:

```sh
flutter run \
  --dart-define=SUPABASE_URL=https://dvjhcdmuuuwepayaatup.supabase.co \
  --dart-define=SUPABASE_PUBLISHABLE_KEY=...
```

## Generazione progetto iOS

In questo ambiente non e installato Flutter SDK. Su una macchina con Flutter:

```sh
cd flutter_app
flutter pub get
flutter create --platforms=ios,android .
flutter run -d ios
```

La cartella `ios/` va generata con Flutter su macOS/Xcode per ottenere una build installabile iOS.

## Note tecniche

- Il server Supabase resta fonte primaria.
- I feedback pendenti non vengono eliminati finche Supabase non conferma il salvataggio.
- La sync prima invia i feedback locali, poi aggiorna schede, esercizi, note coach e completions dal server.
- Le schede scadute restano consultabili, come nella webapp.
