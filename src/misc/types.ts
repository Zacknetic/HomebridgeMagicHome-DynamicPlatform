import type { PlatformAccessory } from 'homebridge';
import { BaseController, IDeviceState, IDeviceCommand, IColorCCT, IDeviceInformation, IDeviceMetaData, IProtoDevice, IAnimationLoop } from 'magichome-platform';

// import { Switch } from '../accessories/Switch';
// import { DimmerStrip } from '../accessories/DimmerStrip';
// import { RGBStrip } from '../accessories/RGBStrip';
// import { GRBStrip } from '../accessories/GRBStrip';
// import { RGBWBulb } from '../accessories/RGBWBulb';
// import { RGBWWBulb } from '../accessories/RGBWWBulb';
// import { RGBWStrip } from '../accessories/RGBWStrip';
// import { RGBWWStrip } from '../accessories/RGBWWStrip';
// import { CCTStrip } from '../accessories/CCTStrip';


// export const homekitInterface = {
// 	// 'Power Socket': Switch,
// 	// 'Dimmer': DimmerStrip,
// 	// 'GRB Strip': GRBStrip,
// 	// 'RGB Strip': RGBStrip,
// 	'RGBW Non-Simultaneous': RGBWBulb,
// 	'RGBWW Non-Simultaneous': RGBWWBulb,
// 	'RGBW Simultaneous': RGBWStrip,
// 	'RGBWW Simultaneous': RGBWWStrip,
// 	// 'CCT Strip': CCTStrip,
// };

export interface MagicHomeAccessory extends PlatformAccessory {
	context: IAccessoryContext;
}

export interface AnimationAccessory extends PlatformAccessory {
	context: IAnimationContext;
}

export interface IAnimationContext {
	animationLoop: IAnimationLoop;
}

export interface IAccessoryContext {
	displayName?: string;
	deviceMetaData: IDeviceMetaData;
	protoDevice: IProtoDevice;
	latestUpdate: number;
}

export interface IAccessoryState {
	isOn: boolean,
	HSV: IColorHSV,
	TB: IColorTB
}
export interface IPartialAccessoryCommand {
	isOn?: boolean,
	HSV?: IPartialColorHSV,
	TB?: IPartialColorTB,
	colorTemperature?: number,
	isPowerCommand?: boolean,
}

export interface IAccessoryCommand {
	isOn: boolean,
	HSV: IColorHSV,
	TB: IColorTB
	isPowerCommand: boolean,
}

export interface IColorHSV {
	hue: number;
	saturation: number;
	value: number;
}

export interface IColorTB {
	temperature: number;
	brightness: number;
}

export interface IPartialColorTB {
	temperature?: number;
	brightness?: number;
}

export interface IPartialColorHSV {
	hue?: number;
	saturation?: number;
	value?: number;
}


export interface IConfigOptions {
	logLevel: number,
	colorWhiteInterfaceMode: string,
	colorOffSaturationLevel: number,
	colorWhiteSimultaniousSaturationLevel?: number,
}

/*----------------------[DEFAULT VALIES]----------------------*/

export const COLOR_COMMAND_MODES = {
	CCT: 'CCT',
	HSV: 'HSV',
};

export const DEFAULT_ACCESSORY_STATE: IAccessoryState = {
	isOn: false,
	HSV: {
		hue: 0,
		saturation: 0,
		value: 0,
	},
	TB: {
		temperature: 0,
		brightness: 0
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
		temperature: 0,
		brightness: 0
	}
};