# Integration Testing Quick Reference

## ⚠️ Important

Integration tests **deploy real AWS resources** and will incur costs. They are designed to run in a dedicated testing AWS account.

## Run Tests

```bash
# All tests
npm run integ-test

# Specific test
npm run integ-test -- test/integ.deploy-all.ts

# With custom email
TEST_EMAIL=your@email.com npm run integ-test

# Update snapshots
npm run integ-test:update
```

## Available Tests

| Test            | File                       | Duration | What It Tests                        |
| --------------- | -------------------------- | -------- | ------------------------------------ |
| Deploy All      | `integ.deploy-all.ts`      | ~40 min  | All stacks together with direct refs |
| Step-by-Step    | `integ.step-by-step.ts`    | ~40 min  | Sequential deployment with exports   |
| Multiple Events | `integ.multiple-events.ts` | ~55 min  | Multiple events in same group        |

## Manual Cleanup

```bash
# List test stacks
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?starts_with(StackName, `LefInteg`)].StackName'

# Delete stack
aws cloudformation delete-stack --stack-name <stack-name>

# Stop MediaLive channel
aws medialive stop-channel --channel-id <channel-id>
aws medialive wait channel-stopped --channel-id <channel-id>
```

## Cost

~$0.01-0.05 per test run (resources destroyed immediately after validation)

## Troubleshooting

| Issue                 | Solution                                |
| --------------------- | --------------------------------------- |
| Test timeout          | Increase `totalTimeout` in test file    |
| Deployment fails      | Check CloudFormation events             |
| Resources not cleaned | Run manual cleanup commands             |
| Channel stuck         | Wait for stable state before destroying |

## Documentation

- Full guide: `docs/testing-guide.md`
- Test details: `test/README.md`
