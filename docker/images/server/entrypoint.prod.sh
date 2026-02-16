#!/bin/bash
# Docker entrypoint script for Pierre MCP Server - Production
set -e

echo "=== Pierre MCP Server - Starting ==="
echo "Database: ${DATABASE_URL:0:30}..."
echo "Port: ${HTTP_PORT:-8081}"
echo "Log level: ${RUST_LOG:-info}"
echo "User: $(whoami)"

# Create data directory if needed
mkdir -p /app/data

# Execute the server
exec "$@"
