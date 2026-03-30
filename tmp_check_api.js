const base='http://localhost:8000'; 
async function run(){ 
  const ev=await fetch(base+'/api/events'); 
  const evj=await ev.json(); 
  const events=Array.isArray(evj.data)?evj.data:(Array.isArray(evj)?evj:[]); 
  console.log('events:',events.length); 
  if(!events.length)return; 
  const eventId=events[0]._id; 
  console.log('eventId:',eventId); 
  const r1=await fetch(base+'/api/ticket-types/event/'+eventId); 
  const j1=await r1.json(); 
  const arr1=Array.isArray(j1.data)?j1.data:(Array.isArray(j1)?j1:[]); 
  console.log('ticket-types/event count:',arr1.length); 
  if(arr1[0]){ 
    console.log('first from ticket-types/event', arr1[0].name, 'desc=', arr1[0].description); 
  } 
  const r2=await fetch(base+'/api/tickets?event='+eventId); 
  const j2=await r2.json(); 
  const arr2=Array.isArray(j2.data)?j2.data:(Array.isArray(j2)?j2:[]); 
  console.log('tickets?event count:',arr2.length); 
  if(arr2[0]){ 
    console.log('first from tickets?event', arr2[0].name, 'desc=', arr2[0].description); 
  } 
} 
run().catch(function(e){console.error('ERR',e.message);process.exit(1);});
