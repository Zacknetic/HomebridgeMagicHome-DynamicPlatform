/* eslint-disable */
const prompt = require('prompt-sync')({sigint: true});
const fetch = require('node-fetch');

const TEST_DEVICE_NAME = "500291236D10";
const SERVER = "http://localhost:51826";

;(async () => {

  let device = await getAccessories()
  if(!device){
    console.log(`Test device ${TEST_DEVICE_NAME} not found.`)
    return null
  }

  let foundCorrectNumber = false
  while (!foundCorrectNumber) {
    // Get user input
    let userInput = prompt('Enter the iid ( quit="q" rescan="r" ): ');
    if(userInput.indexOf('.') > -1 ){
      console.log('Special Command');
      let [iid, value ] = userInput.split('.')
      if(value === 'true'){ value =true}
      else if(value ==='false'){ value= false}
      else { value = Number(value)}

      const payload = { characteristics:[{ aid:device.aid,iid:Number(iid), value:value}]}
      console.log('Sending command');
      await sendCommand(payload)

      continue;
    }
    if(userInput === 'q' || userInput === 'r'){
    } else {
      // Convert the string input to a number
      userInput = Number(userInput);
    }

    // Compare the guess to the secret answer and let the user know.
    if(userInput === 'q'){
      console.log('Exiting');
      foundCorrectNumber = true
    } else if(userInput === 'r'){
      console.log('Updating accessory list');
      device = await getAccessories()
    } else {
      const payload = { characteristics:[{ aid:device.aid,iid:userInput, value:true}]}
      console.log('Sending command');
      await sendCommand(payload)
    }
  }
  console.log('Exiting!!!')

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

function findDevice(deviceSerialNumber, accessories){
  let device = { found: false, aid: -1, s_iid:-1, c_iid: -1}
  // Search Test Accessory
  for (let accessory of accessories){
    const { aid, services } = accessory
    for (let service of services){
      const {iid:s_iid, type, characteristics} = service
      for (let char of characteristics){
        const { value, description, iid: c_iid } = char
        if( description === "Serial Number"){
          if(value === deviceSerialNumber){
            console.log(`Found desired test device "${deviceSerialNumber}" aid:${aid} service:${s_iid} characteristic:${c_iid}`)
            device = { found: true, aid, s_iid, c_iid}
          } else {
            console.log(`Device in network: "${value}" aid:${aid} service:${s_iid} characteristic:${c_iid}`)
          }
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
 
