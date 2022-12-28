import type { Service, CharacteristicValue, HAP } from 'homebridge';

import { AnimationAccessory, DEFAULT_ACCESSORY_STATE, IAccessoryState } from './misc/types';
// import { addAccessoryInformationCharacteristic, addBrightnessCharacteristic, addColorTemperatureCharacteristic, addConfiguredNameCharacteristic, addHueCharacteristic, addOnCharacteristic, addSaturationCharacteristic } from './misc/serviceCharacteristics';
import { BaseController, AnimationController } from 'magichome-platform';
import { Logs } from './logs';
import { HomebridgeMagichomeDynamicPlatformAccessory } from './platformAccessory';

const LISTENING_TIMEOUT_MS: number = 300;

export class HomebridgeAnimationAccessory {

    protected service: Service;
    protected service2: Service;

    protected accessoryState: IAccessoryState;
    protected animationController: AnimationController;
    protected isRecoding = false;
    protected numToggles = 0;
    listeningTimeout: NodeJS.Timeout;
    listenCount: number = 0;
    countTimeout: NodeJS.Timeout;
    isListening: boolean = false;
    isTurnedOn: number = 0;
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
        this.accessoryState = DEFAULT_ACCESSORY_STATE;
        // this.logs = logs;
        // this.controller = controller;
        this.hap = api.hap;
        this.api = api;
        // this.config = config;
        this.initializeCharacteristics();
        this.animationController = new AnimationController();
    }

    //=================================================
    // End Constructor //

    //=================================================
    // Start Setters //
    async setOn(value: CharacteristicValue) {
        this.accessoryState.isOn = value as boolean;
        if (this.animationController.isActive || !value) this.animationController.clearAnimations();
        clearTimeout(this.listeningTimeout);
        this.listenCount++;
        if (this.listenCount == 2) {
            this.logs.info("Listening for new devices.")
            this.isListening = true;
            // this.service2.updateCharacteristic(this.hap.Characteristic.StatusLowBattery, true);
        } else if (this.listenCount == 3) {
            this.listeningTimeout = setTimeout(async () => {
                this.listenCount = 0;
                this.isListening = false;

                this.logs.info("Assigning new devices.")
                const filteredAccessories = this.accessoriesList.filter(accessory => {
                    return accessory.isReadyToAnimate();
                });
                for (const accessory of filteredAccessories) {
                    if(!this.accessory.context.activeControllerList)this.accessory.context.activeControllerList = [];
                    this.accessory.context.activeControllerList.push(accessory.getController())
                }
            }, LISTENING_TIMEOUT_MS);
        } else if (this.listenCount >= 5) {
            this.isListening = false;
            this.listenCount = 0;
            this.accessory.context.activeControllerList = [];
        } else {
            this.listeningTimeout = setTimeout(async () => {
                this.listenCount = 0;
                if (value) {

                    await this.animationController.animateAsynchronously(this.accessory.context.activeControllerList, this.animationLoop).catch(e => { })
                }
            }, LISTENING_TIMEOUT_MS);
        }
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
    }

    addOnCharacteristic() {
        this.logs.trace(`[Trace] [${this.accessory.context.displayName}] - Adding On characteristic to service.`);
        this.service.getCharacteristic(this.hap.Characteristic.On)
            .onSet(this.setOn.bind(this))
            .onGet(this.getOn.bind(this));
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
