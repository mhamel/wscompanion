# THIRTY-THIRD ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Objectif projet (rappel): Companion Wealthsimple (via SnapTrade) — analytics + insights, avec UX “search-first” et garde-fous (paywall, disclaimer).

Objectif de cette itération: améliorer l’UX Ask (Pro) pour le disclaimer versionné: **acceptation inline** directement dans l’écran Ask (au lieu de forcer un détour par Paramètres).

## 1) Ce qui a été fait

### Mobile

- `apps/mobile/src/screens/AskScreen.tsx`
  - Ajoute `useQuery(["disclaimer"])` pour récupérer le statut + texte du disclaimer.
  - Si disclaimer non accepté (ou version mismatch) → bloc “Action requise” affiché (même avant appel API).
  - Boutons inline:
    - “Lire” (ouvre le texte)
    - “Accepter” / “Ré-accepter” (appelle `POST /v1/disclaimer/accept`, invalide la query)
  - Le bouton “Demander” est désactivé tant que le disclaimer requis n’est pas accepté.
  - Si l’API renvoie quand même `DISCLAIMER_REQUIRED`, le screen invalide la query et affiche le bloc.

### Docs

- `docs/DISCLAIMER.md` mentionne que Ask propose maintenant un flux inline en plus de Settings.

## 2) Comment valider

```powershell
npx tsc -p apps/mobile/tsconfig.json --noEmit
npm --workspace apps/backend test
```

Manuel (mobile):
1) Ouvrir Ask sur un user Pro sans disclaimer accepté (ou version mismatch)
2) Vérifier que le bloc “Action requise” apparaît et que “Demander” est désactivé
3) “Lire” affiche le texte
4) “Accepter/Ré-accepter” enregistre et débloque Ask

## 3) Notes / next steps

- Il reste un doublon UX (Settings + Ask): OK pour MVP, mais on pourrait factoriser un composant “DisclaimerGate”.
- Next: si on veut un guard global (avant même d’entrer dans Tabs), implémenter un modal au niveau du root navigator.

## 4) Git

- Branche: `main`
- Commit: à créer dans cette itération (voir `git log -1` après commit)

