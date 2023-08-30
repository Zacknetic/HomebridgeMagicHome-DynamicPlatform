import { MHLogger } from './misc/helpers/MHLogger';
import { API, APIEvent, DynamicPlatformPlugin, Logger, PlatformConfig, Service } from 'homebridge';
import { repairObjectShape } from './misc/helpers/utils';
import { EXPECTED_CONTEXT_STRUCTURE } from './misc/types/constants';
// import { AnimationGenerator } from './AnimationGenerator'
import { AccessoryTypes, AnimationAccessory, HomebridgeAccessory } from './misc/types/types';
import { AccessoryGenerator } from './Generators/AccessoryGenerator';
import { MHConfig } from './misc/helpers/MHConfig';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class HomebridgeMagichomeDynamicPlatform implements DynamicPlatformPlugin {
	public readonly Service: typeof Service = this.api.hap.Service;
	public readonly Characteristic = this.api.hap.Characteristic;
	private repairFailedCount = 0;
	public count = 1;

	// public readonly logger: MHLogger;
	public readonly hbAccessoriesFromDisk: Map<string, HomebridgeAccessory> = new Map();
	animationsFromDiskMap: Map<string, AnimationAccessory> = new Map();

	constructor(public readonly log: Logger, public readonly config: PlatformConfig, public readonly api: API) {
		new MHConfig(config);
		const {
			advancedOptions: { logLevel },
		} = MHConfig;
		new MHLogger(log, logLevel);

		MHLogger.warn('If this plugin brings you joy, consider visiting GitHub and giving it a ⭐.');

		api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
			MHLogger.debug('Homebridge Magichome Dynamic Platform didFinishLaunching');
			this.initializePlatform();
		});
	}

	/**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   */
	configureAccessory(accessory) {
		// set cached accessory as not recently seen
		// if found later to be a match with a discovered device, will change to true
		// accessory.context.scansSinceSeen++;
		// accessory.context.pendingRegistration = true;
		// // add the restored accessory to the accessories cache so we can track if it has already been registered
		if (typeof accessory.context.protoDevice != 'undefined' || accessory.context.accessoryType == AccessoryTypes.Light) {
			const homebridgeUUID = accessory.context.protoDevice?.uniqueId;
			this.hbAccessoriesFromDisk.set(homebridgeUUID, accessory);
			MHLogger.info(`${this.hbAccessoriesFromDisk.size} - Loading accessory from cache: ${accessory.context.displayName}`);
		} else if (accessory.context.accessoryType == AccessoryTypes.Animation) {
			const homebridgeUUID = this.api.hap.uuid.generate(accessory.context.animationBlueprint.name);
			this.animationsFromDiskMap.set(homebridgeUUID, accessory);
		} else {
			//we need to fix the accessory
			MHLogger.warn('Accessory has outdated persistant data which is incompatible with the current version. Attempting to repair. This should be a one time operation (per device).');
			try {
				const updatedContext = repairObjectShape(accessory.context, EXPECTED_CONTEXT_STRUCTURE);
				if (updatedContext.protoDevice.ipAddress && updatedContext.protoDevice.uniqueId) {
					MHLogger.warn(`Successfully repaired accessory ${accessory.context.displayName}. Thank goodness...`);
					accessory.context = updatedContext;
					const homebridgeUUID = accessory.context.protoDevice?.uniqueId;
					this.hbAccessoriesFromDisk.set(homebridgeUUID, accessory);
				} else {
					this.repairFailedCount++;
				}
			} catch (error) {
				this.repairFailedCount++;
			}
		}
	}

	/**
   * Accessories are added by one of three Methods:
   * Method One: New devices that were seen after scanning the network and are registered for the first time
   * Method Two: Cached devices that were seen after scanning the network and are added while checking for ip discrepancies
   * Method Three: Cached devices that were not seen after scanning the network but are still added with a warning to the user
   */
	async initializePlatform() {
		if (this.repairFailedCount > 0) {
			//a short poem for the user explaining that their data is lost. Will it soften the blow?
			MHLogger.error('\n\nThree things in life are certain: death, taxes, and data loss.\nThe conversion was unsuccessful. \nLife\'s complexities continue.\n');
			MHLogger.error(
				`Failed to repair ${this.repairFailedCount} accessories. Please delete all old accessories and allow them to be re-scanned. \nAlternatively, please revert to a previous version of this plugin.`
			);
		}

		new AccessoryGenerator(this, this.hbAccessoriesFromDisk);
		// accesssoryGenerator.removeAllAccessories();
		await AccessoryGenerator.discoverAccessories();
		try {
			AccessoryGenerator.rescanAccessories();
		} catch (error) {
			MHLogger.error(error);
		}
	}
} //ZackneticMagichomePlatform class
