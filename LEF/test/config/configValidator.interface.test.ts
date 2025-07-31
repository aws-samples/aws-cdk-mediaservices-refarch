/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { IConfigValidator, ConfigurationError, ConfigType } from "../../lib/config/configValidator";

// Define a simple config type for testing that satisfies the ConfigType constraint
// Create a mock implementation of the required interfaces
import { EventSourceConfig } from "../../lib/event/eventConfigInterface";
import { IMediaPackageChannelConfig } from "../../lib/event/eventConfigInterface";

// Define a mock for IMediaPackageChannelConfig
const mockMediaPackageConfig: IMediaPackageChannelConfig = {
  inputType: "HLS",
  endpoints: {}
};

// Define a test config that satisfies the ConfigType constraint
interface TestConfig {
  event: {
    name: string;
    value: number;
    optional?: string;
    // Add required properties to satisfy ConfigType
    mediaPackage: IMediaPackageChannelConfig;
    // Add required properties from EventSourceConfig
    mediaLive: {
      encodingProfileLocation: string;
      channelClass: "STANDARD";
      inputs: any[];
      segmentLengthInSeconds: number;
      inputSpecification: any;
      sourceEndBehavior?: "CONTINUE";
    }
  };
}

// Implement a validator for the test config
class TestConfigValidator implements IConfigValidator<TestConfig> {
  validateConfig(config: TestConfig): void {
    if (!config) {
      throw new ConfigurationError("Config cannot be null or undefined");
    }
    
    if (!config.event) {
      throw new ConfigurationError("Config must have an event property");
    }
    
    if (!config.event.name) {
      throw new ConfigurationError("Config must have a name property");
    }
    
    if (typeof config.event.name !== 'string') {
      throw new ConfigurationError("Config name must be a string");
    }
    
    if (config.event.value === undefined || config.event.value === null) {
      throw new ConfigurationError("Config must have a value property");
    }
    
    if (typeof config.event.value !== 'number') {
      throw new ConfigurationError("Config value must be a number");
    }
    
    if (config.event.optional !== undefined && typeof config.event.optional !== 'string') {
      throw new ConfigurationError("Config optional property must be a string if provided");
    }
  }
}

describe('IConfigValidator', () => {
  let validator: TestConfigValidator;
  
  beforeEach(() => {
    validator = new TestConfigValidator();
  });
  
  test('should validate a valid config', () => {
    // Arrange
    const validConfig: TestConfig = {
      event: {
        name: 'test',
        value: 42,
        mediaPackage: mockMediaPackageConfig,
        mediaLive: {
          encodingProfileLocation: "/path/to/profile.json",
          channelClass: "STANDARD",
          inputs: [{
            type: "MP4_FILE",
            urls: ["s3://example/file.mp4"]
          }],
          segmentLengthInSeconds: 6,
          inputSpecification: {
            codec: "AVC",
            maximumBitrate: "MAX_10_MBPS",
            resolution: "HD"
          },
          sourceEndBehavior: "CONTINUE"
        }
      }
    };
    
    // Act & Assert
    expect(() => validator.validateConfig(validConfig)).not.toThrow();
  });
  
  test('should validate a valid config with optional property', () => {
    // Arrange
    const validConfig: TestConfig = {
      event: {
        name: 'test',
        value: 42,
        optional: 'optional value',
        mediaPackage: mockMediaPackageConfig,
        mediaLive: {
          encodingProfileLocation: "/path/to/profile.json",
          channelClass: "STANDARD",
          inputs: [{
            type: "MP4_FILE",
            urls: ["s3://example/file.mp4"]
          }],
          segmentLengthInSeconds: 6,
          inputSpecification: {
            codec: "AVC",
            maximumBitrate: "MAX_10_MBPS",
            resolution: "HD"
          },
          sourceEndBehavior: "CONTINUE"
        }
      }
    };
    
    // Act & Assert
    expect(() => validator.validateConfig(validConfig)).not.toThrow();
  });
  
  test('should throw when config is null', () => {
    // Act & Assert
    expect(() => validator.validateConfig(null as unknown as TestConfig)).toThrow(ConfigurationError);
    expect(() => validator.validateConfig(null as unknown as TestConfig)).toThrow('Config cannot be null or undefined');
  });
  
  test('should throw when config is undefined', () => {
    // Act & Assert
    expect(() => validator.validateConfig(undefined as unknown as TestConfig)).toThrow(ConfigurationError);
    expect(() => validator.validateConfig(undefined as unknown as TestConfig)).toThrow('Config cannot be null or undefined');
  });
  
  test('should throw when event is missing', () => {
    // Arrange
    const invalidConfig = {} as TestConfig;
    
    // Act & Assert
    expect(() => validator.validateConfig(invalidConfig)).toThrow(ConfigurationError);
    expect(() => validator.validateConfig(invalidConfig)).toThrow('Config must have an event property');
  });
  
  test('should throw when name is missing', () => {
    // Arrange
    const invalidConfig = {
      event: {
        value: 42
      }
    } as TestConfig;
    
    // Act & Assert
    expect(() => validator.validateConfig(invalidConfig)).toThrow(ConfigurationError);
    expect(() => validator.validateConfig(invalidConfig)).toThrow('Config must have a name property');
  });
  
  test('should throw when name is not a string', () => {
    // Arrange
    const invalidConfig = {
      event: {
        name: 123,
        value: 42
      }
    } as unknown as TestConfig;
    
    // Act & Assert
    expect(() => validator.validateConfig(invalidConfig)).toThrow(ConfigurationError);
    expect(() => validator.validateConfig(invalidConfig)).toThrow('Config name must be a string');
  });
  
  test('should throw when value is missing', () => {
    // Arrange
    const invalidConfig = {
      event: {
        name: 'test'
      }
    } as TestConfig;
    
    // Act & Assert
    expect(() => validator.validateConfig(invalidConfig)).toThrow(ConfigurationError);
    expect(() => validator.validateConfig(invalidConfig)).toThrow('Config must have a value property');
  });
  
  test('should throw when value is not a number', () => {
    // Arrange
    const invalidConfig = {
      event: {
        name: 'test',
        value: '42'
      }
    } as unknown as TestConfig;
    
    // Act & Assert
    expect(() => validator.validateConfig(invalidConfig)).toThrow(ConfigurationError);
    expect(() => validator.validateConfig(invalidConfig)).toThrow('Config value must be a number');
  });
  
  test('should throw when optional is not a string', () => {
    // Arrange
    const invalidConfig = {
      event: {
        name: 'test',
        value: 42,
        optional: 123
      }
    } as unknown as TestConfig;
    
    // Act & Assert
    expect(() => validator.validateConfig(invalidConfig)).toThrow(ConfigurationError);
    expect(() => validator.validateConfig(invalidConfig)).toThrow('Config optional property must be a string if provided');
  });
});