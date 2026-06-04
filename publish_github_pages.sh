#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="${1:-ash-leve-toi-marche.github.io}"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI introuvable. Installe gh ou connecte-toi via GitHub Desktop."
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Connexion GitHub requise."
  echo "Lance : gh auth login -h github.com -w"
  exit 1
fi

git branch -M main

if git remote get-url origin >/dev/null 2>&1; then
  echo "Remote origin deja configure : $(git remote get-url origin)"
else
  gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
fi

git push -u origin main

OWNER="$(gh api user --jq .login)"
echo
echo "Page prete."
if [[ "$REPO_NAME" == "$OWNER.github.io" ]]; then
  echo "URL : https://$OWNER.github.io"
else
  echo "URL probable : https://$OWNER.github.io/$REPO_NAME/"
fi

