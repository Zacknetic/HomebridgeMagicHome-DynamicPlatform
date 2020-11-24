
# Design notes
Here are some notes about development and testing

### Scenes
What is ...
"Scenes are a great way to control the state of one device, or even multiple devices, all at once. After you set up a scene, you can then control it using Siri voice commands. There are four built-in scenes, but you also have the ability to create custom Scenes within HomeKit."

How to test it...
Create the following scenes:
A: hue: red, brightness: 100%, saturation: 100%, Power: on
B: hue: green, brightness: 50%, saturation: 60%, Power: on
C: hue: blue, brightness 25%, saturation: 30%, Power: on
D: Power: off
E: Power on ( this is tricky, we don't want to send any color data so make sure it simply says "on")


### Color Temperature
To be implemented

### Adaptive lighting
Upcoming feature 1Q 2021

### References
Some references that may be relevant to development

- Magic-home javascript drivers: https://www.npmjs.com/package/magic-home
- Hubitat library that uses magic-home devices
  - https://community.hubitat.com/t/release-magic-home-wifi-devices-0-89/5197
  - https://github.com/adamkempenich/hubitat/tree/master/Drivers/MagicHome
- HueLight: a plugin for Phillips Hue lamps. https://github.com/ebaauw/homebridge-hue/blob/master/lib/HueLight.js