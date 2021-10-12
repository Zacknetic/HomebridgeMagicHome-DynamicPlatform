import type { PlatformAccessory } from 'homebridge';
import { BaseController } from 'magichome-platform';

import { Switch } from '../accessories/Switch';
import { DimmerStrip } from '../accessories/DimmerStrip';
import { RGBStrip } from '../accessories/RGBStrip';
import { GRBStrip } from '../accessories/GRBStrip';
import { RGBWBulb } from '../accessories/RGBWBulb';
import { RGBWWBulb } from '../accessories/RGBWWBulb';
import { RGBWStrip } from '../accessories/RGBWStrip';
import { RGBWWStrip } from '../accessories/RGBWWStrip';
import { CCTStrip } from '../accessories/CCTStrip';
import { IDeviceState, IDeviceCommand, IColorCCT } from 'magichome-platform/dist/types';


export const homekitInterface = {
	'Power Socket': Switch,
	'Dimmer': DimmerStrip,
	'GRB Strip': GRBStrip,
	'RGB Strip': RGBStrip,
	'RGBW Non-Simultaneous': RGBWBulb,
	'RGBWW Non-Simultaneous': RGBWWBulb,
	'RGBW Simultaneous': RGBWStrip,
	'RGBWW Simultaneous': RGBWWStrip,
	'CCT Strip': CCTStrip,
};

export interface MagicHomeAccessory extends PlatformAccessory {
	context: {
		displayName: string;
		restartsSinceSeen: number,
		pendingRegistration?: boolean;
		cachedAccessoryState?: IAccessoryState;
	}
}

export interface IAccessoryState {
	isOn: boolean,
	HSL: IColorHSL,
	colorTemperature?: number,
	brightness?: number,
}

export interface IAccessoryCommand {
	isOn?: boolean,
	HSL?: IColorHSL,
	colorTemperature?: number,
	brightness?: number,
	isPowerCommand?: boolean,
}

export interface IColorHSL {
	hue?: number;
	saturation?: number;
	luminance?: number;
}

/*----------------------[Constants]----------------------*/

export const ColorCommandModes = {
	CCT: 'CCT',
	HSL: 'HSL',
};

export const DefaultAccessoryCommand = {
	isOn: true,
	HSL: {
		hue: 0,
		saturation: 100,
		luminance: 0,
	},
	colorTemperature: 140,
	brightness: 100,
};