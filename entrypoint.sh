#!/bin/bash
set -e

# Download prompts from GCS if the path is configured
if [ -n "$GCS_PROMPTS_PATH" ]; then
    echo "Downloading prompts from $GCS_PROMPTS_PATH..."
    gsutil -m cp -r "${GCS_PROMPTS_PATH}/*" /app/prompts/ || {
        echo "Warning: Failed to download prompts from GCS. Continuing anyway..."
    }
    echo "Prompts downloaded successfully."
fi

# Execute the main command
exec "$@"
