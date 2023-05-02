import { BaseController, ControllerGenerator, IDeviceAPI, ICompleteDevice, IProtoDevice, ICompleteDeviceInfo, mergeDeep, overwriteDeep, IAnimationLoop, cctWave, IAnimationBlueprint } from 'magichome-platform';
import { thunderStruck, rainbow, AnimationManager } from 'magichome-platform';
import { AnimationAccessory, IAccessoryContext, IAccessoryState, MagicHomeAccessory } from './misc/types';
import { API, HAP, PlatformAccessory, PlatformConfig, uuid } from 'homebridge';

// import { homekitInterface } from './misc/types';
import { Logs } from './logs';
import { HomebridgeMagichomeDynamicPlatformAccessory } from './platformAccessory';
import { HomebridgeAnimationAccessory } from './animationAccessory';

const PLATFORM_NAME = 'homebridge-magichome-dynamic-platform';
const PLUGIN_NAME = 'homebridge-magichome-dynamic-platform';
const animationLoops = [rainbow, thunderStruck]
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
        activeAccessories: HomebridgeMagichomeDynamicPlatformAccessory[]
        ) {
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


        for (const animationLoop of animationLoops) {
            const homebridgeUUID = this.hap.uuid.generate(animationLoop.name);
            try {
                if (this.animationsFromDiskMap.has(homebridgeUUID)) {
                    const existingAnimationAccessory = this.animationsFromDiskMap.get(homebridgeUUID);
                    this.animationsFromDiskMap.delete(homebridgeUUID);
                    this.logs.info(`[${animationLoop.name}] - Found existing accessory. Updating...`);
                    const existingAccessory = this.processOnlineAccessory(existingAnimationAccessory, animationLoop);
                    existingAccessoriesList.push(existingAccessory);

                } else if (!this.activeAnimationAcessoriesMap.has(homebridgeUUID)) { //if the accessory is not a duplicate active device
                    const newAccessory: AnimationAccessory = this.createNewAnimation(animationLoop);
                    this.logs.info(`[${animationLoop.name}] - Found new accessory. Registering...`);
                    newAccessoriesList.push(newAccessory);	//add it to new accessory list


                    this.activeAnimationAcessoriesMap.set(homebridgeUUID, newAccessory);

                }


            } catch (e) {
                this.logs.error(e)
            }
        }

        this.registerNewAccessories(newAccessoriesList);	//register new accessories from scan
        this.updateExistingAccessories(existingAccessoriesList);
    }

    createNewAnimation(animationLoop: IAnimationBlueprint): AnimationAccessory {
        let homebridgeUUID = this.hap.uuid.generate(animationLoop.name);
        const newAccessory: AnimationAccessory = new this.api.platformAccessory(animationLoop.name, homebridgeUUID) as AnimationAccessory;
        newAccessory.context.animationBlueprint = animationLoop;
        new HomebridgeAnimationAccessory(this.hap, this.logs, this.api, newAccessory, this.activeAccessories, animationLoop);
        return newAccessory;
    }

    processOnlineAccessory(existingAccessory: AnimationAccessory, animationLoop: IAnimationBlueprint) {


        // const { name, pattern, accessoryOffsetMS } = animationLoop;


        try {
            new HomebridgeAnimationAccessory(this.hap, this.logs, this.api, existingAccessory, this.activeAccessories, animationLoop);
            // new homekitInterface[description](this.api, existingAccessory, this.config, controller, this.hbLogger, this.logs);
        } catch (error) {
            // throw new Error(`[Error] [${existingAccessory.context.displayName}] [UID: ${cachedDeviceInformation.protoDevice.uniqueId}] [processExistingAccessory]: ${error}`);
        }
        return existingAccessory;
    }

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