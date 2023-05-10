import { IAnimationBlueprint } from 'magichome-platform';
import { thunderStruck, rainbow, AnimationManager } from 'magichome-platform';
import { AnimationAccessory, MagicHomeAccessory } from './misc/types';
import { API, HAP, PlatformAccessory, PlatformConfig, uuid } from 'homebridge';

// import { homekitInterface } from './misc/types';
import { Logs } from './logs';
import { HomebridgeMagichomeDynamicPlatformAccessory } from './platformAccessory';
import { HomebridgeAnimationAccessory } from './animationAccessory';

const PLATFORM_NAME = 'homebridge-magichome-dynamic-platform';
const PLUGIN_NAME = 'homebridge-magichome-dynamic-platform';
const animationBlueprints = [rainbow, thunderStruck]
export class AnimationGenerator {

    public readonly activeAnimationAcessoriesMap: Map<string, AnimationAccessory> = new Map();
    public readonly cachedAccessoriesMap: Map<string, MagicHomeAccessory> = new Map();
    private hap: HAP;
    private animationManager: AnimationManager;
    constructor(
        private api: API,
        private logs: Logs,
        private hbLogger,
        private config : PlatformConfig,
        public readonly animationsFromDiskMap : Map<string, AnimationAccessory> = new Map(),
        private activeAccessories: HomebridgeMagichomeDynamicPlatformAccessory[]
    ) {
        this.hap = this.api.hap;
        this.animationManager = AnimationManager.getInstance([], [thunderStruck, rainbow]);
    }



    async generateActiveAccessories() {

        const newAccessoriesList: AnimationAccessory[] = [];
        const existingAccessoriesList: AnimationAccessory[] = [];


        for (const animationBlueprint of animationBlueprints) {
            const homebridgeUUID = this.hap.uuid.generate(animationBlueprint.name);
            try {
                if (this.animationsFromDiskMap.has(homebridgeUUID)) {
                    const existingAnimationAccessory = this.animationsFromDiskMap.get(homebridgeUUID);
                    this.animationsFromDiskMap.delete(homebridgeUUID);
                    this.logs.info(`[${animationBlueprint.name}] - Found existing accessory. Updating...`);
                    const existingAccessory = this.processOnlineAccessory(existingAnimationAccessory, animationBlueprint);
                    existingAccessoriesList.push(existingAccessory);

                } 
                
                else if (!this.activeAnimationAcessoriesMap.has(homebridgeUUID)) { //if the accessory is not a duplicate active device
                    const newAccessory: AnimationAccessory = this.createNewAnimation(animationBlueprint);
                    this.logs.info(`[${animationBlueprint.name}] - Found new accessory. Registering...`);
                    newAccessoriesList.push(newAccessory);	//add it to new accessory list
                    this.activeAnimationAcessoriesMap.set(homebridgeUUID, newAccessory);

                }


            } catch (e) {
                this.logs.error(e)
            }
        }

        this.registerNewAccessories(newAccessoriesList);	//register new accessories from scan
        this.updateExistingAccessories(existingAccessoriesList);
        // this.unregisterAccessory(existingAccessoriesList);
    }

    createNewAnimation(animationBlueprint: IAnimationBlueprint): AnimationAccessory {
        let homebridgeUUID = this.hap.uuid.generate(animationBlueprint.name);
        const newAccessory: AnimationAccessory = new this.api.platformAccessory(animationBlueprint.name, homebridgeUUID) as AnimationAccessory;
        newAccessory.context.animationBlueprint = animationBlueprint;
        new HomebridgeAnimationAccessory(this.hap, this.logs, this.api, newAccessory, this.activeAccessories, animationBlueprint);
        return newAccessory;
    }

    processOnlineAccessory(existingAccessory: AnimationAccessory, animationBlueprint: IAnimationBlueprint) {


        // const { name, pattern, accessoryOffsetMS } = animationLoop;


        try {
            new HomebridgeAnimationAccessory(this.hap, this.logs, this.api, existingAccessory, this.activeAccessories, animationBlueprint);
            // new homekitInterface[description](this.api, existingAccessory, this.config, controller, this.hbLogger, this.logs);
        } catch (error) {
            console.log(error)
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