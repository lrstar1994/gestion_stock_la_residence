from __future__ import annotations

from datetime import date
from html import escape
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
DOCS.mkdir(exist_ok=True)

TITLE = "Manuel d'utilisation - Stock & Production La R\u00e9sidence"
MD_PATH = DOCS / "Manuel_utilisation_La_Residence.md"
DOCX_PATH = DOCS / "Manuel_utilisation_La_Residence.docx"


sections = [
    (
        "1. Avant de commencer",
        [
            "Ce manuel explique comment utiliser l'application Stock & Production La Residence sans assistance technique.",
            "L'utilisateur doit d'abord se connecter avec son email et son mot de passe.",
            "Chaque fonctionnalite depend du role connecte. Si un bouton n'apparait pas, cela signifie en general que le role n'a pas le droit d'effectuer cette action.",
        ],
        [
            ("Adresse de l'application", "Ouvrir l'URL fournie par l'administrateur, par exemple la page Cloudflare Pages de La Residence."),
            ("Connexion", "Ouvrir le menu ou la page Connexion, saisir Email et Mot de passe, puis cliquer sur Se connecter."),
            ("Deconnexion", "Cliquer sur le bouton Deconnexion dans le menu lateral."),
            ("Compte en attente", "Si l'application affiche la page En attente, la Direction doit valider le compte dans Administration > Utilisateurs."),
        ],
    ),
    (
        "2. Roles et responsabilites",
        [
            "Les roles servent a proteger les actions sensibles. Un utilisateur ne doit jamais partager son compte avec une autre personne.",
        ],
        [
            ("Direction", "Valide les comptes, controle les droits, valide les operations sensibles, consulte tous les tableaux de bord."),
            ("Chef cuisine", "Cree les fiches techniques, prepare les evenements, suit les productions et les sorties."),
            ("Fiche technique", "Cree et modifie les recettes, prepare les imports Excel, ne valide pas officiellement."),
            ("Magasinier", "Gere le stock, les receptions, les transferts et les inventaires."),
            ("Acheteur", "Gere fournisseurs, besoins d'achat, commandes et suivis d'achat."),
            ("Caisse", "Remet les especes et suit les retours de monnaie."),
            ("Comptabilite", "Suit factures, paiements, couts et exports financiers."),
            ("Point de vente", "Enregistre les ventes."),
            ("Maintenance", "Cree des besoins d'achat de maintenance."),
            ("Consultation", "Consulte uniquement les informations autorisees."),
        ],
    ),
    (
        "3. Gestion des utilisateurs",
        [
            "Utilisateur connecte requis : Direction.",
            "Menu a ouvrir : Administration > Utilisateurs.",
            "Objectif : valider les nouveaux comptes, attribuer les roles et desactiver/reactiver un utilisateur.",
        ],
        [
            ("Valider un compte", "Ouvrir Administration > Utilisateurs, filtrer En attente, cliquer sur Valider, choisir le role, puis cliquer sur Valider."),
            ("Refuser un compte", "Cliquer sur Refuser, saisir le motif obligatoire, puis confirmer."),
            ("Modifier un utilisateur", "Cliquer sur Modifier, changer le role ou le statut, puis enregistrer."),
            ("Resultat attendu", "Le compte valide peut se connecter et acceder aux menus de son role."),
        ],
    ),
    (
        "4. Profil personnel",
        [
            "Utilisateur connecte requis : tous les utilisateurs.",
            "Menu a ouvrir : Profil.",
        ],
        [
            ("Consulter son profil", "Ouvrir Profil depuis le menu lateral."),
            ("Modifier le nom", "Si le compte est actif, modifier le nom complet puis cliquer sur Enregistrer."),
            ("Resultat attendu", "Le nouveau nom apparait sur le profil et dans les ecrans qui affichent l'utilisateur."),
        ],
    ),
    (
        "5. Familles, unites, localisations et fournisseurs",
        [
            "Ces donnees sont les referentiels de base. Elles doivent etre creees avant les articles et les operations de stock.",
        ],
        [
            ("Familles - role", "Direction uniquement. Menu : Administration > Familles."),
            ("Creer une famille", "Cliquer sur Nouvelle famille, saisir le nom, ajouter une description si besoin, puis cliquer sur Creer."),
            ("Modifier une famille", "Cliquer sur Modifier sur la ligne concernee, changer les informations, puis enregistrer."),
            ("Supprimer une famille", "Cliquer sur Supprimer. La suppression est possible seulement si aucun article n'utilise cette famille."),
            ("Unites - role", "Direction uniquement. Menu : Administration > Unites."),
            ("Creer une unite", "Cliquer sur Nouvelle unite, saisir Nom et Abreviation, puis Creer."),
            ("Localisations - role", "Direction uniquement. Menu : Administration > Localisations."),
            ("Creer une localisation", "Cliquer sur Nouvelle localisation, saisir le nom, puis Creer."),
            ("Fournisseurs - role", "Direction et Acheteur en modification, Comptabilite en lecture. Menu : Administration > Fournisseurs."),
            ("Creer un fournisseur", "Cliquer sur Nouveau fournisseur, saisir au minimum le nom, puis Creer."),
        ],
    ),
    (
        "6. Articles",
        [
            "Roles creation/modification : Direction, Chef cuisine, Magasinier, Acheteur.",
            "Roles lecture seule : Fiche technique, Comptabilite, Consultation, Point de vente, Maintenance, Caisse.",
            "Menu a ouvrir : Articles.",
        ],
        [
            ("Consulter les articles", "Ouvrir Articles. Utiliser la recherche, le filtre famille ou le filtre statut."),
            ("Creer un article", "Cliquer sur Nouvel article, remplir Nom, Famille, Unite de gestion, Stock minimum si besoin et localisations autorisees, puis cliquer sur Creer."),
            ("Fournisseur habituel", "Choisir le fournisseur dans la liste deroulante si disponible."),
            ("Modifier un article", "Ouvrir l'article, cliquer sur Modifier, changer les champs puis Mettre a jour."),
            ("Archiver un article", "Ouvrir le detail, cliquer sur Archiver, confirmer. L'article archive n'est plus utilise dans les nouvelles operations."),
            ("Resultat attendu", "L'article apparait dans le menu Articles et peut etre utilise dans fiches techniques, achats, receptions, stock et ventes."),
        ],
    ),
    (
        "7. Fiches techniques et recettes",
        [
            "Roles creation/modification : Direction, Chef cuisine, Fiche technique.",
            "Validation officielle : Direction uniquement.",
            "Menu a ouvrir : Fiches techniques.",
        ],
        [
            ("Creer une fiche", "Ouvrir le menu Fiches techniques, cliquer sur Nouvelle fiche, saisir Nom, Type, Matiere principale, Portions et description."),
            ("Ajouter un ingredient", "Dans la fiche, cliquer sur Ajouter un ingredient, choisir l'article, saisir quantite, unite et prix unitaire en Ariary."),
            ("Conversion d'unite", "Si l'article est stocke en kg et la fiche saisie en g, l'application affiche la conversion, par exemple 500 g devient 0,5 kg."),
            ("Calcul des couts", "Le total se calcule automatiquement : quantite stockee x prix unitaire dans l'unite de stock."),
            ("Soumettre a validation", "Quand la fiche est complete, cliquer sur Soumettre a validation."),
            ("Valider une fiche", "Connecte en Direction, ouvrir le detail de la fiche, cliquer sur Valider. Le code recette est genere automatiquement."),
            ("Exporter", "Dans le detail, cliquer sur Export PDF, Export Excel ou Export CSV selon le besoin."),
            ("Resultat attendu", "Une fiche validee devient une reference officielle utilisable dans les evenements et productions."),
        ],
    ),
    (
        "8. Import Excel des fiches techniques",
        [
            "Roles autorises : Direction, Chef cuisine, Fiche technique.",
            "Menu a ouvrir : Fiches techniques, puis bouton Import Excel si disponible.",
        ],
        [
            ("Preparer le fichier", "Utiliser les colonnes Nom, Type, Matiere principale, Portions, Ingredients."),
            ("Format ingredients", "Chaque ingredient doit etre sous la forme Article;Quantite;Unite;Prix. Plusieurs ingredients sont separes par le caractere |."),
            ("Lancer l'import", "Cliquer sur Import Excel, choisir le fichier, puis confirmer."),
            ("Lire le rapport", "Le rapport indique les ingredients reconnus, ambigus et inconnus."),
            ("Resoudre les ingredients", "Ouvrir le menu Fiches techniques > Ingredients en attente, choisir un article existant ou creer l'article manquant."),
            ("Resultat attendu", "La fiche est importee en brouillon. Elle ne peut etre validee que quand tous les ingredients sont resolus."),
        ],
    ),
    (
        "9. Evenements, menus, buffets et production",
        [
            "Roles creation/modification : Direction, Chef cuisine, Fiche technique.",
            "Lecture : Magasinier, Acheteur, Comptabilite, Consultation.",
            "Menus a ouvrir : Evenements, puis bouton Nouvel evenement, puis detail de l'evenement.",
        ],
        [
            ("Creer un evenement", "Ouvrir le menu Evenements, cliquer sur Nouvel evenement, remplir Nom, Type, Date, Lieu, Adultes et Enfants."),
            ("Ajouter des recettes", "Dans le formulaire, rechercher une recette validee, cliquer sur Ajouter, choisir service et niveau d'interet."),
            ("Verifier les coefficients", "Pour un buffet, l'application propose un coefficient. Modifier si necessaire et saisir le motif si l'ecart est important."),
            ("Generer les besoins", "Ouvrir l'evenement puis l'onglet Besoins d'achat. Les besoins sont bruts, sans deduction du stock."),
            ("Suivre la production", "Ouvrir l'onglet Production, saisir les quantites produites, rajouts, retours et pertes."),
            ("Analyser", "Ouvrir l'onglet Analyse pour comparer prevu, produit et consomme."),
        ],
    ),
    (
        "10. Besoins d'achat",
        [
            "Menus a ouvrir : Besoins d'achat, puis bouton Nouveau besoin.",
            "Roles : Direction valide, Chef cuisine/Fiche technique/Maintenance/Magasinier creent selon besoin, Acheteur regroupe et exporte.",
        ],
        [
            ("Creer un besoin manuel", "Ouvrir le menu Besoins d'achat puis cliquer sur Nouveau besoin, choisir Article, Quantite, Origine, Urgence, Date souhaitee et commentaire, puis Creer."),
            ("Valider un besoin", "Connecte en Direction, ouvrir le menu Besoins d'achat, selectionner le besoin, cliquer sur Valider."),
            ("Refuser un besoin", "Cliquer sur Refuser et saisir le motif obligatoire."),
            ("Regrouper par fournisseur", "Connecte en Acheteur ou Direction, selectionner les besoins valides, choisir Regrouper, puis confirmer."),
            ("Exporter", "Utiliser les boutons Export Excel ou CSV depuis la liste."),
        ],
    ),
    (
        "11. Achats en especes",
        [
            "Menus a ouvrir : Achats en especes, puis bouton Nouvelle demande.",
            "Roles : Acheteur cree et saisit le retour, Direction valide/cloture, Caisse remet les especes, Comptabilite consulte.",
        ],
        [
            ("Creer une demande", "Ouvrir le menu Achats en especes puis cliquer sur Nouvelle demande, choisir Acheteur, Caisse source, Motif, Date prevue, ajouter les articles, puis Creer."),
            ("Validation Direction", "Connecte en Direction, ouvrir le dossier, cliquer sur Valider, saisir le montant valide si different."),
            ("Remise especes", "Connecte en Caisse, ouvrir le dossier valide, cliquer sur Remettre les especes, saisir le montant remis, puis confirmer."),
            ("Saisir le retour", "Connecte en Acheteur, ouvrir le dossier, saisir quantite achetee, prix reel, fournisseur, facture/recu et monnaie rendue."),
            ("Ajouter justificatif", "Dans le bloc Justificatifs, cliquer sur Ajouter un fichier et choisir la photo ou le PDF. Les images sont compressees automatiquement."),
            ("Gerer les ecarts", "Si le total achete depasse le montant remis ou si la monnaie rendue ne correspond pas, justifier l'ecart. La Direction doit valider l'ecart."),
            ("Cloturer", "Connecte en Direction, apres retour complet, justificatif et ecarts valides, cliquer sur Cloturer."),
        ],
    ),
    (
        "12. Commandes fournisseurs",
        [
            "Menus a ouvrir : Commandes fournisseurs, puis bouton Nouvelle commande.",
            "Roles : Direction valide, Acheteur cree/envoie/suit, Magasinier voit les commandes a receptionner.",
        ],
        [
            ("Creer une commande", "Ouvrir le menu Commandes fournisseurs puis cliquer sur Nouvelle commande, choisir Fournisseur, Date de livraison, conditions, puis ajouter les articles."),
            ("Depuis besoins regroupes", "Selectionner un groupe d'achat pour pre-remplir fournisseur et articles."),
            ("Enregistrer en brouillon", "Cliquer sur Creer ou Enregistrer selon l'ecran."),
            ("Valider", "Connecte en Direction, ouvrir la commande, cliquer sur Valider."),
            ("Envoyer", "Connecte en Acheteur, ouvrir une commande validee, cliquer sur Envoyer au fournisseur."),
            ("Exporter PDF", "Ouvrir le detail et cliquer sur Export PDF."),
            ("Annuler", "Cliquer sur Annuler, saisir le motif obligatoire. Les besoins associes sont liberes si applicable."),
        ],
    ),
    (
        "13. Receptions",
        [
            "Menus a ouvrir : Receptions, puis bouton Nouvelle reception.",
            "Roles : Magasinier cree et valide, Direction valide avec anomalies, Acheteur/Comptabilite consultent.",
        ],
        [
            ("Creer depuis commande", "Ouvrir le menu Receptions puis cliquer sur Nouvelle reception, selectionner une commande envoyee ou partiellement livree. Les articles sont pre-remplis."),
            ("Creer sans commande", "Choisir fournisseur, numero de facture, date facture, localisation et articles recus."),
            ("Saisir les quantites", "Pour chaque article, saisir Quantite livree, Quantite acceptee et Prix reel."),
            ("Controle qualite", "Choisir Conforme, A verifier ou Non conforme. Si Non conforme, saisir un commentaire."),
            ("Photo anomalie", "Pour produit abime ou anomalie demandant preuve, ajouter une photo."),
            ("Valider", "Cliquer sur Valider la reception. Sans anomalie, elle est validee. Avec anomalie, la Direction doit valider."),
            ("Stock", "La reception cree des mouvements en attente ou des entrees de stock selon le workflow du module Stock."),
        ],
    ),
    (
        "14. Stock et transferts internes",
        [
            "Menus a ouvrir : Stock, Transfert interne, Journal des mouvements et Mouvement manuel.",
            "Roles : Direction tout, Magasinier gere, Chef cuisine demande/consulte, autres lecture selon droits.",
        ],
        [
            ("Consulter le stock", "Ouvrir le menu Stock. Utiliser les filtres famille, localisation et statut."),
            ("Voir par article", "Cliquer sur un article pour consulter les localisations, mouvements et prix."),
            ("Transferer", "Ouvrir le menu Transfert interne, choisir Article, Quantite, Depart, Destination et Motif, puis cliquer sur Transferer."),
            ("Erreur stock insuffisant", "Si le stock est insuffisant, l'application bloque le transfert."),
            ("Mouvement manuel", "Ouvrir le menu Mouvement manuel, choisir type, article, quantite, localisation, motif et prix si entree/correction."),
            ("Validation Direction", "Les entrees manuelles, corrections et retroactifs peuvent demander validation Direction."),
            ("Journal", "Ouvrir le menu Journal des mouvements pour consulter tous les mouvements par date, article ou localisation."),
            ("Historique des prix", "Ouvrir l'article puis l'historique des prix pour voir dernier prix, prix moyen, minimum et maximum."),
        ],
    ),
    (
        "15. Sorties de stock et production",
        [
            "Menus a ouvrir : Sorties de stock, Nouvelle sortie et Analyse de consommation.",
            "Roles : Chef cuisine cree, Magasinier valide/consulte, Direction corrige et valide.",
        ],
        [
            ("Saisie manuelle", "Ouvrir le menu Sorties de stock puis cliquer sur Nouvelle sortie, choisir Article, Quantite, Localisation, Destination, Motif et Date, puis Enregistrer."),
            ("Depuis production", "Selectionner l'evenement ou la production si l'ecran le propose. Les quantites theoriques sont pre-remplies."),
            ("Rajout", "Cocher Rajout si la sortie correspond a une quantite supplementaire non prevue, puis saisir le motif."),
            ("Retour", "Cocher Retour si une quantite revient en stock, puis saisir quantite retournee et motif."),
            ("Perte ou casse", "Choisir destination Perte/Casse et saisir le motif. La Direction peut devoir valider."),
            ("Analyse", "Ouvrir le menu Analyse de consommation pour comparer theorique et reel."),
        ],
    ),
    (
        "16. Ventes",
        [
            "Menus a ouvrir : Ventes, Nouvelle vente et Statistiques de vente.",
            "Roles : Point de vente cree les ventes, Direction corrige/annule, Comptabilite consulte/exporte.",
        ],
        [
            ("Creer une vente", "Ouvrir le menu Ventes puis cliquer sur Nouvelle vente, choisir Canal, Mode de service, Point de vente et client si connu."),
            ("Ajouter produit brut", "Choisir Produit brut, selectionner l'article, saisir quantite, prix unitaire et remise si besoin."),
            ("Ajouter produit fini", "Choisir Produit fini, selectionner la recette ou l'article fini, saisir quantite et prix."),
            ("Offert", "Saisir la quantite offerte et le motif obligatoire."),
            ("Valider", "Cliquer sur Enregistrer la vente. Une sortie de stock est creee si le stock est suffisant."),
            ("Annuler", "Ouvrir le detail, cliquer sur Annuler, saisir le motif. Le retour stock est trace."),
            ("Statistiques", "Ouvrir le menu Statistiques de vente pour voir ventes par article, point de vente, canal et periode."),
        ],
    ),
    (
        "17. Inventaires et ecarts",
        [
            "Menus a ouvrir : Inventaires, Nouvel inventaire et Inventaire initial.",
            "Roles : Magasinier cree, Direction valide les ecarts importants et corrections.",
        ],
        [
            ("Inventaire initial", "Ouvrir le menu Inventaire initial pour verifier les articles/localisations non confirmes."),
            ("Creer un inventaire", "Ouvrir le menu Inventaires puis cliquer sur Nouvel inventaire, choisir Localisation, Date, Type, puis charger les articles."),
            ("Compter", "Saisir la Quantite comptee pour chaque article."),
            ("Motif ecart", "Si l'ecart est important, saisir un motif clair."),
            ("Valider", "Cliquer sur Valider. Un ecart faible peut etre valide par le Magasinier. Un ecart significatif passe par la Direction."),
            ("Correction", "Apres validation, l'application cree les corrections de stock necessaires."),
            ("Dashboard", "Consulter le tableau de bord inventaires pour les ecarts par zone et les inventaires en attente."),
        ],
    ),
    (
        "18. Factures et paiements",
        [
            "Menus a ouvrir : Factures, puis bouton Nouvelle facture.",
            "Roles : Comptabilite cree/valide/paye, Direction valide si necessaire, autres consultent selon droits.",
        ],
        [
            ("Creer depuis reception", "Ouvrir le menu Factures puis cliquer sur Nouvelle facture, selectionner une reception. Fournisseur, articles et montants sont pre-remplis."),
            ("Creer manuellement", "Choisir fournisseur, numero facture, dates, montant HT, TVA, mode de paiement et piece jointe."),
            ("Valider", "Connecte en Comptabilite ou Direction, ouvrir la facture et cliquer sur Valider."),
            ("Contester", "Cliquer sur Contester et saisir le motif obligatoire."),
            ("Paiement partiel", "Cliquer sur Enregistrer un paiement, saisir montant, mode, date et reference."),
            ("Paiement complet", "Saisir le solde restant. Le statut passe a Payee."),
            ("Cloturer", "Quand la facture est payee et verifiee, cliquer sur Cloturer."),
        ],
    ),
    (
        "19. Tableaux de bord Direction",
        [
            "Utilisateur connecte requis : Direction.",
            "Menus a ouvrir : Tableau de bord, Dashboard achats, Dashboard stock, Dashboard ventes et Dashboard financier.",
        ],
        [
            ("Dashboard principal", "Ouvrir le menu Tableau de bord pour consulter KPI stock, achats, ventes, factures, alertes et marges."),
            ("Achats", "Ouvrir le menu Dashboard achats pour suivre achats par fournisseur, famille, periode et avances."),
            ("Stock", "Ouvrir le menu Dashboard stock pour voir valeur stock, articles sous seuil et repartitions."),
            ("Ventes", "Ouvrir le menu Dashboard ventes pour voir chiffre d'affaires, top articles, canaux et points de vente."),
            ("Finance", "Ouvrir le menu Dashboard financier pour suivre marge brute, cout matiere et ratio cout."),
            ("Exports", "Utiliser Export PDF ou Excel si disponible sur l'ecran."),
        ],
    ),
    (
        "20. Audit inter-modules",
        [
            "Utilisateur connecte requis : Direction.",
            "Menu a ouvrir : Audit inter-modules.",
        ],
        [
            ("Ouvrir l'audit", "Dans le menu, ouvrir Audit inter-modules."),
            ("Lire les alertes", "Verifier les receptions sans mouvement stock, besoins regroupes sans commande, commandes livrees sans reception, factures incoherentes, ventes sans sortie stock."),
            ("Corriger", "Cliquer sur l'element concerne ou ouvrir le module indique, puis regulariser."),
            ("Resultat attendu", "Les alertes diminuent apres correction des dossiers incomplets."),
        ],
    ),
    (
        "21. Parcours conseilles par utilisateur",
        [
            "Cette section resume quoi faire au quotidien selon le role connecte.",
        ],
        [
            ("Direction", "Le matin : ouvrir le menu Tableau de bord, traiter utilisateurs en attente, besoins a valider, decaissements, commandes, ecarts, inventaires et factures sensibles."),
            ("Chef cuisine", "Ouvrir le menu Fiches techniques pour fiches techniques, le menu Evenements pour menus, le menu Sorties de stock pour sorties production."),
            ("Fiche technique", "Mettre a jour recettes, imports Excel, ingredients en attente et simulations."),
            ("Magasinier", "Ouvrir le menu Receptions pour marchandises, le menu Stock pour mouvements, le menu Transfert interne pour transferts, le menu Inventaires pour inventaires."),
            ("Acheteur", "Ouvrir le menu Besoins d'achat, regrouper les besoins, creer les commandes depuis le menu Commandes fournisseurs, suivre fournisseurs."),
            ("Caisse", "Ouvrir le menu Achats en especes, remettre les especes et verifier les retours."),
            ("Comptabilite", "Ouvrir le menu Factures, verifier paiements, consulter couts, exports et dashboards financiers."),
            ("Point de vente", "Ouvrir le menu Ventes puis cliquer sur Nouvelle vente pour chaque vente, puis verifier le menu Ventes en fin de service."),
        ],
    ),
    (
        "22. Erreurs courantes et quoi faire",
        [
            "Cette section aide l'utilisateur a comprendre les blocages les plus frequents.",
        ],
        [
            ("Bouton absent", "Le role connecte n'a probablement pas le droit. Demander a la Direction de verifier le role."),
            ("Compte en attente", "Le compte doit etre valide dans Administration > Utilisateurs par la Direction."),
            ("Stock insuffisant", "Verifier le stock de l'article dans le menu Stock ou demander une reception/correction."),
            ("Article introuvable", "Verifier que l'article est actif et non archive."),
            ("Facture deja payee", "Consulter l'historique des paiements avant d'ajouter un nouveau paiement."),
            ("Besoin deja regroupe", "Le besoin est deja lie a une commande fournisseur."),
            ("Ecart non justifie", "Saisir un motif clair puis demander validation Direction."),
            ("Export bloque", "Verifier que le navigateur autorise le telechargement de fichiers."),
        ],
    ),
]


