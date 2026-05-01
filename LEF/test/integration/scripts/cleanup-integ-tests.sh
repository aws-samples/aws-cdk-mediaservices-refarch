#!/bin/bash
# Cleanup script for integration test resources
# Usage: ./cleanup-integ-tests.sh

set -e

echo "=========================================="
echo "Integration Test Cleanup"
echo "=========================================="
echo ""

# Function to delete stacks with a prefix
delete_stacks_with_prefix() {
    local prefix=$1
    local region=${2:-us-east-1}
    
    echo "Checking for $prefix* stacks in $region..."
    
    stacks=$(aws cloudformation list-stacks \
        --region "$region" \
        --query "StackSummaries[?starts_with(StackName, \`$prefix\`) && StackStatus != \`DELETE_COMPLETE\`].StackName" \
        --output text)
    
    if [ -z "$stacks" ]; then
        echo "  No $prefix* stacks found"
        return
    fi
    
    for stack in $stacks; do
        echo "  Deleting stack: $stack"
        aws cloudformation delete-stack --stack-name "$stack" --region "$region" 2>&1 || echo "    Failed to delete $stack"
    done
}

# Delete stacks in all regions where tests might have run
for region in us-east-1 us-east-2 us-west-2; do
    echo ""
    echo "Region: $region"
    echo "----------------------------------------"
    
    delete_stacks_with_prefix "LefInteg" "$region"
    delete_stacks_with_prefix "LefStep" "$region"
    delete_stacks_with_prefix "LefMulti" "$region"
    delete_stacks_with_prefix "DeployAllTest" "$region"
    delete_stacks_with_prefix "StepByStepDeploymentTest" "$region"
    delete_stacks_with_prefix "MultipleEventsTest" "$region"
done

echo ""
echo "=========================================="
echo "Waiting for stacks to delete..."
echo "=========================================="
echo ""
echo "This may take several minutes. Press Ctrl+C to stop waiting."
echo ""

# Wait for all deletions to complete
sleep 10

echo ""
echo "=========================================="
echo "Cleanup complete!"
echo "=========================================="
echo ""
echo "Note: CloudFront distributions and response headers policies"
echo "may take up to 15 minutes to fully delete."
echo ""
echo "To verify cleanup, run:"
echo "  aws cloudformation list-stacks --query 'StackSummaries[?starts_with(StackName, \`Lef\`)].{Name:StackName,Status:StackStatus}'"
