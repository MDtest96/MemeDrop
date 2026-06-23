# Release Process — MemeDrop

## Pré-requis

- `gh` CLI authentifié (`gh auth status`)
- Token GitHub valide ou keyring

## Étapes

### 1. Vérifier la version précédente

```bash
gh release list --json tagName,isDraft | grep v1.4
```

Si la release précédente est en **draft**, la publier d'abord :
```bash
gh release edit v1.4.x --draft=false
```

### 2. Bump la version

```bash
cd app
node -e "const p = require('./package.json'); p.version = '1.4.6'; require('fs').writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');"
```

### 3. Commit + Tag + Push

```bash
cd ..
git add app/package.json
git commit -m "chore: bump to v1.4.6"
git push origin master
git tag v1.4.6
git push origin v1.4.6
```

### 4. Build + Publish

```bash
cd app
rm -rf dist
unset GH_TOKEN
GH_TOKEN=$(gh auth token) npx electron-builder --win -p always
```

### 5. Upload les assets (si la release existe déjà en draft)

```bash
unset GH_TOKEN
gh release upload v1.4.6 "dist/memedrop Setup 1.4.6.exe" "dist/memedrop Setup 1.4.6.exe.blockmap" dist/latest.yml --clobber
```

### 6. Vérifier

```bash
gh release view v1.4.6 --json name,tagName,isDraft,url
```

Si `isDraft: true`, publier :
```bash
gh release edit v1.4.6 --draft=false
```

## Notes

- Les releases sont construites avec `electron-builder` (configuration dans `app/package.json`)
- L'auto-updater utilise `latest.yml` pour détecter les nouvelles versions
- Les utilisateurs reçoivent la mise à jour automatiquement au prochain lancement
