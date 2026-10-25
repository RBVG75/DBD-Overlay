import { DrawRenderer } from './draw-renderer.js';

function shuffled(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export default class TournamentBracketRenderer extends DrawRenderer {
  static id = 'tournament-bracket';
  static label = 'Torneo 1v1';
  static description = 'Cruces eliminatorios con retratos hasta la gran final.';
  static modes = ['random-killer'];

  async start(pool) {
    this.reset();
    this.pool = [...pool];
    this.board = this.node('div', 'bracket-board');
    this.board.append(this.node('p', 'draw-renderer-kicker', `TORNEO · ${pool.length} ASESINOS`));
    this.focus = this.node('div', 'bracket-focus');
    this.focus.append(this.node('span', 'bracket-preparing', 'SORTEANDO LOS CRUCES 1V1'));
    this.board.append(this.focus);
    this.host.append(this.board);
    await this.delay(650);
  }

  playerFace(item, className = 'bracket-player') {
    const player = this.node('span', className);
    if (item?.image) {
      const image = this.node('img', 'bracket-image');
      image.src = item.image;
      image.alt = '';
      image.loading = 'eager';
      image.decoding = 'async';
      player.append(image);
    } else player.append(this.node('span', 'bracket-mark', item?.label?.slice(0, 1) || '—'));
    player.append(this.node('span', 'bracket-name', item?.label || 'Pase libre'));
    return player;
  }

  buildBracket(winner) {
    const size = 2 ** Math.ceil(Math.log2(Math.max(1, this.pool.length)));
    let entrants = shuffled(this.pool);
    while (entrants.length < size) entrants.push(null);
    const rounds = [];
    while (entrants.length > 1) {
      const matches = [];
      const advancing = [];
      for (let index = 0; index < entrants.length; index += 2) {
        const pair = [entrants[index], entrants[index + 1]];
        let advancingItem;
        if (!pair[0]) advancingItem = pair[1];
        else if (!pair[1]) advancingItem = pair[0];
        else if (pair.some((item) => item.id === winner.id)) advancingItem = winner;
        else advancingItem = pair[Math.floor(Math.random() * 2)];
        matches.push({ players: pair, advancing: advancingItem });
        advancing.push(advancingItem);
      }
      rounds.push(matches);
      entrants = advancing;
    }
    return rounds;
  }

  async reveal(result) {
    const winner = result.items[0];
    if (this.destroyed || !winner || !this.board) return;
    const rounds = this.buildBracket(winner);
    this.columns = this.node('div', 'bracket-columns');
    const bracketSize = 2 ** Math.ceil(Math.log2(Math.max(1, this.pool.length)));
    const bracketSlots = Math.max(1, bracketSize / 2);
    this.columns.style.setProperty('--bracket-slots', bracketSlots);
    this.columns.style.height = `${bracketSlots * 58 + 44}px`;
    const roundNames = rounds.map((_, index) => {
      const remaining = rounds.length - index;
      if (remaining === 1) return 'FINAL';
      if (remaining === 2) return 'SEMIFINAL';
      if (remaining === 3) return 'CUARTOS';
      if (remaining === 4) return 'OCTAVOS';
      return `RONDA ${index + 1}`;
    });
    const roundElements = rounds.map((matches, roundIndex) => {
      const round = this.node('section', 'bracket-round');
      const locked = roundIndex > 0;
      if (locked) round.classList.add('is-locked');
      round.append(this.node('strong', 'bracket-round-title', roundNames[roundIndex]));
      const matchGrid = this.node('div', 'bracket-round-matches');
      for (const match of matches) {
        const mini = this.node('div', 'bracket-mini-match');
        const span = 2 ** roundIndex;
        const firstRow = (matchGrid.children.length * span) + 1;
        mini.style.gridRow = `${firstRow} / span ${span}`;
        const first = locked ? this.lockedPlayer() : this.playerFace(match.players[0], 'bracket-mini-player');
        const second = locked ? this.lockedPlayer() : this.playerFace(match.players[1], 'bracket-mini-player');
        mini.append(first, this.node('span', 'bracket-match-vs', 'VS'), second);
        if (!locked && match.players.some((item) => item?.id === winner.id)) mini.classList.add('is-champion-path');
        if (!locked && (!match.players[0] || !match.players[1])) mini.classList.add('is-bye');
        mini.append(this.node('small', 'bracket-match-result', locked ? 'RONDA BLOQUEADA' : 'ESPERANDO CRUCE'));
        matchGrid.append(mini);
      }
      round.append(matchGrid);
      this.columns.append(round);
      return round;
    });
    this.board.append(this.columns);

    await this.delay(500);
    for (let roundIndex = 0; roundIndex < rounds.length; roundIndex += 1) {
      const matches = rounds[roundIndex];
      const currentRound = roundElements[roundIndex];
      if (roundIndex > 0) {
        currentRound.classList.remove('is-locked');
        const miniMatches = [...currentRound.querySelectorAll('.bracket-mini-match')];
        matches.forEach((match, matchIndex) => {
          const mini = miniMatches[matchIndex];
          const vs = mini.querySelector('.bracket-match-vs');
          const resultLabel = mini.querySelector('.bracket-match-result');
          mini.replaceChildren(
            this.playerFace(match.players[0], 'bracket-mini-player'),
            vs,
            this.playerFace(match.players[1], 'bracket-mini-player'),
            resultLabel,
          );
          if (match.players.some((item) => item?.id === winner.id)) mini.classList.add('is-champion-path');
          if (!match.players[0] || !match.players[1]) mini.classList.add('is-bye');
          resultLabel.textContent = 'ESPERANDO CRUCE';
        });
        await this.delay(500);
        if (this.destroyed) return;
      }
      currentRound.classList.add('is-active');
      const miniMatches = [...currentRound.querySelectorAll('.bracket-mini-match')];
      for (let matchIndex = 0; matchIndex < matches.length; matchIndex += 1) {
        const match = matches[matchIndex];
        const mini = miniMatches[matchIndex];
        const [firstItem, secondItem] = match.players;
        const first = mini.children[0];
        const second = mini.children[2];
        const resultLabel = mini.querySelector('.bracket-match-result');
        const duel = this.node('div', `bracket-duel${roundIndex === rounds.length - 1 ? ' is-final' : ''}`);
        if (!firstItem || !secondItem) {
          const advancingPlayer = firstItem ? first : second;
          advancingPlayer.classList.add('is-advancing');
          mini.classList.add('is-resolved', 'is-bye');
          resultLabel.textContent = `${match.advancing?.label || 'ASESINO'} AVANZA · PASE LIBRE`;
          await this.delay(260);
          if (this.destroyed) return;
          continue;
        }

        currentRound.classList.add('is-showing-match');
        const focusFirst = this.playerFace(firstItem);
        const focusSecond = this.playerFace(secondItem);
        duel.append(focusFirst, this.node('span', 'bracket-versus', 'VS'), focusSecond);
        this.focus.replaceChildren(
          this.node('span', 'bracket-focus-kicker', `${roundNames[roundIndex]} · CRUCE ${matchIndex + 1} DE ${matches.length}`),
          duel,
        );
        mini.classList.add('is-current-match');
        await this.delay(roundIndex === rounds.length - 1 ? 1100 : 650);
        if (this.destroyed) return;

        const firstAdvances = match.advancing?.id === firstItem.id;
        const advancingItem = firstAdvances ? firstItem : secondItem;
        const eliminatedItem = firstAdvances ? secondItem : firstItem;
        const advancingPlayer = firstAdvances ? first : second;
        const eliminatedPlayer = firstAdvances ? second : first;
        advancingPlayer.classList.add('is-advancing');
        eliminatedPlayer.classList.add('is-eliminated');
        mini.classList.add('is-resolved');
        mini.classList.remove('is-current-match');
        resultLabel.textContent = `${advancingItem.label} ELIMINA A ${eliminatedItem.label}`;
        resultLabel.title = `${advancingItem.label} eliminó a ${eliminatedItem.label}`;
        focusFirst.classList.toggle('is-advancing', firstAdvances);
        focusFirst.classList.toggle('is-eliminated', !firstAdvances);
        focusSecond.classList.toggle('is-advancing', !firstAdvances);
        focusSecond.classList.toggle('is-eliminated', firstAdvances);
        duel.classList.add('is-champion-revealed');
        await this.delay(roundIndex === rounds.length - 1 ? 1300 : 400);
        if (this.destroyed) return;
        currentRound.classList.remove('is-showing-match');
      }
      currentRound.classList.remove('is-active', 'is-showing-match');
      if (roundIndex < rounds.length - 1) {
        this.focus.replaceChildren(this.node('span', 'bracket-preparing', `${roundNames[roundIndex]} COMPLETA · PREPARANDO ${roundNames[roundIndex + 1]}`));
        await this.delay(850);
        if (this.destroyed) return;
      } else {
        this.focus.replaceChildren(
          this.node('span', 'bracket-focus-kicker', 'CAMPEÓN DEL TORNEO'),
          this.playerFace(winner, 'bracket-champion'),
        );
        await this.delay(1200);
        if (this.destroyed) return;
      }
    }

    if (rounds.length === 0) {
      this.focus.replaceChildren(this.playerFace(winner, 'bracket-champion'));
      await this.delay(900);
    }
    if (!this.destroyed) {
      const resultHost = this.node('div', 'bracket-final-result');
      const originalHost = this.host;
      this.host = resultHost;
      this.renderResults(result);
      this.host = originalHost;
      this.board.append(resultHost);
    }
  }

  lockedPlayer() {
    const player = this.node('span', 'bracket-mini-player bracket-hidden-player');
    player.append(this.node('span', 'bracket-lock-mark', '🔒'), this.node('span', 'bracket-name', 'BLOQUEADO'));
    return player;
  }

  preview(pool) {
    this.reset();
    const preview = this.node('div', 'renderer-preview bracket-preview');
    for (let column = 0; column < 3; column += 1) {
      const round = this.node('span', 'bracket-preview-round');
      for (let index = 0; index < 2 ** (2 - column); index += 1) round.append(this.node('i', index === 0 && column === 2 ? 'is-winner' : ''));
      preview.append(round);
    }
    preview.setAttribute('aria-label', `Vista previa del torneo entre ${pool.length} asesinos`);
    this.host.append(preview);
  }
}
