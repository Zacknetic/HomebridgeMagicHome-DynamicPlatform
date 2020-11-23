

/*
      Message Transmission Logic
          Every time a new message arrives OR 100ms after last message, we perform the following logic:
          CASE1: [scene] If have hue, sat and bri, then send message to device
          CASE2: [hue/sat] else if I have only hue and sat, and idle for 100ms (bri missing), send message with last known bri
          CASE3: [bri] else if I have bri, and 100ms has passed from last msg, then send msg
          CASE4: [on/off] else if I have on/off, and 100ms has passed from last msg, then send msg
          CASE5: [colorTemp]
          CASEx: [error] else if I have only hue XOR sat, and 100ms has passed from last msg, then reset

          After performing cases 1,2,3 update the target on state, if any.
          -- Note: if in the future user reports issues, this is the likely cultript
    */

import { ILightState } from './magichome-interface/types';

export interface ILightStateMachine {
    nextState: 'setColor' | 'setColorTemperature' | 'toggleState' | 'unchanged' | 'setBrightness' | 'keepState';
    message?: string;
}

/*  determine payload to be sent out */
export class LightStateMachine{

  static nextState(lightState: ILightState):ILightStateMachine{
    const { targetOnState, targetBrightness, targetColorTemperature, targetHSL } = lightState.targetState;
    const { hue, saturation } = targetHSL; 

    let message;
    // check for simple off->on
    if( targetOnState === true && hue === null && saturation === null && targetBrightness === null && targetColorTemperature === null ){
      message = `toggle: on=${targetOnState}`;
      return { nextState: 'toggleState', message};
    }
    
    // check for simple on->off
    if ( targetOnState === false && hue === null && saturation === null && targetBrightness === null && targetColorTemperature === null ){
      message = `toggle: on=${targetOnState}`;
      return { nextState: 'toggleState', message};
    }

    if(lightState.isOn===false && !targetOnState){
      message = `[BUG] Device is Off. Skip change, but keep state. hue:${hue} sat:${saturation} bri:${targetBrightness};`;
      return { nextState: 'keepState', message};
    }
    
    message = 'setColor.';
    if(hue!==null){
      lightState.HSL.hue = hue;
      message += ` hue=${hue}`;
    }

    if(saturation!==null){
      lightState.HSL.saturation = saturation;
      message += ` sat=${saturation}`;
    }

    if(targetBrightness!==null){
      lightState.brightness = targetBrightness;
      message += ` bri=${targetBrightness}`;
    }

    return { nextState: 'setColor', message};
  }
}