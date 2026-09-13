import { HEROES, type HeroDef } from '../game/Data';

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
  private specialCd = $('special-cd');
  private healCd = $('heal-cd');
  private specialSkill = $('skill-special');
  private healSkill = $('skill-heal');
  private loading = $('loading');
  private loadFill = $('load-fill');

  private screens: Record<Exclude<ScreenId, null>, HTMLElement> = {
    title: $('screen-title'),
    select: $('screen-select'),
    pause: $('screen-pause'),
    dead: $('screen-dead'),
    victory: $('screen-victory'),
  };

  private hitTimer = 0;

  constructor() {
    $('special-name').textContent = 'Especial';
  }

  // ------------------------------------------------------------ telas

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
        <div class="stats"><span>HP ${h.hp}</span><span>DANO ${h.damage}</span><span>VEL ${Math.round(h.speed * 100)}%</span></div>
        <div class="skills"><b style="color:${h.accent}">RMB</b> ${h.special.name}<br/><b style="color:${h.accent}">Q</b> ${h.heal.name} (+${Math.round(h.heal.percent * 100)}% HP)</div>
      `;
      card.addEventListener('mouseenter', () => onHover?.());
      card.addEventListener('click', () => onPick(h));
      container.appendChild(card);
    }
  }

  // ------------------------------------------------------------ HUD

  setHero(hero: HeroDef): void {
    this.heroName.textContent = hero.name.toUpperCase();
    this.heroPortrait.src = hero.portrait;
    $('special-name').textContent = hero.special.name;
    $('heal-name').textContent = hero.heal.name;
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

  setBoss(name: string | null, frac = 0): void {
    this.bossBar.classList.toggle('hidden', !name);
    if (name) {
      this.bossName.textContent = name.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      this.bossFill.style.transform = `scaleX(${Math.max(0, frac)})`;
    }
  }

  setCooldowns(specialFrac: number, healFrac: number): void {
    this.specialCd.style.transform = `scaleY(${specialFrac})`;
    this.healCd.style.transform = `scaleY(${healFrac})`;
    this.specialSkill.classList.toggle('ready', specialFrac <= 0);
    this.healSkill.classList.toggle('ready', healFrac <= 0);
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