REPLACEMENTS = {
    "La Residence": "La R\u00e9sidence",
    "Date de generation": "Date de g\u00e9n\u00e9ration",
}

def fr(text: str) -> str:
    for before, after in REPLACEMENTS.items():
        text = text.replace(before, after)
    return text


def markdown() -> str:
    lines = [f"# {TITLE}", "", f"Date de generation : {date.today().isoformat()}", ""]
    for title, paragraphs, actions in sections:
        lines += [f"## {title}", ""]
        for paragraph in paragraphs:
            lines += [fr(paragraph), ""]
        if actions:
            lines += ["| Fonction | Comment faire |", "|---|---|"]
            for name, text in actions:
                lines.append(f"| {fr(name)} | {fr(text)} |")
            lines.append("")
    return "\n".join(lines)


def paragraph_xml(text: str, style: str | None = None) -> str:
    style_xml = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ""
    return f"<w:p>{style_xml}<w:r><w:t>{escape(fr(text))}</w:t></w:r></w:p>"


def table_xml(rows: list[tuple[str, str]]) -> str:
    xml = [
        "<w:tbl>",
        '<w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/></w:tblPr>',
        "<w:tr>",
        "<w:tc><w:p><w:r><w:t>Fonction</w:t></w:r></w:p></w:tc>",
        "<w:tc><w:p><w:r><w:t>Comment faire / resultat attendu</w:t></w:r></w:p></w:tc>",
        "</w:tr>",
    ]
    for left, right in rows:
        xml.extend(
            [
                "<w:tr>",
                f"<w:tc>{paragraph_xml(left)}</w:tc>",
                f"<w:tc>{paragraph_xml(right)}</w:tc>",
                "</w:tr>",
            ]
        )
    xml.append("</w:tbl>")
    return "".join(xml)


