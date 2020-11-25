import { ILightState } from './magichome-interface/types';

export interface ILightStateMachine {
    nextState: 'setColor' | 'setColorTemperature' | 'toggleState' | 'unchanged' | 'setBrightness' | 'keepState';
    message?: string;
}

/*  determine payload to be sent out */
export class LightStateMachine{

  static nextState(lightState: ILightState, lightLastState: ILightState):ILightStateMachine {
    // lightState: has lastest and greatest user desired state, already reported to user
    // lightLastState: has the last message we wrote to the lightbulb
    // This functions outputs the next action based on the difference of those two states above

    const { isOn: targetOnState, brightness:targetBrightness, colorTemperature: targetColorTemperature, HSL: targetHSL } = lightState;
    const { hue:targetHue, saturation:targetSaturation } = targetHSL; 

    const { isOn: currentOnState, brightness: currentBrightness, colorTemperature: currentColorTemperature, HSL: currentHSL } = lightLastState;
    const { hue:currentHue, saturation:currentSaturation } = currentHSL; 

    let message = `on=${currentOnState}>${targetOnState} hue=${currentHue}>${targetHue} sat:${currentSaturation}>${targetSaturation} bri:${currentBrightness}>${targetBrightness}`;

    if(currentOnState === targetOnState && 
      currentHue === targetHue && 
      currentSaturation === targetSaturation && 
      currentBrightness === targetBrightness){
      message = 'No Change Required - ' + message;
      return { nextState: 'keepState', message};
    }
    if(currentOnState === false && targetOnState === false){
      // light change while off, do not send to light and that would inadvertedly turn it on
      message = 'Device is OFF. No change required. '  + message;
      return { nextState: 'keepState', message};
    }

    if(currentOnState === true &&  targetOnState === false){
      // user wants lights off, disregard HSL
      message = `toggle: on=${targetOnState}`;
      return { nextState: 'toggleState', message};
    }
    // user want light on at a certain h/s/b    
    return { nextState: 'setColor', message};
  }
}