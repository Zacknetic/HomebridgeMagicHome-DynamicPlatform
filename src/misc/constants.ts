/*----------------------[DEFAULT VALIUES]----------------------*/
import type { CorrectedMHConfig } from "../MHConfig";
import type { IAccessoryCommand, IAccessoryState } from "./types";

export const COLOR_COMMAND_MODES = {
	CCT: 'CCT',
	HSV: 'HSV',
};
export const DEFAULT_ANIMATION_STATE = {
	isOn: false,
};
export const DEFAULT_ACCESSORY_STATE: IAccessoryState = {
	isOn: true,
	HSV: {
		hue: 0,
		saturation: 0,
		value: 100,
	},
	TB: {
		temperature: 140,
		brightness: 100
	}
};

export const DEFAULT_ACCESSORY_COMMAND: IAccessoryCommand = {
	isOn: false,
	isPowerCommand: false,
	HSV: {
		hue: 0,
		saturation: 0,
		value: 0,
	},
	TB: {
		temperature: 140,
		brightness: 0
	}
};

export const EXPECTED_CONFIG_STRUCTURE: CorrectedMHConfig = {
  pruning: {
	pruneMissingCachedAccessories: false,
	restartsBeforeMissingAccessoriesPruned: 3,
	pruneAllAccessoriesNextRestart: false,
  },
  whiteEffects: {
	simultaniousDevicesColorWhite: true,
	colorWhiteThreshold: 10,
	colorWhiteThresholdSimultaniousDevices: 95,
	colorOffThresholdSimultaniousDevices: 5,
  },
  deviceManagement: {
	blacklistOrWhitelist: "blacklist",
	blacklistedUniqueIDs: [],
  },
  advancedOptions: {
	periodicDiscovery: true,
	namesWithMacAddress: false,
	logLevel: 3,
	additionalSubnets: [],
  },
};