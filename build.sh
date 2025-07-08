#!/bin/bash

echo "Starting build process..."

# Create dist directory
mkdir -p dist

# Build client (frontend)
echo "Building client application..."
npx vite build --mode production

# Build server (backend)
echo "Building server application..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/index.js

echo "Build completed successfully!"
echo "Client built to: client/dist/"
echo "Server built to: dist/index.js"