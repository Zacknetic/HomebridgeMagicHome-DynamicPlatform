import { existsSync, readFileSync } from 'fs';
import { IColorCCT, IColorRGB, IDeviceCommand, IDeviceState } from 'magichome-platform';
import { IAccessoryCommand, IAccessoryState, IColorHSV } from './types';


export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}


//=================================================
// Start checksum //



/**
 * @checksum
 * a checksum is needed at the end of the byte array otherwise the message is rejected by the device
 * add all bytes and chop off the beginning by & with 0xFF
 * @param buffer 
 * @returns checksum number
 */
export function checksum(buffer: Uint8Array) {
  let chk = 0;

  for (const byte of buffer) {
    chk += byte;
  }

  return chk & 0xff;
}

//=================================================
// Start Convert RGBtoHSL //
// export function convertRGBtoHSL(RGB: IColorRGB) {

//   const { red, green, blue } = RGB;


//   const r = red / 255;
//   const g = green / 255;
//   const b = blue / 255;

//   let h, s, l;
//   h = s = l = 0;

//   const max = Math.max(r, g, b);
//   const min = Math.min(r, g, b);
//   const C = max - min;
//   if (C == 0) {
//     h = 0;
//   } else if (max == r) {
//     h = ((g - b) / C) % 6;
//   } else if (max == g) {
//     h = (b - r) / C + 2;
//   } else {
//     h = (r - g) / C + 4;
//   }
//   h *= 60;
//   if (h < 0) {
//     h += 360;
//   }
//   l = max;
//   if (l == 0) {
//     s = 0;
//   } else {
//     s = C / l;
//   }
//   s *= 100;
//   l *= 100;

//   const HSL: IColorHSL = { hue: Math.floor(h), saturation: Math.floor(s), luminance: Math.floor(l) };
//   return HSL;
// }

//=================================================
// End Convert RGBtoHSL //


//=================================================
// Start Convert HSLtoRGB //
// export function convertHSLtoRGB(HSL: IColorHSL) {

//   const { hue, saturation, luminance } = HSL;

//   const h = hue;
//   const s = saturation / 100.0;
//   const l = luminance / 100.0;

//   const C = l * s;
//   const hh = h / 60.0;
//   const X = C * (1.0 - Math.abs((hh % 2) - 1.0));

//   let r, g, b;
//   r = g = b = 0;

//   if (hh >= 0 && hh < 1) {
//     r = C;
//     g = X;
//   } else if (hh >= 1 && hh < 2) {
//     r = X;
//     g = C;
//   } else if (hh >= 2 && hh < 3) {
//     g = C;
//     b = X;
//   } else if (hh >= 3 && hh < 4) {
//     g = X;
//     b = C;
//   } else if (hh >= 4 && hh < 5) {
//     r = X;
//     b = C;
//   } else {
//     r = C;
//     b = X;
//   }

//   const m = l - C;
//   r += m;
//   g += m;
//   b += m;
//   r *= 255.0;
//   g *= 255.0;
//   b *= 255.0;
//   r = Math.floor(r);
//   g = Math.floor(g);
//   b = Math.floor(b);

//   let RGB = Object.assign({}, { red: r, green: g, blue: b });
//   return RGB;
// }
//=================================================
// End Convert HSLtoRGB //

export function parseJson<T>(value: string, replacement: T): T {
  try {
    return <T>JSON.parse(value);
  } catch (_error) {
    return replacement;
  }
}

export function loadJson<T>(file: string, replacement: T): T {
  if (!existsSync(file)) {
    return replacement;
  }
  return parseJson<T>(readFileSync(file).toString(), replacement);
}

/**
 ** @calculateWhiteColor
 *  determine warmWhite/coldWhite values from hue
 *  the closer to 0/360 the weaker coldWhite brightness becomes
 *  the closer to 180 the weaker warmWhite brightness becomes
 *  the closer to 90/270 the stronger both warmWhite and coldWhite become simultaniously
 */
