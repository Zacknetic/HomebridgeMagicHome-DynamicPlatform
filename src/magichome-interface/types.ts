export interface IDeviceBroadcastProps {
    ipAddress: string;
    uniqueId: string;
    modelNumber: string;
}

export interface IDeviceQueriedProps {
    lightParameters: ILightParameters;
    lightVersionOriginal: string;
    lightVersionModifier: string;
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