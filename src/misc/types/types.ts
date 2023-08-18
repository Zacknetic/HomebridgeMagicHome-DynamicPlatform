import type { PlatformAccessory } from 'homebridge';
import {
	IDeviceMetaData,
	IProtoDevice,
	IAnimationBlueprint,
} from 'magichome-platform';
import { HomebridgeMagichomeDynamicPlatformAccessory } from '../../platformAccessory';

export interface HomebridgeAccessory extends PlatformAccessory {
	context: IAccessoryContext;
}

export interface AnimationAccessory extends PlatformAccessory {
	context: IAnimationContext;
}

export interface IAnimationContext {
	activeAccessoryList: Map<string, HomebridgeMagichomeDynamicPlatformAccessory>;
	animationBlueprint: IAnimationBlueprint;
	displayName?: string;
}

export interface IAccessoryContext {
	displayName?: string;
	deviceMetaData: IDeviceMetaData;
	assignedAnimations: string[];
	protoDevice: IProtoDevice;
	latestUpdate: number;
	isOnline: boolean;
	accessoryType: AccessoryTypes;
}

export enum AccessoryTypes {
	Light = 'light',
	Animation = 'animation',
}

export interface IAccessoryState {
	isOn: boolean;
	HSV: IColorHSV;
	TB: IColorTB;
}

export interface IAnimationState {
	isOn: boolean;
}

export interface IPartialAccessoryCommand {
	isOn?: boolean;
	HSV?: IPartialColorHSV;
	TB?: IPartialColorTB;
	colorTemperature?: number;
	isPowerCommand?: boolean;
}

export interface IAccessoryCommand {
	isOn: boolean;
	HSV: IColorHSV;
	TB: IColorTB;
	isPowerCommand: boolean;
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
	logLevel: number;
	colorWhiteInterfaceMode: string;
	colorOffSaturationLevel: number;
	colorWhiteSimultaniousSaturationLevel?: number;
}
