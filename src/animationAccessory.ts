import type { Service, CharacteristicValue, HAP } from 'homebridge';
import * as CustomHomeKitTypes from "./CustomHomeKitTypes";
import { AnimationAccessory, DEFAULT_ACCESSORY_STATE, DEFAULT_ANIMATION_STATE, IAccessoryState, IAnimationState } from './misc/types';
// import { addAccessoryInformationCharacteristic, addBrightnessCharacteristic, addColorTemperatureCharacteristic, addConfiguredNameCharacteristic, addHueCharacteristic, addOnCharacteristic, addSaturationCharacteristic } from './misc/serviceCharacteristics';
import { BaseController, AnimationManager, overwriteDeep } from 'magichome-platform';
import { Logs } from './logs';
import { HomebridgeMagichomeDynamicPlatformAccessory } from './platformAccessory';

const LISTENING_TIMEOUT_MS: number = 300;

export class HomebridgeAnimationAccessory {

    protected service: Service;
    protected service2: Service;

    protected accessoryState: IAnimationState = { isOn: false };
    protected animationManager: AnimationManager;
    protected isRecoding = false;
    protected numToggles = 0;
    listeningTimeout: NodeJS.Timeout;
    listenCount: number = 0;
    countTimeout: NodeJS.Timeout;
    isListening: boolean = false;
    //=================================================
    // Start Constructor //

    constructor(
        protected hap: HAP,
        protected logs,
        protected api,
        protected accessory: AnimationAccessory,
        protected accessoriesList: HomebridgeMagichomeDynamicPlatformAccessory[],
        protected animationLoop
    ) {
        overwriteDeep(this.accessoryState, DEFAULT_ANIMATION_STATE);
        // this.logs = logs;
        // this.controller = controller;
        this.hap = api.hap;
        this.api = api;
        // this.config = config;
        this.initializeCharacteristics();
        this.animationManager = new AnimationController();
    }

    //=================================================
    // End Constructor //

    //=================================================
    // Start Setters //
    async setOn(value: CharacteristicValue) {
        this.accessoryState.isOn = value as boolean;

        if (this.animationManager.isActive || !value) {
            this.animationManager.clearAnimations()
            for (const accessory of this.accessoriesList) {
                if (accessory.hasAssignedAnimation(this.animationLoop.name)) accessory.restoreBackupAccessoryState();
            }
        } else if (value) {

            const controllers = this.accessoriesList
                .filter(accessory => accessory.hasAssignedAnimation(this.animationLoop.name))
                .map(accessory => {
                    accessory.setBackupAccessoryState();
                    return accessory.getController();
                });

            await this.animationManager.animateAsynchronously(controllers, this.animationLoop).catch(e => { })
        }

    }

    assignDevices(value: CharacteristicValue) {
        if (!value) return;
        this.logs.info("Assigning new devices.")
        this.accessoriesList.filter(accessory => {
            return accessory.isReadyToAnimate();
        }).forEach(accessory => {
            accessory.addAssignedAnimation(this.animationLoop.name);
        });
    }

    clearDevices(value: CharacteristicValue) {
        if (!value) return;
        this.logs.info("Unassigning All Devices.")
        this.accessoriesList.forEach(
            accessory => {
                accessory.removeAssignedAnimation(this.animationLoop.name);
            });
    }



/**
 * Handle requests to get the current value of the "Status Low Battery" characteristic
 */

setConfiguredName(value: CharacteristicValue) {

    const name: string = value.toString();
    this.logs.warn('Renaming device to %o', name);
    this.accessory.context.displayName = name;
    this.api.updatePlatformAccessories([this.accessory]);
}

    //=================================================
    // End Setters //

    //=================================================
    // Start Getters //

    async getOn() {
    const { isOn } = this.accessoryState;
    return isOn;
}


//=================================================
// End LightEffects //

initializeCharacteristics() {
    this.addAccessoryInformationCharacteristic();

    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding "Switch" service to accessory.`);
    this.service = this.accessory.getService(this.hap.Service.Outlet) ?? this.accessory.addService(this.hap.Service.Outlet);
    this.addOnCharacteristic();
    this.addConfiguredNameCharacteristic();
    this.addOtherCharacteristics();

}

addOnCharacteristic() {
    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding On characteristic to service.`);
    this.service.getCharacteristic(this.hap.Characteristic.On)
        .onSet(this.setOn.bind(this))
        .onGet(this.getOn.bind(this));
}

addOtherCharacteristics() {
    this.service.getCharacteristic(CustomHomeKitTypes.Program).onSet(this.assignDevices.bind(this));
    this.service.getCharacteristic(CustomHomeKitTypes.Clear).onSet(this.clearDevices.bind(this));
}

addAccessoryInformationCharacteristic() {

    this.accessory.getService(this.hap.Service.AccessoryInformation)!
        .setCharacteristic(this.hap.Characteristic.Manufacturer, 'Zacknetic')
        // .setCharacteristic(this.hap.Characteristic.SerialNumber, uniqueId)
        // .setCharacteristic(this.hap.Characteristic.Model, modelNumber)
        // .setCharacteristic(this.hap.Characteristic.HardwareRevision, controllerHardwareVersion?.toString(16) ?? 'unknown')
        // .setCharacteristic(this.hap.Characteristic.FirmwareRevision, controllerFirmwareVersion?.toString(16) ?? 'unknown ')
        .removeAllListeners(this.hap.CharacteristicEventTypes.SET)
        .removeAllListeners(this.hap.CharacteristicEventTypes.GET);

    this.accessory.getService(this.hap.Service.AccessoryInformation)!
        .addOptionalCharacteristic(this.hap.Characteristic.ConfiguredName);
}

addConfiguredNameCharacteristic() {
    if (!this.service.testCharacteristic(this.hap.Characteristic.ConfiguredName)) {
        this.service.addCharacteristic(this.hap.Characteristic.ConfiguredName)
            .onSet(this.setConfiguredName.bind(this));
    } else {
        this.service.getCharacteristic(this.hap.Characteristic.ConfiguredName)
            .onSet(this.setConfiguredName.bind(this));
    }
    this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding Configured Name characteristic to service.`);

}
}
