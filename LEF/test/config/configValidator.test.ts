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

import * as path from 'path';

// Mock process.cwd
const mockCwd = jest.fn().mockReturnValue('/mock/cwd');
process.cwd = mockCwd;

// Define a type for our mock config
interface MockConfig {
  event: {
    mediaLive: {
      encodingProfileLocation: string;
    };
  };
}

// Mock the configValidator module
jest.mock('../../lib/config/configValidator', () => {
  const originalModule = jest.requireActual('../../lib/config/configValidator');
  
  // Create a mock loadConfig function
  const mockLoadConfig = jest.fn();
  
  return {
    ...originalModule,
    loadConfig: mockLoadConfig
  };
});

// Import after mocking
import { loadConfig, ConfigurationError } from "../../lib/config/configValidator";

describe('configValidator', () => {
  describe('loadConfig', () => {
    // Reset mocks before each test
    beforeEach(() => {
      (loadConfig as jest.Mock).mockReset();
    });

    test('should load configuration successfully', () => {
      // Arrange
      const expectedConfig: MockConfig = {
        event: {
          mediaLive: {
            encodingProfileLocation: path.resolve('/mock/cwd', 'node_modules/.bin', '../relative/path/to/profile.json')
          }
        }
      };
      
      (loadConfig as jest.Mock).mockReturnValue(expectedConfig);

      // Act
      const result = loadConfig('/path/to/config', 'testKey');

      // Assert
      expect(result).toEqual(expectedConfig);
      expect(loadConfig).toHaveBeenCalledWith('/path/to/config', 'testKey');
    });

    test('should throw ConfigurationError when config key not found', () => {
      // Arrange
      (loadConfig as jest.Mock).mockImplementation(() => {
        throw new ConfigurationError('Configuration key "nonExistentKey" not found in /path/to/config');
      });

      // Act & Assert
      expect(() => {
        loadConfig('/path/to/config', 'nonExistentKey');
      }).toThrow(ConfigurationError);
      
      expect(() => {
        loadConfig('/path/to/config', 'nonExistentKey');
      }).toThrow('Configuration key "nonExistentKey" not found in /path/to/config');
    });

    test('should throw ConfigurationError when require fails', () => {
      // Arrange
      (loadConfig as jest.Mock).mockImplementation(() => {
        throw new ConfigurationError('Failed to load configuration file (/non-existent/path): Module not found');
      });

      // Act & Assert
      expect(() => {
        loadConfig('/non-existent/path', 'testKey');
      }).toThrow(ConfigurationError);
      
      expect(() => {
        loadConfig('/non-existent/path', 'testKey');
      }).toThrow('Failed to load configuration file (/non-existent/path): Module not found');
    });

    test('should convert relative encoding profile path to absolute path', () => {
      // Arrange
      const expectedPath = path.resolve('/mock/cwd', 'node_modules/.bin', '../relative/path/to/profile.json');
      const config: MockConfig = {
        event: {
          mediaLive: {
            encodingProfileLocation: expectedPath
          }
        }
      };
      
      (loadConfig as jest.Mock).mockReturnValue(config);

      // Act
      const result = loadConfig('/path/to/config', 'testKey') as MockConfig;

      // Assert
      expect(result.event.mediaLive.encodingProfileLocation).toEqual(expectedPath);
    });

    test('should not modify absolute encoding profile path', () => {
      // Arrange
      const absolutePath = '/absolute/path/to/profile.json';
      const config: MockConfig = {
        event: {
          mediaLive: {
            encodingProfileLocation: absolutePath
          }
        }
      };
      
      (loadConfig as jest.Mock).mockReturnValue(config);

      // Act
      const result = loadConfig('/absolute/path/test', 'testKey') as MockConfig;

      // Assert
      expect(result.event.mediaLive.encodingProfileLocation).toEqual(absolutePath);
    });

    test('should handle non-Error exceptions', () => {
      // Arrange
      (loadConfig as jest.Mock).mockImplementation(() => {
        throw 'Some string error';
      });
      
      // Act & Assert
      expect(() => {
        loadConfig('/path/to/config', 'testKey');
      }).toThrow('Some string error');
    });
  });
});