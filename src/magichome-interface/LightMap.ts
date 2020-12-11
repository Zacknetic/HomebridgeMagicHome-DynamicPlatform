import { ILightParameters, ControllerTypes } from './types';

const lightTypesMap: Map<number, ILightParameters> = new Map([
  [
    0x04,
    {
      controllerLogicType: ControllerTypes.RGBWStrip,
      convenientName: 'RGBW Simultaneous',
      simultaneousCCT: true,
      hasColor: true,
      hasBrightness: true,
      onCommandWithColor: true,
    },
  ],
  [
    0x06,
    {
      controllerLogicType: ControllerTypes.RGBWStrip,
      convenientName: 'RGBW Simultaneous',
      simultaneousCCT: true,
      hasColor: true,
      hasBrightness: true,
      onCommandWithColor: false,
    },
  ],
  [
    0x07,
    {
      controllerLogicType: ControllerTypes.RGBWWStrip,
      convenientName: 'RGBWW Simultaneous',
      simultaneousCCT: true,
      hasColor: true,
      hasBrightness: true,
      onCommandWithColor: false,
    },
  ],
  [
    0x21,
    {
      controllerLogicType: ControllerTypes.DimmerStrip,
      convenientName: 'Dimmer',
      simultaneousCCT: false,
      hasColor: false,
      hasBrightness: true,
      onCommandWithColor: false,
    },
  ],
  [
    0x25,
    {
      controllerLogicType: ControllerTypes.RGBWWStrip,
      convenientName: 'RGBWW Simultaneous',
      simultaneousCCT: true,
      hasColor: true,
      hasBrightness: true,
      onCommandWithColor: true,
    },
  ],
  [
    0x33,
    {
      controllerLogicType: ControllerTypes.GRBStrip,
      convenientName: 'GRB Strip',
      simultaneousCCT: true,
      hasColor: true,
      hasBrightness: true,
      onCommandWithColor: false,
    },
  ],
  [
    0x35,
    {
      controllerLogicType: ControllerTypes.RGBWWBulb,
      convenientName: 'RGBWW Non-Simultaneous',
      simultaneousCCT: false,
      hasColor: true,
      hasBrightness: true,
      onCommandWithColor: false,
    },
  ],
  [
    0x41,
    {
      controllerLogicType: ControllerTypes.DimmerStrip,
      convenientName: 'Dimmer',
      simultaneousCCT: false,
      hasColor: false,
      hasBrightness: true,
      onCommandWithColor: false,
    },
  ],
  [
    0x44,
    {
      controllerLogicType: ControllerTypes.RGBWBulb,
      convenientName: 'RGBW Non-Simultaneous',
      simultaneousCCT: false,
      hasColor: true,
      hasBrightness: true,
      onCommandWithColor: false,
    },
  ],
  [
    0x52,
    {
      controllerLogicType: ControllerTypes.RGBWWBulb,
      convenientName: 'RGBWW Non-Simultaneous',
      simultaneousCCT: false,
      hasColor: true,
      hasBrightness: true,
      onCommandWithColor: false,
    },
  ],
  [
    0x65,
    {
      controllerLogicType: ControllerTypes.DimmerStrip,
      convenientName: 'Dimmer',
      simultaneousCCT: false,
      hasColor: false,
      hasBrightness: true,
      onCommandWithColor: false,
    },
  ],
  [
    0x97,
    {
      controllerLogicType: ControllerTypes.Switch,
      convenientName: 'Power Socket',
      simultaneousCCT: false,
      hasColor: false,
      hasBrightness: false,
      onCommandWithColor: false,
    },
  ],
  [
    0xa1,
    {
      controllerLogicType: ControllerTypes.RGBStrip,
      convenientName: 'RGB Strip',
      simultaneousCCT: false,
      hasColor: true,
      hasBrightness: true,
      onCommandWithColor: false,
    },
  ],
  [
    0xa2,
    {
      controllerLogicType: ControllerTypes.RGBStrip,
      convenientName: 'RGB Strip',
      simultaneousCCT: false,
      hasColor: true,
      hasBrightness: true,
      onCommandWithColor: false,
    },
  ],
]);

function getPrettyName(uniqueId:string, controllerLogicType:string | null):string{
  const uniqueIdTruc = uniqueId.slice(-6);
  let deviceType = 'LED';
  if(controllerLogicType){
    if( isType(controllerLogicType, 'bulb') ) {
      deviceType = 'Bulb';
    } else if( isType(controllerLogicType, 'strip') ){
      deviceType = 'Strip';
    }else if( isType(controllerLogicType, 'switch') ){
      deviceType = 'Switch';
    }
  }
  return `${deviceType} ${uniqueIdTruc}`;
}

function isType(a,b){
  return a.toLowerCase().indexOf(b) > -1;
}

export { lightTypesMap, getPrettyName };