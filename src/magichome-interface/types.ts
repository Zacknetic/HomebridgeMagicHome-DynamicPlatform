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

enum opMode {
    colorMode = 240,
    whiteMode = 15,
    simultaneous = 255
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