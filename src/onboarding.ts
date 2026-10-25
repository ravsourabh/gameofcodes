import type { CourtScene } from './scene';
import type { CourtRole } from './characters';

export type TourStage = 'welcome' | 'brain' | 'gesture' | 'idea' | 'planning' | 'entering' | 'introductions' | 'ready';
export type OnboardingCallbacks = {
  speak: (role: CourtRole, text: string) => Promise<void>;
  scene: CourtScene;
  planIdea: (idea: string) => Promise<{ speech: string }>;
  reveal: (role: CourtRole) => void;
  stage: (stage: TourStage, hint: string, canContinue: boolean) => void;
  onComplete: () => Promise<void>;
  error: (message: string) => void;
};

// Every pause has a visible user action. No silent timeout advances a lesson.
export class OnboardingManager {
  private active = false;
  private generation = 0;
  private waiter: ((value: boolean) => void) | null = null;
  private ideaInput: ((idea: string) => void) | null = null;
  private stage: TourStage = 'welcome';
  private paused = false;
  private resumeWaiter: (()=>void) | null = null;
  constructor(private cb: OnboardingCallbacks) {}
  get running() { return this.active; }
  get awaitingIdea() { return this.stage === 'idea' && !!this.ideaInput; }
  pause() { this.paused = true; }
  resume() { this.paused = false; this.resumeWaiter?.(); this.resumeWaiter = null; }
  private async ready(token:number) {
    this.checkpoint(token);
    while(this.paused){await new Promise<void>(resolve=>{this.resumeWaiter=resolve;});this.checkpoint(token);}
  }
  stop() {
    this.active = false; this.generation++; this.resume(); this.cb.scene.cancelGuidance();
    this.waiter?.(false); this.waiter = null;
    this.ideaInput?.(''); this.ideaInput = null;
    this.cb.scene.clearGestureOrbs(); this.cb.scene.openHead(null);
  }
  handleInput(text: string) {
    if (this.awaitingIdea) { const done = this.ideaInput!; this.ideaInput = null; done(text); return true; }
    if (this.waiter && /^(?:continue|next|ready|done|go on|skip)(?: please)?[.!]?$/i.test(text.trim())) { this.advance(); return true; }
    return false;
  }
  handleAction(action: string) {
    if (action === 'tour-continue' || this.stage === 'gesture' && action === 'orb-pinched' || this.stage === 'brain' && action === 'brain-swapped') { this.advance(); return true; }
    return false;
  }
  private advance() { this.waiter?.(true); this.waiter = null; }
  private checkpoint(token: number) { if (!this.active || token !== this.generation) throw new Error('Tour cancelled'); }
  private setStage(stage: TourStage, hint: string, canContinue = false) { this.stage = stage; this.cb.stage(stage, hint, canContinue); }
  private wait() { return new Promise<boolean>(resolve => { this.waiter = resolve; }); }
  private async say(token: number, role: CourtRole, text: string) { await this.ready(token); await this.cb.speak(role, text); await this.ready(token); }

  async start(options: { returning?: boolean; hasIdea?: boolean; hasBuild?: boolean; direct?: boolean; explore?: boolean } = {}) {
    if (this.active) return;
    this.active = true; const token = ++this.generation;
    try {
      this.cb.reveal('virus');
      if (!options.returning && !options.direct) {
        this.cb.scene.showGarden(true);
        this.setStage('welcome', 'Virus is welcoming you');
        await this.say(token, 'virus', "Welcome to Game of Codes. I'm Virus, your guide. Let's choose a brain, hear your idea, and meet your court.");
        this.cb.scene.openHead('virus');
        this.setStage('brain', 'Try choosing a brain, or Continue after watching the demonstration.', true);
        const brainDemo = this.wait();
        await this.say(token, 'virus', "Here's my brain. Choose a provider or say its name, like Claude. Then select Continue.");
        await brainDemo; this.checkpoint(token); this.cb.scene.openHead(null);
        this.cb.scene.addGestureOrbs();
        this.setStage('gesture', 'Pinch or click an orb. You can also select Continue.', true);
        const gestureDemo = this.wait();
        await this.say(token, 'virus', 'Point at an orb and pinch to select it. On desktop, click it. This is the same action you use to select a character, swap a brain, or approve a plan.');
        await gestureDemo; this.checkpoint(token); this.cb.scene.clearGestureOrbs();
      } else {
        this.setStage('welcome', 'Welcome back');
        await this.say(token, 'virus', options.hasIdea ? "Welcome back. I'll take you to your court and pick up your saved project." : "Welcome back. Let's hear your idea and take it into the court.");
      }
      if (options.direct) { await this.cb.scene.guideToCourt(); await this.ready(token); }
      if (!options.hasIdea && !options.explore) {
        let planned = false;
        while (!planned) {
          this.setStage('idea', 'Tell Virus what you want to build. He will draft the milestones.');
          // Register the input before speaking so fast typists are never ignored.
          const idea = new Promise<string>(resolve => { this.ideaInput = resolve; });
          await this.say(token, 'virus', 'What would you like to build, and who is it for? I will suggest a plan.');
          const text = await idea; this.checkpoint(token);
          if (!text.trim()) continue;
          this.setStage('planning', 'Virus is drafting milestones and requirements using his assigned brain.');
          try {
            const result = await this.cb.planIdea(text); this.checkpoint(token);
            await this.say(token, 'virus', result.speech); planned = true;
          } catch (error) {
            this.checkpoint(token);
            this.cb.error(error instanceof Error ? error.message : 'The plan could not be prepared.');
            await this.say(token, 'virus', 'I could not prepare that plan yet. Your idea is safe to send again. You can also open my head and choose another available brain.');
          }
        }
      }
      this.setStage('entering', 'Virus is opening the gate and leading you to the court.');
      await this.say(token, 'virus', options.explore&&!options.hasIdea?'Come meet your court. We can explore before deciding what to create.':'Your plan is ready. Follow me into the court.');
      await this.cb.scene.guideToCourt(); await this.ready(token);
      this.setStage('introductions', 'Meet the team who will work on your idea.');
      for (const [role, line] of [
        ['architect', 'This is Elara, your architect. She helps refine the requirements.'],
        ['builder', 'This is Bram, your builder. Approve the plan when you are ready for him to begin.'],
        ['inspector', 'This is Iris, your inspector. She reports the checks actually run on your build.'],
        ['artiste', 'And this is Mira, your artiste. Ask her for a logo or illustration.'],
      ] as const) {
        this.cb.reveal(role); this.cb.scene.selectCharacter(role);
        if (!options.returning) await this.say(token, 'virus', line);
      }
      this.cb.scene.selectCharacter('architect');
      await this.say(token, 'virus', options.explore&&!options.hasIdea ? 'Your court is yours to explore. We can talk, discuss an idea, or plan something when you are ready.' : options.hasBuild ? 'Your saved build is ready. Ask me to review the app or show the code. Tell the team what you would like to change next.' : 'Your court is ready. Review your plan, request a change, or approve it to build.');
      this.checkpoint(token);
      await this.cb.onComplete(); this.checkpoint(token);
      this.active = false; this.setStage('ready', 'Review your plan, request changes, or approve to build.');
    } catch (error) {
      if (token === this.generation && this.active) {
        this.active = false;
        this.cb.error(error instanceof Error ? error.message : 'The tour could not finish. Select Resume guide to try again.');
      }
    }
  }
}
