/* Manuel d'utilisation — partie 2 : méthodes, glossaire, FAQ, dépannage, administrateur. */
import { tip, warn, good, eq, fig, role } from './content.js';

export const SECTIONS_2 = [
  /* ═══════════════════════ COMPRENDRE LES MÉTHODES ═══════════════════════ */
  {
    id: 'm-pert', group: 'Comprendre les méthodes', title: 'Durée d’une tâche : la loi Beta-PERT', roles: null,
    keywords: 'beta pert durée minimum probable maximum optimiste pessimiste loi normale incertitude moyenne écart-type',
    html: `<p>Personne ne sait à l’avance combien de jours durera une tâche. Mais on sait donner trois chiffres :</p>
      <ul><li><b>a</b>, le minimum : tout se passe bien ;</li><li><b>m</b>, la durée la plus probable ;</li><li><b>b</b>, le maximum : tout se passe mal.</li></ul>
      <p>La loi <b>Beta-PERT</b> transforme ces trois chiffres en une courbe de probabilité entre a et b, dont le sommet est en m. Sa moyenne et son écart-type valent environ :</p>
      ${eq('moyenne = (a + 4·m + b) / 6 &nbsp;&nbsp;&nbsp; écart-type ≈ (b − a) / 6')}
      <p><b>Exemple</b> : coffrage-ferraillage d’une dalle, a = 5 j, m = 7 j, b = 10 j. Moyenne ≈ 7,2 j, écart-type ≈ 0,8 j. La durée n’est pas symétrique : on peut perdre plus de jours (jusqu’à +3) qu’on n’en gagne (−2).</p>
      ${fig('pert', 'Trois tâches de même durée probable (7 j) mais d’incertitude différente : plus l’écart entre minimum et maximum est grand, plus la courbe est étalée. La courbe bleue est celle de l’exemple (5 – 7 – 10).')}
      <p><b>Pourquoi pas une loi normale ?</b> Une durée ne peut pas être négative et les retards sont en général plus longs que les gains : la loi Beta-PERT, bornée et asymétrique, est plus réaliste qu’une cloche symétrique. C’est la loi utilisée par l’application pour toutes les tâches.</p>
      ${tip('Estimez les trois durées <b>honnêtement</b>, avec les chefs d’équipe. Un maximum trop optimiste donne des probabilités trop flatteuses.')}`,
  },
  {
    id: 'm-productivite', group: 'Comprendre les méthodes', title: 'Productivité : moyenne, écart-type, CV', roles: null,
    keywords: 'productivité rendement moyenne écart-type coefficient de variation dispersion régularité',
    html: `<p>Le rendement d’une équipe varie d’un jour à l’autre. Trois chiffres le résument :</p>
      <ul><li>la <b>moyenne</b> x̄ : le rendement typique ;</li>
        <li>l’<b>écart-type</b> σ (noté s pour un échantillon) : l’amplitude habituelle des variations autour de la moyenne ;</li>
        <li>le <b>coefficient de variation</b> CV = σ ÷ x̄ : la même chose en pourcentage, pour comparer des activités d’unités différentes.</li></ul>
      ${eq('CV = σ / x̄')}
      <p>Repères indicatifs : un CV de 5 à 10 % indique une activité très régulière ; 10 à 25 %, une activité ordinaire ; au-delà de 30 %, une activité irrégulière, souvent soumise à des à-coups (livraisons, météo, panne). Un CV qui grimpe est un signal à comprendre, même quand la moyenne ne bouge pas.</p>`,
  },
  {
    id: 'm-student', group: 'Comprendre les méthodes', title: 'Le test de Student : l’écart est-il réel ?', roles: null,
    keywords: 'student test hypothèse h0 h1 p valeur seuil alpha t degrés de liberté significatif erreur risque puissance échantillon',
    html: `<p>Votre équipe de terrassement devait faire 42 m³/h ; elle a fait en moyenne 38,4 m³/h sur 14 relevés. Est-ce une vraie baisse, ou la malchance de quelques mauvais jours ? Le test de Student tranche.</p>
      <h3>Le raisonnement</h3>
      <ol><li>On suppose d’abord que <b>tout va bien</b> : c’est l’hypothèse <b>H₀</b> « le rendement réel est égal au rendement prévu ». L’hypothèse contraire <b>H₁</b> : « il est différent » (test <i>bilatéral</i> : dans un sens ou dans l’autre).</li>
        <li>On mesure l’écart entre la moyenne observée et la prévision, en le comparant à la variabilité normale (écart-type) et au nombre de relevés :</li></ol>
      ${eq('t = (x̄ − μ₀) / (s / √n) &nbsp;&nbsp;&nbsp; avec n − 1 degrés de liberté')}
      <ol start="3"><li>On calcule la <b>valeur de p</b> : la probabilité d’observer un écart au moins aussi grand <i>si H₀ était vraie</i>.</li>
        <li>Si p est inférieure au <b>seuil α</b> (5 % par défaut), l’écart est jugé trop grand pour être du hasard : on <b>rejette H₀</b>. L’écart est dit <b>significatif</b>.</li></ol>
      <p><b>Exemple (données de démonstration)</b> : x̄ = 38,4 ; μ₀ = 42 ; s = 4,6 ; n = 14 → t = −2,93 avec 13 degrés de liberté, p = 0,012. Comme 0,012 &lt; 0,05, on rejette H₀ : le terrassement est <b>significativement sous la prévision</b>. Il n’y a qu’environ 1 chance sur 80 d’observer un tel écart par hasard.</p>
      ${fig('student', 'Si le t observé tombe dans les zones orangées (les 2,5 % extrêmes de chaque côté pour α = 5 %), l’écart est significatif.')}
      <h3>Lire le résultat sans se tromper</h3>
      <ul><li><b>Significatif</b> ne veut pas dire <i>grave</i> : avec beaucoup de relevés, un écart de 1 % peut être significatif. Regardez aussi l’écart en pourcentage.</li>
        <li><b>Non significatif</b> ne veut pas dire <i>conforme</i> : cela veut dire « pas assez de preuves ». Avec 4 ou 5 relevés, même un gros écart peut ne pas l’être.</li>
        <li>Choisir α, c’est choisir un risque : à 5 %, une activité parfaitement conforme déclenchera une fausse alerte environ une fois sur vingt.</li>
        <li>Le test suppose des relevés <b>indépendants</b> (un par jour) et un rendement qui ne s’écarte pas trop d’une forme de cloche. Il est robuste dès 8 à 10 relevés ; au-dessous, l’application affiche un avertissement.</li></ul>
      <h3>L’intervalle de confiance de la moyenne</h3>
      <p>La bande bleue du graphique de tendance est l’intervalle dans lequel se trouve la vraie moyenne avec 95 % de confiance : x̄ ± t<sub>crit</sub> · s / √n. Si la valeur prévue est <i>hors</i> de la bande, le test est significatif : les deux lectures disent la même chose.</p>`,
  },
  {
    id: 'm-atypique', group: 'Comprendre les méthodes', title: 'Valeurs atypiques : l’intervalle de prédiction', roles: null,
    keywords: 'atypique aberrante outlier intervalle de prédiction confiance contrôle saisie erreur frappe unité',
    html: `<p>Une erreur de frappe (710 au lieu de 71), une mauvaise unité ou un jour vraiment exceptionnel peuvent fausser toutes les statistiques. À la saisie, l’application compare donc chaque valeur à ce qu’on peut raisonnablement attendre d’<b>un seul jour ordinaire</b>.</p>
      ${eq('intervalle de prédiction = x̄ ± t<sub>crit</sub> · s · √(1 + 1/n)')}
      <p><b>Attention à ne pas confondre</b> avec l’intervalle de confiance de la moyenne (x̄ ± t · s/√n), qui est <i>étroit</i> car la moyenne varie peu. L’intervalle de prédiction concerne une valeur isolée ; il est donc plus large, à cause du terme « 1 + ».</p>
      ${fig('range', 'Une valeur saisie hors de la zone bleue est signalée « atypique ».')}
      <ul><li>Il faut au moins <b>5 relevés</b> récents ; sinon l’application le dit et ne signale rien.</li>
        <li>Le niveau de détection est de 95 % par défaut : environ <b>1 valeur ordinaire sur 20</b> sera signalée à tort. Ce n’est pas grave : il suffit de la confirmer.</li>
        <li>Une valeur atypique <b>non confirmée</b> est conservée mais exclue des statistiques (« à valider ») : elle ne peut pas fausser les analyses en silence.</li></ul>
      ${warn('Ne supprimez pas une valeur uniquement parce qu’elle gêne. <b>Écartez</b> ce qui est <i>faux</i> (erreur de saisie, mesure impossible) ; <b>gardez</b> ce qui est <i>réel</i> mais exceptionnel — c’est une information sur le chantier.')}`,
  },
  {
    id: 'm-poisson', group: 'Comprendre les méthodes', title: 'Pannes : lois de Poisson et exponentielle, MTBF', roles: null,
    keywords: 'poisson exponentielle lambda mtbf mttr disponibilité fiabilité khi deux chi2 pannes semaine survie',
    html: `<p>Les pannes arrivent « au hasard », sans mémoire : une machine qui vient de tomber en panne n’est pas plus ou moins « due » qu’une autre. Deux lois décrivent ce hasard, vu sous deux angles.</p>
      <h3>Combien de pannes par semaine ? La loi de Poisson</h3>
      <p>Si l’on compte les pannes semaine après semaine, la moyenne est le <b>taux λ</b> (ex. 1,65 panne par semaine). La loi de Poisson donne la probabilité d’avoir exactement k pannes dans une semaine :</p>
      ${eq('P(k pannes) = e<sup>−λ</sup> · λ<sup>k</sup> / k!')}
      <p>Avec λ = 1,65 : aucune panne dans la semaine = e<sup>−1,65</sup> ≈ 19 % ; trois pannes ou plus ≈ 23 %.</p>
      <p>L’application vérifie que vos pannes <i>suivent bien</i> cette loi avec un <b>test du χ²</b> (khi-deux) : si p ≥ 5 %, l’ajustement est bon. Sinon, les pannes arrivent plutôt « par grappes » (une cause commune), et le taux moyen reste un résumé fragile.</p>
      <h3>Combien de temps entre deux pannes ? La loi exponentielle</h3>
      <p>Mesuré en heures de marche, l’intervalle entre deux pannes suit une loi exponentielle dont la moyenne est le <b>MTBF</b> (<i>Mean Time Between Failures</i>). La probabilité qu’une machine fonctionne t heures sans panne est :</p>
      ${eq('R(t) = e<sup>−t / MTBF</sup>')}
      <p>Avec un MTBF de 32 h, tenir 40 h sans panne n’arrive que 28 % du temps ; 100 h, 4 %.</p>
      <h3>Disponibilité</h3>
      <p>Une machine est tantôt en marche (en moyenne MTBF), tantôt en réparation (en moyenne <b>MTTR</b>, <i>Mean Time To Repair</i>) :</p>
      ${eq('disponibilité = MTBF / (MTBF + MTTR)')}
      ${fig('poisson', 'Pannes par semaine : barres observées et courbe de Poisson.')}
      ${tip('Le taux de pannes par jour et par tâche utilisé dans la simulation est le taux hebdomadaire du parc ÷ 7 ÷ nombre d’engins (une machine par tâche). Il se règle dans Paramètres › Modèle.')}`,
  },
  {
    id: 'm-monte', group: 'Comprendre les méthodes', title: 'Monte Carlo : simuler le chantier 10 000 fois', roles: null,
    keywords: 'monte carlo simulation tirage aléatoire chemin critique criticité percentile p50 p85 p95 convergence graine hypothèses indépendance',
    html: `<p>Prenons un planning de 8 tâches reliées par des dépendances. Avec les durées « probables », il finit à une date. Mais en vrai, chaque durée varie, et les retards s’enchaînent. La simulation de Monte Carlo <b>rejoue le chantier</b> un grand nombre de fois :</p>
      <ol><li>Pour chaque tâche, elle <b>tire une durée au hasard</b> selon sa loi Beta-PERT.</li>
        <li>Elle ajoute les <b>aléas</b> : des pannes (leur nombre suit une loi de Poisson proportionnelle à la durée, chacune ajoutant une durée de réparation aléatoire) et, pour les tâches exposées, des épisodes de pluie qui font perdre du temps.</li>
        <li>Elle calcule la <b>date de fin</b> en respectant les dépendances : une tâche ne commence que quand toutes ses prédécesseurs sont finies ; la fin du chantier est la fin de la dernière tâche.</li>
        <li>Elle recommence N fois (10 000 par défaut), puis regarde la <b>distribution</b> des dates de fin.</li></ol>
      <h3>Lire les résultats</h3>
      <ul><li><b>Probabilité de tenir l’échéance</b> : la part des tirages dont la fin tombe avant la date limite.</li>
        <li><b>P50, P85, P95</b> : dates sous lesquelles tombent respectivement 50 %, 85 % et 95 % des tirages. L’écart entre P50 et P95 mesure l’incertitude totale : plus il est grand, plus le planning est risqué.</li>
        <li><b>Criticité</b> d’une tâche : la part des tirages où elle est sur le chemin critique (celui qui fixe la date de fin). 100 % = toute la durée de la tâche se retrouve dans la date de fin.</li></ul>
      ${fig('mc', 'Probabilité cumulée de la date de fin : on lit directement « chance de finir au plus tard à telle date ».')}
      <h3>Combien de simulations ?</h3>
      <p>Le résultat a lui-même une petite marge d’erreur : environ √(p(1−p)/N). Pour p = 85 % et N = 10 000, c’est ±0,4 point ; avec 1 000 simulations, ±1,1 point. D’où l’intérêt de la <b>graine</b> : en la fixant, vous comparez deux scénarios sans ce bruit.</p>
      <h3>Hypothèses à connaître</h3>
      <ul><li>Les durées des tâches sont tirées <b>indépendamment</b>, sauf les aléas communs de pluie sur les tâches exposées. Dans la réalité, une mauvaise équipe est mauvaise partout : l’incertitude réelle peut donc être un peu <b>plus grande</b> que simulée.</li>
        <li>Les ressources sont supposées <b>suffisantes</b> pour mener en parallèle les tâches qui le peuvent.</li>
        <li>Les durées sont en <b>jours calendaires</b> à partir d’aujourd’hui.</li>
        <li>Les événements exceptionnels (grève, arrêt administratif, défaillance d’un sous-traitant) ne sont pas modélisés.</li></ul>`,
  },
  {
    id: 'm-files', group: 'Comprendre les méthodes', title: 'Files d’attente M/M/c et formule d’Erlang C', roles: null,
    keywords: 'file attente erlang mmc λ μ rho occupation poste camion toupie capacité attente moyenne lq wq saturé',
    html: `<p>Le modèle <b>M/M/c</b> décrit un guichet à <b>c</b> postes où les clients — ici, les camions de béton — arrivent au hasard (« M » pour Markov, loi de Poisson) à raison de <b>λ</b> par heure, et où chaque poste en décharge <b>μ</b> par heure (durée de service aléatoire, loi exponentielle). Un camion qui trouve tous les postes occupés attend en file, premier arrivé, premier servi.</p>
      <ul><li><b>Charge</b> a = λ / μ (en « postes occupés »).</li>
        <li><b>Taux d’occupation</b> ρ = λ / (c × μ). Il doit rester <b>inférieur à 1</b>, sinon la file grandit sans fin.</li>
        <li><b>Probabilité d’attendre</b> (formule d’Erlang C) :</li></ul>
      ${eq('P<sub>att</sub> = [ aᶜ/c! · 1/(1−ρ) ] / [ Σ<sub>k=0…c−1</sub> aᵏ/k! + aᶜ/c! · 1/(1−ρ) ]')}
      <ul><li><b>Attente moyenne</b> en file : W<sub>q</sub> = P<sub>att</sub> / (c·μ − λ) ; <b>longueur moyenne</b> de la file : L<sub>q</sub> = λ · W<sub>q</sub>.</li></ul>
      <p><b>Exemple</b> (démonstration) : λ = 6 camions/h, μ = 5 camions/h par poste, c = 2 postes → ρ = 60 %. Probabilité d’attendre ≈ 45 %, attente moyenne ≈ 6,7 min. Avec un 3ᵉ poste, l’attente tombe à moins d’une minute ; en cadençant les livraisons à 5 camions/h, à 4 min.</p>
      ${tip('L’effet n’est pas proportionnel : passer de ρ = 60 % à 90 % ne multiplie pas l’attente par 1,5, mais par plus de 10. C’est pourquoi un petit retard d’une centrale suffit parfois à bloquer tout le chantier.')}
      <p><b>Limites</b> : les arrivées d’une centrale à béton bien organisée sont souvent <i>plus régulières</i> que du pur hasard, et les durées de déchargement varient moins que dans une loi exponentielle. Le modèle est donc plutôt <b>prudent</b> ; la simulation d’une matinée montre à quoi cela peut ressembler concrètement.</p>`,
  },
  {
    id: 'm-limites', group: 'Comprendre les méthodes', title: 'Limites et bonnes pratiques', roles: null,
    keywords: 'limites précautions bonnes pratiques qualité données confiance interprétation erreur biais jugement',
    html: `<ol><li><b>Saisissez chaque jour.</b> Les statistiques ne valent rien sans historique : 8 à 10 relevés par activité pour les écarts, 4 semaines pour les pannes.</li>
        <li><b>Gardez le planning à jour.</b> Mettez l’avancement des tâches en cours et marquez les tâches terminées : la simulation ne porte que sur le <i>reste à faire</i>.</li>
        <li><b>Des durées honnêtes.</b> « Minimum » et « maximum » ne sont pas des bornes absolues mais des cas favorables et défavorables réalistes. Évitez les fourchettes trop serrées.</li>
        <li><b>Même unité, même mesure.</b> Mesurez toujours le rendement de la même façon (quantité ÷ temps de travail effectif).</li>
        <li><b>N’effacez pas les valeurs qui dérangent</b> : écartez seulement les erreurs avérées.</li>
        <li><b>Une probabilité n’est pas une garantie.</b> 85 % signifie que dans 15 % des cas semblables, on dépasse.</li>
        <li><b>Le modèle ne connaît pas l’imprévisible</b> : grève, décision administrative, défaut de conception… Gardez de la marge pour cela.</li>
        <li><b>Petits échantillons, grandes précautions.</b> Sous 8 relevés, ou 4 semaines de pannes, traitez les résultats comme des indications.</li>
        <li><b>L’outil éclaire, il ne décide pas.</b> Une alerte est une raison d’aller voir sur le terrain, pas un verdict.</li></ol>`,
  },

  /* ═══════════════════════ AIDE ═══════════════════════ */
  {
    id: 'glossaire', group: 'Aide', title: 'Glossaire', roles: null,
    keywords: 'glossaire définitions lexique termes sigles',
    html: `<dl>
      <dt>α (alpha) — seuil de signification</dt><dd>Risque accepté de conclure à tort à un écart. 5 % par défaut.</dd>
      <dt>Atypique (valeur)</dt><dd>Valeur hors de l’intervalle de prédiction : à confirmer ou à corriger.</dd>
      <dt>Beta-PERT</dt><dd>Loi de probabilité construite à partir d’un minimum, d’une valeur probable et d’un maximum.</dd>
      <dt>Chemin critique</dt><dd>Suite de tâches qui détermine la date de fin du chantier : tout retard sur ce chemin retarde la fin.</dd>
      <dt>Coefficient de variation (CV)</dt><dd>Écart-type divisé par la moyenne, en %. Mesure l’irrégularité.</dd>
      <dt>Criticité</dt><dd>Part des simulations où une tâche se trouve sur le chemin critique.</dd>
      <dt>Disponibilité</dt><dd>Part du temps où un engin est utilisable : MTBF / (MTBF + MTTR).</dd>
      <dt>Écart-type (σ)</dt><dd>Amplitude habituelle des variations autour de la moyenne.</dd>
      <dt>Erlang C</dt><dd>Formule donnant la probabilité qu’un client doive attendre dans une file à plusieurs postes.</dd>
      <dt>Graine aléatoire</dt><dd>Nombre qui fixe la suite de « hasards » d’une simulation : même graine, même résultat.</dd>
      <dt>H₀ / H₁</dt><dd>Hypothèse de départ (« tout est conforme ») et son contraire (« il y a un écart »).</dd>
      <dt>Intervalle de confiance (de la moyenne)</dt><dd>Zone où se trouve très probablement la vraie moyenne (95 % de confiance).</dd>
      <dt>Intervalle de prédiction</dt><dd>Zone où l’on s’attend à voir 95 % des valeurs journalières ordinaires. Plus large que l’intervalle de confiance.</dd>
      <dt>λ (lambda)</dt><dd>Taux moyen d’événements : pannes par semaine (fiabilité) ou camions par heure (files d’attente).</dd>
      <dt>μ (mu)</dt><dd>Deux usages : <b>μ₀</b>, le rendement prévu d’une activité, et <b>μ</b>, la cadence de déchargement d’un poste (camions par heure).</dd>
      <dt>MTBF</dt><dd>Temps moyen de marche entre deux pannes.</dd>
      <dt>MTTR</dt><dd>Durée moyenne de réparation.</dd>
      <dt>Monte Carlo</dt><dd>Méthode qui estime une probabilité en répétant un grand nombre de tirages aléatoires.</dd>
      <dt>P50, P85, P95</dt><dd>Dates (ou valeurs) sous lesquelles tombent 50 %, 85 % et 95 % des simulations.</dd>
      <dt>Valeur de p</dt><dd>Probabilité d’observer un écart au moins aussi grand si tout était conforme. Plus elle est petite, plus l’écart est difficile à attribuer au hasard.</dd>
      <dt>Poisson (loi de)</dt><dd>Loi du nombre d’événements rares et indépendants dans un intervalle de temps (pannes, arrivées de camions).</dd>
      <dt>ρ (rho)</dt><dd>Taux d’occupation d’une file : λ / (c × μ). Doit rester sous 100 %.</dd>
      <dt>Student (test de)</dt><dd>Test qui compare une moyenne observée à une valeur de référence en tenant compte du nombre de relevés.</dd>
      <dt>Wq / Lq</dt><dd>Attente moyenne en file / nombre moyen de camions en file.</dd></dl>`,
  },
  {
    id: 'faq', group: 'Aide', title: 'Questions fréquentes', roles: null,
    keywords: 'faq questions réponses aide corriger valeur résultat change hors connexion données privées échéance utilisateur',
    html: `<details class="qa"><summary>Pourquoi le résultat de Monte Carlo change-t-il d’un lancement à l’autre ?</summary><div>Chaque simulation tire des nombres au hasard. Avec 10 000 tirages, la variation reste de l’ordre de ±0,4 point. Fixez une <b>graine</b> pour obtenir exactement le même résultat. Le tableau de bord utilise une graine fixe pour ne pas « bouger » tout seul.</div></details>
      <details class="qa"><summary>J’ai saisi une mauvaise valeur. Comment la corriger ?</summary><div>Dans « Saisie quotidienne », choisissez la date, corrigez le rendement et enregistrez : la valeur du jour est remplacée. Ou utilisez le bouton <b>Modifier</b> dans « Dernières saisies ». Si l’erreur est grossière, vous pouvez aussi <b>Écarter</b> ou <b>Supprimer</b> la saisie.</div></details>
      <details class="qa"><summary>La valeur est inhabituelle mais bien réelle. Que faire ?</summary><div>Cochez « Je confirme cette valeur » avant d’enregistrer, ou cliquez <b>Valider</b> dans « Dernières saisies ». Elle comptera alors dans les statistiques.</div></details>
      <details class="qa"><summary>Que veut dire « historique court » ?</summary><div>Il y a moins de 5 relevés récents pour cette activité : l’application ne peut pas encore dire ce qui est normal. Continuez à saisir.</div></details>
      <details class="qa"><summary>Je lis « 85 % » mais la date P85 est un jour après l’échéance. Est-ce une erreur ?</summary><div>Non. La probabilité affichée est arrondie à l’unité : 84,6 % s’affiche « 85 % » alors que la date sûre à 85 % tombe un jour après l’échéance. Les deux lectures sont cohérentes.</div></details>
      <details class="qa"><summary>Les durées du planning incluent-elles les dimanches ?</summary><div>Les durées sont comptées en <b>jours calendaires</b> : la date de fin est obtenue en ajoutant ces jours à la date du jour. Si vous raisonnez en jours ouvrés, convertissez-les (par exemple 6 jours ouvrés ≈ 7 jours calendaires).</div></details>
      <details class="qa"><summary>Comment changer l’échéance ?</summary><div>Paramètres › Projet (conducteur de travaux, direction). Sur la page Monte Carlo, vous pouvez aussi essayer une autre date sans l’enregistrer.</div></details>
      <details class="qa"><summary>Pourquoi ne puis-je pas modifier le planning ?</summary><div>Seuls le conducteur de travaux et la direction le peuvent. Votre rôle est affiché dans le menu, en bas à gauche.</div></details>
      <details class="qa"><summary>L’application fonctionne-t-elle sans connexion Internet ?</summary><div>Une fois chargée, oui pour la consultation et les calculs (ils se font dans le navigateur). Dans la version avec connexion, les saisies de terrain faites hors réseau sont gardées sur l’appareil et envoyées plus tard. Ouvrir l’application pour la première fois demande du réseau.</div></details>
      <details class="qa"><summary>Où sont enregistrées mes données ?</summary><div>Exemplaire de démonstration : uniquement dans votre navigateur, rien n’est envoyé nulle part. Exemplaire avec connexion : dans votre base Supabase, protégées par des règles qui limitent chaque personne à ses chantiers et à son rôle.</div></details>
      <details class="qa"><summary>Le serveur Python est-il obligatoire ?</summary><div>Non. Tous les calculs existent aussi dans le navigateur, avec les mêmes résultats. Le serveur sert à décharger les appareils modestes et à garder une référence de calcul.</div></details>
      <details class="qa"><summary>Comment passer en thème sombre (ou en clair) ?</summary><div>Cliquez sur le bouton rond en haut de la page (lune, soleil ou écran) : chaque clic passe à l’option suivante (Automatique, Clair, Sombre). Vous pouvez aussi choisir dans <b>Paramètres › Compte › Apparence</b>. En mode Automatique, l’application suit le réglage de votre appareil.</div></details>
      <details class="qa"><summary>Le thème sombre change-t-il les rapports imprimés et le PDF ?</summary><div>Non : l’impression et l’export PDF sont toujours en clair, quel que soit le thème choisi à l’écran.</div></details>
      <details class="qa"><summary>Comment obtenir ce manuel en PDF ?</summary><div>Bouton <b>Télécharger le PDF</b> en haut de cette page, ou <b>Imprimer</b> puis « Enregistrer au format PDF ».</div></details>`,
  },
  {
    id: 'depannage', group: 'Aide', title: 'Dépannage', roles: null,
    keywords: 'problème erreur dépannage serveur veille configuration profil introuvable droits refusé planning incohérent lien expiré',
    html: `<table><thead><tr><th>Ce que vous voyez</th><th>Cause probable</th><th>Que faire</th></tr></thead><tbody>
      <tr><td>« Le serveur de calcul ne répond pas »</td><td>Un serveur gratuit s’endort après quelque temps d’inactivité ; il met jusqu’à une minute à se réveiller.</td><td>Patientez puis relancez, ou passez le moteur en « dans le navigateur » (Paramètres › Modèle).</td></tr>
      <tr><td>« Configuration incomplète » au démarrage</td><td>Adresse et clé Supabase absentes de <code>config.js</code>.</td><td>Voir le guide de déploiement (administrateur).</td></tr>
      <tr><td>« Profil introuvable »</td><td>Le script <code>supabase/schema.sql</code> n’a pas été exécuté.</td><td>L’exécuter dans l’éditeur SQL de Supabase.</td></tr>
      <tr><td>Un enregistrement est refusé</td><td>Droits insuffisants (rôle ou chantier) ou saisie faite par une autre personne.</td><td>Demandez à un conducteur de travaux ou à la direction ; vérifiez vos accès.</td></tr>
      <tr><td>« Planning incohérent »</td><td>Deux tâches avec le même code, un prédécesseur inconnu ou une boucle de dépendances.</td><td>Ouvrez Paramètres › Planning et corrigez la tâche indiquée.</td></tr>
      <tr><td>« Aucune tâche restante »</td><td>Toutes les tâches sont terminées, ou le planning est vide.</td><td>Ajoutez les tâches restantes.</td></tr>
      <tr><td>« Analyse impossible » (fiabilité)</td><td>Moins de 4 semaines d’historique de pannes.</td><td>Continuer à déclarer les pannes ; c’est normal au début.</td></tr>
      <tr><td>Les données de démonstration ont disparu</td><td>Le navigateur a été vidé ou la navigation privée a été fermée.</td><td>Paramètres › Données › Réinitialiser la démonstration.</td></tr>
      <tr><td>Lien de confirmation ou de réinitialisation expiré</td><td>Les liens reçus par e-mail ont une durée limitée.</td><td>Redemandez un lien depuis l’écran de connexion.</td></tr>
      <tr><td>Une saisie « n’apparaît pas » ailleurs</td><td>Elle est hors connexion, en attente d’envoi.</td><td>Le bandeau rouge indique le nombre de saisies en attente ; elles partent au retour du réseau (Paramètres › Données › Envoyer maintenant).</td></tr></tbody></table>`,
  },
  {
    id: 'raccourcis', group: 'Aide', title: 'Raccourcis et astuces', roles: null,
    keywords: 'raccourci clavier astuce ctrl k échap recherche navigation',
    html: `<ul><li><kbd>Ctrl</kbd> + <kbd>K</kbd> (ou <kbd>⌘</kbd> + <kbd>K</kbd>) : recherche rapide.</li>
        <li><kbd>Échap</kbd> : ferme une fenêtre.</li>
        <li>Sur la page Écarts, cliquez une ligne du tableau pour ouvrir l’activité.</li>
        <li>Sur la page Fiabilité, cliquez « Parc complet » ou un engin pour changer l’analyse.</li>
        <li>Page Saisie : les flèches du sélecteur de date vont au jour précédent ou suivant ; « Aujourd’hui » revient à la date du jour.</li>
        <li>Sur téléphone, ajoutez l’application à l’écran d’accueil depuis le menu du navigateur : elle s’ouvre comme une application.</li></ul>`,
  },
  {
    id: 'administrateur', group: 'Aide', title: 'Pour l’administrateur : déploiement et exploitation', roles: ['direction'],
    keywords: 'administrateur déploiement vercel hugging face supabase config.js clé anon jwt origines cors sauvegarde inscription',
    html: `${role('Direction')}
      <p>ChantierPulse se compose de trois éléments indépendants. Le guide <b>GUIDE-DEPLOIEMENT.md</b>, livré avec l’application, détaille chaque étape.</p>
      <table><thead><tr><th>Élément</th><th>Hébergement</th><th>Rôle</th></tr></thead><tbody>
        <tr><td>Interface (HTML, CSS, JavaScript)</td><td>Vercel (ou tout hébergement de fichiers)</td><td>Ce que vous voyez à l’écran ; peut faire tous les calculs seule.</td></tr>
        <tr><td>Serveur de calcul (Python)</td><td>Hugging Face Spaces</td><td>Simulations et tests statistiques (facultatif).</td></tr>
        <tr><td>Base de données et connexion</td><td>Supabase</td><td>Données, comptes, rôles, droits d’accès (exemplaire avec connexion).</td></tr></tbody></table>
      <h3>Réglages à connaître</h3>
      <ul><li><b>config.js</b> (interface) : <code>MODE</code> (« demo » ou « supabase »), <code>SUPABASE_URL</code>, <code>SUPABASE_ANON_KEY</code> (clé publique : « publishable » ou « anon public », visible dans le navigateur par conception), <code>API_URL</code> (adresse du serveur de calcul), <code>ENGINE</code> (« local », « auto » ou « remote »), <code>ALLOW_SIGNUP</code>. N’y mettez <b>jamais</b> la clé secrète (<code>sb_secret_…</code>) ni la clé <code>service_role</code>.</li>
        <li><b>Variables du serveur de calcul</b> : <code>ALLOWED_ORIGINS</code> (adresse de votre interface, pour n’autoriser qu’elle), et — pour exiger une connexion — <code>SUPABASE_JWT_SECRET</code> ou <code>SUPABASE_URL</code>.</li>
        <li><b>Premier compte</b> : il reçoit le rôle Direction. Créez-le vous-même avant de communiquer l’adresse. Ensuite, désactivez les inscriptions libres (<code>ALLOW_SIGNUP: false</code> et réglage Supabase) si vous préférez inviter les personnes.</li>
        <li><b>Sauvegardes</b> : utilisez Paramètres › Données › Sauvegarde complète, et les sauvegardes de votre offre Supabase.</li></ul>`,
  },
];
