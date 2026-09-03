# v6 : données de démo et nom centralisé (03/09/2026)

- Réglages > "Données de démo" : charge 3 mois de dépenses fictives (≈150 opérations, Wave + Orange Money,
  marchands dakarois, salaire, loyer, transferts famille) et des budgets pour le mois courant. Bouton de suppression.
  Les opérations sont marquées note = "Données de démo" ; les vraies opérations ne sont jamais touchées.
- Nom de l'app centralisé dans src/lib/app.ts (APP_NAME) : layout, titre PWA et page de connexion.
  Reste à changer à la main le jour du renommage : public/manifest.webmanifest, nom du projet Netlify.
