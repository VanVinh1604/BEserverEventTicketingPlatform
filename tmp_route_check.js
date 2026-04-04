const app=require('./src/app'); 
const request=require('supertest'); 
request(app).get('/api/auth/google').then(function(r){console.log(r.status);console.log(String(r.text).slice(0,160));}).catch(function(e){console.error(e);process.exit(1);}); 
