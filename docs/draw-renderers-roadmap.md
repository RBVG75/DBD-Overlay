# Sorteos del overlay: modos y renderers

## Separación de responsabilidades

Los modos de `src/js/games/` deciden el pool y generan el resultado. Los
renderers de `src/js/renderers/` reciben `DrawItem[]` y se ocupan únicamente de
la animación, la revelación y el reinicio. La vista no introduce reglas propias.

```js
/** @typedef {{
 * id: string,
 * label: string,
 * kind: 'killer'|'perk'|'survivor',
 * image?: string,
 * accent?: string,
 * meta?: Object
 * }} DrawItem
 */

/** @typedef {{ items: DrawItem[], meta?: Object }} DrawResult */

/** @interface GameMode
 * @property {string} id
 * @property {(request: Object) => DrawItem[]} getPool
 * @property {(request: Object) => DrawResult} draw
 */

/** @interface DrawRenderer
 * @property {(pool: DrawItem[]) => void|Promise<void>} start
 * @property {(result: DrawResult) => void|Promise<void>} reveal
 * @property {() => void} reset
 * @property {() => void} destroy
 * @property {(pool: DrawItem[]) => void} preview
 */
```

La secuencia es `mode.getPool(request)` → `renderer.start(pool)` →
`mode.draw(request)` → `renderer.reveal(result)`. El controller aplica el tema,
el color de acento y `prefers-reduced-motion` al renderer. Todos los items
llevan su icono (`image`); la marca tipográfica de `makeItem()` solo es el
respaldo cuando un item no tiene imagen.

Los modos y renderers se cargan automáticamente desde archivos `*.game.js` y
`*.renderer.js`. Un nuevo renderer que use items genéricos se añade como una
clase nueva; no requiere cambios en los modos. `draw-combinations.js` fija la
presentación inicial recomendada. Si un renderer declara `static modes`, la UI
solo lo ofrece para esos modos y el controller también valida la combinación.
Los renderers sin esa propiedad funcionan con todos los modos.

## Requisitos de presentación

Dos reglas fijadas por el usuario que debe cumplir **cualquier** renderer nuevo,
además de los ya entregados:

1. **Los participantes se ven, no se numeran.** Durante la animación cada killer
   o perk del pool aparece con su propio icono (`item.image`), no con un número,
   una inicial o un símbolo genérico. Cuando el pool es grande, el icono se
   reduce o se reparte en varios anillos/niveles, pero nunca se sustituye por
   texto. Si el soporte es un `<canvas>`, se precargan los sprites y se recortan
   al contorno de la pieza (cover centrado en la cara para retratos, contain para
   iconos de perk). Solo se admite el respaldo tipográfico mientras la imagen no
   ha cargado.
2. **El resultado final usa siempre el layout partido.** `renderResults()` de
   `draw-renderer.js` agrupa los items por `kind` y los reparte en dos columnas,
   de modo que el renderer no decide la composición:

   - `.draw-result-featured` (izquierda): solo el killer. Escala `--card-scale: 2.6`
     (≈2× las perks) y ocupa toda la altura disponible.
   - `.draw-result-perks` (derecha): las perks en 2 columnas × 2 filas, todas del
     mismo tamaño (`grid-auto-rows: minmax(0,1fr)`), con `--card-scale: 1.3`.
   - El contenedor `.draw-results` publica `data-layout` = `split` | `perks` |
     `featured` para los modos sin killer o sin perks.
   - Todo el interior de la tarjeta (imagen, texto, padding, radios) está en
     `calc(px * var(--card-scale))`, así que cambiar la escala mantiene las
     proporciones. No se altera el contenido ni el estilo de la tarjeta, solo el
     layout.
   - Por debajo de 680px las columnas se apilan: killer arriba, perks debajo.

Un renderer nuevo debe limitar su animación a `.draw-stage` y terminar llamando a
`this.renderResults(result)` para heredar esta composición.

## Primer grupo

| Modo | Presentación inicial | Otras presentaciones del primer grupo |
|---|---|---|
| `random-killer` | Ruleta | Carrera, torneo y cualquier renderer compatible |
| `random-perk` | Cartas girando | Lista / tómbola y cualquier renderer compatible |
| `killer-and-perks` | Tambor de bolas | Cartas girando, lista / tómbola, portal y cualquier renderer compatible |

Las opciones de tipo de juego y renderer son controles separados, pero la lista
de presentaciones se filtra por las compatibilidades que declara cada renderer.
Al elegir una presentación compatible, el renderer recibe el mismo formato
genérico de items.

Notas de implementación del primer grupo:

- `roulette`: exclusiva de `random-killer`. Muestra solo el arco superior de un
  disco ampliado bajo la flecha; retratos y nombres siguen la orientación radial
  de cada sector (hacia afuera), también durante el giro. Con menos de 12 opciones
  repite el pool para mantener sectores anchos; cada asesino activo aparece en la
  rueda. Al frenar, el ganador queda bajo el puntero y se resalta.
- `ball-drum`: `paintBallFace()` recorta el sprite dentro de la bola y vuelve a
  pintar el sombreado esférico encima; las bolas que salen por la compuerta
  también muestran su icono.
- `race`: exclusiva de `random-killer`; representa hasta 10 participantes aunque
  el pool configurado sea mayor. El resultado sigue sorteándose desde el pool
  íntegro. Si el ganador no estaba en los diez mostrados, sustituye una calle para
  que el ganador participe en la animación.
- `list-reveal`: cuando recibe un pool con killers y perks, anima solo killers y
  revela el killer (`result.items[0]`) en `killer-and-perks`; en un pool formado
  solo por perks sigue mostrando perks.
