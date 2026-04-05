# Installazione come server (LAN)

Obiettivo: installare il gestionale su una postazione “server” e collegarsi dai client via browser nella stessa rete.

## Opzione A (consigliata): Docker (App + Postgres)

### 1) Prerequisiti

- Windows 10/11 o Windows Server
- Docker Desktop (con Docker Compose)

### 2) Avvio

Da `gestionale-corfumania/`:

```bash
docker compose up -d --build
```

L’app sarà disponibile su:

- `http://IP_DEL_SERVER:3000`
- `http://localhost:3000` (dal server stesso)

### 3) Creazione admin iniziale

Esegui una sola volta sul server:

```bash
docker compose exec -e ADMIN_EMAIL="admin@azienda.local" -e ADMIN_PASSWORD="UnaPasswordLunga!" app node scripts/create-admin.mjs
```

Al primo accesso l’utente admin sarà forzato al cambio password.

### 4) Firewall / rete

Apri sul server:

- Porta TCP `3000` (oppure usa un reverse proxy e apri `80/443`)

## Config consigliata per produzione (se esposta su Internet)

Usa lo stack di produzione che non espone Postgres e richiede segreti da variabili d’ambiente:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Imposta almeno:

- `POSTGRES_PASSWORD` (lunga e casuale)
- `JWT_SECRET` (lunga e casuale)

## HTTPS + PWA (con dominio)

Per avere HTTPS (necessario per installare la PWA su telefono) serve un dominio che punti al server e porte `80` e `443` raggiungibili.

Questo progetto include una configurazione pronta con Caddy (certificati automatici).

### 1) DNS

- Crea un record `A` su Aruba (o altro provider) che punti all’IP pubblico del router/linea dove si trova il server.
- Configura il port forwarding sul router verso il server per `80` e `443`.

### 2) Avvio con Caddy

Da `gestionale-corfumania/`:

```bash
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d --build
```

Poi imposta il dominio in `docker-compose.caddy.yml` (variabile `DOMAIN`) e riavvia lo stack.

### 3) Installazione PWA

Apri `https://tuodominio.it` da Chrome/Edge e usa “Installa app”.

### 5) Backup database

Il database è nel volume Docker `corfumania_db`. Per backup, puoi usare `pg_dump` dentro il container `db`.

## Opzione B: senza Docker (Node + Postgres)

### 1) Prerequisiti

- Node.js LTS
- Postgres 16

### 2) Configurazione

Imposta `.env` (puoi partire da `.env.server.example`).

### 3) Migrazioni e build

```bash
npm ci
npx prisma migrate deploy
npm run build
```

### 4) Avvio

```bash
npm run start
```

Per tenerlo sempre acceso: esegui come servizio Windows (Task Scheduler / NSSM / PM2).

## Sicurezza consigliata (LAN)

- Impostare `JWT_SECRET` lungo e casuale.
- Esporre l’app in LAN dietro HTTPS (reverse proxy) se possibile.
- Limitare le porte aperte sul server al minimo necessario.
- Backup regolari del DB.
