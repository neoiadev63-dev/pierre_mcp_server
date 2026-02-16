# 🚀 Guide de Connexion Rapide - Pierre MCP Server

## 📋 Identifiants Disponibles

### 🔐 Utilisateur Principal (Votre compte)
```
Email    : neo.ia.dev.63@gmail.com
Password : 06E9816931sbg!
Role     : Admin
```

### 👤 Compte Admin par défaut
```
Email    : admin@pierre.mcp
Password : adminpass123
Role     : Super Admin
```

### 🧪 Comptes de Test
```
Email    : webtest@pierre.dev
Password : (utilisez le CLI si besoin)

Email    : mobiletest@pierre.dev
Password : (utilisez le CLI si besoin)
```

---

## 🖥️ Configuration à 2 Terminaux

### Terminal 1️⃣ : Serveur Pierre (Toujours en premier)

**Démarrer le serveur Pierre MCP :**
```bash
cd C:\Users\fabmi\PierreCoach\pierre_mcp_server
cargo run --bin pierre-mcp-server
```

**Attendre de voir :**
```
✅ Pierre MCP Server running on http://127.0.0.1:8081
```

---

### Terminal 2️⃣ : Commandes de Test et Connexion

**1. Tester que le serveur répond :**
```bash
curl -s http://localhost:8081/health
```
✅ Devrait retourner : `{"status":"ok","service":"pierre-mcp-server"}`

---

**2. Se connecter avec votre compte (neo.ia.dev.63@gmail.com) :**
```bash
curl -s -X POST http://localhost:8081/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&username=neo.ia.dev.63@gmail.com&password=06E9816931sbg!"
```

**Ou avec le compte admin par défaut :**
```bash
curl -s -X POST http://localhost:8081/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&username=admin@pierre.mcp&password=adminpass123"
```

---

**3. Extraire et sauvegarder le token (Windows) :**

**PowerShell :**
```powershell
$response = Invoke-RestMethod -Uri "http://localhost:8081/oauth/token" `
  -Method POST `
  -ContentType "application/x-www-form-urlencoded" `
  -Body "grant_type=password&username=neo.ia.dev.63@gmail.com&password=06E9816931sbg!"

$token = $response.access_token
Write-Host "Token : $token"

# Sauvegarder dans une variable d'environnement
$env:PIERRE_TOKEN = $token
```

**Git Bash :**
```bash
TOKEN=$(curl -s -X POST http://localhost:8081/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&username=neo.ia.dev.63@gmail.com&password=06E9816931sbg!" \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

echo "Token : $TOKEN"
export PIERRE_TOKEN=$TOKEN
```

---

**4. Utiliser le token pour appeler l'API :**
```bash
# Git Bash
curl -s -H "Authorization: Bearer $PIERRE_TOKEN" \
  http://localhost:8081/api/athlete

# PowerShell
Invoke-RestMethod -Uri "http://localhost:8081/api/athlete" `
  -Headers @{ Authorization = "Bearer $env:PIERRE_TOKEN" }
```

---

## 🆘 Dépannage Rapide

### ❌ Erreur "Connection refused"
```bash
# Vérifier si le serveur tourne
netstat -an | grep 8081

# Si rien → Relancer Terminal 1️⃣
```

### ❌ Erreur "Invalid email or password"
```bash
# Vérifier que l'utilisateur existe
sqlite3 data/users.db "SELECT email FROM users WHERE email = 'neo.ia.dev.63@gmail.com';"

# Si vide → Recréer l'utilisateur
cargo run --bin pierre-cli -- user create \
  --email "neo.ia.dev.63@gmail.com" \
  --password "06E9816931sbg!" \
  --name "Neo"
```

### ❌ Base de données corrompue
```bash
# Sauvegarder l'ancienne base
mv data/users.db data/users.db.backup

# Réinitialiser avec le setup
cargo run --bin pierre-cli -- user create \
  --email "admin@pierre.mcp" \
  --password "adminpass123" \
  --name "Admin" \
  --super-admin
```

---

## 🔧 Commandes Utiles du CLI

### Créer un nouvel utilisateur
```bash
cargo run --bin pierre-cli -- user create \
  --email "nouveau@example.com" \
  --password "MotDePasse123!" \
  --name "Nom Utilisateur"
```

### Créer un super admin
```bash
cargo run --bin pierre-cli -- user create \
  --email "superadmin@example.com" \
  --password "SuperPass123!" \
  --name "Super Admin" \
  --super-admin
```

### Forcer la mise à jour d'un utilisateur existant
```bash
cargo run --bin pierre-cli -- user create \
  --email "neo.ia.dev.63@gmail.com" \
  --password "NouveauPass123!" \
  --name "Neo" \
  --force
```

---

## 📊 Vérifier les Utilisateurs dans la Base

```bash
# Lister tous les utilisateurs
sqlite3 data/users.db "SELECT email, display_name, is_admin, user_status FROM users;"

# Chercher un utilisateur spécifique
sqlite3 data/users.db "SELECT * FROM users WHERE email = 'neo.ia.dev.63@gmail.com';"

# Compter les utilisateurs
sqlite3 data/users.db "SELECT COUNT(*) FROM users;"
```

---

## 🌐 URLs Importantes

- **Serveur API** : http://localhost:8081
- **Health Check** : http://localhost:8081/health
- **OAuth Token** : http://localhost:8081/oauth/token
- **Frontend Web** : http://localhost:8082 (si démarré)
- **Mobile Expo** : http://localhost:8082 (Metro bundler)

---

## 📝 Workflow Typique

1. **Terminal 1** : `cargo run --bin pierre-mcp-server` ➡️ Attendre "Server running"
2. **Terminal 2** : `curl http://localhost:8081/health` ➡️ Vérifier la santé
3. **Terminal 2** : Se connecter avec curl (voir commandes ci-dessus)
4. **Terminal 2** : Extraire le token et l'utiliser pour les appels API
5. Développer / tester en utilisant le token pour authentifier vos requêtes

---

## 💾 Variables d'Environnement Importantes (.envrc)

```bash
# Base de données
DATABASE_URL="sqlite:./data/users.db"

# Ports
HTTP_PORT="8081"           # Port du serveur Pierre
OAUTH_CALLBACK_PORT="35535" # Port pour les callbacks OAuth

# Credentials admin par défaut (dev/test)
ADMIN_EMAIL="admin@pierre.mcp"
ADMIN_PASSWORD="adminpass123"

# Encryption (générer avec: openssl rand -base64 32)
PIERRE_MASTER_ENCRYPTION_KEY="AXPV72EqM0z0KOpkoHdxNV3olmVuZI+P2CBV6Jqb8FQ="
```

---

## ✅ Checklist de Démarrage Rapide

- [ ] Terminal 1 : Serveur démarré (`cargo run --bin pierre-mcp-server`)
- [ ] Terminal 2 : Health check OK (`curl localhost:8081/health`)
- [ ] Terminal 2 : Connexion réussie (obtenir le token)
- [ ] Token sauvegardé dans `$PIERRE_TOKEN` ou `$env:PIERRE_TOKEN`
- [ ] Test d'un endpoint API avec le token

---

**Dernière mise à jour** : 2026-02-12
**Database** : `./data/users.db` (18 MB)
**Version** : Pierre MCP Server 0.2.0