- `spotlight-search`: hace varios barridos por candidatos falsos antes de fijar
  los reflectores en los resultados. Las pausas usan `DrawRenderer.delay()` para
  poder cancelar el sorteo y respetar `reducedMotion`.
- `tournament-bracket`: genera byes al completar el siguiente cuadro potencia de
  dos. Cada ronda informa quién elimina a quién; avance verde y eliminación roja.
  Las rondas futuras muestran cruces bloqueados sin retratos ni nombres; se
  desbloquean solo al terminar la ronda anterior. Las filas usan intervalos de
  grid calculados desde la cantidad de cruces de la primera ronda
  (`--bracket-slots`), y la altura del cuadro se calcula a partir del número de
  participantes. No fijar la altura de las columnas ni recolocar cruces solo con
  CSS: el mapeo de filas vive en el renderer.
- `summon-portal`: puerta/halo de suelo pulsante, carga, ascenso del killer y
  materialización de perks. Evitar volver al giro plano continuo del aro: causaba
  que la puerta pareciera dar vueltas sin expresar una invocación.
- `slot-machine`: anima cada tira con Web Animations API, `finished` y un retraso
  escalonado por rodillo. `destroy()` cancela todas las animaciones activas. El
  modo `reducedMotion` coloca los rodillos en el resultado sin iniciar giro.

## Integración con UI y cancelación

La sala de sorteos se abre desde el botón de ruleta en la barra del **overlay de
stream**, no desde la ventana opaca de Ajustes. La configuración de pool sigue en
el diálogo secundario “Pool y reglas”. El HTML de ambas vistas vive en
`src/index.html`; `body.settings-window` esconde la barra y los diálogos de sorteo
en la ventana de Ajustes.

Al cambiar modo, renderer o pool, `game-tools.js` cancela intencionalmente el
sorteo activo. Al recibir `config-updated` tras el autoguardado, `main.js` vuelve
a llamar `gameTools.setConfig()`: este método compara la configuración
normalizada y **no debe cancelar ni reconstruir** la sala si no cambió
`game_tools`. Si se elimina esa comparación, el primer sorteo iniciado después de
cambiar de modo/renderer puede quedar cancelado por el evento de autoguardado;
el siguiente sorteo parece funcionar porque ese evento ya se procesó.

## Datos

- `src/data/killers.json` es la fuente del catálogo de asesinos. `catalog.js`
  sigue exponiendo `KILLERS` para los paneles preexistentes.
- `vite.config.js` indexa los iconos de `images/perks_killers/` y
  `images/perks-survis/` para construir `virtual:perk-assets`. Los nombres de
  archivo que son alias de una misma perk se agrupan y conservan sus rutas en
  `aliases`; se prefiere el archivo que no tenga el prefijo legado `IconPerks_`.
- `src/data/perks.json` aporta nombres preferidos y asociaciones opcionales en
  `byKiller`. Si una perk no tiene asociación a un killer, el combinado usa el
  pool killer activo como alternativa.
- Los arrays configurables del usuario se guardan en `game_tools` dentro de la
  configuración existente.

## Renderers incorporados

Hay 12 estilos disponibles. `RENDERER_GROUPS` en `game-tools.js` los presenta por
familias y los nuevos archivos se auto-registran desde `renderers/`.

- `slot-machine`: un rodillo por item del resultado; las tiras de iconos y nombres
  se detienen en cascada.
- `grid-blackout`: el pool completo aparece como retratos y se apaga en lotes
  hasta destacar los elegidos.
- `radar-scan`: los iconos se distribuyen en espiral sobre un scope; el barrido
  los fija y atenúa el resto.
- `spotlight-search`: los reflectores recorren el mosaico y convergen en cada
  retrato sorteado.
- `tournament-bracket`: cuadro con byes para `random-killer`; el ganador está
  sembrado para llegar a la final.
- `summon-portal`: solo modos con killer; retrato emergente y perks como runas.
- `scratch-card`: una capa de canvas se rasca automáticamente para cada item.

En todos los casos la animación termina con `renderResults(result)` para usar la
composición común del resultado final. `tournament-bracket` y `summon-portal`
declaran modos compatibles mediante `static modes`.

## Catálogo de renderers pendiente (19)

### Azar físico / casino

- `dice-roll` — dados 3D en CSS.
- `coin-flip` — moneda al aire para pools de dos opciones.
- `envelope-reveal` — sobre o caja que se abre.

### Movimiento / competencia

- `race-vehicle` — carrera de autos o barcos.
- `snake-eat` — las opciones se eliminan entre sí.
- `zone-shrink` — círculo que se reduce hasta dejar un resultado.
- `progress-race` — barras de progreso con velocidades distintas.

### Selección visual directa

- `dartboard` — dardo que cae sobre un sector.
- `plinko` — bola que rebota entre pines.

### Texto / tipografía

- `decode-glitch` — texto que se decodifica con glitch.
- `typewriter-shuffle` — opciones que se escriben y sustituyen.
- `digit-spinner` — nombres que pasan como un marcador digital.

### Cartas / tablero

- `memory-flip` — varias cartas se voltean antes de elegir.
- `fan-deck` — abanico de cartas del que sale una.
- `deal-deck` — reparto de cartas hasta la elegida.

### Temáticos

- `energy-converge` — energía que converge y forma al personaje.
- `seal-break` — sello que se rompe para revelar el resultado.

### Interactivos / chat

- `chat-vote-bar` — votos recibidos mediante un proveedor de chat.
- `projectile-target` — opciones que vuelan hacia una diana.

La aplicación actual no incluye un conector Twitch/chat; `chat-vote-bar` queda
pendiente de una fuente de eventos de chat.
