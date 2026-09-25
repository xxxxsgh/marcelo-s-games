(async()=>{const g=__game; const tick=()=>new Promise(r=>setTimeout(r,50)); for(let i=0;i<8;i++){ g.advance(0.8); if(g.ui.cur) g.ui.close(); await tick(); } g.advance(1); })()
