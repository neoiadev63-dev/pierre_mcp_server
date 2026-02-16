# 🏃‍♂️ Guide Complet : Pierre MCP - Votre Coach Personnel IA

## 📋 Vue d'ensemble

Pierre MCP est votre **assistant fitness intelligent** qui analyse vos données Strava en temps réel et vous fournit :
- 📊 **Analyse de charge d'entraînement** (CTL, ATL, TSB)
- 🎯 **Zones d'entraînement personnalisées** (FC, puissance, allure)
- 😴 **Analyse du sommeil et récupération**
- 🥗 **Conseils nutritionnels personnalisés**
- 🤖 **Coaches IA spécialisés** (entraînement, nutrition, récupération)
- 🎪 **Yoga et étirements** adaptés à votre activité
- 📈 **Suivi d'objectifs** avec faisabilité

---

## 🔌 Étape 1 : Connexion Strava (FAIT ✅)

Vous venez de connecter votre compte Strava à Pierre MCP via OAuth.

**Credentials Pierre Server :**
- Email : `neo.ia.dev.63@gmail.com`
- Password : `06E9816931sbg!`

---

## 🤖 Étape 2 : Choisir et Activer un Coach

Pierre propose plusieurs **coaches IA spécialisés** :

### 🏋️ Coaches disponibles

| Coach | Spécialité | Quand l'utiliser |
|-------|-----------|------------------|
| **Training Coach** | Plans d'entraînement, périodisation | Planning hebdomadaire, préparation compétition |
| **Nutrition Coach** | Nutrition sportive, macros | Optimiser l'alimentation, recettes |
| **Recovery Coach** | Sommeil, récupération, prévention blessures | Fatigue, surentraînement, repos |
| **Performance Analyst** | Analyse de données, métriques | Comprendre ses performances |
| **Endurance Coach** | Sports d'endurance (course, vélo, natation) | Améliorer endurance, VO2max |

### 📝 Commandes

```bash
# Lister tous les coaches disponibles
claude> Liste-moi les coaches disponibles

# Activer un coach spécifique
claude> Active le coach Training Coach

# Voir le coach actuel
claude> Quel est mon coach actuel ?

# Créer un coach personnalisé
claude> Crée-moi un coach spécialisé en trail running
```

---

## 📊 Étape 3 : Analyser Votre Condition Physique

### 3.1 📈 Charge d'entraînement (CTL, ATL, TSB)

**CTL (Chronic Training Load)** = Forme physique (fitness sur 6 semaines)
**ATL (Acute Training Load)** = Fatigue (charge des 7 derniers jours)
**TSB (Training Stress Balance)** = Forme - Fatigue

```bash
# Analyse sur les 42 derniers jours (par défaut)
claude> Analyse ma charge d'entraînement

# Analyse personnalisée
claude> Analyse ma charge d'entraînement sur les 60 derniers jours
```

**Interprétation TSB :**
- `TSB > 25` : Très frais, risque de désentraînement
- `TSB 10-25` : Frais, **optimal pour compétition**
- `TSB -10 à 10` : Équilibré, bon pour entraînement normal
- `TSB -30 à -10` : Fatigué mais productif
- `TSB < -30` : **Risque de surentraînement** ⚠️

### 3.2 🔍 Détection de Patterns

Analyse automatique de vos habitudes d'entraînement :

```bash
# Analyser les patterns sur 4 semaines
claude> Détecte mes patterns d'entraînement

# Analyse plus longue
claude> Détecte mes patterns d'entraînement sur 8 semaines
```

**Patterns détectés :**
- ⚖️ Équilibre jours durs/faciles
- 📅 Consistance hebdomadaire
- 📊 Progression du volume
- ⚠️ Signes de surentraînement

### 3.3 💯 Score de Fitness Global

Score de 0-100 basé sur :
- Consistance d'entraînement
- CTL (forme chronique)
- Volume d'entraînement
- Équilibre récupération

```bash
claude> Calcule mon score de fitness global
```

### 3.4 😴 Analyse du Sommeil et Récupération

```bash
# Score de récupération (sommeil + HRV + charge)
claude> Calcule mon score de récupération

# Qualité du sommeil
claude> Analyse la qualité de mon sommeil

# Recommandation repos
claude> Dois-je prendre un jour de repos aujourd'hui ?

# Optimiser horaire de sommeil
claude> Optimise mon horaire de sommeil
```

---

## 🎯 Étape 4 : Zones d'Entraînement Personnalisées

Calculez vos zones basées sur vos métriques réelles :

```bash
# Zones complètes (FC, puissance, allure)
claude> Calcule mes zones d'entraînement personnalisées avec :
- VO2max : 55 ml/kg/min
- FC max : 190 bpm
- FC repos : 50 bpm
- FTP : 250 watts
- Seuil lactique : 180 bpm

# Zones simplifiées (uniquement VO2max requis)
claude> Calcule mes zones avec VO2max 55
```

