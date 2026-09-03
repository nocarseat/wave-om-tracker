// Exemples de SMS utilisés pour tester le parseur (formats APPROXIMATIFS).
// Remplacez-les par de vrais SMS reçus sur votre téléphone, puis lancez :
//   npm run test:sms
export const SAMPLES: Array<{ sender: string; body: string }> = [
  {
    sender: "Wave",
    body: "Vous avez envoyé 5,000F à Awa Ndiaye (+221771234567). Nouveau solde: 12,500F. ID de transaction: TABCD1234",
  },
  {
    sender: "Wave",
    body: "Vous avez reçu 25,000F de Moussa Diop (+221781112233). Nouveau solde: 37,500F. ID de transaction: TXYZ9876",
  },
  {
    sender: "Wave",
    body: "Vous avez payé 3,500F à PHARMACIE DU POINT E. Nouveau solde: 34,000F. ID de transaction: TPAY5555",
  },
  {
    sender: "Wave",
    body: "Vous avez retiré 10,000F chez Agent Wave Pikine. Nouveau solde: 24,000F. ID de transaction: TWDR0001",
  },
  {
    sender: "OrangeMoney",
    body: "Vous avez transfere 15000 FCFA au 771234567. Frais: 300 FCFA. Votre nouveau solde est 42000 FCFA. Ref: PP260903.1522.A12345",
  },
  {
    sender: "OrangeMoney",
    body: "Transfert de 20000 FCFA recu de 781112233. Votre nouveau solde est 62000 FCFA. Ref: PP260903.1530.B67890",
  },
  {
    sender: "OrangeMoney",
    body: "Paiement de 8500 FCFA effectue chez SENELEC WOYOFAL. Nouveau solde: 53500 FCFA. Ref: PP260903.1600.C11111",
  },
  {
    sender: "OrangeMoney",
    body: "Achat de credit de 1000 FCFA effectue pour le 771234567. Nouveau solde: 52500 FCFA. Ref: PP260903.1610.D22222",
  },
];
