export interface IDeviceBroadcastProps {
    ipAddress: string;
    uniqueId: string;
    modelNumber: string;
}

export interface IDeviceQueriedProps {
    lightParameters: ILightParameters;
    lightVersionOriginal: string;
    lightVersionModifier: string;
    operatingMode: opMode;
}

export enum opMode {
    redBlueGreenMode = 'redBlueGreenMode',
    temperatureMode = 'temperatureMode',
    simultaneous = 'simultaneous',
    unknown = 'unknown'
}

export interface ILightParameters {
    controllerType: string;
    convenientName: string;
    simultaneousCCT: boolean;
    hasColor:  boolean;
    hasBrightness: boolean;
}

export type IDeviceProps = IDeviceBroadcastProps & IDeviceQueriedProps & {
    uuid: string;
};
export interface ILightState {
    isOn: boolean;
    operatingMode: opMode;
    RGB: IColorRGB;
    HSL?: IColorHSL;
    whiteValues:  IWhites;
    brightness?: number;
    colorTemperature?: number;
    debugBuffer?: Buffer;
    lightVersion?: number;
    lightVersionModifier?: number;
    targetState: ITargetLightState;
}

export interface ITargetLightState {
    targetMode: opMode;
    targetOnState: boolean | null
    targetHSL: IColorHSL;
    targetColorTemperature?: number;
    targetBrightness?: number
}
export interface IColorRGB {
    red: number; 
    green: number; 
    blue:number;
}

export interface IColorHSL {
    hue: number; 
    saturation: number; 
    luminance:number;
}

export interface IWhites {
    warmWhite: number; 
    coldWhite: number; 
}