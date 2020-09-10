import { APIEvent, AccessoryEventTypes, UUID } from 'homebridge';
import type { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';

import { DimmerStrip } from './accessories/DimmerStrip';
import { RGBStrip } from './accessories/RGBStrip';
import { GRBStrip } from './accessories/GRBStrip';
import { RGBWBulb } from './accessories/RGBWBulb';
import { RGBWWBulb } from './accessories/RGBWWBulb';
import { RGBWStrip } from './accessories/RGBWStrip';
import { RGBWWStrip } from './accessories/RGBWWStrip';

import { Discover } from './magichome-interface/Discover';
import { Transport } from './magichome-interface/Transport';
//import { AnimationPlatformAccessory } from './animationPlatformAccessory';
import { HomebridgeMagichomeDynamicPlatformAccessory } from './platformAccessory';

import broadcastAddress from 'broadcast-address';
import systemInformation from 'systeminformation';

const NEW_COMMAND_QUERY_STATE: Uint8Array = Uint8Array.from([0x81, 0x8a, 0x8b]);
const LEGACY_COMMAND_QUERY_STATE: Uint8Array = Uint8Array.from([0xEF, 0x01, 0x77]);

const accessoryType = {
  DimmerStrip,
  GRBStrip,
  RGBStrip,
  RGBWBulb,
  RGBWWBulb,
  RGBWStrip,
  RGBWWStrip,
};

const lightTypesMap = new Map([
  [1,  
    {
      controllerType: 'GRBStrip',
      convenientName: 'Simple GRB',
      simultaneousCCT: false,
      hasColor: true,
    }],
  [2,  
    {
      controllerType: 'RGBWWStrip',
      convenientName: 'RGBWW Simultanious',
      simultaneousCCT: true,
      hasColor: true,
    }],
  [3,  
    {
      controllerType: 'RGBWWStrip',
      convenientName: 'RGBWW Simultanious',
      simultaneousCCT: true,
      hasColor: true,
    }],
  [4,  
    {
      controllerType: 'RGBStrip',
      convenientName: 'Simple RGB',
      simultaneousCCT: false,
      hasColor: true,
    }],
  [5,  
    {
      controllerType: 'RGBWWBulb',
      convenientName: 'RGBWW Non-Simultanious',
      simultaneousCCT: false,
      hasColor: true,
    }],
  [7,  
    {
      controllerType: 'RGBWWBulb',
      convenientName: 'RGBWW Non-Simultanious',
      simultaneousCCT: false,
      hasColor: true,
    }],
  [8,  
    {
      controllerType: 'RGBWBulb',
      convenientName: 'RGBW Non-Simultanious',
      simultaneousCCT: false,
      hasColor: true,
    }],
  [9,  
    {
      controllerType: 'RGBWBulb',
      convenientName: 'RGBW Non-Simultanious',
      simultaneousCCT: false,
      hasColor: true,
    }],
  [10,  
    {
      controllerType: 'RGBWStrip',
      convenientName: 'RGBW Simultanious',
      simultaneousCCT: true,
      hasColor: true,
    }],
  [99,  
    {
      controllerType: 'DimmerStrip',
      convenientName: 'Dimmer',
      simultaneousCCT: false,
      hasColor: false,
    }],
]);



/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class HomebridgeMagichomeDynamicPlatform implements DynamicPlatformPlugin {
  public readonly Service = this.api.hap.Service;
  public readonly Characteristic = this.api.hap.Characteristic;
  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  public readonly lightAccessories: HomebridgeMagichomeDynamicPlatformAccessory[] = [];
  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing homebridge-magichome-dynamic-platform');
    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      log.debug('Executed didFinishLaunching callback');

      // run the method to discover / register your devices as accessories
      this.discoverDevices();
      // this.discoverAnimations();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {

    this.log.debug('Loading accessory from cache...', accessory.context.displayName);
    // set cached accessory as not recently seen 
    // if found later to be a match with a discovered device, will change to true
    accessory.context.restartsSinceSeen++;
    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * Accessories are added by one of three Methods:
   * Method One: New devices that were seen after scanning the network and are registered for the first time
   * Method Two: Cached devices that were seen after scanning the network and are added while checking for ip discrepancies 
   * Method Three: Cached devices that were not seen after scanning the network but are still added with a warning to the user
   */


  async discoverDevices() {
    const defaultInterface = await systemInformation.networkInterfaceDefault();
    const broadcastIPAddress = broadcastAddress(defaultInterface.toString());

    let registeredDevices = 0;
    let newDevices = 0;
    let unseenDevices = 0;
    const discover = new Discover(this.log, this.config);
    this.log.info('Scanning broadcast-address: %o on interface: %o for Magichome lights... \n', broadcastIPAddress, defaultInterface);

    let devices: any = await discover.scan(2000);
    
    let scans = 0;
    while(devices.length === 0 && scans <5){
      this.log.warn('( Scan: %o ) Discovered zero devices... rescanning...', scans + 1);
      devices = await discover.scan(2000);
      scans++;
    }

    if (devices.length == 0){
      this.log.warn('\nDiscovered zero devices! Will load cached devices if they exist.\n');
    } else {
      this.log.info('\nDiscovered %o devices.\n', devices.length);
    }


    
    try {
      // loop over the discovered devices and register each one if it has not already been registered
      for ( const device of devices) {  

        // generate a unique id for the accessory this should be generated from
        // something globally unique, but constant, for example, the device serial
        // number or MAC address
        const uuid = this.api.hap.uuid.generate(device.uniqueId);
        device.uuid = uuid;
        // check that the device has not already been registered by checking the
        // cached devices we stored in the `configureAccessory` method above
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);  


        /**
   * Accessory Generation Method One: UUID has not been seen before. Register new accessory.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
        if (!existingAccessory) { 

          const updatedDevice = await this.determineController(device);
          if(updatedDevice == null){
            this.log.error('Warning! Device type could not be determined, please restart homebridge and try again. If problem persists, file an issue.\n', 
              device.uniqueId);
            continue;
          }
          
          const accessory = new this.api.platformAccessory(updatedDevice.lightParameters.convenientName, uuid);

          //create a new transport object so we have access to devices state
          //this is neccessary to determine the lightVersion
          const transport = new Transport(device.ipAddress, this.config);
          //retrieve the device's state
  
          const state = await transport.getState(1000);

          //check if device is on blacklist or is not on whitelist
          if(!await this.isAllowed(device.uniqueId)){
            this.log.warn('Warning! New device with Unique ID: %o is blacklisted or is not whitelisted.\n', 
              device.uniqueId);

            //exit the loop
            continue;
          }

        
          // store a copy of the device object in the `accessory.context`
          // the `context` property can be used to store any data about the accessory you may need
         

          // saved a distint cached version of the IP address to compare in future restarts
          accessory.context.cachedIPAddress = device.ipAddress;

          // set its restart prune counter to 0 as it has been seen this session
          accessory.context.restartsSinceSeen = 0;

          accessory.context.displayName = updatedDevice.lightParameters.convenientName;
          accessory.context.lightParameters = updatedDevice.lightParameters;
          device.lightVersion = updatedDevice.lightVersion;
          device.lightVersionModifier = updatedDevice.lightVersionModifier;

          accessory.context.device = device; 
          // create the accessory handler
          // this is imported from `platformAccessory.ts`
          const lightAccessory: HomebridgeMagichomeDynamicPlatformAccessory = new accessoryType[accessory.context.lightParameters.controllerType](this, accessory, this.config);

          // link the accessory to your platform
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          registeredDevices++;
          newDevices++;

          this.log.info('\nRegistering new accessory %o \nModel: %o \nUnique ID: %o \nIP-Address: %o \nVersion %o \nVersion Modifier: %o\n',  
            accessory.context.displayName,
            device.modelNumber, 
            device.uniqueId, 
            device.ipAddress,
            device.lightVersion,
            device.lightVersionModifier);

          // push into accessory cache
          this.accessories.push(accessory);
          this.lightAccessories.push(lightAccessory);
        } else {
          // the device has already been registered and will need
          // to ensure the ip address (or other custom variables) are still identical
        
          // set its restart prune counter to 0 as it has been seen this session
          existingAccessory.context.restartsSinceSeen = 0;

          // test if the existing cached accessory ip address matches the discovered
          // accessory ip address if not, replace it
          if (existingAccessory.context.cachedIPAddress !== device.ipAddress) {

            this.log.warn('Ip address discrepancy found for accessory:' , existingAccessory.context.displayName);
            this.log.warn('Expected ip address: ', existingAccessory.context.cachedIPAddress);
            this.log.warn('Discovered ip address: ', device.ipAddress);

            // overwrite the ip address of the existing accessory to the newly disovered ip address
            existingAccessory.context.cachedIPAddress = device.ipAddress;

            this.log.warn('Ip address successfully reassigned to: %o\n ', existingAccessory.context.cachedIPAddress);
          }
          
          if(!await this.isAllowed(existingAccessory.context.device.uniqueId)){
            this.log.warn('Warning! Accessory: %o will be pruned as its Unique ID: %o is blacklisted or is not whitelisted.\n', 
              existingAccessory.context.displayName, existingAccessory.context.device.uniqueId);
            this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
            continue;
          }

        
          this.log.info('\nRegistering cached accessory %o \nModel: %o \nUnique ID: %o \nIP-Address: %o \nVersion %o \nVersion Modifier: %o\n',  
            existingAccessory.context.displayName,
            existingAccessory.context.device.modelNumber, 
            existingAccessory.context.device.uniqueId, 
            existingAccessory.context.cachedIPAddress,
            existingAccessory.context.device.lightVersion,
            existingAccessory.context.device.lightVersionModifier);
          // create the accessory handler
          const lightAccessory = new accessoryType[existingAccessory.context.lightParameters.controllerType](this, existingAccessory, this.config);
          this.lightAccessories.push(lightAccessory);
          registeredDevices++;
          // udpate the accessory to your platform
          this.api.updatePlatformAccessories([existingAccessory]);
        } 
      }
    //=================================================
    // End Cached Devices //
    } catch (error) {
      this.log.error(error);
    }
   
    //***************** Device Pruning Start *****************//
    
    //if config settings are enabled, devices that are no longer seen
    //will be pruned, removing them from the cache. Usefull for removing
    //unplugged or unresponsive accessories

    for (const accessory of this.accessories){
      try {
      
   
        if(accessory.context.displayName.toString().toLowerCase().includes('delete')){
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.log.warn('Successfully pruned accessory: ', accessory.context.displayName,
            'due to being marked for deletion\n');
          continue;
        
        //if the config parameters for pruning are set to true, prune any devices that haven't been seen
        //for more restarts than the accepted ammount
        } else if(this.config.pruning.pruneMissingCachedAccessories || this.config.pruning.pruneAllAccessoriesNextRestart){
          if(accessory.context.restartsSinceSeen >= this.config.pruning.restartsBeforeMissingAccessoriesPruned || this.config.pruning.pruneAllAccessoriesNextRestart){
            this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            this.log.warn('Successfully pruned accessory:', accessory.context.displayName,
              'which had not being seen for (',accessory.context.restartsSinceSeen,') restart(s).\n');
            continue;
          }
        }
        //simple warning to notify user that their accessory hasn't been seen in n restarts
        if(accessory.context.restartsSinceSeen > 0){
        //logic for removing blacklisted devices
    
          if( !await this.isAllowed(accessory.context.device.uniqueId)){
            this.log.warn('Warning! Accessory: %o will be pruned as its Unique ID: %o is blacklisted or is not whitelisted.\n', 
              accessory.context.displayName, accessory.context.device.uniqueId);
            this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            continue;
          }


          this.log.warn('\nWarning! Continuing to register cached accessory %o despite not being seen for %o restarts. \nModel: %o \nUnique ID: %o \nIP-Address: %o\n Version %o \nVersion Modifier: %o \n',  
            accessory.context.displayName,
            accessory.context.restartsSinceSeen,
            accessory.context.device.modelNumber,
            accessory.context.device.uniqueId, 
            accessory.context.cachedIPAddress,
            accessory.context.device.lightVersion,
            accessory.context.device.lightVersionModifier);
          // create the accessory handler
        
          const lightAccessory = new accessoryType[accessory.context.lightParameters.controllerType](this, accessory, this.config);
          this.lightAccessories.push(lightAccessory);
          // udpate the accessory to your platform
          this.api.updatePlatformAccessories([accessory]);
          registeredDevices++;
          unseenDevices++;
        }
    
      
      } catch (error) {
        //this.log.debug(error);
      }


    }


    
    this.log.info('\nRegistered %o Magichome device(s). \nNew devices: %o \nCached devices that were seen this restart: %o \nCached devices that were not seen this restart: %o\n',
      registeredDevices, 
      newDevices, 
      registeredDevices-newDevices-unseenDevices, 
      unseenDevices);
  



  }//discoveredDevices

  async isAllowed(uniqueId){

    let isAllowed = true;
    try {

      if(this.config.deviceManagement.blacklistedUniqueIDs !== undefined 
        && this.config.deviceManagement.blacklistOrWhitelist !== undefined){

        if (((this.config.deviceManagement.blacklistedUniqueIDs).includes(uniqueId) && (this.config.deviceManagement.blacklistOrWhitelist).includes('blacklist')) 
   || (!(this.config.deviceManagement.blacklistedUniqueIDs).includes(uniqueId)) && (this.config.deviceManagement.blacklistOrWhitelist).includes('whitelist')){
          isAllowed = false; 
        }
      }
    } catch (error) {
      this.log.debug(error);
    }

    return isAllowed;
  }

  async getInitialState(ipAddress, _timeout = 500){

    const transport = new Transport(ipAddress, this.config);
    try{
      let scans = 0;
      let data;

      while(data == null && scans < 5){
        data = await transport.send(NEW_COMMAND_QUERY_STATE, true, _timeout);
        scans++;
      } 

      if (data.length < 14 || data == null) {
        return null;
      }
      return {      
        debugBuffer: data,
        lightVersionModifier: data.readUInt8(1),
        lightVersion: data.readUInt8(10),
      };
    
    } catch (error) {
      this.log.debug(error);
    }
  }

  async determineController(device){
    
    const initialState = await this.getInitialState (device.ipAddress);
    if( initialState == null){
      return null;
    }

    let lightVersion;
    const lightVersionModifier = initialState.lightVersionModifier;
    
    this.log.debug('\n Platform.ts.createAccessory(): \nAssigning controller to device: UniqueId: %o \nIpAddress %o \nModel: %o\nLight Version: %o\nLight Version Modifier: %o\n', device.uniqueId, device.ipAddress,device.modelNumber, initialState.lightVersion, initialState.lightVersionModifier);

    let lightParameters;
    //set the lightVersion so that we can give the device a useful name and later know how which protocol to use

    //check the version modifiers. I wish there was a pattern to this.
    
    if (lightVersionModifier == 33 || lightVersionModifier == 65){
      lightVersion = 99;
    } else if ((lightVersionModifier == 51 && lightVersion == 3) || (lightVersionModifier == 51 && lightVersion == 4 || device.modelNumber.includes('AK001-ZJ2131'))) {
      lightVersion = 1;
    } else if(lightVersionModifier == 4 || lightVersionModifier == 6) {
      lightVersion = 10;
    } else {
      lightVersion = initialState.lightVersion;
    }

    if(lightTypesMap.has(lightVersion)){
      this.log.debug('Light version: %o matches known device type records', lightVersion);
      lightParameters = lightTypesMap.get(lightVersion);
    } else {
      this.log.warn('Uknown light version: %o... type probably cannot be set. Trying anyway...', lightVersion);
      this.log.warn('Please create an issue at https://github.com/Zacknetic/HomebridgeMagicHome-DynamicPlatform/issues and post your homebridge.log');
      lightParameters = lightTypesMap.get(4);
    }

    this.log.debug('\nPlatform.ts.determineController(): \nLight version assigned to %o\nController Type assigned to %o', lightVersion, lightParameters.controllerType);
    return {
      lightParameters,
      lightVersion,
      lightVersionModifier,
    };
  }

  /*
  async discoverAnimations(){

    let registeredAnimations = 0;
    let newAnimations = 0;


    const animationDevices: any = this.config.animations;

    if (animationDevices.length == 0){
      return;
    } else {
      this.log.info('Found %o animations in config.', animationDevices.length);
    }

    try {
      // loop over the discovered devices and register each one if it has not already been registered
      for ( const animationDevice of animationDevices) {  

        // generate a unique id for the accessory this should be generated from
        // something globally unique, but constant
        const uuid = this.api.hap.uuid.generate(animationDevice.name);
        animationDevice.uuid = uuid;

        // check that the device has not already been registered by checking the
        // cached devices we stored in the `configureAccessory` method above
        const existingAnimationAccessory = this.accessories.find(accessory => accessory.UUID === uuid);  


        if (!existingAnimationAccessory) { 
          
          const animationAccessory = new this.api.platformAccessory(animationDevice.name, uuid);


          animationAccessory.context.displayName = animationDevice.name;


          animationAccessory.context.animationDevice = animationDevice; 
          // create the accessory handler
          // this is imported from `platformAccessory.ts`
          new AnimationPlatformAccessory(this, this.config, this.lightAccessories, animationAccessory);

          // link the accessory to your platform
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [animationAccessory]);
          registeredAnimations++;
          newAnimations++;

          this.log.info('Registering new animation %o',  
            animationAccessory.context.displayName,
          );

          // push into accessory cache
          this.accessories.push(animationAccessory);
 
        } else {
          // the animation has already been registered

          this.log.info('Registering existing animation %o',  
            existingAnimationAccessory.context.displayName,
          );

          // create the accessory handler
          new AnimationPlatformAccessory(this, this.config, this.lightAccessories, existingAnimationAccessory);
          registeredAnimations++;
          // udpate the accessory to your platform
          this.api.updatePlatformAccessories([existingAnimationAccessory]);
        }
      }
      this.log.info('\n\nRegistered %o total Animation(s)\nNew Animtions: %o \nCached Animations: %o\n',
        registeredAnimations, 
        newAnimations, 
        registeredAnimations-newAnimations,
      ); 
    //=================================================
    // End Cached Devices //
    } catch (error) {
      this.log.error(error);
    }
  }
*/
}//ZackneticMagichomePlatform class

  