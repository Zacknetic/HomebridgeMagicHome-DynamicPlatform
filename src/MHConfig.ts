import { PlatformConfig } from "homebridge";
import { EXPECTED_CONFIG_STRUCTURE } from "./misc/constants";

interface AdvancedOptions {
  periodicDiscovery: boolean;
  namesWithMacAddress: boolean;
  logLevel: number;
  additionalSubnets: any[];
}

interface DeviceManagement {
  blacklistOrWhitelist: string;
  blacklistedUniqueIDs: any[];
}

interface WhiteEffects {
  simultaniousDevicesColorWhite: boolean;
  colorWhiteThreshold: number;
  colorWhiteThresholdSimultaniousDevices: number;
  colorOffThresholdSimultaniousDevices: number;
}

interface Pruning {
  pruneMissingCachedAccessories: boolean;
  restartsBeforeMissingAccessoriesPruned: number;
  pruneAllAccessoriesNextRestart: boolean;
}

export interface CorrectedMHConfig {
  pruning: Pruning;
  whiteEffects: WhiteEffects;
  deviceManagement: DeviceManagement;
  advancedOptions: AdvancedOptions;
}

export class MHConfig {
  private static instance: MHConfig;

  public static pruning: Pruning;
  public static whiteEffects: WhiteEffects;
  public static deviceManagement: DeviceManagement;
  public static advancedOptions: AdvancedOptions;

  constructor(private hbConfig: PlatformConfig) {
    if (MHConfig.instance) {
      return;
    }

    const correctedConfig = correctConfig(hbConfig, EXPECTED_CONFIG_STRUCTURE) as CorrectedMHConfig;

    MHConfig.pruning = correctedConfig.pruning;
    MHConfig.whiteEffects = correctedConfig.whiteEffects;
    MHConfig.deviceManagement = correctedConfig.deviceManagement;
    MHConfig.advancedOptions = correctedConfig.advancedOptions;

    MHConfig.instance = this;
  }
}

function correctConfig(config: any, expectedKeys: CorrectedMHConfig): CorrectedMHConfig {
  const correctedConfig: any = {};

  // Function to find and correct misplaced keys
  function findAndCorrectKey(key: string, value: any, expectedSection: any) {
    let closestKey: string | null = null;
    let minDistance = Infinity;
    let closestSection: string | null = null;

    for (const section in expectedKeys) {
      for (const expectedKey in expectedKeys[section]) {
        const distance = levenshteinDistance(key, expectedKey);
        if (distance < minDistance) {
          minDistance = distance;
          closestKey = expectedKey;
          closestSection = section;
        }
      }
    }

    if (minDistance < 5 && closestKey !== null && closestSection !== null) {
      // Threshold of 5, adjust as needed
      correctedConfig[closestSection][closestKey] = value;
    } else {
      console.warn(`Unexpected key: ${key}`);
      // Handle the misplaced or misspelled key as needed
    }
  }

  for (const section in expectedKeys) {
    correctedConfig[section] = { ...expectedKeys[section] }; // Initialize with default values

    if (config[section] && typeof config[section] === "object") {
      for (const key in config[section]) {
        if (expectedKeys[section].hasOwnProperty(key)) {
          correctedConfig[section][key] = config[section][key]; // Correct key, use value from actual config
        } else {
          findAndCorrectKey(key, config[section][key], expectedKeys[section]); // Potentially misplaced key, find correct place
        }
      }
    }

    // Check for misplaced keys at the root level
    for (const key in config) {
      if (!expectedKeys.hasOwnProperty(key) && typeof config[key] !== "object") {
        findAndCorrectKey(key, config[key], expectedKeys);
      }
    }
  }

  return correctedConfig as CorrectedMHConfig;
}

function levenshteinDistance(a: string, b: string) {
  const matrix = [];
  let i, j;

  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  for (i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }

  return matrix[b.length][a.length];
}
