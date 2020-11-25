/* eslint-disable */
const prompt = require('prompt-sync')({sigint: true});
const fetch = require('node-fetch');

const TEST_DEVICE_NAME = "500291236D10";
const iid = 9 // enter IID for On, example: [9]: On= true bool perms: pr,pw,ev (Type:43)
const SERVER = "http://localhost:51826";

;(async () => {

  let device = await getAccessories()
  if(!device.found){
    console.log(`Test device ${TEST_DEVICE_NAME} not found.`)
    return null
  }

  const value = false
  const payload = (iid, value) => ({ characteristics:[{ aid:device.aid,iid:Number(iid), value}]})
  console.log('Sending command');
  await sendCommand(payload(iid, true))
  await sleep(250)
  await sendCommand(payload(iid, false))
  await sleep(250)
  await sendCommand(payload(iid, true))


  // console.log('Put response code: ', putRes.status)
})();

async function getAccessories(){
  let json
  try{
    const res = await fetch(`${SERVER}/accessories`);
    json = await res.json()
  } catch(err){
    console.log(`Server is down: `, SERVER)
    return
  }

  const { accessories } = json
  console.log(`Found ${accessories.length} accessories`)

  const device = findDevice(TEST_DEVICE_NAME, accessories)
  if(!device.found){
    return null
  }

  listDeviceCharacteristics(accessories, device)
  return device
}

async function sendCommand(payload){
  console.log(`PUT request: `, payload)

  const putRes = await fetch(`${SERVER}/characteristics`, 
  { 
    method: 'PUT', 
    headers: { "Content-Type":"Application/json", "authorization": "031-45-154" },
    body: JSON.stringify(payload)
  })
  let jsonResponse
  try{jsonResponse = await putRes.json() } catch(err){}
  console.log(`PUT response: ${putRes.status}`, jsonResponse)
  return 
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function findDevice(deviceSerialNumber, accessories){
  let device = { found: false, aid: -1, s_iid:-1, c_iid: -1}
  // Search Test Accessory
  for (let accessory of accessories){
    const { aid, services } = accessory
    for (let service of services){
      const {iid:s_iid, type, characteristics} = service
      for (let char of characteristics){
        const { value, description, iid: c_iid } = char
        if( description === "Serial Number" && value === deviceSerialNumber){
          console.log(`Found ${deviceSerialNumber} aid:${aid} service:${s_iid} characteristic:${c_iid}`)
          device = { found: true, aid, s_iid, c_iid}
        }
      }
    }
  }
  return device
}

function listDeviceCharacteristics(accessories, device){
    // List Existing Characteristics for device
    const oneAccessory = accessories.find( e=> e.aid === device.aid)

    console.log(`Test device has ${oneAccessory.services.length} services`)
    for (let service of oneAccessory.services){
      const { type, characteristics} = service
      for (let char of characteristics){
        console.log(`\t [${char.iid}]: ${char.description}=`, char.value, `${char.format} perms: ${char.perms.join(',')} (Type:${type})`)
      }
    }
}
 
