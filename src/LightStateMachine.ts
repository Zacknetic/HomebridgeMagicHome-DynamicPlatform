import { ILightState } from './magichome-interface/types';

export interface ILightStateMachine {
    nextState: 'setColor' | 'setColorTemperature' | 'setPower' | 'keepState';
    message?: string;
}

/*  determine payload to be sent out */
export class LightStateMachine{

  static nextState(targetState: ILightState, currentState: ILightState):ILightStateMachine {
    // targetState: has lastest and greatest user desired state
    // currentState: what we believe the current light state is. (you can pass either last read or last write)
    // This functions outputs the next action based on the difference of those two states above

    const { isOn: targetOnState, brightness:targetBrightness, colorTemperature: targetColorTemperature, HSL: targetHSL } = targetState;
    const { hue:targetHue, saturation:targetSaturation } = targetHSL; 

    const { isOn: currentOnState, brightness: currentBrightness, colorTemperature: currentColorTemperature, HSL: currentHSL } = currentState;
    const { hue:currentHue, saturation:currentSaturation } = currentHSL; 

    let message = `on=${currentOnState}>${targetOnState} hue=${currentHue}>${targetHue} sat:${currentSaturation}>${targetSaturation} bri:${currentBrightness}>${targetBrightness}`;
    const noHueSatBriChange = currentHue === targetHue &&  currentSaturation === targetSaturation && currentBrightness === targetBrightness;
    if(currentOnState === targetOnState && noHueSatBriChange){
      message = 'Same state. No Change: ' + message;
      return { nextState: 'keepState', message};
    }
    if(currentOnState === false && targetOnState === false){
      // light change while off, do not send to light and that would inadvertedly turn it on
      message = 'Device is OFF. No change: '  + message;
      return { nextState: 'keepState', message};
    }

    if(currentOnState === false &&  targetOnState === true && noHueSatBriChange){
      // user wants lights on, no HSB
      message = `Toggle: on=${currentOnState}>${targetOnState}`;
      return { nextState: 'setPower', message};
    }
    if(currentOnState === true &&  targetOnState === false){
      // user wants lights off, disregard HSL
      message = `Toggle: on=${currentOnState}>${targetOnState}`;
      return { nextState: 'setPower', message};
    }
    // user want light on at a certain h/s/b    
    return { nextState: 'setColor', message};
  }


}