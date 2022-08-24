import { BaseController, ControllerGenerator, IDeviceAPI, ICompleteDevice, IProtoDevice, ICompleteDeviceInfo, mergeDeep, overwriteDeep, IAnimationLoop } from 'magichome-platform';
import { thunderStruck, colorWave, AnimationController } from 'magichome-platform';
import { AnimationAccessory, IAccessoryContext, IAccessoryState, MagicHomeAccessory } from './misc/types';
import { API, HAP, PlatformAccessory, PlatformConfig, uuid } from 'homebridge';

// import { homekitInterface } from './misc/types';
import { Logs } from './logs';
import { HomebridgeMagichomeDynamicPlatformAccessory } from './platformAccessory';
import { HomebridgeAnimationAccessory } from './animationAccessory';

const PLATFORM_NAME = 'homebridge-magichome-dynamic-platform';
const PLUGIN_NAME = 'homebridge-magichome-dynamic-platform';
const animationLoops = [colorWave, thunderStruck]
export class AnimationGenerator {

    public readonly animationsFromDiskMap: Map<string, AnimationAccessory> = new Map();
    public readonly activeAnimationAcessoriesMap: Map<string, AnimationAccessory> = new Map();
    public readonly cachedAccessoriesMap: Map<string, MagicHomeAccessory> = new Map();
    private activeAccessories: HomebridgeMagichomeDynamicPlatformAccessory[];
    private hap: HAP;
    private api: API;
    private hbLogger;
    private config: PlatformConfig;
    private logs: Logs;
    constructor(
        api: API,
        logs: Logs,
        hbLogger,
        config,
        animationsFromDiskMap,
        activeAccessories: HomebridgeMagichomeDynamicPlatformAccessory[]) {
        this.api = api;
        this.hap = api.hap;
        this.hbLogger = hbLogger;
        this.logs = logs;
        this.config = config;
        this.animationsFromDiskMap = animationsFromDiskMap;
        this.activeAccessories = activeAccessories;
    }



    async generateActiveAccessories() {

        const newAccessoriesList: AnimationAccessory[] = [];
        const existingAccessoriesList: AnimationAccessory[] = [];

        this.animationsFromDiskMap.forEach((animation) => {
            this.unregisterAccessory(animation)
        })
        for (const animationLoop of animationLoops) {
            let currAccessory: AnimationAccessory;
            const max = 99999999;
            const min = 11111111
            const randomInt = Math.floor(Math.random() * (max - min + 1) + min);
            animationLoop.name = randomInt.toString();

            const uniqueId = animationLoop.name;

            // try {
            //     if (this.animationsFromDiskMap.has(uniqueId)) {
                //     const existingAccessory = this.animationsFromDiskMap.get(uniqueId);

                //     this.animationsFromDiskMap.delete(uniqueId);
                //     this.logs.info(`[${existingAccessory.context.animationLoop.name}] - Found existing accessory. Updating...`);
                //     currAccessory = this.processOnlineAccessory(existingAccessory, animationLoop);
                //     existingAccessoriesList.push(currAccessory);

                // } else if (!this.activeAnimationAcessoriesMap.has(uniqueId)) { //if the accessory is not a duplicate active device
                    currAccessory = this.createNewAnimation(animationLoop);
                    this.logs.info(`[${currAccessory.context.animationLoop.name}] - Found new accessory. Registering...`);
                    newAccessoriesList.push(currAccessory);	//add it to new accessory list
                // }

                this.activeAnimationAcessoriesMap.set(uniqueId, currAccessory);
            // } catch (error) {
            //     this.logs.error(error);
            // }
        }

        this.registerNewAccessories(newAccessoriesList);	//register new accessories from scan
        this.updateExistingAccessories(existingAccessoriesList);

    }

    createNewAnimation(animationLoop: IAnimationLoop): AnimationAccessory {
        const { name, pattern, accessoryOffsetMS } = animationLoop;
        const homebridgeUUID = this.hap.uuid.generate(name);
        const newAccessory: AnimationAccessory = new this.api.platformAccessory(name, homebridgeUUID) as AnimationAccessory;
        newAccessory.context.animationLoop = animationLoop;
        new HomebridgeAnimationAccessory(this.hap, this.logs, this.api, newAccessory, this.activeAccessories, animationLoop);

        return newAccessory;

    }

    processOnlineAccessory(existingAccessory: AnimationAccessory, animationLoop: IAnimationLoop) {


        const { name, pattern, accessoryOffsetMS } = animationLoop;


        try {
            new HomebridgeAnimationAccessory(this.hap, this.logs, this.api, existingAccessory, this.activeAccessories, animationLoop);
            // new homekitInterface[description](this.api, existingAccessory, this.config, controller, this.hbLogger, this.logs);
        } catch (error) {
            // throw new Error(`[Error] [${existingAccessory.context.displayName}] [UID: ${cachedDeviceInformation.protoDevice.uniqueId}] [processExistingAccessory]: ${error}`);
        }
        return existingAccessory;
    }

    // registerOfflineAccessories() {
    //     const offlineAccessoriesList: MagicHomeAccessory[] = [];
    //     const completeDevicesInfo: ICompleteDeviceInfo[] = [];
    //     this.accessoriesFromDiskMap.forEach(async (offlineAccessory) => {
    //         const { displayName, deviceMetaData, protoDevice, latestUpdate } = offlineAccessory.context;
    //         const completeDeviceInfo: ICompleteDeviceInfo = { protoDevice, deviceMetaData, latestUpdate };
    //         completeDevicesInfo.push(completeDeviceInfo);
    //     });

    //     const controllers = this.controllerGenerator.generateCustomControllers(completeDevicesInfo);

    //     for (const controller of controllers) {
    //         try {
    //             const { protoDevice: { uniqueId } } = controller.getCachedDeviceInformation();
    //             if (this.accessoriesFromDiskMap.has(uniqueId)) {
    //                 const offlineAccessory = this.accessoriesFromDiskMap.get(uniqueId);
    //                 this.accessoriesFromDiskMap.delete(uniqueId);
    //                 this.processOfflineAccessory(offlineAccessory, controller);
    //                 offlineAccessoriesList.push(offlineAccessory);
    //                 this.cachedAccessoriesMap.set(uniqueId, offlineAccessory);
    //             }
    //         } catch (error) {
    //             this.logs.error(error);
    //         }
    //     }

    //     this.updateExistingAccessories(offlineAccessoriesList);
    // }




    registerNewAccessories(newAccessories: AnimationAccessory[]) {
        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, newAccessories);

    }

    updateExistingAccessories(existingAccessories: AnimationAccessory[]) {
        this.api.updatePlatformAccessories(existingAccessories);
    }

    unregisterAccessory(existingAnimationAccessory) {

        // this.activeAnimationAcessoriesMap.delete(uuid);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAnimationAccessory]);
        // this.logs.warn(reason);
    }

    //    const accessory = new this.api.platformAccessory(deviceQueryData.lightParameters.convenientName, generatedUUID) as MagicHomeAccessory;

}