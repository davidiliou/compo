# Compo Rugby

Application client-serveur pour gérer les compositions d'équipe au rugby (XV).

## Fonctionnalités

- **Mode visiteur** (sans login) : prochain match, matchs passés, compositions publiques, suivi du score en direct
- **Mode admin** (`/admin`, login staff) : joueurs, matchs, compos, mode match (chrono), planification des entraînements, export PDF
- **Joueurs** : CRUD (n°, prénom, n° de licence)
- **Matchs** : CRUD avec adversaire, date, lieu, scores, type (XV / XII / VII)
- **Mode match** : chrono par mi-temps (35 min par défaut), vibration/sonnerie, événements de score (essai, transformation, pénalité, drop) avec joueur et minute
- **Entraînements** : saison (sept→juin), créneaux hebdo, périodes thématiques, bibliothèque d’entraînements types (ateliers chronométrés)
- **Compositions** : plusieurs compos par match selon le format (15+8, 12+8 ou 7+5) ; bouton **Rendre public** pour le mode visiteur
- **PWA** : installable sur Android (Chrome → « Installer l’appli » / bannière)

## Démarrage local (Docker)

```bash
docker compose up --build
```

- Interface : http://localhost:3080
- API / docs : http://localhost:8000/docs

## Déploiement gratuit sur Render + Neon

Le Blueprint (`render.yaml`) utilise le **free tier** Render pour l’API et le front.
La base Postgres est sur **[Neon](https://neon.tech)** (free), à brancher via `DATABASE_URL`.

### Étapes

1. Créez un projet Postgres sur Neon et copiez la connection string (pooler, `sslmode=require`)
2. Poussez le dépôt sur GitHub
3. [Render](https://dashboard.render.com) → **New** → **Blueprint** (ou mettez à jour le service existant)
4. Sur le service **compo-api** → **Environment** → définissez :
   - `DATABASE_URL` = votre URL Neon  
     Ex. `postgresql://USER:PASS@ep-….neon.tech/compo?sslmode=require`
5. Déployez / redémarrez l’API
6. Ouvrez l’admin → **Paramètres** → **Importer une sauvegarde** (JSON) pour restaurer les données

Vous pouvez **supprimer la Postgres Render** une fois Neon branché et les données restaurées.

URLs typiques :

- API : `https://compo-api.onrender.com`
- Front : `https://compo-web.onrender.com`

### Limites free

- Render API et Neon free peuvent **s’endormir** après inactivité
- Premier appel lent au réveil (~30–60 s)
- Pas adapté à la production critique

Si le nom de service API change, mettez à jour `VITE_API_URL` sur `compo-web` puis redéployez.

### Local avec Neon

1. Copiez `.env.example` → `.env` et collez votre `DATABASE_URL` Neon
2. `docker compose up --build` (le backend lit `.env`)

Postgres locale (optionnel) : `docker compose --profile local-db up --build` avec une URL locale dans `.env`.

## Stack

- Frontend : React + Vite + TypeScript + @dnd-kit
- Backend : FastAPI + SQLAlchemy
- Base : PostgreSQL

## Usage rapide

1. Ajoutez des joueurs dans **Joueurs**
2. Créez un match dans **Matchs**
3. Ouvrez le match → **Ajouter une compo**
4. Cliquez une case du terrain pour assigner un joueur

## Installer sur Android (PWA)

1. Ouvrez l’URL du site dans **Chrome** (HTTPS, ex. Render)
2. Bannière **Installer** dans l’app, ou menu Chrome → **Installer l’application** / **Ajouter à l’écran d’accueil**
3. L’icône Compo apparaît comme une appli (plein écran, sans barre d’adresse)

En local (`http://localhost:3080`), Chrome peut aussi proposer l’installation. Sur iOS : Safari → Partager → Sur l’écran d’accueil.
