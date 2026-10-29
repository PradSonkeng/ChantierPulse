// Manuel d'utilisation — partie 1 : démarrer et guide des pages.

import { ic } from '../ui.js';

export const tip = (t) => `<div class="note info callout">${ic('info', 17)}<div>${t}</div></div>`;
export const warn = (t) => `<div class="note warn callout">${ic('alert', 17)}<div>${t}</div></div>`;
export const good = (t) => `<div class="note good callout">${ic('check', 17)}<div>${t}</div></div>`;
export const eq = (t) => `<div class="eqb">${t}</div>`;
export const fig = (name, caption) => `<figure class="manfig"><div data-fig="${name}"></div><figcaption>${caption}</figcaption></figure>`;
export const role = (...r) => `<div class="roles">${r.map((x) => `<span class="chip info">${x}</span>`).join('')}</div>`;

export const GROUPS = ['Démarrer', 'Guide des pages', 'Comprendre les méthodes', 'Aide'];
const CHEF = 'Chef de chantier', COND = 'Conducteur de travaux', DIR = 'Direction';

export const SECTIONS_1 = [
  /* ═══════════════════════ DÉMARRER ═══════════════════════ */
  {
    id: 'bienvenue', group: 'Démarrer', title: 'À quoi sert ChantierPulse', roles: null,
    keywords: 'présentation introduction objectif probabilité aléa incertitude pilotage',
    html: `<p class="lead">ChantierPulse transforme ce que vous notez chaque jour sur le chantier en <b>probabilités</b> : quelle chance a-t-on de finir à temps ? Un écart de productivité est-il une vraie dérive ou une simple fluctuation ? Combien de pannes faut-il attendre ? Les camions de béton vont-ils faire la queue ?</p>
      <p>Un planning classique donne <i>une</i> date. Mais un chantier est plein d’aléas : la pluie, les pannes, les livraisons en retard, des équipes plus ou moins rapides d’un jour à l’autre. ChantierPulse garde cette incertitude au lieu de la cacher, et vous répond sous la forme : « <b>85 % de chances de finir avant le 15 décembre</b> ».</p>
      <h3>Ce que fait l’application</h3>
      <ul><li><b>Saisie quotidienne</b> rapide (téléphone compris) du rendement des équipes, de la météo, des pannes et des surcoûts.</li>
        <li><b>Contrôle à la saisie</b> : une valeur qui sort de l’ordinaire est signalée tout de suite.</li>
        <li><b>Analyse des écarts</b> par un test statistique (test de Student) : l’écart est-il significatif ?</li>
        <li><b>Prévision de la date de fin</b> par simulation de Monte Carlo (10 000 chantiers virtuels).</li>
        <li><b>Fiabilité des engins</b> : taux de pannes, temps moyen entre pannes (MTBF), disponibilité.</li>
        <li><b>Files d’attente</b> : rotation des camions-toupies au poste de déchargement.</li>
        <li><b>Rapports</b> imprimables et exports Excel (CSV).</li></ul>
      ${warn('<b>Une probabilité n’est pas une promesse.</b> « 85 % » veut dire que sur 100 chantiers semblables, environ 85 finiraient à temps. Les résultats valent ce que valent les données saisies et les durées estimées : voir « Limites et bonnes pratiques ».')}`,
  },
  {
    id: 'premiers-pas', group: 'Démarrer', title: 'Premiers pas en 10 minutes', roles: null,
    keywords: 'démarrage configuration commencer checklist initialisation chantier planning activités engins première saisie',
    html: `<p>Pour que les analyses soient utiles, l’application a besoin de cinq informations de départ. Elles se renseignent dans <b>Paramètres</b> (conducteur de travaux ou direction).</p>
      <ol><li><b>Le chantier</b> (Paramètres › Projet) : nom, lieu, date de début et surtout <b>l’échéance à tenir</b>.</li>
        <li><b>Le planning</b> (Paramètres › Planning) : les tâches restantes, chacune avec trois durées (minimale, probable, maximale) et ses prédécesseurs.</li>
        <li><b>Les activités mesurées</b> (Paramètres › Activités) : coulage, ferraillage, coffrage… avec le rendement prévu au planning.</li>
        <li><b>Les engins</b> (Paramètres › Engins) : ceux dont on veut suivre les pannes.</li>
        <li><b>La première saisie</b> (Saisie quotidienne) : le rendement du jour, la météo, les pannes éventuelles.</li></ol>
      ${tip('Les analyses statistiques demandent un minimum d’historique : <b>5 relevés</b> par activité pour détecter une valeur atypique, <b>8 à 10</b> pour un test de Student fiable, <b>4 semaines</b> pour analyser les pannes. Avant cela, l’application vous le dit au lieu d’inventer un résultat.')}
      <h3>Ensuite, chaque jour</h3>
      <p>Une saisie de 2 à 3 minutes en fin de journée suffit : effectif, météo, quantité et temps de chaque activité, pannes. Le tableau de bord se met à jour tout seul.</p>`,
  },
  {
    id: 'roles', group: 'Démarrer', title: 'Rôles et droits', roles: null,
    keywords: 'droits permissions chef de chantier conducteur direction accès utilisateur lecture seule',
    html: `<p>Chaque personne a un rôle, qui décide de ce qu’elle peut modifier. Tout le monde voit toutes les analyses du chantier auquel il a accès.</p>
      <table><thead><tr><th>Action</th><th>${CHEF}</th><th>${COND}</th><th>${DIR}</th></tr></thead><tbody>
        <tr><td>Saisir rendements, rapport du jour, pannes</td><td>oui</td><td>oui</td><td>oui</td></tr>
        <tr><td>Modifier ou supprimer <i>ses propres</i> saisies</td><td>oui</td><td>oui</td><td>oui</td></tr>
        <tr><td>Modifier, valider ou supprimer les saisies des autres</td><td>non</td><td>oui</td><td>oui</td></tr>
        <tr><td>Ajouter des surcoûts</td><td>non</td><td>oui</td><td>oui</td></tr>
        <tr><td>Planning, activités, engins, réglages du modèle</td><td>non</td><td>oui</td><td>oui</td></tr>
        <tr><td>Gérer les utilisateurs et les accès</td><td>non</td><td>non</td><td>oui</td></tr>
        <tr><td>Créer ou supprimer un chantier</td><td>non</td><td>non</td><td>oui</td></tr></tbody></table>
      <p>Dans la version avec connexion, ces règles sont imposées par la base de données elle-même : même en contournant l’écran, une personne ne peut pas dépasser ses droits. Le <b>premier compte créé</b> reçoit le rôle Direction ; les suivants sont « Chef de chantier » sans accès, jusqu’à ce que la direction les ajoute (Paramètres › Utilisateurs).</p>
      ${tip('Dans l’exemplaire de démonstration, le sélecteur « Voir l’application en tant que » (bandeau jaune en haut) permet d’essayer chaque rôle.')}`,
  },
  {
    id: 'navigation', group: 'Démarrer', title: 'Se repérer dans l’application', roles: null,
    keywords: 'menu navigation recherche raccourci cloche alertes mobile téléphone bandeau démo thème sombre clair apparence',
    html: `<ul><li><b>Menu de gauche</b> : Tableau de bord, Saisie quotidienne, les quatre analyses (écarts, Monte Carlo, fiabilité, files d’attente), Rapports et Paramètres. Les pastilles rouges comptent les points à examiner.</li>
        <li><b>Sélecteur de chantier</b> (en haut du menu) : visible dès que vous avez accès à plusieurs chantiers.</li>
        <li><b>Recherche</b> : tapez le nom d’une tâche, d’une activité, d’un engin ou d’une page, ou utilisez <kbd>Ctrl</kbd> + <kbd>K</kbd> (<kbd>⌘</kbd> + <kbd>K</kbd> sur Mac).</li>
        <li><b>Cloche</b> : liste des alertes et recommandations générées par les contrôles statistiques ; le point rouge signale qu’il y en a de nouvelles.</li>
        <li><b>Bouton de thème</b> (lune, soleil ou écran, à gauche de la cloche) : passe de <b>Automatique</b> à <b>Clair</b> puis <b>Sombre</b> à chaque clic. Pratique sur chantier en plein soleil (clair) ou le soir (sombre).</li>
        <li><b>Sur téléphone</b> : une barre de navigation en bas (Accueil, Saisie, Prévisions, Engins, Menu) ; la saisie se fait en 4 étapes courtes.</li>
        <li><b>Bandeau jaune</b> (démonstration uniquement) : rappelle que les données sont fictives et enregistrées dans votre navigateur.</li>
        <li><b>Bandeau rouge</b> : vous êtes hors connexion ; les saisies de terrain sont gardées sur l’appareil et envoyées au retour du réseau.</li></ul>`,
  },

  /* ═══════════════════════ GUIDE DES PAGES ═══════════════════════ */
  {
    id: 'page-dashboard', group: 'Guide des pages', title: 'Tableau de bord', roles: null,
    keywords: 'accueil probabilité échéance indicateurs avancement criticité alertes relancer simulation',
    html: `<p>La page d’accueil répond à la question : <b>est-ce que ça tient ?</b></p>
      <ul><li><b>Grande carte</b> : probabilité de finir avant l’échéance, courbe de probabilité cumulée, et les dates <b>P50</b> (une chance sur deux), <b>P85</b> et <b>P95</b>. Pour annoncer une date à un client, prenez P85 ou P95 : c’est la date que 85 % (ou 95 %) des simulations respectent.</li>
        <li><b>Avancement physique</b> : part du travail fait, pondérée par la durée probable de chaque tâche, comparée au temps écoulé.</li>
        <li><b>Productivité</b> : l’activité dont l’écart à la prévision est le plus net, avec sa moyenne, son écart-type σ et son coefficient de variation CV.</li>
        <li><b>Pannes cette semaine</b> et <b>surcoût lié aux aléas</b> (intempéries, pannes, retards de livraison).</li>
        <li><b>Tâches critiques</b> : l’indice de criticité est la part des simulations où la tâche se trouve sur le chemin critique. Une tâche à 100 % retarde le chantier à chaque fois qu’elle glisse.</li>
        <li><b>Alertes</b> : écarts significatifs, valeurs atypiques à valider, pannes répétées, pluie fréquente, échéance menacée.</li></ul>
      <p>Le bouton <b>Relancer la simulation</b> recharge les données et recalcule. La mention « calcul local » ou « serveur Python » indique où le calcul a été fait ; les résultats sont les mêmes.</p>
      ${tip('Les alertes passent en « Marge faible » sous 80 % de probabilité et en « Échéance menacée » sous 50 %.')}`,
  },
  {
    id: 'page-saisie', group: 'Guide des pages', title: 'Saisie quotidienne', roles: null,
    keywords: 'saisir rendement quantité temps effectif météo pluie heures perdues brouillon atypique confirmer valider pannes surcoûts étapes mobile hors connexion',
    html: `${role('Chef de chantier', 'Conducteur de travaux', 'Direction')}
      <p>C’est la page que vous utiliserez le plus. Elle suit l’ordre de la journée.</p>
      <h3>1. Choisir la date</h3>
      <p>Par défaut, aujourd’hui. Les flèches et le calendrier permettent de compléter ou de corriger un jour passé ; on ne peut pas saisir une date à venir.</p>
      <h3>2. Contexte du jour</h3>
      <ul><li><b>Effectif présent</b> (personnes réellement sur le chantier) et <b>effectif déclaré</b> (pointage officiel, facultatif) : un effectif présent supérieur au déclaré déclenche un avertissement.</li>
        <li><b>Heures de poste</b> (durée de la journée de travail), <b>heures perdues</b> (pluie, attente, panne) et <b>retard de livraison</b> en heures.</li>
        <li><b>Météo</b> et <b>pluie en mm</b> : la hauteur de pluie sert à estimer le taux de jours bloquants.</li>
        <li><b>Camions reçus</b> et <b>remarques</b> libres.</li></ul>
      <h3>3. Productivité par activité</h3>
      <p>Pour chaque activité, saisissez la <b>quantité</b> réalisée et le <b>temps passé</b> : le <b>rendement</b> (quantité ÷ temps) se calcule seul. Vous pouvez aussi taper directement le rendement si vous n’avez que lui. Laissez vide les activités non réalisées ce jour-là.</p>
      <p>Dès que le rendement est saisi, la colonne <b>Contrôle</b> le compare à l’historique récent :</p>
      <ul><li><b>Dans l’intervalle</b> : valeur normale, enregistrée directement.</li>
        <li><b>Atypique</b> : valeur hors de l’intervalle de prédiction à 95 %. Deux choix : <b>cocher « Je confirme cette valeur »</b> (elle compte dans les statistiques) ou l’enregistrer telle quelle : elle sera alors marquée <b>« à valider »</b> et <i>ne comptera pas</i> dans les statistiques tant que quelqu’un ne l’a pas validée.</li>
        <li><b>Historique court</b> : moins de 5 relevés, pas de contrôle possible.</li></ul>
      ${fig('range', 'Le bandeau de contrôle : trait noir = rendement prévu, zone bleue = intervalle de prédiction à 95 % (où l’on s’attend à voir 95 % des valeurs ordinaires), point = valeur saisie. Point rouge = hors intervalle.')}
      <p>Le panneau de droite détaille les <b>vérifications de cohérence</b> (effectif, heures, météo, unité plausible) et l’<b>effet sur la loi de productivité</b> : moyenne, écart-type et CV avant et avec votre valeur. Une valeur extrême fait visiblement grimper l’écart-type : c’est ce que le contrôle cherche à éviter.</p>
      <h3>4. Pannes et surcoûts du jour</h3>
      <p><b>Déclarer une panne</b> ouvre une fenêtre : engin, heure, durée d’arrêt en minutes, heures de marche depuis la dernière panne (estimées si vous ne les connaissez pas), coût et cause. Les <b>surcoûts</b> (intempéries, livraison, matériaux…) sont ajoutés par le conducteur de travaux ou la direction.</p>
      <h3>5. Enregistrer</h3>
      <p>Le bouton <b>Enregistrer la saisie</b> crée ou met à jour le rapport du jour et les relevés. Il n’y a <b>qu’une valeur par activité et par jour</b> : enregistrer à nouveau la remplace.</p>
      <ul><li><b>Brouillon automatique</b> : ce que vous tapez est conservé sur l’appareil (« Brouillon enregistré à… »). Fermer la page par erreur ne fait rien perdre.</li>
        <li><b>Dernières saisies</b> : pour chaque ligne, <b>Valider</b> (conserver une valeur atypique), <b>Modifier</b> (rouvre le jour), <b>Écarter</b> / <b>Réintégrer</b> (exclure des statistiques sans supprimer), <b>Supprimer</b>. Vous ne pouvez agir que sur vos propres saisies, sauf conducteur et direction.</li></ul>
      <h3>Sur téléphone</h3>
      <p>La saisie est découpée en 4 étapes : <b>Contexte</b>, <b>Productivité</b>, <b>Contrôle</b>, <b>Validation</b>. Le bouton « Suivant » reste en bas de l’écran ; le récapitulatif de l’étape 4 permet de relire avant d’enregistrer.</p>
      ${good('<b>Sans réseau ?</b> Dans la version avec connexion, rendements, rapports du jour et pannes sont gardés sur l’appareil, puis envoyés automatiquement dès que le réseau revient. Le bandeau rouge indique combien de saisies attendent.')}`,
  },
  {
    id: 'page-ecarts', group: 'Guide des pages', title: 'Analyse des écarts', roles: null,
    keywords: 'écart productivité student test hypothèse p valeur t significatif alpha fenêtre moyenne',
    html: `<p>Cette page répond à : <b>le rendement observé s’écarte-t-il <i>vraiment</i> de la prévision, ou est-ce le hasard ?</b></p>
      <ul><li>Choisissez l’<b>activité</b> avec les onglets (un point rouge signale un écart significatif à la baisse, vert à la hausse).</li>
        <li>Choisissez la <b>période</b> (7 à 60 jours, ou tout l’historique) et le <b>seuil α</b> (1, 5 ou 10 %). Les valeurs par défaut viennent de Paramètres › Modèle.</li>
        <li>Les quatre tuiles donnent la moyenne observée, le rendement prévu, l’écart relatif et la variabilité (σ, CV).</li>
        <li>Le <b>graphique de tendance</b> montre chaque relevé, la prévision (trait noir) et l’<b>intervalle de confiance de la moyenne</b> (bande bleue) : si la prévision sort de la bande, l’écart est significatif.</li>
        <li>Le <b>panneau « Test de Student »</b> pose les hypothèses H₀ / H₁, donne t, les degrés de liberté, la valeur critique et la valeur de p, et conclut en une phrase.</li>
        <li>Le <b>tableau</b> résume toutes les activités ; cliquez une ligne pour l’ouvrir.</li></ul>
      ${fig('student', 'Courbe de Student : les zones orangées sont les « queues » de rejet. Si le t observé (trait noir) tombe dedans, on rejette H₀ : l’écart est significatif.')}
      <p>Les valeurs <b>écartées</b> et celles <b>à valider</b> ne sont pas comptées dans le test ; la page le rappelle sous le graphique.</p>
      ${warn('« Fluctuation normale » veut dire : <i>pas de preuve d’écart</i>, pas : « la prévision est exacte ». Avec peu de relevés, le test manque de puissance ; un avertissement s’affiche sous 8 relevés.')}`,
  },
  {
    id: 'page-monte', group: 'Guide des pages', title: 'Simulation de Monte Carlo', roles: null,
    keywords: 'monte carlo simulation échéance probabilité p50 p85 p95 criticité chemin critique aléas graine confiance scénario et si',
    html: `<p>Cette page simule des milliers de fois la fin du chantier pour estimer la <b>probabilité de tenir l’échéance</b>. Elle sert aussi à tester des scénarios « et si ».</p>
      <h3>Panneau de paramètres</h3>
      <ul><li><b>Nombre de simulations</b> : 10 000 est un bon compromis ; 1 000 donne un résultat rapide mais un peu bruité.</li>
        <li><b>Échéance</b> : changer la date ici est un essai ; rien n’est enregistré sans votre accord.</li>
        <li><b>Niveau de confiance annoncé</b> : « sûr à 85 % » = la date que 85 % des simulations respectent. L’application indique la marge ou le dépassement en jours.</li>
        <li><b>Graine aléatoire</b> : une même graine redonne exactement le même résultat (utile pour comparer deux scénarios sans bruit). Videz-la pour obtenir un tirage différent à chaque lancement.</li>
        <li><b>Pannes d’engins</b> et <b>Pluie</b> : activez ou non les aléas et réglez leur intensité (voir Paramètres › Modèle pour les estimer d’après l’historique).</li></ul>
      <p>Appuyez sur <b>Lancer la simulation</b> après chaque changement. Les boutons <b>Enregistrer pour le chantier</b> (conducteur, direction) et <b>Valeurs du chantier</b> gardent ou annulent vos essais.</p>
      <h3>Résultats</h3>
      <ul><li>La <b>probabilité</b>, les dates P50 / P85 / P95 et un message clair : « Pour être sûr à 85 %, annoncez le… ».</li>
        <li>L’encadré <b>« Sans aléas »</b> chiffre ce que coûtent les pannes et la pluie : en points de probabilité et en jours sur la date médiane.</li>
        <li>L’<b>histogramme</b> de la date de fin (bleu : avant l’échéance, gris : après) et la <b>courbe cumulée</b>.</li>
        <li>Le <b>tableau des tâches</b> : durées min / probable / max, durée simulée moyenne ± σ et <b>criticité</b>. Les tâches les plus critiques sont celles sur lesquelles gagner du temps rapporte le plus.</li></ul>
      ${fig('mc', 'Courbe de probabilité cumulée : lisez la chance de finir au plus tard à chaque date. Ici l’échéance (trait noir) a environ 85 % de chances d’être tenue.')}`,
  },
  {
    id: 'page-fiabilite', group: 'Guide des pages', title: 'Fiabilité des engins', roles: null,
    keywords: 'pannes engins mtbf mttr disponibilité poisson exponentielle lambda maintenance préventive journal',
    html: `<p>Combien de pannes attendre ? Quels engins surveiller ? Cette page analyse le journal des pannes.</p>
      <ul><li><b>Cartes d’engins</b> : cliquez « Parc complet » ou un engin. Chaque carte affiche son <b>MTBF</b> (heures de marche moyennes entre deux pannes), sa <b>disponibilité</b> et son nombre de pannes. « À surveiller » = au moins une panne par semaine en moyenne, ou un MTBF sous 40 h.</li>
        <li><b>Indicateurs</b> : taux λ (pannes par semaine), MTBF, réparation moyenne (MTTR) et disponibilité = MTBF ÷ (MTBF + MTTR).</li>
        <li><b>Pannes par semaine</b> : les barres sont les semaines observées, la courbe orange la loi de Poisson de même moyenne. Un test du χ² dit si l’ajustement est bon.</li>
        <li><b>Temps entre pannes</b> : histogramme des heures de marche entre deux pannes et loi exponentielle (il faut au moins 3 pannes avec les heures de marche renseignées).</li>
        <li><b>Probabilités utiles</b> : aucune panne la semaine prochaine, trois ou plus, tenir 40 h ou 100 h sans panne.</li>
        <li><b>Recommandations</b> : priorité de maintenance, qualité de l’ajustement. Le bouton <b>Utiliser ces taux dans la simulation</b> (conducteur, direction) met à jour le modèle de Monte Carlo.</li></ul>
      ${fig('poisson', 'Les barres (semaines observées) suivent la courbe orange (loi de Poisson) : les pannes arrivent « au hasard », à taux constant.')}
      ${tip('Il faut <b>au moins 4 semaines</b> d’historique pour lancer l’analyse. Renseignez les <b>heures de marche</b> de chaque panne : sans elles, pas de MTBF fiable.')}`,
  },
  {
    id: 'page-files', group: 'Guide des pages', title: 'Files d’attente (camions de béton)', roles: null,
    keywords: 'file attente camion toupie béton erlang ρ occupation poste déchargement cadence lambda mu scénario gantt',
    html: `<p>Pour un coulage, les camions-toupies arrivent au hasard et sont déchargés un par un à un ou plusieurs postes. Quand ils arrivent trop vite, ils font la queue et le béton vieillit. Cette page chiffre l’attente et compare des remèdes.</p>
      <ul><li><b>Curseurs</b> : <b>λ</b> (camions qui arrivent par heure), <b>μ</b> (camions qu’un poste décharge par heure), <b>c</b> (nombre de postes), heures de début et de fin. Tout se recalcule en direct.</li>
        <li><b>Indicateurs</b> : taux d’occupation ρ, part des camions qui attendent, attente moyenne en file (min) et longueur moyenne de file.</li>
        <li><b>Courbes d’attente</b> selon la cadence pour c, c+1 et c+2 postes : on voit le « mur » où l’attente explose.</li>
        <li><b>Camions présents</b> : probabilité d’avoir n camions sur le site à un instant donné.</li>
        <li><b>Simulation d’une matinée</b> : diagramme jour par jour de l’arrivée, de l’attente (gris) et du déchargement (couleur du poste). <b>Tirer une autre matinée</b> change le hasard.</li>
        <li><b>Que faire ?</b> compare la situation actuelle, une cadence réduite et un poste de plus.</li>
        <li><b>Scénarios</b> : enregistrez un réglage pour le retrouver (conducteur, direction).</li></ul>
      ${warn('Si <b>λ ≥ c × μ</b> (les camions arrivent plus vite que la capacité des postes), la file ne se résorbe jamais : l’application affiche « saturé ». Il faut ajouter un poste ou cadencer les livraisons.')}`,
  },
  {
    id: 'page-rapports', group: 'Guide des pages', title: 'Rapports et exports', roles: null,
    keywords: 'rapport imprimer pdf export csv excel sauvegarde synthèse hebdomadaire',
    html: `<ul><li><b>Rapport de pilotage</b> : une synthèse d’une page ou deux — « En bref » rédigé automatiquement, courbe de tenue d’échéance, écarts de productivité, fiabilité, aléas et surcoûts, alertes. Cliquez <b>Imprimer / enregistrer en PDF</b> et choisissez « Enregistrer au format PDF » dans la fenêtre d’impression de votre navigateur.</li>
        <li><b>Exports CSV</b> : rendements, pannes, rapports journaliers, surcoûts et planning. Les fichiers s’ouvrent directement dans Excel en français (séparateur « ; », accents conservés).</li>
        <li>Pour une copie complète et réimportable, voir Paramètres › Données › <b>Sauvegarde complète (JSON)</b>.</li></ul>`,
  },
  {
    id: 'page-parametres', group: 'Guide des pages', title: 'Paramètres', roles: null,
    keywords: 'paramètres réglages projet planning tâches activités engins modèle utilisateurs données compte moteur serveur api',
    html: `<table><thead><tr><th>Onglet</th><th>Contenu</th><th>Qui modifie</th></tr></thead><tbody>
        <tr><td><b>Projet</b></td><td>Nom, lieu, dates, budget, devise. Création et suppression de chantier.</td><td>${COND}, ${DIR}</td></tr>
        <tr><td><b>Planning</b></td><td>Tâches, trois durées, prédécesseurs, statut et avancement, sensibilité à la pluie, ordre.</td><td>${COND}, ${DIR}</td></tr>
        <tr><td><b>Activités</b></td><td>Activités mesurées, unité et rendement prévu μ₀.</td><td>${COND}, ${DIR}</td></tr>
        <tr><td><b>Engins</b></td><td>Engins suivis, heures de marche par semaine, réparation moyenne.</td><td>${COND}, ${DIR}</td></tr>
        <tr><td><b>Modèle</b></td><td>Réglages des simulations et des tests, aléas, moteur de calcul.</td><td>${COND}, ${DIR} (moteur : chacun, sur son appareil)</td></tr>
        <tr><td><b>Utilisateurs</b></td><td>Rôles et accès au chantier.</td><td>${DIR}</td></tr>
        <tr><td><b>Données</b></td><td>Sauvegarde JSON, saisies hors connexion, brouillons, réinitialisation de la démonstration.</td><td>Tous</td></tr>
        <tr><td><b>Compte</b></td><td>Nom affiché, apparence (thème clair, sombre ou automatique), mot de passe, déconnexion.</td><td>Chacun</td></tr>
        <tr><td><b>Manuel d’utilisation</b></td><td>Ce document.</td><td>—</td></tr></tbody></table>
      <h3>Apparence : thème clair, sombre ou automatique</h3>
      <p>Dans <b>Paramètres › Compte › Apparence</b>, ou avec le bouton rond en haut de chaque page (et sur l’écran de connexion), choisissez :</p>
      <ul><li><b>Automatique</b> : l’application suit le réglage de votre téléphone ou de votre ordinateur et change toute seule (par exemple au coucher du soleil).</li>
        <li><b>Clair</b> : fond clair, idéal en plein jour.</li>
        <li><b>Sombre</b> : fond sombre, plus reposant le soir et sur les écrans OLED.</li></ul>
      <p>Les textes, graphiques, alertes, formulaires et fenêtres gardent le même contraste dans les deux thèmes. Le choix est mémorisé <b>dans ce navigateur</b> (il n’est pas partagé avec les autres appareils ni avec les autres personnes). L’<b>impression</b>, les <b>rapports</b> et le <b>PDF</b> restent toujours en clair, pour économiser l’encre.</p>
      <h3>Planning : renseigner une tâche</h3>
      ${role(COND, DIR)}
      <ul><li><b>Trois durées</b> en <b>jours calendaires</b> (dimanches et jours fériés compris) : minimale (tout se passe bien), probable, maximale (tout se passe mal). Il faut : minimum ≤ probable ≤ maximum.</li>
        <li><b>Prédécesseurs</b> : les tâches à terminer avant de commencer celle-ci. L’application refuse les boucles (A dépend de B qui dépend de A).</li>
        <li><b>Statut</b> : « à faire », « en cours » (avec l’avancement en %) ou « terminée ». Une tâche en cours est simulée au prorata du reste à faire ; une tâche terminée disparaît de la simulation.</li>
        <li><b>Exposée à la pluie</b> : cochez les tâches de plein air sensibles (terrassement, coulage, maçonnerie extérieure…). Seules elles perdent du temps les jours de pluie.</li></ul>
      <h3>Modèle : le détail des réglages</h3>
      <ul><li><b>Seuil α</b> : plus il est petit, plus il faut un écart net pour déclencher une alerte (1 % = très prudent, 10 % = sensible).</li>
        <li><b>Niveau de détection des valeurs atypiques</b> : 95 % par défaut.</li>
        <li><b>Fenêtre d’analyse</b> : nombre de jours récents pris en compte pour la productivité (30 par défaut).</li>
        <li><b>Taux de pannes</b> (par jour et par tâche) et <b>durée de réparation</b> ; <b>taux de pluie</b> (part de jours bloquants), <b>perte par épisode</b> et <b>seuil bloquant</b> en mm. Les boutons « Estimer d’après l’historique » proposent des valeurs à vérifier puis enregistrer.</li>
        <li><b>Moteur de calcul</b> : « dans le navigateur » (par défaut, fonctionne hors connexion), « automatique » ou « serveur Python uniquement » (voir « Pour l’administrateur »). <b>Tester la connexion</b> vérifie que le serveur répond ; un serveur gratuit en veille peut mettre une minute à se réveiller.</li></ul>`,
  },
];
