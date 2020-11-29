import { HomebridgeMagichomeDynamicPlatformAccessory } from '../platformAccessory';
import { ILightState } from '../magichome-interface/types';
import Common from './common'; 
import { cloneDeep } from 'lodash'; 

export class RGBWWBulb extends HomebridgeMagichomeDynamicPlatformAccessory {
  
  addHomekitProps(state:ILightState):void {
    if(this.config.advancedOptions?.useColorTemperature){
      this.platform.log.info('EXPRIMENTAL MAPPER - addHomekitProps: convertRGBWWtoHSB_v2');
      Common.convertRGBWWtoHSB_v2(state, this as any);
      return;
    }
    Common.convertRGBWWtoHSB(state, this as any);
    return;
  }

  addMagicHomeProps(state:ILightState):void {
    if(this.config.advancedOptions?.useColorTemperature){
      this.platform.log.info('EXPRIMENTAL MAPPER - addMagicHomeProps: convertHSBtoRGBWW_v2');
      Common.convertHSBtoRGBWW_v2(state, this as any);
      return;
    }
    Common.convertHSBtoRGBWW(state, this as any);
    return;
  }

  async updateDeviceState(_timeout = 200, lockedState:ILightState) {
    this.addMagicHomeProps(lockedState);
    this.lightLastWrittenState = cloneDeep(lockedState);   
    const { r, g, b, ww, cw, mask } = Common.getRGBWWfromState(lockedState);
    this.send([0x31, r, g, b, ww, cw, mask, 0x0F], true, _timeout); //9th byte checksum calculated later in send() 
  }
    
}
