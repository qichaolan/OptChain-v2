#!/bin/sh

# Download prompts from GCS using Node.js script (optional, won't fail startup)
# This avoids needing the large gcloud SDK in the image
if [ -f /app/scripts/download-prompts.js ]; then
  node /app/scripts/download-prompts.js || echo "Warning: Prompt download failed, using defaults"
fi

# Execute the main command
exec "$@"
