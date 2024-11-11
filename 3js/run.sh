#!/bin/bash

# Launch a Python3 HTTP server in the current directory on port 8000
echo "Launching world.html on http://localhost:8000"
python3 -m http.server 8000 --directory "$(dirname "$0")/world"