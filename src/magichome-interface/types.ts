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

export interface IColorHSL {
	hue: number;
	saturation: number;
	luminance: number;
}


export interface MagicHomeAccessory extends PlatformAccessory {
	context: {
		displayName: string;
		restartsSinceSeen: number,
		pendingRegistration?: boolean;
		cachedInformation;
	}
}