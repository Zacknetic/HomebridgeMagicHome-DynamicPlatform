
<p align="center">

<img src="https://github.com/Lethegrin/HomebridgeMagicHome-DynamicPlatform/blob/master/branding/logos/zackneticlogo.svg" width="150">

</p>


# Homebridge MagicHome Dynamic Platform

## About

A Homebridge plugin for a range of Magic Home Wi-Fi lights and LED controllers.

## Installation

First, install the plugin globally.

````
npm install -g homebridge-magichome-dynamic-platform
````

## Use

* This plugin automatically detects MagicHome bulbs and controllers just like the Magichome app, and it should do so when you first run Homebridge. No more setting individual IP addresses per device.

* If a device has changed it's IP Address, such as after a power outage, this plugin will update that device with the new IP on the next restart. Maintaining the device's associated timers, scenes, etc.

* If you'd like to remove an individual device, type the word 'delete' in any part of its name in Homekit and restart homebridge. This can be useful if you are intentionally taking a device offline or if you would simply like to reset it. Keep in mind, if it is still connected during the homebridge restart, it will be detected and added again.

## Configuration

Please setup your config in Config UI X under ```Plugins>Homebridge MagicHome Dynamic Platform>Settings.``` 
However the default settings should suffice. Please read below to learn more about the settings before changing anything.

### example 'config.json'
```json
{
    "bridge": {
        "name": "Example Config",
        "username": "1A:2B:3C:4B:5D:6E",
        "port": 51398,
        "pin": "123-45-678"
    },
    "platforms": [
        {
            "platform": "homebridge-magichome-dynamic-platform",
            "settings": {
                "pruning": {
                    "pruneMissingCachedAccessories": false,         
                    "restartsBeforeMissingAccessoriesPruned": 3,   
                    "pruneAllAccessoriesNextRestart": false, 
                },
                "whiteEffects": {
                    "simultaniousDevicesColorWhite": true,          
                    "colorWhiteThreshold": 10,                      
                    "colorWhiteThresholdSimultaniousDevices": 50,   
                    "colorOffThresholdSimultaniousDevices": 5,
                },
            },
        }
    ]
}
```
### Settings

#### Pruning

* `pruneMissingCachedAccessories` - **true** / **false** "Prune" or remove accessories once they have been missing for n restarts. Associated names, timers, and scenes will be lost for those accessories.

* `restartsBeforeMissingAccessoriesPruned` - ***number*** The number of homebridge restarts that an accessory can be not seen before being pruned. Will not occur if `pruneMissingCachedAccessories` is set to false.

* `pruneAllAccessoriesNextRestart` - **true** / **false** "Prune" or remove all accessories next restart. Use this if you would like to remove all your magichome accessories next restart. Be sure to set to false after you restart otherwise the cached accessories and associated names, timers, and scenes will be lost.

#### White Effects

* `simultaniousDevicesColorWhite` - **true** / **false** Allow simultanious color and white LEDs on compatible devices.

* `colorWhiteThreshold` - ***number*** The saturation threshold from color-only to white-only for non-simultanious devices.

* `colorWhiteThresholdSimultaniousDevices` - ***number*** The saturation threshold from color-only to color and white for simulanious devices.

* `colorOffThresholdSimultaniousDevices` - ***number*** The saturation threshold from color and white to white only for simultanious devices.
