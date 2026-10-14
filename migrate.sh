#!/usr/bin/env bash
export PATH="/c/Program Files/nodejs:$PATH"
node backend/scripts/migrate.js "$@"
