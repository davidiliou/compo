# Compo Rugby

Application client-serveur pour gérer les compositions d'équipe au rugby (XV).

## Fonctionnalités

- **Joueurs** : CRUD (n°, prénom, n° de licence)
- **Matchs** : CRUD avec adversaire, date, lieu, scores
- **Compositions** : plusieurs compos par match, placement des 15 postes en glisser-déposer sur un terrain

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
4. Glissez les joueurs du banc vers les cases du terrain