export function convertHueToColorCCT(hue: number): IColorCCT {
  let multiplier = 0;
  let warmWhite = 0, coldWhite = 0;


  if (hue <= 90) {        //if hue is <= 90, warmWhite value is full and we determine the coldWhite value based on Hue
    multiplier = ((hue / 90));
    coldWhite = Math.round((127 * multiplier));
    warmWhite = 255 - coldWhite;
  } else if (hue > 270) { //if hue is >270, warmWhite value is full and we determine the coldWhite value based on Hue
    multiplier = (1 - (hue - 270) / 90);
    coldWhite = Math.round((127 * multiplier));
    warmWhite = 255 - coldWhite;
  } else if (hue > 180 && hue <= 270) { //if hue is > 180 and <= 270, coldWhite value is full and we determine the warmWhite value based on Hue
    multiplier = ((hue - 180) / 90);
    warmWhite = Math.round((127 * multiplier));
    coldWhite = 255 - warmWhite;

  } else if (hue > 90 && hue <= 180) {//if hue is > 90 and <= 180, coldWhite value is full and we determine the warmWhite value based on Hue
    multiplier = (1 - (hue - 90) / 90);
    warmWhite = Math.round((127 * multiplier));
    coldWhite = 255 - warmWhite;
  }

  return { warmWhite, coldWhite };
} //hueToWhiteTemperature

/*
HSV to RGB conversion formula
When 0 ≤ H < 360, 0 ≤ S ≤ 1 and 0 ≤ V ≤ 1:
C = V × S
X = C × (1 - |(H / 60°) mod 2 - 1|)
m = V - C
(R,G,B) = ((R'+m)×255, (G'+m)×255, (B'+m)×255)
*/

export function HSVtoRGB(HSV: IColorHSV): IColorRGB {
  const { hue, saturation, value }: IColorHSV = HSV;
  let [H, S, V] = [hue, saturation, value];
  H = clamp(H, 0, 359)
  S = clamp(S, 0, 100)
  V = clamp(V, 0, 100)

  // console.log("-- SENDING -- H: ", H, "S: ", S, "V: ", V)
  S /= 100.0
  V /= 100.0
  const C = V * S;
  const X = C * (1 - Math.abs(((H / 60) % 2) - 1));
  const m = V - C;

  let order;
  if (H < 60) order = [C, X, 0];
  else if (H < 120) order = [X, C, 0];
  else if (H < 180) order = [0, C, X];
  else if (H < 240) order = [0, X, C];
  else if (H < 300) order = [X, 0, C];
  else if (H < 360) order = [C, 0, X];

  const [dR, dG, dB] = order;
  const [red, green, blue] = [Math.round((dR + m) * 255), Math.round((dG + m) * 255), Math.round((dB + m) * 255)]

  // console.log(`--SENDING-- RED: ${red} GREEN: ${green} BLUE: ${blue}`)
  return { red, green, blue };
}

export function RGBtoHSV(RGB: IColorRGB): IColorHSV {

  const { red, green, blue }: IColorRGB = RGB;

  // console.log(`--RECEIVING-- RED: ${red} GREEN: ${green} BLUE: ${blue}`)

  const [R, G, B] = [red, green, blue];
  const [dR, dG, dB] = [R / 255, G / 255, B / 255];

  const Dmax = Math.max(dR, dG, dB);
  const Dmin = Math.min(dR, dG, dB);
  const D = Dmax - Dmin;

  let H, S, V;
  if (D === 0) H = 0;
  else if (Dmax === dR) H = ((dG - dB) / D) % 6;
  else if (Dmax === dG) H = ((dB - dR) / D) + 2;
  else H = ((dR - dG) / D) + 4
  H *= 60;
  if (H < 0) H += 360;
  V = Dmax;
  if (V === 0) S = 0;
  else S = D / V;

  
  S *= 100;
  V *= 100;
  // console.log("-- RECEIVED -- H: ", H, "S: ", S, "V: ", V)

  return { hue: H, saturation: S, value: V };
}

export function cctToWhiteTemperature(CCT: number, multiplier = 0): { warmWhite: number, coldWhite: number } {
  CCT -= 140;
  let warmWhite, coldWhite;

  const threshold = 110;
  if (CCT >= threshold) {
    warmWhite = 127;
    multiplier = (1 - ((CCT - threshold) / (360 - threshold)));
    coldWhite = Math.round((127 * multiplier));
  } else {
    coldWhite = 127;
    multiplier = (CCT / threshold);
    warmWhite = Math.round((127 * multiplier));
  }

  return { warmWhite, coldWhite };
}

export function whiteTemperatureToCCT(whiteTemperature: IColorCCT) {
  const { coldWhite } = whiteTemperature;
  const CCT = (coldWhite * 1.41) + 140;

  return CCT;
}

