#!/bin/bash

echo "========================================"
echo "  PRD Analyzer — Push to GitHub"
echo "========================================"

if [ -z "$GITHUB_TOKEN" ]; then
  echo ""
  echo "ERROR: GITHUB_TOKEN is not set."
  echo ""
  echo "To fix this:"
  echo "  1. Click the lock icon (Secrets) in the left sidebar"
  echo "  2. Add a new secret:"
  echo "       Key:   GITHUB_TOKEN"
  echo "       Value: your ghp_... token from github.com/settings/tokens"
  echo "  3. Run this workflow again"
  echo ""
  exit 1
fi

REPO_URL="https://${GITHUB_TOKEN}@github.com/smanikanta233/prd-engineering-gap-analyzer.git"

echo ""
echo "Setting up GitHub remote..."
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"

echo "Pushing all commits to GitHub..."
git push -u origin main

if [ $? -eq 0 ]; then
  echo ""
  echo "SUCCESS! All commits pushed to GitHub."
  echo "View your repo at: https://github.com/smanikanta233/prd-engineering-gap-analyzer"
  echo ""
else
  echo ""
  echo "PUSH FAILED. Check that:"
  echo "  - Your GITHUB_TOKEN is correct (starts with ghp_)"
  echo "  - The token has 'repo' scope"
  echo "  - The repo exists at github.com/smanikanta233/prd-engineering-gap-analyzer"
  echo ""
  exit 1
fi
