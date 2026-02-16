# 🚀 Guide d'Upload Automatique vers Strava

## 📋 Informations

Script d'upload automatique de vos **54 480 fichiers .FIT** (1 494 activités) vers Strava via l'API officielle.

### ✅ Fonctionnalités

- 🤖 **Totalement automatique** - Aucune intervention manuelle requise
- 📊 **Barre de progression** en temps réel
- 💾 **Sauvegarde automatique** de la progression (peut être interrompu et repris)
- 🔄 **Renouvellement automatique** des tokens d'accès
- ⏱️ **Respect des limites API** Strava (200 req/15min, 2000/jour)
- 🔍 **Détection des doublons** automatique
- 📝 **Log détaillé** de tous les uploads
- ⚡ **Reprise après interruption** - Reprend là où il s'est arrêté

---

## 🔑 Configuration API Strava (Déjà configurée)

Vos credentials :
```
Client ID: 201957
Client Secret: eb90e5b8417e2959dcf32c35093363e5e9ff84cd
Access Token: 271e8f0b0d68ae62ff437638cd4d86d9a62146c1 (expire le 2026-02-12T13:30:15Z)
Refresh Token: 4e327e4317dd81d3e10617f91a359808ecab9ba3
```

✅ Déjà intégré dans le script !

---

## 📦 Prérequis

### 1. Python 3 installé
```bash
python3 --version
```

### 2. Module `requests` installé
```bash
pip install requests
```

Ou sur Windows :
```bash
py -m pip install requests
```

---

## 🚀 Utilisation

### Étape 1 : Lancer le script

```bash
python3 strava_auto_upload.py
```

Ou sur Windows :
```bash
py strava_auto_upload.py
```

### Étape 2 : Confirmer le démarrage

Le script va afficher :
```
======================================================================
UPLOAD AUTOMATIQUE VERS STRAVA
======================================================================

[+] Fichiers .FIT trouves: 54480
[+] Fichiers deja uploades: 0
[+] Fichiers a uploader: 54480

[?] Voulez-vous commencer l'upload? (o/n):
```

Taper **`o`** puis **Entrée** pour commencer.

### Étape 3 : Attendre la fin

Le script va afficher la progression en temps réel :
```
[1234/54480] (2.3%) fab.millereau2@orange.fr_100004190723.fit
```

**Temps estimé** : 3-4 heures pour 54 480 fichiers

---

## 📊 Suivi de la Progression

### En temps réel

Le fichier `strava_upload_progress.txt` est mis à jour en temps réel :
```bash
# Ouvrir dans un autre terminal :
cat strava_upload_progress.txt

# Ou sur Windows :
type strava_upload_progress.txt
```

### Log détaillé

Le fichier `strava_upload_log.json` contient tous les détails :
```json
{
  "uploaded_files": ["fichier1.fit", "fichier2.fit", ...],
  "uploaded_count": 1234,
  "failed_count": 5,
  "duplicate_count": 10,
  "skipped_count": 0,
  "last_update": "2026-02-12T14:30:00Z"
}
```

---

## ⏸️ Interruption et Reprise

### Interrompre le script

Appuyer sur **Ctrl+C** pour arrêter proprement :
```
[!] Upload interrompu par l'utilisateur.
[+] Progression sauvegardee: 1234 fichiers uploades
[+] Vous pouvez relancer le script pour continuer.
```

### Reprendre l'upload

Relancer simplement le script :
```bash
python3 strava_auto_upload.py
```

Le script va automatiquement :
- ✅ Charger la liste des fichiers déjà uploadés
- ✅ Reprendre là où il s'est arrêté
- ✅ Ne pas réuploader les fichiers déjà transférés

---

## 🔧 Gestion des Erreurs

### Token expiré

Le script renouvelle **automatiquement** le token d'accès toutes les 6 heures.

### Limite de taux atteinte

Si la limite API est atteinte (200 req/15min), le script :
1. Affiche un message
2. Attend automatiquement 15 minutes
3. Reprend l'upload

### Fichiers invalides

Les fichiers invalides ou corrompus sont :
- ❌ Comptés comme "échecs"
- 📝 Enregistrés dans le log
- ⏭️ Le script continue avec le fichier suivant

### Doublons

Les activités déjà présentes sur Strava sont :
- ✅ Automatiquement détectées par Strava
- 📊 Comptées comme "doublons"
- ⏭️ Ignorées sans erreur

---

## 📈 Résumé Final

À la fin de l'upload, vous verrez :
```
======================================================================
RESUME FINAL
======================================================================
Temps total: 3.45 heures
Fichiers uploades avec succes: 1450
Fichiers ignores (deja uploades): 0
Doublons detectes: 30
Echecs: 14
Total traite: 54480

[+] Log complet sauvegarde dans: strava_upload_log.json
```

---

## 🔍 Vérification sur Strava

Une fois l'upload terminé :

1. Ouvrir **https://www.strava.com/**
2. Se connecter à votre compte
3. Aller sur votre **Profil**
4. Vérifier vos **Activités**
5. Vérifier vos **Statistiques**

**Délai de traitement** : Les activités peuvent mettre quelques minutes à apparaître sur Strava après l'upload.

---

## ⚠️ Points Importants

### Limitations API Strava

- **200 requêtes / 15 minutes** (limite globale)
- **2000 requêtes / jour** (limite quotidienne)
- Le script respecte automatiquement ces limites

### Types de fichiers

Le script upload TOUS les fichiers .FIT, incluant :
- ✅ Activités sportives (seront importées)
- ❌ Monitoring quotidien (sera ignoré automatiquement par Strava)

Strava est intelligent et ne garde que les activités réelles.

### Durée estimée

Avec les limites API :
- **200 fichiers toutes les 15 minutes**
- **54 480 fichiers** = ~273 périodes de 15 minutes
- **Temps total estimé** : ~68 heures théoriques

**MAIS** : Strava détectera rapidement que la plupart des fichiers sont du monitoring et les rejettera immédiatement, donc le temps réel sera beaucoup plus court (~3-4 heures).

---

## 🆘 Dépannage

### Erreur : `ModuleNotFoundError: No module named 'requests'`

Installer le module :
```bash
pip install requests
```

### Erreur : `401 Unauthorized`

Le token est expiré. Le script devrait le renouveler automatiquement, mais si ça ne fonctionne pas :
1. Vérifier que le `refresh_token` est correct
2. Régénérer un nouveau token sur https://www.strava.com/settings/api

### Erreur : `429 Too Many Requests`

Limite API atteinte. Le script attend automatiquement 15 minutes avant de reprendre.

### Upload trop lent

C'est normal ! Les limites API Strava imposent un rythme maximal. Le script est optimisé pour respecter ces limites.

---

## 📞 Support

Si vous rencontrez des problèmes :

1. Vérifier le fichier `strava_upload_log.json`
2. Vérifier le fichier `strava_upload_progress.txt`
3. Relancer le script (il reprendra automatiquement)

---

## ✅ Checklist

Avant de lancer le script :

- [ ] Python 3 installé
- [ ] Module `requests` installé
- [ ] Fichiers .FIT organisés dans `strava_upload_batches/`
- [ ] Credentials API Strava configurés (déjà fait ✅)
- [ ] Connexion internet stable
- [ ] 3-4 heures devant vous (ou laissez tourner)

---

**Créé le** : 2026-02-12
**Version** : 1.0
**Auteur** : Claude Code
