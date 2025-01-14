#!/bin/bash

# Define the world directory
WORLD_DIR="$(dirname "$0")/world"

# Define the FastAPI backend script path
BACKEND_SCRIPT="$WORLD_DIR/pythonbackend.py"

# Check if the backend script exists
if [[ ! -f "$BACKEND_SCRIPT" ]]; then
  echo "Error: FastAPI backend script not found at $BACKEND_SCRIPT"
  exit 1
fi

# Change to the world directory
cd "$WORLD_DIR" || exit

# Launch FastAPI with uvicorn
echo "Launching FastAPI backend and serving world.html on http://localhost:8000"
uvicorn pythonbackend:app --workers 4 --host 0.0.0.0 --port 8000