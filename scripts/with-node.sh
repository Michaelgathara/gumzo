#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
START_DIR="$(pwd)"

has_required_node() {
  if ! command -v node >/dev/null 2>&1; then
    return 1
  fi

  node <<'EOF'
const [major, minor, patch] = process.versions.node.split(".").map(Number);
const supported =
  major > 22 ||
  (major === 22 && (minor > 22 || (minor === 22 && patch >= 3)));

process.exit(supported ? 0 : 1);
EOF
}

activate_nvm_node() {
  local nvm_dir="${NVM_DIR:-$HOME/.nvm}"

  if [ ! -s "$nvm_dir/nvm.sh" ]; then
    return 1
  fi

  # shellcheck disable=SC1090
  . "$nvm_dir/nvm.sh"
  cd "$ROOT_DIR"
  nvm use --silent >/dev/null
  cd "$START_DIR"
}

if ! has_required_node; then
  activate_nvm_node || true
fi

if ! has_required_node; then
  required_version="$(tr -d '\n' < "$ROOT_DIR/.nvmrc")"
  echo "Gumzo requires Node ${required_version}. Run 'nvm use' or install NVM before retrying." >&2
  exit 1
fi

exec "$@"
