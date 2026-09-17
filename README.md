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

## Déploiement sur Render

Le fichier `render.yaml` définit :

1. Une base **PostgreSQL** (plan `basic-256mb`, payant — le free Postgres n’existe plus)
2. L’**API** (Docker FastAPI, plan free)
3. Le **frontend** (site statique Vite, plan free)

### Étapes

1. Créez un dépôt GitHub vide, puis poussez ce projet (`main`)
2. Sur [Render](https://dashboard.render.com) → **New** → **Blueprint**
3. Connectez le dépôt GitHub et validez le Blueprint
4. Attendez le premier déploiement (sur free, l’API peut mettre ~1 min à démarrer à froid)

URLs typiques :

- API : `https://compo-api.onrender.com`
- Front : `https://compo-web.onrender.com`

Si le nom de service API change, mettez à jour `VITE_API_URL` dans le service `compo-web` (ex. `https://VOTRE-API.onrender.com/api`) puis **Clear build cache & deploy**.

> Note : sur le plan gratuit, l’API s’endort après inactivité ; le premier appel peut prendre ~30–60 s.

## Stack

- Frontend : React + Vite + TypeScript + @dnd-kit
- Backend : FastAPI + SQLAlchemy
- Base : PostgreSQL

## Usage rapide

1. Ajoutez des joueurs dans **Joueurs**
2. Créez un match dans **Matchs**
3. Ouvrez le match → **Ajouter une compo**
4. Glissez les joueurs du banc vers les cases du terrain
