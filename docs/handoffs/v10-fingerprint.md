# v10 : déduplication des imports WhatsApp (03/09/2026)

Bug : sur WhatsApp, toutes les lignes lues dans une même capture partageaient le marqueur de lot "wa:<id>" utilisé
comme texte brut, et l'empreinte de déduplication en dérivait : seule la première ligne était enregistrée, les autres
étaient déclarées « déjà connues ». Le web (Importer) n'était pas touché.

Correctif (src/lib/sms.ts, fingerprintFor) : référence opérateur si présente ; sinon contenu + date lue sur l'image ;
sinon texte brut + minute. Une capture renvoyée reste dédupliquée ligne par ligne. Test : npm run test:fp.
