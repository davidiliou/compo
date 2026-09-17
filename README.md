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

En local, Docker utilise encore **PostgreSQL**. Sur Render (gratuit), l’API utilise **SQLite**.

## Déploiement gratuit sur Render

Le fichier `render.yaml` est en **plan free** uniquement (plus de Postgres Render payant).

### Étapes

1. Poussez le dépôt sur GitHub
2. [Render](https://dashboard.render.com) → **New** → **Blueprint**
3. Connectez le dépôt et déployez

URLs typiques :

- API : `https://compo-api.onrender.com`
- Front : `https://compo-web.onrender.com`

### Limites du gratuit

- L’API **s’endort** après inactivité (~30–60 s au réveil)
- SQLite est **éphémère** : les données peuvent être perdues au redémarrage du service free
- Si Render demande une CB même en free : c’est une vérif de compte, pas une facturation (dans la plupart des cas). Sinon, alternative 100 % free sans CB : [Neon](https://neon.tech) (Postgres free) + coller `DATABASE_URL` dans le service `compo-api`

Si le nom de service API change, mettez à jour `VITE_API_URL` sur `compo-web` puis redéployez.

## Stack

- Frontend : React + Vite + TypeScript + @dnd-kit
- Backend : FastAPI + SQLAlchemy
- Base : PostgreSQL (local) / SQLite (Render free)

## Usage rapide

1. Ajoutez des joueurs dans **Joueurs**
2. Créez un match dans **Matchs**
3. Ouvrez le match → **Ajouter une compo**
4. Glissez les joueurs du banc vers les cases du terrain
