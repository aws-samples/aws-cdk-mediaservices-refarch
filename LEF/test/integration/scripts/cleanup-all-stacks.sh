#!/bin/bash

# Script to delete integration test stacks, retrying until all are removed
# Handles stack dependencies and deletion protection
# Only targets stacks with specific test prefixes

set -e

REGION=${AWS_REGION:-us-east-1}

echo "=========================================="
echo "Cleanup Integration Test Stacks"
echo "Region: $REGION"
echo "=========================================="
echo ""

# Define test stack prefixes matching integration tests
TEST_PREFIXES=("LefStepTest" "LefMultiTest" "LefIntegTest")

MAX_ITERATIONS=20
ITERATION=0

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
    ITERATION=$((ITERATION + 1))
    echo "Iteration $ITERATION/$MAX_ITERATIONS"
    echo ""
    
    # Get all test stacks that are not already deleted or being deleted
    STACKS=$(aws cloudformation list-stacks \
        --region "$REGION" \
        --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE UPDATE_ROLLBACK_COMPLETE \
        --query "StackSummaries[?starts_with(StackName, 'LefStepTest') || starts_with(StackName, 'LefMultiTest') || starts_with(StackName, 'LefIntegTest')].StackName" \
        --output text)
    
    if [ -z "$STACKS" ]; then
        echo "✅ All integration test stacks have been deleted!"
        exit 0
    fi
    
    echo "Found stacks to delete:"
    echo "$STACKS" | tr '\t' '\n'
    echo ""
    
    # Try to delete each stack
    for STACK in $STACKS; do
        echo "Attempting to delete: $STACK"
        
        if aws cloudformation delete-stack --region "$REGION" --stack-name "$STACK" 2>&1; then
            echo "  ✓ Delete initiated for $STACK"
        else
            echo "  ⚠ Could not delete $STACK (may have dependencies)"
        fi
    done
    
    echo ""
    echo "Waiting 30 seconds before next iteration..."
    sleep 30
    echo ""
done

echo "❌ Max iterations reached. Some stacks may still exist:"
aws cloudformation list-stacks \
    --region "$REGION" \
    --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE UPDATE_ROLLBACK_COMPLETE \
    --query "StackSummaries[?starts_with(StackName, 'LefStepTest') || starts_with(StackName, 'LefMultiTest') || starts_with(StackName, 'LefIntegTest')].StackName" \
    --output table
