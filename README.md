
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

## Configuration

### example '.json'
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

* `pruneMissingCachedAccessories` - **true** / **false** "Prune" or remove accessories once they have been missing for n restarts.

* `restartsBeforeMissingAccessoriesPruned` - ***number*** The number of homebridge restarts that an accessory can be not seen before being pruned. Will not occur if 'pruneMissingCachedAccessories' is set to false.

#### White Effects

* `simultaniousDevicesColorWhite` - **true** / **false** Allow simultanious color and white LEDs on compatible devices.

* `colorWhiteThreshold` - ***number*** The saturation threshold from color-only to white-only for non-simultanious devices.

* `colorWhiteThresholdSimultaniousDevices` - ***number*** The saturation threshold from color-only to color and white for simulanious devices.

* `colorOffThresholdSimultaniousDevices` - ***number*** The saturation threshold from color and white to white only for simultanious devices.
