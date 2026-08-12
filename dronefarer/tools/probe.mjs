import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const PORT=4179;
const server=spawn('npx',['vite','preview','--port',String(PORT),'--host','127.0.0.1'],{stdio:'ignore'});
process.on('exit',()=>{try{server.kill('SIGKILL')}catch{}});
for(let i=0;i<60;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/`);if(r.ok)break}catch{}await wait(300);}
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:640,height:360}});
await p.goto(`http://127.0.0.1:${PORT}/?q=baixo`,{waitUntil:'load'});
await p.waitForFunction(()=>!!window.DF?.drone,null,{timeout:90000});
await p.evaluate(()=>{const T=window.DF.THREE;window.DF.restart(new T.Vector3(-13.5,-1.6,-70),Math.PI);
  window.DF.drone.state.vel.set(0,0,0);});
await wait(3500);
console.log(JSON.stringify(await p.evaluate(()=>{
  const d=window.DF.drone.state, c=window.DF.camera.position;
  return {drone:[+d.pos.x.toFixed(2),+d.pos.y.toFixed(2),+d.pos.z.toFixed(2)],
          cam:[+c.x.toFixed(2),+c.y.toFixed(2),+c.z.toFixed(2)],
          alt:+d.altitude.toFixed(2), crashed:window.DF.drone.status.crashed,
          crashes:window.DF.drone.status.crashCount,
          boom:+window.DF.rig.rig.boomDistance.toFixed(2)};
}),null,1));
await b.close(); server.kill('SIGKILL'); process.exit(0);
