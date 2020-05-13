module.exports = (homebridge) => {
  homebridge.registerPlatform(
    'LED Light',
    'homebridge-gordalina-magic-home',
    require('./src/Platform')(homebridge),
  );
}