**Zones calculées :**
- Zone 1 : Récupération active
- Zone 2 : Endurance de base
- Zone 3 : Tempo/seuil aérobie
- Zone 4 : Seuil lactique
- Zone 5 : VO2max
- Zone 6 : Anaérobie
- Zone 7 : Neuromusculaire

---

## 🎪 Étape 5 : Récupération Active

### 5.1 🧘 Séquences de Yoga

```bash
# Yoga post-cardio
claude> Suggère-moi une séquence yoga après ma course

# Yoga du matin
claude> Séquence yoga pour bien commencer la journée

# Yoga repos
claude> Séquence yoga pour jour de repos
```

### 5.2 🤸 Étirements Ciblés

```bash
# Étirements par activité
claude> Suggère-moi des étirements après ma sortie vélo

# Étirements par groupe musculaire
claude> Montre-moi des étirements pour les ischio-jambiers

# Échauffement dynamique
claude> Étirements dynamiques avant une course
```

---

## 🥗 Étape 6 : Nutrition Sportive

### 6.1 📊 Besoins Caloriques et Macros

```bash
claude> Calcule mes besoins nutritionnels :
- Poids : 75 kg
- Taille : 180 cm
- Âge : 35 ans
- Sexe : homme
- Activité : très actif
- Objectif : performance endurance
```

**Résultat :**
- TDEE (maintenance calorique)
- Protéines (g/jour)
- Glucides (g/jour)
- Lipides (g/jour)

### 6.2 ⏱️ Timing des Nutriments

```bash
# Nutrition autour de l'entraînement
claude> Timing des nutriments pour un entraînement intense
```

### 6.3 🍳 Recettes Adaptées

```bash
# Rechercher des aliments USDA
claude> Recherche "poulet grillé" dans la base USDA

# Valider une recette
claude> Valide la nutrition de ma recette

# Sauvegarder une recette
claude> Sauvegarde cette recette
```

---

## 🎯 Étape 7 : Objectifs et Suivi

### 7.1 Créer un Objectif

```bash
# Objectif de distance
claude> Crée un objectif : courir 200km ce mois-ci

# Objectif de fréquence
claude> Objectif : 4 séances par semaine

# Objectif de performance
claude> Objectif : améliorer mon 10km de 2 minutes
```

### 7.2 Analyser la Faisabilité

```bash
claude> Est-ce que courir 300km ce mois est réalisable pour moi ?
```

### 7.3 Suivre la Progression

```bash
claude> Suivi de mon objectif de distance mensuelle
```

### 7.4 Suggestions d'Objectifs

```bash
# Pierre analyse votre historique et suggère des objectifs adaptés
claude> Suggère-moi des objectifs basés sur mon niveau
```

---

## 💬 Exemples de Conversations avec Votre Coach

### 🏃 Scénario 1 : Planning Hebdomadaire

```
Vous : Active le Training Coach

Coach : Training Coach activé ! Comment puis-je vous aider ?

Vous : Analyse ma charge d'entraînement et dis-moi ce que je dois faire cette semaine

Coach : [Analyse CTL, ATL, TSB]
Votre TSB est à -15, vous êtes légèrement fatigué mais dans la zone productive.
Cette semaine, je recommande :
- 2 séances intensives (seuil lactique)
- 2 séances endurance de base (zone 2)
- 1 jour de repos actif (yoga ou natation douce)
- 2 jours de repos complet

Évitez les intensités zone 5-6 cette semaine pour optimiser la récupération.
```

### 🍎 Scénario 2 : Nutrition Pré-Compétition

```
Vous : Active le Nutrition Coach

Coach : Nutrition Coach activé !

Vous : J'ai une course de 10km dimanche, comment dois-je manger cette semaine ?

Coach : [Analyse vos besoins]
Voici votre plan nutritionnel pré-compétition :

**Lundi-Vendredi** : Maintenance
- 2800 kcal/jour
- Glucides : 350g (50%)
- Protéines : 140g (20%)
- Lipides : 93g (30%)

**Samedi** : Charge glucidique
- 3200 kcal
- Glucides : 500g (65%)
- Protéines : 120g (15%)
- Lipides : 71g (20%)

**Dimanche matin** (2h avant course) :
- Toast + miel + banane
- 300ml eau
```

### 😴 Scénario 3 : Récupération et Repos

```
Vous : Active le Recovery Coach

Coach : Recovery Coach activé !

Vous : Je me sens très fatigué, analyse ma récupération

Coach : [Analyse sommeil, HRV, charge]
⚠️ Attention : Signes de fatigue importante détectés

**Score de récupération : 35/100** (faible)
- Sommeil : 6h15 (insuffisant)
- HRV : -15% vs baseline
- TSB : -28 (forte fatigue)

**Recommandation : JOE DE REPOS OBLIGATOIRE**

Actions immédiates :
1. ❌ PAS d'entraînement intensif cette semaine
2. ✅ 2-3 jours de repos complet
3. 😴 Optimiser le sommeil (8h minimum)
4. 🧘 Yoga doux ou marche légère uniquement
5. 🥗 Nutrition anti-inflammatoire

Reprenez progressivement quand votre HRV remonte à baseline.
```

---

