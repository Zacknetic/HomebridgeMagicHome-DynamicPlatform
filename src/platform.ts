import { APIEvent, AccessoryEventTypes, UUID } from 'homebridge';
import type { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { HomebridgeMagichomeDynamicPlatformAccessory } from './platformAccessory';
import { Discover } from './magichome-interface/Discover';
import { Transport } from './magichome-interface/transport';

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


    this.log.info('Loading accessory from cache...', accessory.context.displayName);

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
  async discoverDevices() {

    
    let devices: any = await Discover.scan();
    while(devices.length === 0){
      this.log.warn('Found zero devices... rescanning...');
      devices = Discover.scan();
      return;

    }



    // loop over the discovered devices and register each one if it has not already been registered
    for (const device of devices) {  

      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(device.uniqueId);
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);  
      // check that the device has not already been registered by checking the
      // cached devices we stored in the `configureAccessory` method above

      //=================================================
      // Start Unregistered Devices //
      const transport = new Transport(device.ipAddress, 1000);
      if (!existingAccessory) { 
        //create a new transport object so we have access to devices state
        //this is neccessary to determine the lightVersion
        

        //retrieve the device's state
        const state = await transport.getState();

        device.initialState = state.debugBuffer;
        device.lightVersion = state.lightVersion;

        //set the lightVersion so that we can give the device a useful name and later know how which protocol to use
        //test if the version modifier is 4 which means it's an RGBW strip
        if(state.lightVersionModifier === 4){
          device.lightVersion = 10;
        }
       
        this.log.info('Registering new accessory: ', device.lightVersion); 

        // create a new accessory
        const accessory = new this.api.platformAccessory(device.lightVersion, uuid);
        accessory.context.lightVersion = device.lightVersion;
        accessory.context.displayName = device.lightVersion;
        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.device = device; 

        // saved a distint cached version of the IP address to compare in future restarts
        accessory.context.cachedIPAddress = device.ipAddress;
        this.log.info('Discovered IP', accessory.context.device.ipAddress); 

        // set its restart prune counter to 0 as it has been seen this session
        accessory.context.restartsSinceSeen = 0;

        // create the accessory handler
        // this is imported from `platformAccessory.ts`
        new HomebridgeMagichomeDynamicPlatformAccessory(this, accessory, this.config);

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

        // push into accessory cache
        this.accessories.push(accessory);


        //=================================================
        // End Unregistered Devices //

        
      //=================================================
      // Start Cached Devices //
      } else {
      // the device has already been registered and will need
      // to ensure the ip address (or other custom variables) are still identical
        
        // set its restart prune counter to 0 as it has been seen this session
        existingAccessory.context.restartsSinceSeen = 0;
        //=================================================
        // Start IP Discrepency //
        // test if the existing cached accessory ip address matches the discovered
        // accessory ip address if not, replace it
        if (existingAccessory.context.cachedIPAddress !== device.ipAddress) {

          this.log.warn('Ip address discrepancy found for accessory:' , existingAccessory.context.displayName);
          this.log.warn('Expected ip address: ', existingAccessory.context.cachedIPAddress);
          this.log.warn('Discovered ip address: ', device.ipAddress);

          // overwrite the ip address of the existing accessory to the newly disovered ip address
          existingAccessory.context.cachedIPAddress = device.ipAddress;

          this.log.warn('Ip address successfully reassigned to: ', existingAccessory.context.cachedIPAddress);
        }

        //=================================================
        // End IP Discrepency //
        
        this.log.debug('Registering cached accessory %o Model: %o ID: %o IP-Address: %o \n Intial State: %o \n',  
          existingAccessory.context.displayName,
          existingAccessory.context.device.modelNumber, 
          existingAccessory.context.device.uniqueId, 
          existingAccessory.context.cachedIPAddress,
          existingAccessory.context.device.initialState);
        // create the accessory handler
        new HomebridgeMagichomeDynamicPlatformAccessory(this, existingAccessory,this.config);   

        // udpate the accessory to your platform
        this.api.updatePlatformAccessories([existingAccessory]);
      } 
    }
    //=================================================
    // End Cached Devices //
   
    //***************** Device Pruning Start *****************//

    //if config settings are enabled, devices that are no longer seen
    //will be pruned, removing them from the cache. Usefull for removing
    //unplugged or unresponsive accessories
    for (const accessory of this.accessories){
      
      //simple warning to notify user that their accessory hasn't been seen in n restarts
      if(accessory.context.restartsSinceSeen > 0){
        this.log.warn('Warning! Accessory: %o has not been seen for %o restarts but will continue to register.', 
          accessory.context.displayName, accessory.context.restartsSinceSeen);

        this.log.debug( 'Continuing to register cached accessory %o Model: %o ID: %o IP-Address: %o \n Intial State: %o \n',
          accessory.context.device.modelNumber, 
          accessory.context.device.uniqueId, 
          accessory.context.cachedIPAddress,
          accessory.context.device.initialState);
        // create the accessory handler
        new HomebridgeMagichomeDynamicPlatformAccessory(this, accessory,this.config);   

        // udpate the accessory to your platform
        this.api.updatePlatformAccessories([accessory]);

      }
      if(accessory.context.displayName.toString().toLowerCase().includes('delete')){
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.log.warn('Successfully pruned accessory:', accessory.context.displayName,
          'due to being marked for deletion');
     
      //if the config parameters for pruning are set to true, prune any devices that haven't been seen
      //for more restarts than the accepted ammount
      } else if(this.config.pruneMissingCachedAccessories){
        if(accessory.context.restartsSinceSeen >= this.config.restartsBeforeMissingAccessoriesPruned){
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.log.warn('Successfully pruned accessory:', accessory.context.displayName,
            'due to not being seen for (',accessory.context.restartsSinceSeen,') restart(s).');
        }
      }
    
    } 
    //***************** Device Pruning End *****************//

    this.log.info('Registered %o MagicHome devices.', this.accessories.length);
  }//disoveredDevices()
  
}//ZackneticMagichomePlatform class
  