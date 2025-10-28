#!/bin/bash

# Copy .env.local from parent directory to hydration-app
if [ -f "../.env" ]; then
    cp "../.env" ".env"
    echo "Copied .env from parent directory"
else
    echo "No .env found in parent directory"
fi

# Run the Next.js build
next build