def document_xml() -> str:
    body = [paragraph_xml(TITLE, "Title"), paragraph_xml(f"Date de generation : {date.today().isoformat()}")]
    for title, paragraphs, actions in sections:
        body.append(paragraph_xml(title, "Heading1"))
        for paragraph in paragraphs:
            body.append(paragraph_xml(paragraph))
        if actions:
            body.append(table_xml(actions))
    body.append('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1000" w:bottom="1440" w:left="1000" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>')
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{''.join(body)}</w:body>"
        "</w:document>"
    )


CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"""

RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"""

DOC_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>
"""

STYLES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:color w:val="1E3A8A"/><w:sz w:val="28"/></w:rPr></w:style>
  <w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="D4AF37"/><w:left w:val="single" w:sz="4" w:space="0" w:color="D4AF37"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="D4AF37"/><w:right w:val="single" w:sz="4" w:space="0" w:color="D4AF37"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="D4AF37"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="D4AF37"/></w:tblBorders></w:tblPr></w:style>
</w:styles>
"""

CORE = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>{escape(TITLE)}</dc:title>
  <dc:creator>La Residence</dc:creator>
  <cp:lastModifiedBy>La Residence</cp:lastModifiedBy>
</cp:coreProperties>
"""

APP = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Office Word</Application>
</Properties>
"""


def write_docx() -> None:
    with ZipFile(DOCX_PATH, "w", ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", CONTENT_TYPES)
        docx.writestr("_rels/.rels", RELS)
        docx.writestr("word/_rels/document.xml.rels", DOC_RELS)
        docx.writestr("word/document.xml", document_xml())
        docx.writestr("word/styles.xml", STYLES)
        docx.writestr("docProps/core.xml", CORE)
        docx.writestr("docProps/app.xml", APP)


def main() -> None:
    MD_PATH.write_text(markdown(), encoding="utf-8")
    write_docx()
    print(MD_PATH)
    print(DOCX_PATH)


if __name__ == "__main__":
    main()
