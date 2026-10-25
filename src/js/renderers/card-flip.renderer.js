import { DrawRenderer } from './draw-renderer.js';

export default class CardFlipRenderer extends DrawRenderer {
  static id = 'card-flip';
  static label = 'Cartas girando';
  static description = 'Baraja el mazo y voltea las cartas sorteadas.';

  async start(pool) {
    this.reset();
    this.pool = [...pool];
    const table = this.node('div', 'card-flip-table');
    table.append(this.node('p', 'draw-renderer-kicker', 'BARAJANDO EL MAZO'));
    const deck = this.node('div', 'flip-deck flip-deck-stack is-shuffling');
    for (let index = 0; index < Math.min(7, Math.max(3, pool.length)); index += 1) {
      const card = this.node('div', 'flip-card');
      card.style.setProperty('--card-index', index);
      card.style.setProperty('--card-side', index % 2 ? 1 : -1);
      card.append(this.node('span', 'flip-card-back', '✦'));
      deck.append(card);
    }
    table.append(deck);
    this.host.append(table);
    await this.delay(520);
  }

  async reveal(result) {
    if (this.destroyed) return;
    const table = this.node('div', 'card-flip-table');
    table.append(this.node('p', 'draw-renderer-kicker', 'TUS CARTAS'));
    const deck = this.node('div', 'flip-deck');
    for (const [index, item] of result.items.entries()) {
      const card = this.node('div', 'flip-card');
      card.style.setProperty('--card-index', index);
      card.style.setProperty('--item-accent', item.accent || this.context.accent || '#c52d35');
      const inner = this.node('div', 'flip-card-inner');
      inner.append(this.node('span', 'flip-card-back', '✦'));
      const front = this.node('div', 'flip-card-front');
      if (item.image) {
        const image = this.node('img', 'flip-card-image');
        image.src = item.image;
        image.alt = '';
        front.append(image);
      } else {
        front.append(this.node('span', 'flip-perk-symbol', '✦'));
      }
      front.append(this.node('strong', 'flip-card-name', item.label));
      inner.append(front);
      card.append(inner);
      deck.append(card);
    }
    table.append(deck);
    this.host.replaceChildren(table);
    const cards = [...deck.querySelectorAll('.flip-card')];
    for (const [index, card] of cards.entries()) {
      await this.delay(index === 0 ? 220 : 240);
      if (this.destroyed) return;
      card.classList.add('is-flipped');
    }
    await this.delay(500);
    if (!this.destroyed) this.renderResults(result);
  }

  preview(pool) {
    this.reset();
    const preview = this.node('div', 'renderer-preview card-preview');
    for (let index = 0; index < 3; index += 1) preview.append(this.node('span', 'preview-playing-card', '✦'));
    preview.setAttribute('aria-label', `Cartas para ${pool[0]?.label || 'el sorteo'}`);
    this.host.append(preview);
  }
}
