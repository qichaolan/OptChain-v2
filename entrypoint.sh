#!/bin/sh

# OptChain v2 Entrypoint
# Runs both Next.js frontend and FastAPI backend

echo "Starting OptChain v2..."

# Download prompts from GCS using Node.js script (optional, won't fail startup)
if [ -f /app/scripts/download-prompts.js ]; then
  echo "Downloading prompts from GCS..."
  node /app/scripts/download-prompts.js || echo "Warning: Prompt download failed, using defaults"
fi

# Start FastAPI backend in the background
echo "Starting FastAPI backend on port ${BACKEND_PORT:-8081}..."
cd /app/backend
PYTHONPATH=/app/backend python -m uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${BACKEND_PORT:-8081}" \
  --log-level info &

BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend to be ready..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -s "http://localhost:${BACKEND_PORT:-8081}/health" > /dev/null 2>&1; then
    echo "Backend is ready!"
    break
  fi
  if [ $i -eq 10 ]; then
    echo "Warning: Backend health check timed out, continuing anyway..."
  fi
  sleep 1
done

# Return to app directory for Next.js
cd /app

# Handle shutdown gracefully
trap "echo 'Shutting down...'; kill $BACKEND_PID 2>/dev/null; exit 0" TERM INT

# Execute the main command (Next.js server)
echo "Starting Next.js frontend on port ${PORT:-8080}..."
exec "$@"
