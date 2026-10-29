// Authored stage choreography for the four-seat studio desk. Paths leave a chair
// through the gap beside it, use a walking lane behind the chairs and return
// the same way. Metres are in the actor's seat frame: +z towards the desk,
// +x the actor's left. Yaw 0 faces the desk; positive yaw turns towards +x.
export const SEAT_SPACING=1.05,GAP_X=.53,FRONT_Z=-.02,STAND_Z=-.25,LANE_Z=-.9,STAGE_EDGE=4.3,STRIDE_M=1.0;
export const STAGE_KINDS=Object.freeze({
  'movement.walk':'walk','movement.pace':'pace','movement.approach-person':'approach','movement.change-seat':'change-seat',
  'movement.enter':'enter','movement.exit':'exit','debate.walk-out':'walk-out','drama.storm-off':'storm-off','drama.return-sheepishly':'return',
  'social.handshake':'meet','social.high-five':'meet','props.hand-over-note':'meet','celebration.group-dance':'dance',
  'drama.pretend-faint':'faint','drama.staged-stumble':'stumble',
});
// Actions whose counterpart performs a mirrored part of the same choreography.
export const PARTNER_ACTIONS=Object.freeze(['social.handshake','social.high-five','props.hand-over-note']);
export const DEFAULT_PARTNER_DX=SEAT_SPACING*2;
const smooth=t=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

function builder(){
  const keys=[{t:0,x:0,z:0,yaw:0,stand:0,walk:0}],marks={},last=()=>keys.at(-1);
  const api={keys,marks,
    wait(ms,state={}){const p=last();keys.push({...p,walk:0,...state,t:p.t+Math.max(0,ms)});return api;},
    start(state){Object.assign(keys[0],state);return api;},
    rise(ms=1100){return api.wait(ms,{stand:1,z:STAND_Z});},
    sit(ms=1250){return api.wait(ms,{stand:0,z:0});},
    face(yaw,ms){const p=last(),turn=Math.abs(wrap(yaw-p.yaw));if(turn<.02)return api;return api.wait(ms??(170+turn*230),{yaw:p.yaw+wrap(yaw-p.yaw)});},
    // Walk forwards, turning first; `sidestep` keeps the current facing.
    walk(x,z,speed=1.15,{sidestep=false}={}){const p=last(),d=Math.hypot(x-p.x,z-p.z);if(d<.01)return api;if(!sidestep)api.face(Math.atan2(x-p.x,z-p.z));return api.wait(d/speed*1000,{x,z,walk:speed});},
    mark(name){marks[name]=last().t;return api;},
    get end(){return last();},
  };
  return api;
}
// Rise and leave through the gap on side `s` into the lane.
const leave=(b,s,{speed=1.15,riseMs}={})=>b.rise(riseMs).walk(0,FRONT_Z,.8,{sidestep:true}).walk(s*GAP_X,FRONT_Z,speed).walk(s*GAP_X,LANE_Z,speed);
// Return from the lane through gap `s` into a chair at `x`, then sit.
const arrive=(b,s,x=0,{speed=1.15,sitMs}={})=>b.walk(x+s*GAP_X,LANE_Z,speed).walk(x+s*GAP_X,FRONT_Z,speed).walk(x,FRONT_Z,speed).face(0).walk(x,STAND_Z,.6,{sidestep:true}).sit(sitMs);
const towards=x=>x>=0?1:-1,outwards=worldX=>worldX>=0?1:-1;

function meetLeg(b,dx,kind){
  const s=towards(dx),near=Math.abs(dx)<1.3;
  if(kind==='props.hand-over-note')b.wait(950).mark('picked');
  if(near){b.rise().walk(s*.14,STAND_Z,.6,{sidestep:true}).face(s*Math.PI/2*.82);}
  else{leave(b,s);b.walk(dx/2-s*.36,LANE_Z).face(s*Math.PI/2);}
  return near;
}
function meetPlan(kind,dx){
  const arrival=d=>{const b=builder();meetLeg(b,d,kind);return b.end.t;};
  // Partners arrive together: the quicker route waits seated before rising.
  const mine=arrival(dx),theirs=arrival(-dx),b=builder();b.wait(Math.max(0,theirs-mine));
  const near=meetLeg(b,dx,kind),s=towards(dx),hold=kind==='social.high-five'?1700:kind==='props.hand-over-note'?2500:2600;
  b.mark('meet').wait(hold).mark('part');
  if(near)b.face(0).walk(0,STAND_Z,.6,{sidestep:true}).sit();else arrive(b,s);
  if(kind==='props.hand-over-note')b.wait(700).mark('placed');
  return {...finish(b),meet:{x:dx/2,z:near?STAND_Z+.08:LANE_Z,near}};
}
function finish(b,minimum=0){const end=b.end.t;return {keys:b.keys,marks:b.marks,durationMs:Math.max(minimum,end)};}

