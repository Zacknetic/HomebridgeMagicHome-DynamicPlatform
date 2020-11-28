import { clamp, convertHSLtoRGB, convertRGBtoHSL } from '../magichome-interface/utils';
import { HomebridgeMagichomeDynamicPlatformAccessory } from '../PlatformAccessory';
import { ILightState, opMode } from '../magichome-interface/types';
import Common from './common'; 
import _ from 'lodash'; // Import the entire lodash library

export class RGBWWBulb extends HomebridgeMagichomeDynamicPlatformAccessory {
  
  addHomekitProps(state:ILightState):void {
    this.platform.log.info('addHomekitProps is calling convertRGBWWtoHSB');
    Common.convertRGBWWtoHSB(state, this);
    return;
  }

  addMagicHomeProps(state:ILightState):void {
    this.platform.log.info('addMagicHomeProps is calling convertHSBtoRGBWW');
    Common.convertHSBtoRGBWW(state, this);
    return;
  }

  async updateDeviceState(_timeout = 200, lockedState:ILightState) {
    this.addMagicHomeProps(lockedState);

    this.lightLastWrittenState = _.cloneDeep(lockedState);   

    const { red:r, green:g, blue:b } = lockedState.RGB;
    const { coldWhite:cw, warmWhite:ww } = lockedState.whiteValues;
    const mask = Common.getMaskFromOpMode(lockedState.operatingMode);
    this.send([0x31, r, g, b, ww, cw, mask, 0x0F], true, _timeout); //9th byte checksum calculated later in send() 
  }
    
}
