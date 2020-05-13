/* eslint-disable linebreak-style */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { APIEvent, AccessoryEventTypes } from 'homebridge';
import type { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { ZackneticMagichomePlatformAccessory } from './platformAccessory';
//import { LightController } from './magichome-interface/lightController';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class ZackneticMagichomePlatform implements DynamicPlatformPlugin {
  public readonly Service = this.api.hap.Service;
  public readonly Characteristic = this.api.hap.Characteristic;
  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing:', this.config.name);
    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {


    this.log.info('Restoring accessory from cache:', accessory.displayName);

    // set cached accessory as not recently seen 
    // if found later to be a match with a discovered device, will change to true
    accessory.context.restartsSinceSeen++;

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
    
 
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {

    // EXAMPLE ONLY
    // A real plugin you would discover accessories from the local network, cloud services
    // or a user-defined array in the platform config.
    const exampleDevices = [
      {
        uniqueId: '1234',
        modelNumber: '151000',
        displayName: 'Bedroom Light 6',
        ipAddress: '192.168.1.22',
        lightVersion: '8',

      },
      {
        uniqueId: '5678',
        modelNumber: '151001',
        displayName: 'Bedroom Light 7',
        ipAddress: '192.168.1.23',
        lightVersion: '7',
      },
    ];   


    // loop over the discovered devices and register each one if it has not already been registered
    for (const device of exampleDevices) {

      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(device.uniqueId);
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);  
      // check that the device has not already been registered by checking the
      // cached devices we stored in the `configureAccessory` method above



      if (!existingAccessory) { 
        this.log.info('Registering new accessory:', device.displayName); 

        // create a new accessory
        const accessory = new this.api.platformAccessory(device.displayName, uuid);

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.device = device; 

        // saved a distint cached version of the IP address to compare in future restarts
        accessory.context.cachedIPAddress = device.ipAddress;

        // set its restart prune counter to 0 as it has been seen this session
        accessory.context.restartsSinceSeen = 0;

        this.log.info('Discovered IP', accessory.context.device.ipAddress); 


 
        // create the accessory handler
        // this is imported from `platformAccessory.ts`
        new ZackneticMagichomePlatformAccessory(this, accessory);

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

        // push into accessory cache
        this.accessories.push(accessory);

      // otherwise the device has already been registered and will need
      // to ensure the ip address (or other custom variables) are still identical
      } else {

        this.log.info('Registering cached accessory: ', device.displayName, '...');
        
        // set its restart prune counter to 0 as it has been seen this session
        existingAccessory.context.restartsSinceSeen = 0;

        // test if the existing cached accessory ip address matches the discovered
        // accessory ip address
        if (existingAccessory.context.cachedIPAddress !== device.ipAddress) {

          this.log.info('Ip address discrepancy found for accessory:' , device.displayName);
          this.log.info('Expected ip address: ', existingAccessory.context.cachedIPAddress);
          this.log.info('Discovered ip address: ', device.ipAddress);

          // overwrite the ip address of the existing accessory to the newly disovered ip address
          existingAccessory.context.cachedIPAddress = device.ipAddress;

          this.log.info('Ip address successfully reassigned to: ', existingAccessory.context.cachedIPAddress);
        }
        
        // create the accessory handler
        new ZackneticMagichomePlatformAccessory(this, existingAccessory);   

        // udpate the accessory to your platform
        this.api.updatePlatformAccessories([existingAccessory]);

        // push into accessory cache
        this.accessories.push(existingAccessory); 
      } 
    }

    if(this.config.pruneMissingCachedAccessories){
 
      for (const accessory of this.accessories){
        if(accessory.context.restartsSinceSeen >= this.config.restartsBeforeMissingAccessoriesPruned){
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.log.info('Successfully pruned accessory:', accessory.context.device.displayName,
            'due to not being seen for (',accessory.context.restartsSinceSeen,') restart(s).');
        }
      }
    
    } 
 
  } 
}
  