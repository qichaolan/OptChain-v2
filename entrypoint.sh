#!/bin/sh
set -e

# Download prompts from GCS using Node.js script
# This avoids needing the large gcloud SDK in the image
node /app/scripts/download-prompts.js

# Execute the main command
exec "$@"