## 🛠️ Commandes Utiles

### 📊 Récupérer vos Données

```bash
# Vos 20 dernières activités
claude> Récupère mes 20 dernières activités

# Statistiques complètes
claude> Montre-moi mes statistiques Strava

# Profil athlète
claude> Affiche mon profil athlète
```

### 🔧 Configuration

```bash
# Voir la config actuelle
claude> Quelle est ma configuration fitness ?

# Mettre à jour
claude> Mets à jour ma config avec VO2max 58

# Profils disponibles
claude> Quels profils de configuration sont disponibles ?
```

---

## 🎓 Concepts Clés

### CTL (Chronic Training Load)
**Forme physique sur 6 semaines** (42 jours)
- Augmente lentement avec entraînement régulier
- Objectif : progression de 5-10 par semaine maximum
- Plus CTL est élevé, plus vous pouvez absorber de charge

### ATL (Acute Training Load)
**Fatigue des 7 derniers jours**
- Augmente/diminue rapidement
- Reflète votre charge d'entraînement récente
- Doit être géré pour éviter surentraînement

### TSB (Training Stress Balance)
**Forme - Fatigue = État actuel**
- Indicateur clé pour planifier entraînement et repos
- Guide pour savoir si vous êtes prêt à performer

### VO2max
**Consommation maximale d'oxygène** (ml/kg/min)
- Indicateur de fitness cardiovasculaire
- Utilisé pour calculer zones d'entraînement
- S'améliore avec entraînement ciblé zone 4-5

### FTP (Functional Threshold Power)
**Puissance maximale soutenable 1h** (watts)
- Référence pour zones d'entraînement cyclisme
- Test : 20min max effort × 0.95

### HRV (Heart Rate Variability)
**Variabilité fréquence cardiaque**
- Indicateur de récupération et stress
- ↗️ HRV = bonne récupération
- ↘️ HRV = fatigue ou stress

---

## 🚀 Workflow Optimal

### 1️⃣ **Lundi Matin** : Planification Hebdomadaire
```bash
claude> Active Training Coach
claude> Analyse ma charge d'entraînement
claude> Détecte mes patterns sur 4 semaines
claude> Quelle doit être ma semaine d'entraînement ?
```

### 2️⃣ **Chaque Matin** : Check Récupération
```bash
claude> Active Recovery Coach
claude> Calcule mon score de récupération
claude> Dois-je m'entraîner aujourd'hui ?
```

### 3️⃣ **Avant Séance** : Validation Intensité
```bash
claude> Mon TSB actuel permet-il une séance intensive ?
claude> Calcule mes zones pour la séance d'aujourd'hui
```

### 4️⃣ **Après Séance** : Récupération Active
```bash
claude> Suggère étirements après ma course
claude> Timing des nutriments post-entraînement
```

### 5️⃣ **Dimanche Soir** : Bilan Semaine
```bash
claude> Récupère mes activités de la semaine
claude> Calcule ma progression vers mes objectifs
claude> Score de fitness global
```

---

## 🎯 Objectifs Réalistes

### Débutant
- **Fréquence** : 3-4 séances/semaine
- **Volume** : Augmenter de 10% par semaine max
- **Intensité** : 80% zone 2, 20% zones 3-4

### Intermédiaire
- **Fréquence** : 4-6 séances/semaine
- **Volume** : Progression 5-8% par semaine
- **Intensité** : 70% zone 2, 20% zones 3-4, 10% zones 5-6

### Avancé
- **Fréquence** : 6-10 séances/semaine
- **Volume** : Progression 3-5% par semaine
- **Intensité** : Périodisation complexe (base/build/peak/taper)

---

## ⚠️ Signaux d'Alerte

### Risque de Surentraînement
- ❌ TSB < -30 pendant plus de 2 semaines
- ❌ HRV constamment en baisse
- ❌ Fatigue persistante malgré repos
- ❌ Performances en baisse
- ❌ Troubles du sommeil
- ❌ Perte d'appétit

**Action :** Repos immédiat, consulter Recovery Coach

### Désentraînement
- ⚠️ TSB > 25 pendant plus d'une semaine
- ⚠️ CTL en baisse rapide
- ⚠️ Absence de stimulation d'entraînement

**Action :** Reprendre progressivement

---

## 📞 Support et Questions

Pour toute question ou problème :

```bash
claude> Comment utiliser [fonctionnalité] ?
claude> Explique-moi [concept]
claude> Aide-moi avec [problème]
```

---

## ✅ Checklist Démarrage

Avant de commencer votre coaching :

- [x] Compte Strava connecté à Pierre MCP
- [x] Upload des activités historiques terminé (991/54480...)
- [ ] Coach activé (Training/Nutrition/Recovery)
- [ ] Configuration fitness définie (VO2max, FC, FTP)
- [ ] Premier objectif créé
- [ ] Première analyse de charge effectuée

---

**Créé le** : 2026-02-12
**Version** : 1.0
**Auteur** : Claude Code + Pierre MCP Server

**Bon coaching ! 🏃‍♂️💪🚀**
