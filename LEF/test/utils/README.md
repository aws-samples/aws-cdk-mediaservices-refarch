# Test Utilities

This directory contains shared test utilities that are used across multiple test files.

## Available Utilities

### test-utils.ts

Contains common functions for testing CDK stacks and configurations:

- `createEventStack`: Creates an event stack for testing purposes
- `writeConfigToFile`: Writes a configuration object to a TypeScript file
- `writeTemplateToFile`: Writes a CloudFormation template to a file
- `createEventConfiguration`: Creates an event configuration by merging base config with additional config

## Enhancement Suggestions

1. Add type safety to the `additionalConfig` parameter in `createEventConfiguration`
2. Create a test configuration builder class to make test config creation more fluent:

```typescript
const config = new TestConfigBuilder(baseConfig)
  .withChannelClass("SINGLE_PIPELINE")
  .withMulticastInput(singlePipelineMulticastInput)
  .withAnywhereSettings(anywhereSettings)
  .writeConfig(filename);
```

3. Add more utility functions for common test operations like:
   - Cleanup utilities for test files and directories
   - Template assertion helpers for common AWS MediaLive patterns
   - Configuration validation helpers
4. Consider adding snapshot testing utilities for template comparison
5. Add error handling utilities for testing error cases
