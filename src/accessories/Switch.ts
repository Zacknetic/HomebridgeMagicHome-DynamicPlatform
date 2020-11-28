import { HomebridgeMagichomeDynamicPlatformAccessory } from '../platformAccessory';
import { ILightState } from '../magichome-interface/types';
import { cloneDeep } from 'lodash'; 
import Common from './common'; 

export class Switch extends HomebridgeMagichomeDynamicPlatformAccessory {
  
  addHomekitProps(state:ILightState):void {
    throw new Error('Switch addHomeKitProps not implemented');
  }

  addMagicHomeProps(state:ILightState):void {
    throw new Error('Switch addMagicHomeProps not implemented');
  }

  async updateDeviceState(_timeout = 200, lockedState:ILightState) {
    this.addMagicHomeProps(lockedState);
    this.lightLastWrittenState = cloneDeep(lockedState);   
    const { r, g, b, mask } = Common.getRGBfromState(lockedState);
    this.send([0x31, r, g, b, 0x00, mask, 0x0F], true, _timeout); //8th byte checksum calculated later in send()
  }  
    
}