import type { PlatformAccessory } from 'homebridge';

export interface IDeviceDiscoveredProps {
    ipAddress: string;
    uniqueId: string;
    modelNumber: string;
}

export interface IDeviceQueriedProps {
    lightParameters: ILightParameters;
    controllerHardwareVersion: string | number;
    controllerFirmwareVersion: string | number;
}

export interface ILightParameters {
    controllerLogicType: ControllerTypes;
    convenientName: string;
    simultaneousCCT: boolean;
    hasColor:  boolean;
    hasCCT:  boolean;
    hasBrightness: boolean;
}

export enum ControllerTypes {
    RGBWStrip = 'RGBWStrip',
    RGBWWStrip = 'RGBWWStrip',
    CCTStrip = 'CCTStrip',
    DimmerStrip = 'DimmerStrip',
    GRBStrip = 'GRBStrip',
    RGBWWBulb = 'RGBWWBulb',
    RGBWBulb = 'RGBWBulb',
    Switch = 'Switch',
    RGBStrip = 'RGBStrip'
}

export type IDeviceProps = IDeviceDiscoveredProps & IDeviceQueriedProps & {
    UUID: string;
    cachedIPAddress: string;
    displayName: string;
    restartsSinceSeen: number;
    lastKnownState?: ILightState;
}

export interface ILightState {
    isOn: boolean;
    RGB: IColorRGB;
    HSL?: IColorHSL;
    whiteValues:  IWhites;
    brightness?: number;
    colorTemperature?: number;
    debugBuffer?: Buffer;
    controllerHardwareVersion?: string;
    controllerFirmwareVersion?: string;
}

export interface IColorRGB {
    red: number; 
    green: number; 
    blue:number;
}

export interface IColorHSL {
    hue: number; 
    saturation: number; 
    luminance: number;
}

export interface IWhites {
    warmWhite: number; 
    coldWhite: number; 
}

export interface MagicHomeAccessory extends PlatformAccessory{
    context: {
      displayName: string;
      device: IDeviceProps;
      pendingRegistration?: boolean;
    }
  } 