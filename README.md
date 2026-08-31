# Super Power Gym

App mobile e web per clienti, coach e amministrazione della palestra. La versione mobile usa Capacitor con progetto iOS nativo; dati e autenticazione sono gestiti da Supabase.

## Requisiti

- Node.js 22
- npm
- Xcode 26 o successivo per iOS

## Avvio locale

1. Copia `.env.example` in `.env` e inserisci le variabili Supabase.
2. Esegui `npm ci`.
3. Esegui `npm run dev` per il web.

## Verifica completa

```sh
npm run check
```

## iOS Simulator

```sh
npm run ios:prepare
npm run ios:open
```

In Xcode seleziona lo schema `App` e un simulatore iPhone. Per una build da terminale usa `npm run ios:build`.

## Sicurezza

- `.env` non viene versionato.
- Le funzioni amministrative Supabase richiedono un utente autenticato con ruolo `admin`.
- Il primo amministratore va creato direttamente dal pannello Supabase, non tramite endpoint pubblico.

## Branch

`main` è la sola linea stabile. I cambiamenti vanno sviluppati in branch brevi e integrati solo dopo `npm run check` e la build iOS.
