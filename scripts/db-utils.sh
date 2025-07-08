#!/bin/bash

# Script to help manage database environments

# Function to show usage
show_usage() {
  echo "Database Environment Utility Script"
  echo "===================================="
  echo "Usage: bash db-utils.sh [command]"
  echo ""
  echo "Commands:"
  echo "  use-dev       - Switch to development database"
  echo "  use-prod      - Switch to production database"
  echo "  push-dev      - Push schema to development database"
  echo "  push-prod     - Push schema to production database"
  echo "  list-dev      - List development database schema"
  echo "  list-prod     - List production database schema"
  echo "  query-dev     - Run SQL query on development database"
  echo "  query-prod    - Run SQL query on production database"
  echo ""
}

# Main script logic
case "$1" in
  use-dev)
    echo "Switching to DEVELOPMENT database"
    export NODE_ENV=""
    echo "Environment set to: $([ -z "$NODE_ENV" ] && echo "development" || echo "$NODE_ENV")"
    ;;
    
  use-prod)
    echo "Switching to PRODUCTION database"
    export NODE_ENV="production"
    echo "Environment set to: $NODE_ENV"
    ;;
    
  push-dev)
    echo "Pushing schema to DEVELOPMENT database"
    NODE_ENV="" npx drizzle-kit push
    ;;
    
  push-prod)
    echo "Pushing schema to PRODUCTION database"
    NODE_ENV="production" npx drizzle-kit push
    ;;
    
  list-dev)
    echo "Listing DEVELOPMENT database schema"
    NODE_ENV="" npx drizzle-kit list
    ;;
    
  list-prod)
    echo "Listing PRODUCTION database schema"
    NODE_ENV="production" npx drizzle-kit list
    ;;
    
  query-dev)
    if [ -z "$2" ]; then
      echo "Error: SQL query required"
      echo "Usage: bash db-utils.sh query-dev 'SELECT * FROM users'"
      exit 1
    fi
    echo "Running query on DEVELOPMENT database: $2"
    NODE_ENV="" psql "$DATABASE_URL" -c "$2"
    ;;
    
  query-prod)
    if [ -z "$2" ]; then
      echo "Error: SQL query required"
      echo "Usage: bash db-utils.sh query-prod 'SELECT * FROM users'"
      exit 1
    fi
    echo "Running query on PRODUCTION database: $2"
    NODE_ENV="production" psql "${PROD_DATABASE_URL:-$DATABASE_URL}" -c "$2"
    ;;
    
  *)
    show_usage
    ;;
esac