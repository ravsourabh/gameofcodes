// Only shapes present on the shipped Rocketbox faces. Speech owns the jaw;
// listener expressions must not be disabled by an empty viseme dictionary.
export function facialReactionSample(actions,{speaking=false,variant=0,energy=.5}={}){
  // Inverse smile/brow deltas provide a restrained frown on these reduced rigs.
  const result={},put=(name,value)=>{const previous=result[name]||0;if(Math.abs(value)>=Math.abs(previous))result[name]=Math.max(-.35,Math.min(1,value));};
  for(const action of actions){
    const k=action.intensity*(.85+energy*.3),speechScale=speaking?.35:1,left=variant%2===0,smile=value=>{put('AK_44_MouthSmileLeft',value*speechScale);put('AK_45_MouthSmileRight',value*speechScale);};
    switch(action.actionId){
      case 'expression.disgust':put('AK_03_BrowInnerUp',.28*k);put('AK_09_EyeBlinkLeft',.38*k);put('AK_10_EyeBlinkRight',.26*k);break;
      case 'expression.smile':smile(.78*k);put('AK_09_EyeBlinkLeft',.12*k);put('AK_10_EyeBlinkRight',.12*k);break;
      case 'comedy.chuckle':case 'comedy.laugh':case 'comedy.belly-laugh':case 'comedy.suppress-laughter':{
        const strong=['comedy.laugh','comedy.belly-laugh'].includes(action.actionId),held=action.actionId==='comedy.suppress-laughter',pulse=.45+.55*Math.sin(action.progress*Math.PI*3)**2;smile((held?.32:strong?.95:.8)*k);put('AK_09_EyeBlinkLeft',.22*k);put('AK_10_EyeBlinkRight',.22*k);if(!speaking&&!held)put('AK_25_JawOpen',(strong?.2:.095)*k*pulse);break;
      }
      case 'response.raise-eyebrow':put(left?'AK_04_BrowOuterUpLeft':'AK_05_BrowOuterUpRight',.9*k);put('AK_03_BrowInnerUp',.12*k);break;
      case 'response.sceptical-look':put(left?'AK_04_BrowOuterUpLeft':'AK_05_BrowOuterUpRight',.78*k);put(left?'AK_45_MouthSmileRight':'AK_44_MouthSmileLeft',.2*k*speechScale);break;
      case 'expression.surprise':put('AK_03_BrowInnerUp',.85*k);put('AK_04_BrowOuterUpLeft',.35*k);put('AK_05_BrowOuterUpRight',.35*k);if(!speaking)put('AK_25_JawOpen',.18*k);break;
      case 'expression.grin':smile(k);put('AK_09_EyeBlinkLeft',.16*k);put('AK_10_EyeBlinkRight',.16*k);break;
      case 'expression.frown':put('AK_44_MouthSmileLeft',-.25*k*speechScale);put('AK_45_MouthSmileRight',-.25*k*speechScale);put('AK_04_BrowOuterUpLeft',-.18*k);put('AK_05_BrowOuterUpRight',-.18*k);break;
      case 'expression.confusion':case 'expression.disbelief':put('AK_03_BrowInnerUp',.34*k);put(left?'AK_04_BrowOuterUpLeft':'AK_05_BrowOuterUpRight',.6*k);put(left?'AK_10_EyeBlinkRight':'AK_09_EyeBlinkLeft',.22*k);break;
      case 'expression.concern':put('AK_03_BrowInnerUp',.65*k);put('AK_44_MouthSmileLeft',-.14*k*speechScale);put('AK_45_MouthSmileRight',-.14*k*speechScale);break;
      case 'expression.embarrassment':smile(.2*k);put('AK_09_EyeBlinkLeft',.32*k);put('AK_10_EyeBlinkRight',.32*k);break;
      case 'expression.frustration':put('AK_04_BrowOuterUpLeft',-.24*k);put('AK_05_BrowOuterUpRight',-.24*k);put('AK_09_EyeBlinkLeft',.18*k);put('AK_10_EyeBlinkRight',.18*k);put('AK_44_MouthSmileLeft',-.12*k*speechScale);put('AK_45_MouthSmileRight',-.12*k*speechScale);break;
      case 'expression.jaw-drop':case 'comedy.mock-shock':put('AK_03_BrowInnerUp',.9*k);if(!speaking)put('AK_25_JawOpen',.4*k);break;
      case 'expression.relief':smile(.42*k);put('AK_09_EyeBlinkLeft',.23*k);put('AK_10_EyeBlinkRight',.23*k);break;
      case 'comedy.smirk':put(left?'AK_44_MouthSmileLeft':'AK_45_MouthSmileRight',.6*k*speechScale);put(left?'AK_05_BrowOuterUpRight':'AK_04_BrowOuterUpLeft',.28*k);break;
      case 'fatigue.yawn':put('AK_09_EyeBlinkLeft',.65*k);put('AK_10_EyeBlinkRight',.65*k);if(!speaking)put('AK_25_JawOpen',.48*k);break;
      case 'fatigue.drooping-eyelids':case 'fatigue.nod-off':put('AK_09_EyeBlinkLeft',.7*k);put('AK_10_EyeBlinkRight',.7*k);break;
      case 'fatigue.sleep-on-desk':put('AK_09_EyeBlinkLeft',action.envelope??k);put('AK_10_EyeBlinkRight',action.envelope??k);break;
      case 'fatigue.startle-awake':put('AK_03_BrowInnerUp',.95*k);put('AK_04_BrowOuterUpLeft',.55*k);put('AK_05_BrowOuterUpRight',.55*k);if(!speaking)put('AK_25_JawOpen',.15*k);break;
    }
  }
  return result;
}
