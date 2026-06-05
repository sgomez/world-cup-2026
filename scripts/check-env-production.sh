#!/bin/sh
# Blocks committing .env.production if any value is not encrypted by dotenvx.
# Encrypted values look like: KEY="encrypted:BF..."
# Safe plaintext lines: comments (#), empty lines, DOTENV_PUBLIC_KEY* assignments.

if ! git diff --cached --name-only | grep -q '^\.env\.production$'; then
  exit 0
fi

if git show :.env.production \
  | grep -E '^[A-Z_]+=' \
  | grep -v '^DOTENV_PUBLIC_KEY' \
  | grep -qv '="encrypted:'; then
  echo ""
  echo "  ERROR: .env.production has unencrypted values."
  echo "  Run:   pnpm env:encrypt"
  echo "  Then stage and commit again."
  echo ""
  exit 1
fi