/*
export function delayToSpeed(delay: never) {
  let clamped = clamp(delay, 1, 31);
  clamped -= 1; // bring into interval [0, 30]
  return 100 - (clamped / 30) * 100;
}

export function speedToDelay(speed: never) {
  const clamped = clamp(speed, 0, 100);
  return 30 - (clamped / 100) * 30 + 1;
}
*/
// export function convertMiredColorTemperatureToHueSat(temperature: number): [number, number] {
//   const xy = convertMiredColorTemperatureToXY(500 - temperature);
//   return convertXyToHueSat(xy[0], xy[1]);
// }

// export function convertXyToHueSat(x: number, y: number): [number, number] {
//   // Based on: https://developers.meethue.com/develop/application-design-guidance/color-conversion-formulas-rgb-to-xy-and-back/
//   const z: number = 1.0 - x - y;
//   const Y = 1.0;
//   const X: number = (Y / y) * x;
//   const Z: number = (Y / y) * z;

//   // sRGB D65 conversion
//   let r: number = (X * 1.656492) - (Y * 0.354851) - (Z * 0.255038);
//   let g: number = (-X * 0.707196) + (Y * 1.655397) + (Z * 0.036152);
//   let b: number = (X * 0.051713) - (Y * 0.121364) + (Z * 1.011530);

//   // Remove negative values
//   const m = Math.min(r, g, b);
//   if (m < 0.0) {
//     r -= m;
//     g -= m;
//     b -= m;
//   }

//   // Normalize
//   if (r > b && r > g && r > 1.0) {
//     // red is too big
//     g = g / r;
//     b = b / r;
//     r = 1.0;
//   } else if (g > b && g > r && g > 1.0) {
//     // green is too big
//     r = r / g;
//     b = b / g;
//     g = 1.0;
//   } else if (b > r && b > g && b > 1.0) {
//     // blue is too big
//     r = r / b;
//     g = g / b;
//     b = 1.0;
//   }

//   // Gamma correction
//   r = reverseGammaCorrection(r);
//   g = reverseGammaCorrection(g);
//   b = reverseGammaCorrection(b);

//   // Maximize
//   const max = Math.max(r, g, b);
//   r = (r === max) ? 255 : (255 * (r / max));
//   g = (g === max) ? 255 : (255 * (g / max));
//   b = (b === max) ? 255 : (255 * (b / max));

//   const RGB: IColorRGB = { red: r, green: g, blue: b };
//   const HSL = convertRGBtoHSL(RGB);

//   const hsv = [HSL.hue, HSL.saturation];

//   return [hsv[0], hsv[1]];
// }

