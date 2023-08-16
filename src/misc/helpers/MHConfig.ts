import { PlatformConfig } from "homebridge";
import { EXPECTED_CONFIG_STRUCTURE } from "../types/constants";
import { correctObjectShape } from "./utils";
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

    const correctedConfig = correctObjectShape(hbConfig, EXPECTED_CONFIG_STRUCTURE) as CorrectedMHConfig;

    MHConfig.pruning = correctedConfig.pruning;
    MHConfig.whiteEffects = correctedConfig.whiteEffects;
    MHConfig.deviceManagement = correctedConfig.deviceManagement;
    MHConfig.advancedOptions = correctedConfig.advancedOptions;

    MHConfig.instance = this;
  }
}
