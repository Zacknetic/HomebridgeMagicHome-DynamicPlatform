export interface IDeviceDiscoveredProps {
    ipAddress: string;
    uniqueId: string;
    modelNumber: string;
}

export interface IDeviceQueriedProps {
    lightParameters: ILightParameters;
    controllerHardwareVersion: string;
    controllerFirmwareVersion: string;
}

export interface ILightParameters {
    controllerLogicType: string;
    convenientName: string;
    simultaneousCCT: boolean;
    hasColor:  boolean;
    hasBrightness: boolean;
}

export type IDeviceProps = IDeviceDiscoveredProps & IDeviceQueriedProps & {
    uuid: string;
    cachedIPAddress: string;
    displayName: string;
    restartsSinceSeen: number;
    lastKnownState;
}

export type IStateProps = {
    
}

;

