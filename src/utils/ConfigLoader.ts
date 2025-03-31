/**
 * Load all config values from the config.json file
 * if the entry is not found, log a detailed homebridge error and use a default value  
 */

import { PlatformConfig } from 'homebridge';
import { CommonConstants } from './CommonConstants.js';

// Base interface that defines the structure of our config
export interface HB_Config {
    name: string,
    platform: string,
    discovery_management: {
        additional_subnets: string[];
        device_discovery_interval: number;
    };
    device_management: {
        whitelist: string[];
        blacklist: string[];
    };
    [key: string]: unknown; // Allow for future extensions
}

//
type ConfigProperties = 'name' | 'platform' | 'discovery_management' | 'device_management'
| 'additional_subnets' | 'device_discovery_interval' | 'whitelist' | 'blacklist' | 'periodic_scan' | 'purge_all_accessories' | 'device_discovery';

// Add type mapping for properties
type PropertyTypeMap = {
  name: string;
  platform: string;
  discovery_management: {
    additional_subnets: string[];
    device_discovery_interval: number;    
    periodic_scan: boolean;
    device_discovery: boolean;
  };
  device_management: {
    whitelist: string[];
    blacklist: string[];
    purge_all_accessories: boolean;
  };
  additional_subnets: string[];
  device_discovery_interval: number;
  whitelist: string[];
  blacklist: string[];
  periodic_scan: boolean;
  purge_all_accessories: boolean;
  device_discovery: boolean;
};

interface HomebridgeLogger {
    warn(message: string): void;
}

// Define the callable type with proper type inference
type ConfigLoaderFunction = {
  <K extends ConfigProperties>(propertyName: K): PropertyTypeMap[K];
  initialize(config: PlatformConfig, log: HomebridgeLogger): void;
  config: HB_Config;
  findProperty<K extends ConfigProperties>(propertyName: K): PropertyTypeMap[K];
};

export class ConfigLoaderClass {
  private static log: HomebridgeLogger;
  private static _config: HB_Config;

  static initialize(config: PlatformConfig, log: HomebridgeLogger): void {
    ConfigLoaderClass.log = log;
    ConfigLoaderClass._config = ConfigLoaderClass.validateConfig(config as Partial<HB_Config>, CommonConstants.DEFAULT_CONFIG);
  }

  /**
   * Get the current config
   */
  static get config(): HB_Config {
    return ConfigLoaderClass._config;
  }

  /**
   * Find a property by name in the config structure, regardless of depth
   * @param propertyName The name of the property to find (must be a valid config property)
   * @returns The value of the property if found, or the default value if not found
   */
  static findProperty<K extends ConfigProperties>(propertyName: K): PropertyTypeMap[K] {
    const result = ConfigLoaderClass.findPropertyRecursive(ConfigLoaderClass._config, propertyName);
    if (result === undefined) {
      ConfigLoaderClass.log.warn(`Property '${propertyName}' not found in config. Using default value.`);
      // Get the default value from the default config
      const defaultValue = ConfigLoaderClass.findPropertyRecursive(CommonConstants.DEFAULT_CONFIG, propertyName);
      return defaultValue as PropertyTypeMap[K];
    }

    // Special handling for additional_subnets to ensure it's always an array
    if (propertyName === 'additional_subnets') {
      return (Array.isArray(result) ? result : []) as PropertyTypeMap[K];
    }

    return result as PropertyTypeMap[K];
  }

  /**
   * Recursively search for a property in an object
   */
  private static findPropertyRecursive(obj: unknown, propertyName: string): unknown {
    if (typeof obj !== 'object' || obj === null) {
      return undefined;
    }

    // Check if the property exists at this level
    if (propertyName in obj) {
      return (obj as Record<string, unknown>)[propertyName];
    }

    // Recursively search in all object properties
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        const result = ConfigLoaderClass.findPropertyRecursive(value, propertyName);
        if (result !== undefined) {
          return result;
        }
      }
    }

    return undefined;
  }

  /**
   * Recursively validate and merge config with defaults
   */
  private static validateConfig<T extends Record<string, unknown>>(config: Partial<T>, defaults: T): T {
    const result = { ...defaults };

    for (const key in config) {
      // Skip array indices
      if (/^\d+$/.test(key)) {
        continue;
      }

      const value = config[key];
      const defaultValue = defaults[key];

      if (value === undefined || value === null) {
        ConfigLoaderClass.log.warn(`Config missing: ${key}. Using default value: ${defaultValue}`);
        continue;
      }

      if (typeof value === 'object' && typeof defaultValue === 'object') {
        // Recursively validate nested objects
        result[key] = ConfigLoaderClass.validateConfig(
                    value as Record<string, unknown>,
                    defaultValue as Record<string, unknown>,
        ) as T[Extract<keyof T, string>];
      } else {
        // Validate primitive values
        if (Array.isArray(defaultValue)) {
          if (!Array.isArray(value)) {
            ConfigLoaderClass.log.warn(`Invalid array in config: ${key}. Expected array, got ${typeof value}. Using default value: ${defaultValue}`);
            continue;
          }
          // Only validate array element types for leaf properties defined in HB_Config
          if (ConfigLoaderClass.isLeafArrayProperty(key) && defaultValue.length > 0) {
            const expectedType = typeof defaultValue[0];
            if (!value.every(item => typeof item === expectedType)) {
              ConfigLoaderClass.log.warn(`Invalid array elements in config: ${key}. 
                All elements must be of type ${expectedType}. Using default value: ${defaultValue}`);
              continue;
            }
          }
        } else if (typeof value !== typeof defaultValue) {
          ConfigLoaderClass.log.warn(`Invalid type in config: ${key}.
            Expected ${typeof defaultValue}, got ${typeof value}. Using default value: ${defaultValue}`);
          continue;
        }
        result[key] = value as T[Extract<keyof T, string>];
      }
    }

    return result;
  }

  /**
   * Check if a property is a leaf array property defined in HB_Config
   */
  private static isLeafArrayProperty(key: string): boolean {
    const leafArrays = [
      'additional_subnets',
      'whitelist',
      'blacklist',
    ];
    return leafArrays.includes(key);
  }
}

// Create the callable ConfigLoader
export const ConfigLoader = Object.assign(
  (propertyName: ConfigProperties) => ConfigLoaderClass.findProperty(propertyName),
  {
    initialize: ConfigLoaderClass.initialize.bind(ConfigLoaderClass),
    config: ConfigLoaderClass.config,
    findProperty: ConfigLoaderClass.findProperty.bind(ConfigLoaderClass),
  },
) as ConfigLoaderFunction;
