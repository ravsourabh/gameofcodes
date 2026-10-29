// Only shapes present on the shipped Rocketbox faces. Speech owns the jaw and
// lips; listener expressions must not be disabled by an empty viseme dictionary.
export function facialReactionSample(actions,{speaking=false,variant=0,energy=.5}={}){
  // Inverse smile/brow deltas provide a restrained frown on these reduced rigs.
  const result={},put=(name,value)=>{const previous=result[name]||0;if(Math.abs(value)>=Math.abs(previous))result[name]=Math.max(-.35,Math.min(1,value));};
  for(const action of actions){
    const k=action.intensity*(.85+energy*.3),p=action.progress??.5,speechScale=speaking?.35:1,left=variant%2===0,smile=value=>{put('AK_44_MouthSmileLeft',value*speechScale);put('AK_45_MouthSmileRight',value*speechScale);},
      blink=(l,r=l)=>{put('AK_09_EyeBlinkLeft',l);put('AK_10_EyeBlinkRight',r);},brows=(inner,outer)=>{put('AK_03_BrowInnerUp',inner);put('AK_04_BrowOuterUpLeft',outer);put('AK_05_BrowOuterUpRight',outer);},
      lips=(name,value)=>{if(!speaking)put(name,value);},jaw=value=>{if(!speaking)put('AK_25_JawOpen',value);},
      window=(a,b)=>{const t=x=>Math.max(0,Math.min(1,x));const s=x=>{x=t(x);return x*x*(3-2*x);};return s((p-a+.08)/.08)*s((b+.08-p)/.08);};
    switch(action.actionId){
      case 'expression.disgust':put('AK_03_BrowInnerUp',.3*k);blink(.42*k,.3*k);put(left?'AK_45_MouthSmileRight':'AK_44_MouthSmileLeft',-.25*k*speechScale);lips('AA_VI_06_CH',.25*k);break;
      case 'expression.smile':smile(.9*k);blink(.16*k);break;
      case 'comedy.chuckle':case 'comedy.laugh':case 'comedy.belly-laugh':case 'comedy.suppress-laughter':{
        const strong=['comedy.laugh','comedy.belly-laugh'].includes(action.actionId),held=action.actionId==='comedy.suppress-laughter',pulse=.45+.55*Math.sin(p*Math.PI*(strong?11:8))**2;smile((held?.45:strong?1:.85)*k);blink((held?.4:.3)*k);brows(.18*k,.1*k);if(!held)jaw((strong?.32:.14)*k*pulse);else lips('AA_VI_01_PP',.35*k);break;
      }
      case 'response.raise-eyebrow':put(left?'AK_04_BrowOuterUpLeft':'AK_05_BrowOuterUpRight',k);put('AK_03_BrowInnerUp',.15*k);break;
      case 'response.sceptical-look':put(left?'AK_04_BrowOuterUpLeft':'AK_05_BrowOuterUpRight',.85*k);put(left?'AK_45_MouthSmileRight':'AK_44_MouthSmileLeft',.25*k*speechScale);put(left?'AK_10_EyeBlinkRight':'AK_09_EyeBlinkLeft',.2*k);break;
      case 'expression.surprise':brows(.95*k,.55*k);jaw(.28*k);lips('AA_VI_13_O',.25*k);break;
      case 'expression.grin':smile(k);blink(.22*k);lips('AA_VI_11_E',.35*k);break;
      case 'expression.frown':smile(-.3*k);put('AK_04_BrowOuterUpLeft',-.25*k);put('AK_05_BrowOuterUpRight',-.25*k);put('AK_03_BrowInnerUp',.12*k);break;
      case 'expression.confusion':case 'expression.disbelief':put('AK_03_BrowInnerUp',.45*k);put(left?'AK_04_BrowOuterUpLeft':'AK_05_BrowOuterUpRight',.75*k);put(left?'AK_10_EyeBlinkRight':'AK_09_EyeBlinkLeft',.25*k);if(action.actionId==='expression.disbelief')jaw(.1*k);break;
      case 'expression.concern':put('AK_03_BrowInnerUp',.8*k);smile(-.18*k);break;
      case 'expression.embarrassment':smile(.35*k);blink(.38*k);put('AK_03_BrowInnerUp',.3*k);break;
      case 'expression.frustration':put('AK_04_BrowOuterUpLeft',-.3*k);put('AK_05_BrowOuterUpRight',-.3*k);blink(.22*k);smile(-.2*k);lips('AA_VI_07_SS',.3*k);break;
      case 'expression.jaw-drop':case 'comedy.mock-shock':brows(.95*k,.5*k);jaw(.55*k);lips('AA_VI_13_O',.3*k);break;
      case 'expression.relief':smile(.5*k);blink(.3*k);put('AK_03_BrowInnerUp',.25*k);break;
      case 'expression.eye-roll':put(left?'AK_45_MouthSmileRight':'AK_44_MouthSmileLeft',.2*k*speechScale);put('AK_03_BrowInnerUp',.2*k);break;
      case 'comedy.smirk':put(left?'AK_44_MouthSmileLeft':'AK_45_MouthSmileRight',.75*k*speechScale);put(left?'AK_05_BrowOuterUpRight':'AK_04_BrowOuterUpLeft',.35*k);break;
      case 'comedy.deadpan-stare':blink(.18*k);smile(-.1*k);break;
      // A wink closes one eye completely for its middle beat.
      case 'expression.wink':case 'comedy.wink-at-camera':case 'gesture.finger-guns':case 'gesture.call-me':case 'gesture.ok-sign':{const shut=window(action.actionId==='gesture.finger-guns'?.42:.3,action.actionId==='gesture.finger-guns'?.58:.62);put(left?'AK_09_EyeBlinkLeft':'AK_10_EyeBlinkRight',Math.max(.15*k,shut*Math.min(1,1.25*k)));put(left?'AK_10_EyeBlinkRight':'AK_09_EyeBlinkLeft',.12*k*shut);put(left?'AK_44_MouthSmileLeft':'AK_45_MouthSmileRight',.85*k*speechScale);put(left?'AK_45_MouthSmileRight':'AK_44_MouthSmileLeft',.4*k*speechScale);put(left?'AK_05_BrowOuterUpRight':'AK_04_BrowOuterUpLeft',.35*k);break;}
      case 'expression.squint':blink(.5*k);put('AK_04_BrowOuterUpLeft',-.28*k);put('AK_05_BrowOuterUpRight',-.28*k);smile(.12*k);break;
      case 'expression.pout':lips('AA_VI_14_U',.6*k);lips('AA_VI_13_O',.2*k);put('AK_03_BrowInnerUp',.45*k);smile(-.15*k);break;
      case 'expression.puppy-eyes':put('AK_03_BrowInnerUp',k);put('AK_04_BrowOuterUpLeft',-.12*k);put('AK_05_BrowOuterUpRight',-.12*k);lips('AA_VI_14_U',.3*k);break;
      case 'expression.eyebrow-flash':{const flash=Math.sin(p*Math.PI*4)**2;brows(.9*k*flash,.8*k*flash);smile(.35*k);break;}
      case 'comedy.side-eye':put(left?'AK_04_BrowOuterUpLeft':'AK_05_BrowOuterUpRight',.5*k);blink(.25*k);put(left?'AK_45_MouthSmileRight':'AK_44_MouthSmileLeft',.25*k*speechScale);break;
      case 'fatigue.yawn':blink(.65*k);jaw(.48*k);break;
      case 'fatigue.drooping-eyelids':case 'fatigue.nod-off':blink(.7*k);break;
      case 'fatigue.sleep-on-desk':blink(Math.min(action.envelope??1,1.25*k));break;
      case 'fatigue.startle-awake':brows(.95*k,.55*k);jaw(.15*k);break;
      // Gestures carry a matching face.
      case 'gesture.heart-hands':case 'gesture.hand-on-heart':case 'gesture.namaste':smile(.75*k);blink(.18*k);if(action.actionId==='gesture.hand-on-heart')put('AK_03_BrowInnerUp',.3*k);break;
      case 'gesture.thumbs-up':case 'gesture.wave':case 'gesture.peace-sign':case 'celebration.raise-the-roof':case 'social.high-five':case 'social.handshake':smile(.85*k);blink(.15*k);if(action.actionId==='gesture.wave')brows(.4*k*Math.sin(p*Math.PI*2)**2,.3*k);break;
      case 'gesture.thumbs-down':smile(-.25*k);put('AK_04_BrowOuterUpLeft',-.2*k);put('AK_05_BrowOuterUpRight',-.2*k);break;
      case 'gesture.blow-kiss':case 'gesture.chef-kiss':{const pucker=1-window(.5,1.2);lips('AA_VI_14_U',.7*k*pucker);smile(.6*k*(1-pucker));blink(action.actionId==='gesture.chef-kiss'?.7*k*pucker:.15*k);if(action.actionId==='gesture.blow-kiss')put(left?'AK_09_EyeBlinkLeft':'AK_10_EyeBlinkRight',window(.6,.8)*Math.min(1,1.25*k));break;}
      case 'gesture.shush':lips('AA_VI_14_U',.55*k);brows(.5*k,.4*k);break;
      case 'gesture.mind-blown':brows(k,.7*k);jaw(.4*k*window(.42,1.1));lips('AA_VI_13_O',.3*k);break;
      case 'gesture.air-quotes':case 'gesture.beckon':case 'gesture.rub-hands':put(left?'AK_44_MouthSmileLeft':'AK_45_MouthSmileRight',.7*k*speechScale);put(left?'AK_04_BrowOuterUpLeft':'AK_05_BrowOuterUpRight',.6*k);if(action.actionId==='gesture.rub-hands')blink(.3*k);break;
      case 'gesture.salute':smile(.2*k);put('AK_04_BrowOuterUpLeft',.15*k);put('AK_05_BrowOuterUpRight',.15*k);break;
      case 'celebration.fist-pump':case 'celebration.victory-pose':case 'celebration.cheer':case 'celebration.celebratory-jump':case 'celebration.seated-dance':case 'celebration.group-dance':smile(k);brows(.35*k,.3*k);if(action.actionId==='celebration.cheer')jaw(.35*k);break;
      case 'comedy.slow-clap':blink(.25*k);smile(-.08*k);break;
      case 'comedy.mic-drop':put(left?'AK_44_MouthSmileLeft':'AK_45_MouthSmileRight',.8*k*speechScale);put(left?'AK_05_BrowOuterUpRight':'AK_04_BrowOuterUpLeft',.45*k);break;
      case 'drama.hands-on-head':brows(.9*k,.4*k);jaw(.25*k);break;
      case 'drama.sob':put('AK_03_BrowInnerUp',k);blink(.75*k);smile(-.3*k);break;
      case 'drama.exaggerated-sigh':put('AK_03_BrowInnerUp',.45*k);blink(.35*k*window(.45,.85));jaw(.12*k*window(.45,.8));break;
      case 'drama.awkward-recovery':smile(.4*k);put('AK_03_BrowInnerUp',.35*k);blink(.2*k);break;
      case 'drama.storm-off':case 'debate.walk-out':put('AK_04_BrowOuterUpLeft',-.3*k);put('AK_05_BrowOuterUpRight',-.3*k);smile(-.3*k);break;
      case 'drama.return-sheepishly':smile(.3*k);put('AK_03_BrowInnerUp',.55*k);blink(.25*k);break;
      case 'drama.pretend-faint':blink(window(.4,.82)*Math.min(1,1.25*k));put('AK_03_BrowInnerUp',.6*k);jaw(.18*k*window(.38,.82));break;
      case 'drama.staged-stumble':brows(.85*k*window(.3,.6),.5*k*window(.3,.6));smile(.35*k*window(.6,1));break;
      case 'debate.stand-to-object':case 'debate.point-to-opponent':put('AK_04_BrowOuterUpLeft',-.2*k);put('AK_05_BrowOuterUpRight',-.2*k);put('AK_03_BrowInnerUp',.2*k);break;
      case 'debate.fold-arms':smile(-.12*k);put(left?'AK_04_BrowOuterUpLeft':'AK_05_BrowOuterUpRight',.3*k);break;
      case 'listening.thoughtful-pause':put('AK_03_BrowInnerUp',.25*k);put(left?'AK_04_BrowOuterUpLeft':'AK_05_BrowOuterUpRight',.25*k);break;
    }
  }
  return result;
}
