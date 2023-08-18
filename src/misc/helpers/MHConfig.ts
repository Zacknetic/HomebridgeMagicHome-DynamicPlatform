import { PlatformConfig } from 'homebridge';
import { EXPECTED_CONFIG_STRUCTURE } from '../types/constants';
import { repairObjectShape } from './utils';
interface AdvancedOptions {
  periodicDiscovery: boolean;
  namesWithMacAddress: boolean;
  logLevel: number;
  additionalSubnets: string[];
}

interface DeviceManagement {
  blacklistOrWhitelist: string;
  blacklistedUniqueIDs: string[];
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

		const correctedConfig = repairObjectShape(hbConfig, EXPECTED_CONFIG_STRUCTURE) as CorrectedMHConfig;

		MHConfig.pruning = correctedConfig.pruning;
		MHConfig.whiteEffects = correctedConfig.whiteEffects;
		MHConfig.deviceManagement = correctedConfig.deviceManagement;
		MHConfig.advancedOptions = correctedConfig.advancedOptions;

		MHConfig.instance = this;
	}
}
