# Los Santos Phone — Téléphone multijoueur RP

Un **vrai petit site web multi-joueurs** qui ressemble à un téléphone iOS, avec un univers Los Santos / GTA RP. Les joueurs n'ont pas besoin de Discord : ils utilisent le site dans leur navigateur (PC, PS5 si compatible, ou smartphone).

## Fonctionnalités

- **Code d'accès** `1245`, vérifié par le serveur.
- **Création de personnage** : prénom/nom RP, âge RP, genre, description, expérience RP, pseudo PlayStation, code PIN privé.
- **Numéro unique permanent** attribué automatiquement (`555-0100`, `555-0101`, etc.), conservé par SQLite, ainsi que les comptes et leur PIN chiffré par dérivation PBKDF2.
- **Écran d'accueil façon iPhone**, fond d'écran personnalisable, intro « Bienvenue à Los Santos » version police.
- **Messagerie multijoueur** réelle, conversations historiques, notifications en direct via WebSocket.
- **Téléphone** : composer un numéro RP, recevoir/refuser/terminer les appels **audio en direct via WebRTC**, historique des appels.
- **Contacts** enregistrés par joueur.
- **Maze Bank** : solde, virements entre numéros, historique d'opérations, crédit/débit par modération.
- **Pôle Emploi** : choix des métiers, candidatures et validation par modération. Les salaires affichés sont indicatifs, **pas versés automatiquement**.
- **App Store** : suggestions d'applications, approbation par les modérateurs, publication de raccourcis partagés. Le **contenu personnalisé** d'une nouvelle application nécessite du développement supplémentaire.
- **Photos / appareil photo** : import d'images ou prise de photo sur mobile, galerie privée dans le compte.
- **Réglages** : 4 sonneries originales synthétisées, notifications, sons, 4 fonds d'écran, déconnexion.
- **Espace modérateur** : code `2007` vérifié par le serveur, liste de joueurs, bannissement/débannissement, ajustement d'argent, lecture des messages RP, journal d'appels, gestion des candidatures et demandes d'apps, historique d'actions.

## Démarrer sur Windows

1. Installe **Python 3.11 ou plus récent** depuis python.org (coche « Add Python to PATH »).
2. Décompresse le ZIP et ouvre **un terminal dans le dossier** `los-santos-phone`.
3. Tape :

```powershell
py -m pip install -r requirements.txt
py server.py
```

4. Ouvre [http://localhost:8000](http://localhost:8000) sur ton PC.
5. Entre le code **1245**, crée un personnage et note son **numéro** et son **PIN personnel**.

Pour tester à plusieurs sur le même réseau Wi-Fi, ouvrez `http://ADRESSE-IP-LOCALE-DU-PC:8000`. La messagerie fonctionnera, mais **les appels audio nécessitent HTTPS** sur les appareils autres que `localhost` (sécurité du navigateur).

## Mise en ligne pour des joueurs de partout

Le projet a besoin d'un serveur Python toujours en service. **Déposer seulement `index.html` sur un hébergeur de pages statiques ne suffit pas** : les messages, appels et données utilisent le backend.

- Héberger sur un **VPS** avec Python, ou un service compatible Python et WebSocket (par exemple Render/Railway avec disque persistant).
- Installer les dépendances : `pip install -r requirements.txt`.
- Lancer avec `python server.py` (ou `uvicorn server:app --host 0.0.0.0 --port $PORT`).
- Configurer un nom de domaine avec **HTTPS et WSS** (indispensable au micro et aux notifications navigateur).
- Monter **un stockage persistant** pour `rp_phone.db` et le dossier `uploads/`. Si l'hébergement efface le disque, les comptes seront perdus.
- Sur des réseaux stricts, un serveur **TURN** peut être nécessaire pour permettre à deux joueurs d'établir un appel WebRTC. La version de base intègre des serveurs STUN publics uniquement.

### Variables d'environnement

| Variable | Défaut | Utilité |
|---|---|---|
| `RP_ENTRY_CODE` | `1245` | Code initial de déverrouillage |
| `RP_MOD_CODE` | `2007` | Code modération |
| `RP_START_MONEY` | `5000` | Solde RP initial |
| `RP_DATABASE` | `./rp_phone.db` | Chemin base de données persistante |
| `RP_UPLOADS` | `./uploads` | Photos persistantes |
| `PORT` | `8000` | Port du serveur |

⚠️ **IMPORTANT AVANT LA MISE EN LIGNE :** le code modération `2007` demandé pour cette version est très facile à deviner et toute personne qui le connaît peut bannir des joueurs et consulter leurs messages. **Change `RP_MOD_CODE` pour un secret long et privé**, limite qui peut être modérateur et prévois une protection anti-brute-force avant une grosse ouverture publique. Les données RP sont consultables par la modération et les joueurs en sont informés pendant l'inscription. Prévois des mentions d'information/confidentialité, une politique de conservation et des sauvegardes si tu ouvres au public.

## Comment tester à deux

1. Sur un premier navigateur, crée « Alex Moretti » (numéro `555-0100` sur base vide).
2. Sur un autre navigateur, crée « Sam Rossi » (numéro `555-0101`).
3. Depuis les Contacts, enregistre l'autre numéro et ouvre Messages.
4. Lance un message : il arrive instantanément dans l'autre navigateur.
5. Lance un appel pendant que les deux pages sont ouvertes et autorise le micro sur les deux appareils (sur HTTPS ou localhost).
6. Depuis Maze Bank, essaie un virement.
7. Sur un compte, ouvre Modération et utilise le code serveur puis accepte une candidature ou une demande d'app.

## Limites connues de cette première version

- Les appels et messages en **temps réel** demandent une connexion internet et une page ouverte. Les notifications en arrière-plan complet, quand le site est fermé, ne sont pas encore prises en charge (nécessiteraient un service de *web push* et un service worker adaptés aux navigateurs).
- Les nouvelles apps approuvées sont **des fiches/raccourcis publiés**. Leurs fonctions spécifiques doivent être ajoutées ensuite.
- La création de compte utilise un code d'accès partagé. Chaque joueur possède aussi un PIN personnel distinct, mais aucun mécanisme de récupération du PIN oublié n'est prévu.
- Ne te sers pas de cette base pour stocker des données bancaires réelles, ni de vraies informations personnelles sensibles. Les dollars Maze Bank sont fictifs.
- Les appels audio utilisent WebRTC ; les conditions réseau et navigateurs peuvent empêcher certains appels sans infrastructure TURN.
- Pour une grande communauté publique, renforcer la sécurité, gérer les rôles de modération individuellement, le RGPD, les protections de spam et les sauvegardes.

## Structure

```text
los-santos-phone/
  server.py              API FastAPI + stockage SQLite + WebSockets
  requirements.txt       Dépendances Python
  static/
    index.html            Interface téléphone
    style.css             Design iOS / Los Santos
    app.js                Applications et appels WebRTC
    manifest.webmanifest  Raccourci installable mobile
    icon.svg              Icône
    favicon.svg
  uploads/                Photos des joueurs (privées via API)
```

**Aucun compte tiers ni service Discord n'est nécessaire pour créer un personnage.**
