/** @typedef {import('../games/game-mode.js').DrawItem} DrawItem */
/** @typedef {import('../games/game-mode.js').DrawResult} DrawResult */

export class DrawRenderer {
  static id = 'base';
  static label = 'Renderer';
  static description = '';

  constructor(host, context = {}) {
    this.host = host;
    this.context = context;
    this.destroyed = false;
    this.pool = [];
    this.result = null;
  }

  reset() {
    this.destroyed = false;
    this.pool = [];
    this.result = null;
    this.host?.replaceChildren();
  }

  start(_pool) {
    throw new Error(`${this.constructor.id}.start() must be implemented`);
  }

  reveal(_result) {
    throw new Error(`${this.constructor.id}.reveal() must be implemented`);
  }

  preview(_pool) {
    throw new Error(`${this.constructor.id}.preview() must be implemented`);
  }

  destroy() {
    this.destroyed = true;
  }

  delay(ms) {
    if (this.context.reduceMotion || this.destroyed) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  makeItem(item, className = 'draw-result-card') {
    const card = this.node('article', className);
    card.dataset.kind = item.kind;
    card.style.setProperty('--item-accent', item.accent || this.context.accent || '#c52d35');
    if (item.image) {
      const image = this.node('img', 'draw-item-image');
      image.src = item.image;
      image.alt = '';
      card.append(image);
    } else {
      card.append(this.node('span', 'draw-item-mark', item.kind === 'perk' ? '✦' : item.label.slice(0, 1)));
    }
    const details = this.node('div', 'draw-item-details');
    details.append(this.node('small', 'draw-item-kind', item.kind === 'perk' ? 'PERK' : item.kind === 'killer' ? 'KILLER' : 'SUPERVIVIENTE'));
    details.append(this.node('strong', 'draw-item-label', item.label));
    card.append(details);
    return card;
  }

  renderResults(result, className = 'draw-results') {
    const items = result.items || [];
    const featured = items.filter((item) => item.kind !== 'perk');
    const perks = items.filter((item) => item.kind === 'perk');
    const list = this.node('div', className);
    list.dataset.layout = featured.length && perks.length ? 'split' : perks.length ? 'perks' : 'featured';
    let index = 0;
    const column = (entries, name) => {
      if (!entries.length) return null;
      const group = this.node('div', name);
      for (const item of entries) {
        const card = this.makeItem(item);
        card.style.setProperty('--result-index', index);
        index += 1;
        group.append(card);
      }
      return group;
    };
    list.append(...[column(featured, 'draw-result-featured'), column(perks, 'draw-result-perks')].filter(Boolean));
    this.host.replaceChildren(list);
    this.result = result;
    return list;
  }
}