function convertMiredColorTemperatureToXY(temperature: number): [number, number] {
  // Based on MiredColorTemperatureToXY from:
  // https://github.com/dresden-elektronik/deconz-rest-plugin/blob/78939ac4ee4b0646fbf542a0f6e83ee995f1a875/colorspace.cpp
  const TEMPERATURE_TO_X_TEMPERATURE_THRESHOLD = 4000;

  const TEMPERATURE_TO_Y_FIRST_TEMPERATURE_THRESHOLD = 2222;
  const TEMPERATURE_TO_Y_SECOND_TEMPERATURE_THRESHOLD = 4000;

  const TEMPERATURE_TO_X_FIRST_FACTOR_FIRST_EQUATION = 17440695910400;
  const TEMPERATURE_TO_X_SECOND_FACTOR_FIRST_EQUATION = 15358885888;
  const TEMPERATURE_TO_X_THIRD_FACTOR_FIRST_EQUATION = 57520658;
  const TEMPERATURE_TO_X_FOURTH_FACTOR_FIRST_EQUATION = 11790;

  const TEMPERATURE_TO_X_FIRST_FACTOR_SECOND_EQUATION = 198301902438400;
  const TEMPERATURE_TO_X_SECOND_FACTOR_SECOND_EQUATION = 138086835814;
  const TEMPERATURE_TO_X_THIRD_FACTOR_SECOND_EQUATION = 14590587;
  const TEMPERATURE_TO_X_FOURTH_FACTOR_SECOND_EQUATION = 15754;

  const TEMPERATURE_TO_Y_FIRST_FACTOR_FIRST_EQUATION = 18126;
  const TEMPERATURE_TO_Y_SECOND_FACTOR_FIRST_EQUATION = 22087;
  const TEMPERATURE_TO_Y_THIRD_FACTOR_FIRST_EQUATION = 35808;
  const TEMPERATURE_TO_Y_FOURTH_FACTOR_FIRST_EQUATION = 3312;

  const TEMPERATURE_TO_Y_FIRST_FACTOR_SECOND_EQUATION = 15645;
  const TEMPERATURE_TO_Y_SECOND_FACTOR_SECOND_EQUATION = 22514;
  const TEMPERATURE_TO_Y_THIRD_FACTOR_SECOND_EQUATION = 34265;
  const TEMPERATURE_TO_Y_FOURTH_FACTOR_SECOND_EQUATION = 2744;

  const TEMPERATURE_TO_Y_FIRST_FACTOR_THIRD_EQUATION = 50491;
  const TEMPERATURE_TO_Y_SECOND_FACTOR_THIRD_EQUATION = 96229;
  const TEMPERATURE_TO_Y_THIRD_FACTOR_THIRD_EQUATION = 61458;
  const TEMPERATURE_TO_Y_FOURTH_FACTOR_THIRD_EQUATION = 6062;

  let localX = 0;
  let localY = 0;
  const temp = 1000000 / temperature;

  if (TEMPERATURE_TO_X_TEMPERATURE_THRESHOLD > temp) {
    localX = TEMPERATURE_TO_X_THIRD_FACTOR_FIRST_EQUATION / temp +
      TEMPERATURE_TO_X_FOURTH_FACTOR_FIRST_EQUATION -
      TEMPERATURE_TO_X_SECOND_FACTOR_FIRST_EQUATION / temp / temp -
      TEMPERATURE_TO_X_FIRST_FACTOR_FIRST_EQUATION / temp / temp / temp;
  } else {
    localX = TEMPERATURE_TO_X_SECOND_FACTOR_SECOND_EQUATION / temp / temp +
      TEMPERATURE_TO_X_THIRD_FACTOR_SECOND_EQUATION / temp +
      TEMPERATURE_TO_X_FOURTH_FACTOR_SECOND_EQUATION -
      TEMPERATURE_TO_X_FIRST_FACTOR_SECOND_EQUATION / temp / temp / temp;
  }

  if (TEMPERATURE_TO_Y_FIRST_TEMPERATURE_THRESHOLD > temp) {
    localY = TEMPERATURE_TO_Y_THIRD_FACTOR_FIRST_EQUATION * localX / 65536 -
      TEMPERATURE_TO_Y_FIRST_FACTOR_FIRST_EQUATION * localX * localX * localX / 281474976710656 -
      TEMPERATURE_TO_Y_SECOND_FACTOR_FIRST_EQUATION * localX * localX / 4294967296 -
      TEMPERATURE_TO_Y_FOURTH_FACTOR_FIRST_EQUATION;
  } else if (TEMPERATURE_TO_Y_SECOND_TEMPERATURE_THRESHOLD > temp) {
    localY = TEMPERATURE_TO_Y_THIRD_FACTOR_SECOND_EQUATION * localX / 65536 -
      TEMPERATURE_TO_Y_FIRST_FACTOR_SECOND_EQUATION * localX * localX * localX / 281474976710656 -
      TEMPERATURE_TO_Y_SECOND_FACTOR_SECOND_EQUATION * localX * localX / 4294967296 -
      TEMPERATURE_TO_Y_FOURTH_FACTOR_SECOND_EQUATION;
  } else {
    localY = TEMPERATURE_TO_Y_THIRD_FACTOR_THIRD_EQUATION * localX / 65536 +
      TEMPERATURE_TO_Y_FIRST_FACTOR_THIRD_EQUATION * localX * localX * localX / 281474976710656 -
      TEMPERATURE_TO_Y_SECOND_FACTOR_THIRD_EQUATION * localX * localX / 4294967296 -
      TEMPERATURE_TO_Y_FOURTH_FACTOR_THIRD_EQUATION;
  }

  localY *= 4;

  localX /= 0xFFFF;
  localY /= 0xFFFF;

  return [Math.round(localX * 10000) / 10000, Math.round(localY * 10000) / 10000];
}

function reverseGammaCorrection(v: number): number {
  return (v <= 0.0031308) ? 12.92 * v : (1.0 + 0.055) * Math.pow(v, (1.0 / 2.4)) - 0.055;
}