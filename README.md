# Compo Rugby

Application client-serveur pour gérer les compositions d'équipe au rugby (XV).

## Fonctionnalités

- **Joueurs** : CRUD (n°, prénom, n° de licence)
- **Matchs** : CRUD avec adversaire, date, lieu, scores, type (XV / XII / VII)
- **Mode match** : chrono par mi-temps (35 min par défaut), vibration/sonnerie, événements de score (essai, transformation, pénalité, drop) avec joueur et minute
- **Compositions** : plusieurs compos par match selon le format (15+8, 12+8 ou 7+5)
- **PWA** : installable sur Android (Chrome → « Installer l’appli » / bannière)

## Démarrage local (Docker)

```bash
docker compose up --build
```

- Interface : http://localhost:3080
- API / docs : http://localhost:8000/docs

## Déploiement gratuit sur Render

Le Blueprint (`render.yaml`) utilise uniquement le **free tier** :

- Web service API (Docker / FastAPI)
- **Render Postgres** free
- Static site (frontend)

### Étapes

1. Poussez le dépôt sur GitHub
2. [Render](https://dashboard.render.com) → **New** → **Blueprint**
3. Connectez le dépôt et déployez

URLs typiques :

- API : `https://compo-api.onrender.com`
- Front : `https://compo-web.onrender.com`

### Limites free (Render)

- L’API et Postgres free **s’endorment** après inactivité
- Premier appel lent au réveil (~30–60 s)
- Pas adapté à la production

Si Render demande une CB : c’est souvent une vérification de compte. Le plan des services reste `free`.

Si le nom de service API change, mettez à jour `VITE_API_URL` sur `compo-web` puis redéployez.

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
