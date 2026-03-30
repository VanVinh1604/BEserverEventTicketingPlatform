const base='http://localhost:8000'; 
async function run(){ 
  const ev=await fetch(base+'/api/events'); 
  const evj=await ev.json(); 
  const events=Array.isArray(evj.data)?evj.data:(Array.isArray(evj)?evj:[]); 
  if(!events.length){console.log('no events');return;} 
  const eventId=events[0]._id; 
  const r=await fetch(base+'/api/ticket-types/event/'+eventId); 
  const j=await r.json(); 
  const arr=Array.isArray(j.data)?j.data:(Array.isArray(j)?j:[]); 
  console.log('count',arr.length); 
  arr.slice(0,5).forEach(function(t,i){ console.log(i, t._id, t.name, 'desc=',t.description, 'details=',t.details, 'keys=',Object.keys(t)); }); 
} 
run().catch(function(e){console.error('ERR',e.message);process.exit(1);});