// Builds the timed route for one stage action. Pure and deterministic so every
// renderer and test samples the same choreography.
export function stagePlan(actionId,context={}){
  const plan=build(actionId,context);if(!plan||!context.swap&&!PARTNER_ACTIONS.includes(actionId))return plan;
  // Partners sample one shared cue clock, so both timelines share a length.
  const other=build(actionId,{...context,dx:-(context.dx??DEFAULT_PARTNER_DX),role:context.role==='partner'?'lead':'partner'});
  return {...plan,durationMs:Math.max(plan.durationMs,other.durationMs)};
}
function build(actionId,{dx=DEFAULT_PARTNER_DX,role='lead',worldX=0,swap=false}={}){
  const kind=STAGE_KINDS[actionId];if(!kind)return null;
  const s=outwards(worldX),centre=-s,b=builder(),offstage=s*STAGE_EDGE-worldX;
  switch(kind){
    case 'walk':leave(b,centre);b.walk(centre*(GAP_X+1.15),LANE_Z).wait(350).walk(centre*GAP_X,LANE_Z);arrive(b,centre);break;
    case 'pace':leave(b,centre).mark('pacing');for(let n=0;n<2;n++)b.walk(centre*(GAP_X+1.0),LANE_Z,.75).wait(250).walk(centre*GAP_X,LANE_Z,.75).wait(250);b.mark('paced');arrive(b,centre);break;
    case 'approach':{const t=towards(dx),side=dx-t*GAP_X;leave(b,t);b.walk(side,LANE_Z).walk(side,FRONT_Z-.06).face(t*Math.PI/2).mark('talk').wait(2600).mark('done');b.walk(side,LANE_Z);arrive(b,t);break;}
    case 'change-seat':{const t=towards(dx);
      if(swap&&role==='lead'){b.wait(3600).rise().walk(0,FRONT_Z,.8,{sidestep:true}).walk(dx,FRONT_Z).face(0).walk(dx,STAND_Z,.6,{sidestep:true}).sit();}
      // The partner of a swap circles behind through the far gaps.
      else if(swap){leave(b,-t);arrive(b,t,dx);}
      else{leave(b,t);arrive(b,-t,dx);}
      b.mark('seated');break;}
    case 'enter':b.start({x:offstage,z:LANE_Z,stand:1,yaw:-s*Math.PI/2});arrive(b,s);break;
    case 'return':b.start({x:offstage,z:LANE_Z,stand:1,yaw:-s*Math.PI/2});b.wait(300);arrive(b,s,0,{speed:.55,sitMs:1500});break;
    case 'exit':leave(b,s);b.walk(offstage,LANE_Z).mark('gone').wait(600);break;
    case 'walk-out':leave(b,s,{riseMs:800});b.walk(s*(GAP_X+.9),LANE_Z,1.05).face(0,420).mark('glance').wait(650).walk(offstage,LANE_Z,1.1).mark('gone').wait(500);break;
    case 'storm-off':leave(b,s,{speed:1.45,riseMs:650});b.walk(offstage,LANE_Z,1.6).mark('gone').wait(500);break;
    case 'meet':return meetPlan(actionId,dx);
    case 'dance':b.rise(1000).mark('dance').wait(5600).mark('danced').sit(1300);break;
    case 'faint':b.rise(1000).mark('swoon').wait(1500).mark('fall').sit(520).mark('fainted').wait(2300).mark('recover').wait(1300);break;
    case 'stumble':b.rise().walk(0,FRONT_Z,.8,{sidestep:true}).walk(s*.18,FRONT_Z,.9).mark('trip').walk(s*.48,FRONT_Z+.03,1.6,{sidestep:true}).mark('caught').wait(900).mark('steady').walk(0,FRONT_Z,.8).face(0).walk(0,STAND_Z,.6,{sidestep:true}).sit();break;
  }
  return finish(b);
}

// Samples a plan at cue progress 0..1, stretching the authored timing to the cue.
export function stageSample(plan,progress){
  const t=Math.max(0,Math.min(1,progress))*plan.durationMs,keys=plan.keys;
  let i=0;while(i<keys.length-2&&keys[i+1].t<=t)i++;
  const a=keys[i],b=keys[Math.min(keys.length-1,i+1)],span=b.t-a.t,u=span>0?Math.max(0,Math.min(1,(t-a.t)/span)):1,e=smooth(u);
  let distance=0;for(let n=1;n<=i;n++)distance+=Math.hypot(keys[n].x-keys[n-1].x,keys[n].z-keys[n-1].z);
  const moving=b.walk>0&&span>0,segment=Math.hypot(b.x-a.x,b.z-a.z);distance+=segment*e;
  return {x:a.x+(b.x-a.x)*e,z:a.z+(b.z-a.z)*e,yaw:a.yaw+wrap(b.yaw-a.yaw)*e,stand:a.stand+(b.stand-a.stand)*e,
    // Fixed-time gait fades avoid snapping the whole rig into a walk during
    // the short sidestep between the chair and the gap.
    walk:moving?smooth(u*span/350)*smooth((1-u)*span/350):0,stride:distance/STRIDE_M,timeMs:t};
}
// Time-window weight between two plan marks, with soft edges in milliseconds.
export function markWindow(plan,progress,from,to,easeMs=350){
  const t=progress*plan.durationMs,a=plan.marks[from],b=plan.marks[to];if(a===undefined||b===undefined)return 0;
  return smooth((t-a+easeMs*.5)/easeMs)*smooth((b+easeMs*.5-t)/easeMs);
}
