#!/bin/bash
# VYRDON Model Installation Script
# Installs Deepseek, MiniMax, Qwen, and other models to Ollama

set -e

OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
LOG_FILE="${HOME}/.vyrdon/model_install.log"

mkdir -p "$(dirname "$LOG_FILE")"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting VYRDON model installation..." | tee -a "$LOG_FILE"

# Check if Ollama is running
check_ollama() {
  if ! curl -s "$OLLAMA_HOST/api/tags" > /dev/null 2>&1; then
    echo "[ERROR] Ollama is not running at $OLLAMA_HOST"
    echo "Start Ollama with: ollama serve"
    return 1
  fi
  echo "[OK] Ollama is running" | tee -a "$LOG_FILE"
  return 0
}

# Install model function
install_model() {
  local model=$1
  echo "[*] Installing $model..." | tee -a "$LOG_FILE"

  if ollama pull "$model" 2>&1 | tee -a "$LOG_FILE"; then
    echo "[✓] $model installed successfully" | tee -a "$LOG_FILE"
  else
    echo "[✗] Failed to install $model" | tee -a "$LOG_FILE"
    return 1
  fi
}

# List installed models
list_models() {
  echo "[*] Currently installed models:" | tee -a "$LOG_FILE"
  curl -s "$OLLAMA_HOST/api/tags" | jq -r '.models[].name' 2>/dev/null || echo "No models found"
}

# Main installation flow
main() {
  check_ollama || exit 1

  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║         VYRDON MODEL INSTALLATION                            ║"
  echo "║                                                              ║"
  echo "║  Installing AI Models for VYRDEN.COM                         ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""

  # Deepseek Models
  echo "[Phase 1] Installing Deepseek models..."
  install_model "deepseek-coder:6.7b" || true
  install_model "deepseek-coder:33b" || true

  # Qwen Models
  echo "[Phase 2] Installing Qwen models..."
  install_model "qwen:7b" || true
  install_model "qwen:14b" || true

  # MiniMax (via compatible provider)
  echo "[Phase 3] Installing alternative models..."
  install_model "mistral:7b" || true        # MiniMax-compatible base
  install_model "neural-chat:7b" || true    # Optimized inference

  # GPT-compatible models
  echo "[Phase 4] Installing GPT-compatible models..."
  install_model "neural-chat:latest" || true
  install_model "dolphin-mixtral:latest" || true

  # Ensure core models are present
  echo "[Phase 5] Ensuring core models..."
  install_model "llama3.2:3b" || true
  install_model "llama2:7b" || true

  echo ""
  list_models

  echo ""
  echo "[✓] Model installation complete!" | tee -a "$LOG_FILE"
  echo "[*] Log: $LOG_FILE"
}

main "$@"
