---
name: Bug report
about: Create a report to help us solve the issue
title: "[BUG] (CHANGE ME -> eg. Powering off my raspberry pi causes devices to become unresponsive)"
labels: bug
assignees: isramos, Zacknetic

---

### Logs
1. Enable debug mode in Homebridge
1. Reproduce the issue so that it appears in the logs
1. Upload a '.txt' file of your logs to this issue. ( Logs from screenshots, in '.rtf' format, or pasted directly into the post make debugging extremely difficult. Please just upload the file. )

### Describe the bug
_A clear and concise description of what the bug is._

[e.g. While using the HomeKit app on iPhone, after setting a MagicHome light tile's brightness to 0%, the tile will not respond again to brightness or color changes until after clicking the tile on again. Other HomeKit tiles, including other MagicHome lights, will continue to respond and are otherwise unaffected.]

### To Reproduce
e.g.
Steps to reproduce the behavior:
1. In the HomeKit app, long press a MagicHome light's tile to display the brightness slider
1. Slide the brightness down to 0%
1. Attempt to increase brightness and change color
1. Observe that the light is unresponsive
1. Tap the MagicHome light's tile on>off>on
1. Observe that the light is now responsive again

### Expected behavior
_A clear and concise description of what you expected to happen._

e.g. After sliding a MagicHome tile's brightness down to 0%, sliding it back up will again increase the brightness without the need for tapping the tile off and on again.

### Additional context
_Add any other context about the problem here._

#### Host Hardware
* Hardware: [e.g. Raspberry Pi 3b+]
* OS: [e.g. HOOBS Install Image]
* OS Version: [e.g. buster]

#### Homebridge and MagicHome 
* Homebridge / HOOBS version [e.g. 1.1.6]
* Homebridge MagicHome Dynamic Platform version [e.g. 1.9.2]
* Link to the MagicHome Device on the seller's website.

#### Screenshots
_If applicable, add screenshots to help explain your problem._
