#!/bin/bash
# Helper script to run CDK integration tests
# Usage: ./run-integ-tests.sh [test-name]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

TEST_NAME="${1:-}"

if [ -z "$TEST_NAME" ]; then
    echo "Running all integration tests..."
    npm run integ-test
else
    echo "Running integration test: $TEST_NAME"
    npm run integ-test -- "$TEST_NAME"
fi
