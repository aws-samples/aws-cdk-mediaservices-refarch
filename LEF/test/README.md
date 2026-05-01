# Integration Tests

This directory contains integration tests for the Live Event Framework.

## Directory Structure

```
test/integration/
├── e2e/                    # End-to-end CDK integration tests
│   ├── integ.deploy-all.ts
│   ├── integ.step-by-step.ts
│   ├── integ.multiple-events.ts
│   └── *.snapshot/         # Test snapshots
├── unit/                   # Unit-style integration tests
│   └── *.integration.test.ts
└── scripts/                # Helper scripts
    ├── cleanup-integ-tests.sh
    └── test-deploy-all.sh
```

## E2E Integration Tests

End-to-end tests deploy real AWS resources to validate complete deployment workflows.

### Available Tests

#### 1. Deploy All Test (`e2e/integ.deploy-all.ts`)

Tests deploying all three stacks together with direct references.

#### 2. Step-by-Step Test (`e2e/integ.step-by-step.ts`)

Tests sequential deployment: Foundation → EventGroup → Event.

#### 3. Multiple Events Test (`e2e/integ.multiple-events.ts`)

Tests deploying multiple events in the same event group.

### Running E2E Tests

```bash
# Run all integration tests
npm run integ-test

# Run a specific test
npm run integ-test -- test/integration/e2e/integ.deploy-all.ts

# Update test snapshots
npm run integ-test:update

# Set custom email for testing
TEST_EMAIL=your@email.com npm run integ-test
```

### Helper Scripts

```bash
# Clean up integration test resources
./test/integration/scripts/cleanup-integ-tests.sh

# Run deploy-all test manually
./test/integration/scripts/test-deploy-all.sh
```

## Unit Integration Tests

Unit-style integration tests in `unit/` directory test specific input types and configurations without full deployments.

Run with Jest:

```bash
npm test -- test/integration/unit
```

## Prerequisites

- AWS credentials configured
- CDK bootstrapped in target account/region
- Sufficient AWS service quotas

## Cost Considerations

⚠️ **E2E tests deploy real AWS resources and incur costs.** Tests automatically clean up resources, but verify cleanup completed successfully.

## Troubleshooting

### Test fails during deployment

```bash
aws cloudformation describe-stack-events --stack-name <stack-name>
```

### Resources not cleaned up

```bash
./test/integration/scripts/cleanup-integ-tests.sh
```

See [Testing Guide](../docs/testing-guide.md) for detailed information.
