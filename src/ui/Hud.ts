import { DIFFICULTY, HEROES, meleeDamageMul, type HeroDef } from '../game/Data';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} não encontrado`);
  return el as T;
};

export type ScreenId = 'title' | 'select' | 'pause' | 'dead' | 'victory' | null;

export class Hud {
  readonly hud = $('hud');
  private hpFill = $('hp-fill');
  private hpText = $('hp-text');
  private xpFill = $('xp-fill');
  private xpText = $('xp-text');
  private heroName = $('hero-name');
  private heroLevel = $('hero-level');
  private heroPortrait = $<HTMLImageElement>('hero-portrait');
  private objectiveText = $('objective-text');
  private killCount = $('kill-count');
  private bossBar = $('boss-bar');
  private bossName = $('boss-name');
  private bossFill = $('boss-fill');
  private toasts = $('toasts');
  private vignette = $('vignette');
  private loading = $('loading');
  private loadFill = $('load-fill');
  private prompt = $('prompt');
  private cds = [$('sk1-cd'), $('sk2-cd'), $('sk3-cd')];
  private skills = [$('skill-1'), $('skill-2'), $('skill-3')];
  private hitTimer = 0;

  constructor() {
    const label = `Dificuldade ${DIFFICULTY} / 10`;
    const titleDiff = document.getElementById('difficulty-title');
    const hudDiff = document.getElementById('difficulty-hud');
    const pauseDiff = document.getElementById('difficulty-pause');
    if (titleDiff) titleDiff.innerHTML = `Dificuldade <b>${DIFFICULTY}</b> / 10`;
    if (hudDiff) hudDiff.innerHTML = `Dificuldade <b>${DIFFICULTY}</b>/10`;
    if (pauseDiff) pauseDiff.textContent = label;
  }

  private screens: Record<Exclude<ScreenId, null>, HTMLElement> = {
    title: $('screen-title'),
    select: $('screen-select'),
    pause: $('screen-pause'),
    dead: $('screen-dead'),
    victory: $('screen-victory'),
  };

  showScreen(id: ScreenId): void {
    for (const [k, el] of Object.entries(this.screens)) el.classList.toggle('hidden', k !== id);
  }

  setHudVisible(v: boolean): void {
    this.hud.classList.toggle('hidden', !v);
  }

  setLoading(progress: number | null): void {
    if (progress === null) {
      this.loading.classList.add('hidden');
      return;
    }
    this.loading.classList.remove('hidden');
    this.loadFill.style.transform = `scaleX(${Math.min(1, progress)})`;
  }

  buildHeroCards(onPick: (hero: HeroDef) => void, onHover?: () => void): void {
    const container = $('hero-cards');
    container.innerHTML = '';
    for (const h of HEROES) {
      const card = document.createElement('div');
      card.className = 'hero-card';
      card.innerHTML = `
        <img src="${h.portrait}" alt="${h.name}" />
        <div class="name">${h.name.toUpperCase()}</div>
        <div class="title">${h.title}</div>
        <div class="company">${h.company}</div>
        <div class="desc">${h.description}</div>
        <div class="stats"><span>HP ${h.hp}</span><span>DANO ${Math.round(h.damage * meleeDamageMul())}</span><span>VEL ${Math.round(h.speed * 100)}%</span></div>
        <div class="skills">${h.skills.map((s, i) => `<b style="color:${h.accent}">${i + 1}</b> ${s.name}`).join('<br/>')}</div>
      `;
      card.addEventListener('mouseenter', () => onHover?.());
      card.addEventListener('click', () => onPick(h));
      container.appendChild(card);
    }
  }

  setHero(hero: HeroDef): void {
    this.heroName.textContent = hero.name.toUpperCase();
    this.heroPortrait.src = hero.portrait;
    $('sk1-name').textContent = hero.skills[0].name;
    $('sk2-name').textContent = hero.skills[1].name;
    $('sk3-name').textContent = hero.skills[2].name;
  }

  setHealth(hp: number, max: number): void {
    const f = Math.max(0, hp / max);
    this.hpFill.style.transform = `scaleX(${f})`;
    this.hpFill.classList.toggle('low', f < 0.3);
    this.hpText.textContent = `${Math.ceil(Math.max(0, hp))} / ${max}`;
    this.vignette.classList.toggle('low', f < 0.3 && f > 0);
  }

  setXp(xp: number, nextXp: number, prevXp: number, level: number): void {
    const f = nextXp > prevXp ? (xp - prevXp) / (nextXp - prevXp) : 1;
    this.xpFill.style.transform = `scaleX(${Math.min(1, Math.max(0, f))})`;
    this.xpText.textContent = nextXp > prevXp ? `XP ${xp} / ${nextXp}` : `XP MAX`;
    this.heroLevel.textContent = `Nível ${level}`;
  }

  setObjective(text: string): void {
    this.objectiveText.textContent = text;
  }

  setKills(n: number): void {
    this.killCount.textContent = String(n);
  }

  setCoins(n: number): void {
    $('coin-count').textContent = String(n);
  }

  setCookies(n: number): void {
    $('cookie-count').textContent = String(n);
  }

  setPrompt(text: string): void {
    this.prompt.textContent = text;
    this.prompt.classList.toggle('hidden', !text);
  }

  showTalk(name: string, title: string, body: string, options: string[], onPick: (i: number) => void): void {
    $('dialogue-name').textContent = name;
    $('dialogue-title').textContent = title;
    $('dialogue-body').textContent = body;
    $('dialogue-ask').textContent = '';
    $('dialogue-ask').classList.add('hidden');
    this.fillTalkOptions(options, onPick);
    $('dialogue-close').classList.add('hidden');
    $('dialogue').classList.remove('hidden');
  }

  showTalkReply(body: string, followUp?: { ask?: string; options: string[]; onPick: (i: number) => void }): void {
    $('dialogue-body').textContent = body;
    const ask = $('dialogue-ask');
    if (followUp?.ask) {
      ask.textContent = followUp.ask;
      ask.classList.remove('hidden');
    } else {
      ask.textContent = '';
      ask.classList.add('hidden');
    }
    if (followUp?.options.length) {
      this.fillTalkOptions(followUp.options, followUp.onPick);
      $('dialogue-close').classList.add('hidden');
    } else {
      $('dialogue-options').classList.add('hidden');
      $('dialogue-close').classList.remove('hidden');
    }
  }

  hideTalk(): void {
    $('dialogue').classList.add('hidden');
    $('dialogue-options').innerHTML = '';
    $('dialogue-ask').textContent = '';
    $('dialogue-ask').classList.add('hidden');
    $('dialogue-close').classList.add('hidden');
  }

  private fillTalkOptions(options: string[], onPick: (i: number) => void): void {
    const list = $('dialogue-options');
    list.innerHTML = '';
    list.classList.remove('hidden');
    options.forEach((label, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dialogue-option';
      const kbd = document.createElement('kbd');
      kbd.textContent = String(i + 1);
      btn.append(kbd, document.createTextNode(label));
      btn.addEventListener('click', () => onPick(i));
      list.appendChild(btn);
    });
  }

  setBoss(name: string | null, frac = 0): void {
    this.bossBar.classList.toggle('hidden', !name);
    if (name) {
      this.bossName.textContent = name.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      this.bossFill.style.transform = `scaleX(${Math.max(0, frac)})`;
    }
  }

  setCooldowns(fracs: [number, number, number]): void {
    fracs.forEach((f, i) => {
      this.cds[i].style.transform = `scaleY(${f})`;
      this.skills[i].classList.toggle('ready', f <= 0);
    });
  }

  hit(): void {
    this.vignette.classList.add('hit');
    this.hitTimer = 0.2;
  }

  update(dt: number): void {
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) this.vignette.classList.remove('hit');
    }
  }

  toast(text: string, big = false): void {
    const el = document.createElement('div');
    el.className = `toast${big ? ' big' : ''}`;
    el.textContent = text;
    this.toasts.appendChild(el);
    while (this.toasts.children.length > 4) this.toasts.firstChild?.remove();
    setTimeout(() => el.remove(), 3200);
  }

  setDeadText(t: string): void {
    $('dead-text').textContent = t;
  }

  setVictoryText(t: string): void {
    $('victory-text').textContent = t;
  }
}
