# DBD Overlay

Overlay de cronómetros y marcador 1v1 para streams de Dead by Daylight en Windows,
hecho con **Tauri v2**. La captura del overlay y la ventana de ajustes son
independientes: selecciona **DBD Overlay** como fuente en OBS.

## Descargar

1. Ve a la página de [Releases](https://github.com/RBVG75/DBD-Overlay/releases) del repositorio.
2. Abre la última versión y descarga el archivo que termina en **`x64-setup.exe`**.
3. Ejecútalo y sigue el instalador.

No hace falta instalar nada más ni compilar el proyecto. Como el instalador no está
firmado digitalmente, Windows SmartScreen puede mostrar un aviso: pulsa
**Más información → Ejecutar de todas formas**.

## Qué hace

- **Siempre encima** — se mantiene sobre cualquier ventana, incluidos los juegos en pantalla completa sin bordes, y cubre la pantalla entera con la franja de la barra de tareas incluida
- **Fondo transparente** — interfaz de cristal con desenfoque
- **Atravesable** — con el candado echado, los clics pasan al juego
- **Atajos globales** — 20 acciones configurables, más uno por temporizador y hasta cinco por contador
- **Cronómetros 1v1** — dos tiempos independientes con cambio de jugador activo
- **Auto-puntuación** — al pausar ambos, el mayor suma un punto si los dos superan 5 s
- **Marcador** — nombres y controles +/reiniciar/− disponibles en Ajustes
- **Temporizadores** — 30 diseños distintos y más de 40 opciones por temporizador
- **Paneles de info para el directo** — racha, récord personal, récord mundial, winrate, killrate, objetivo del día… con recuadros que van rotando entre varias páginas
- **Retratos incluidos** — los 44 killers y los 54 supervivientes, para enseñar con quién estás jugando
- **Mira** — once formas, color, tamaño, grosor y separación ajustables
- **Edición directa** — arrastra los widgets y redimensiónalos desde su tirador; los contornos aparecen en modo edición
- **Ruletas y modos DBD** — se abren desde la barra del overlay para que la animación salga en OBS
- **Ligero** — binario de ~5 MB y unos 30 MB de RAM

## Atajos por defecto

| Acción | Atajo |
|---|---|
| Iniciar / pausar cronómetro activo | `F1` |
| Cambiar jugador activo | `F2` |
| Reiniciar | `Ctrl+Shift+F3` |
| Mostrar / ocultar ventana | `Ctrl+Shift+F4` |
| Ajustes | `Ctrl+Shift+F5` |
| Bloquear clics | `F6` |
| Mira | `F7` |
| Cronómetro | `F8` |
| Marcador | `F9` |
| Temporizadores | `F10` |
| Todo | `F11` |
| Temporizador «Corto» (15 s) | `J` |
| Temporizador «Largo» (60 s) | `K` |

Sin asignar por defecto: pausar, vuelta, paneles de info, pasar de página,
reiniciar sesión, limpiar temporizadores, punto jugador 1, punto jugador 2 y
reiniciar marcador. Todos se asignan en *Ajustes → Atajos*: haz clic en el
recuadro y pulsa la combinación; `Supr` la borra y `Esc` cancela. Los atajos de
cada contador se asignan en su propia ficha, dentro de *Ajustes → Contadores*.

## Ventanas, 1v1 y OBS

La aplicación abre dos ventanas: **DBD Overlay** es la
ventana transparente, sin marco y siempre encima que debes elegir en OBS mediante
**Fuentes → Captura de ventana**. **DBD Overlay · Ajustes** es una ventana
opaca separada; no la selecciones para la captura.

`F1` inicia, pausa o reanuda el cronómetro activo. `F2` cambia de jugador sin
alterar tiempos ni puntos. También hay controles independientes en cada reloj.
Con auto-puntuación activada, cuando ambos están pausados y los dos tiempos
alcanzan el umbral (5 segundos por defecto), se otorga exactamente un punto al
tiempo mayor; los empates no puntúan. Reiniciar o empezar una carrera nueva borra
las capturas de pausa anteriores. El umbral se ajusta en *Ajustes → Inicio →
Jugadores y marcador*.

Los nombres y puntajes se editan en esa misma pantalla de Ajustes. Se aplican de
inmediato al overlay y se guardan automáticamente.

La barra flotante del overlay incluye **Ruletas y modos de juego**; el panel de
sorteo se muestra en la ventana capturada por OBS y no en Ajustes. **Editar datos
sobre el overlay** activa contornos en los widgets/paneles y tiradores de escala;
**Terminar edición** sale de ese modo. El overlay de fábrica arranca desbloqueado;
el candado deja pasar los clics al juego.

Los modos de sorteo son **Killer aleatorio**, **Perk aleatoria** y **Killer +
perks**. Las reglas y los pools se configuran desde la propia sala de sorteos.
La carrera muestra hasta 10 participantes sin limitar el pool y la tómbola del
modo combinado solo anima killers. El torneo conserva el cuadro de eliminaciones
por rondas junto al resultado final.

## Paneles de información

Están pensados para retransmitir: recuadros que enseñan tus números en pantalla y
se actualizan con un atajo mientras juegas.

### Contadores

Todo dato nace de un **contador**, de cuatro tipos:

- **Contador** — un número que sube y baja con un atajo (kills, generadores, muertes…). Guarda su récord él solo.
- **Victorias / derrotas** — lleva V, D, E, el porcentaje y el historial de las últimas partidas.
- **Texto libre** — para el récord mundial, tus redes o una nota.
- **Personaje** — un killer o superviviente del juego, con su retrato. Los 44 killers y los 54 supervivientes vienen incluidos: lo eliges de una rejilla en los ajustes, o lo vas cambiando en directo con los atajos «personaje siguiente» y «anterior», que dan la vuelta al llegar al final.

**Las rachas se llevan solas.** A un contador numérico le dices «sube con la
victoria de Partidas» y «se pone a cero con la derrota de Partidas»: cada
victoria le suma uno, cada derrota lo devuelve a cero y el récord se queda con la
mejor marca. Eso es exactamente una racha, sin tocar nada a mano.

Cada contador tiene sus propios atajos globales (sumar, restar, victoria,
derrota, empate, deshacer la última, poner a cero) y los valores se guardan solos
un segundo y medio después de cambiarlos, así que un cierre inesperado no se
lleva tu racha por delante.

### Qué puede mostrar un recuadro

Valor del contador · récord · actual y récord juntos · porcentaje de victorias ·
**fórmula** · objetivo con barra de progreso · últimos resultados en cadena de V y
D · tiempo en directo · hora actual · texto fijo · **retrato del personaje**.

Con la disposición **«retrato al lado»** el retrato se coloca a un lado (izquierda
o derecha, tú eliges) y el resto de datos se apilan junto a él.

Las **fórmulas** son lo que da juego: escribe `kills / partidas / 4 * 100` y
tienes el killrate; `partidas_v / partidas * 100` y tienes el winrate. Cada
contador aporta sus claves (`partidas`, `partidas_v`, `partidas_d`,
`partidas_pct`, `kills_record`, `sesion`…) y el panel de ajustes te las lista
mientras escribes, marcando en rojo lo que no cuadra.

### Recuadros que rotan

Un panel puede tener **hasta 12 páginas**. Le pones cada cuántos segundos cambia
y con qué transición (fundido, deslizar hacia arriba, deslizar al lado, voltear,
zoom o ninguna) y va enseñando una tras otra: racha, luego winrate, luego tus
redes. Unos puntitos indican por dónde va, y el atajo «Pasar de página» las
adelanta cuando quieras.

### Diez estilos de recuadro

Tarjeta · mosaico · banner · píldora · franja · neón · esports · contorno ·
mínimo · terminal. De cada uno se ajustan anclaje, desplazamiento, ancho, escala,
opacidad, cuatro colores, brillo, radio, borde, tipografía, tres tamaños de
texto, mayúsculas y si se ve el título.

### Plantillas listas

Siete montajes de un clic que crean los contadores y el panel ya conectados:
**Killer + racha** (el retrato del killer y, al lado, la racha actual con su
récord personal y el récord mundial), **Racha**, **Winrate**, **Killrate**,
**Sesión**, **Objetivo del día** y **Panel rotativo**. Si ya tienes un contador de victorias y derrotas, las plantillas lo
reutilizan en lugar de crear otro, así que los números nunca se contradicen.

## Los 30 diseños de temporizador

**Anillos** — clásico · por minuto · doble · segmentado · de marcas · degradado ·
neón · punteado · doble pista · órbita · espiral de minutos

**Sólidos** — porción · medidor · líquido · reloj de arena · radar · reloj
analógico · pulso

**Barras** — horizontal · vertical · segmentada · ecualizador · puntos en línea ·
rejilla de puntos · bloques apilados

**Texto** — digital · LCD · flip clock · glitch · mínimo

El diseño **anillo por minuto** es el que lleva el número en el centro y una
línea circular alrededor que se llena con cada minuto que pasa; el anillo interior
más fino muestra a la vez cuánto queda del total.

## Qué se puede personalizar en cada temporizador

Nombre · atajo · duración · permitir varios a la vez · diseño · tamaño · grosor
de línea · número de segmentos o marcas · sentido (se vacía o se llena) · giro
horario o antihorario · ángulo de inicio · opacidad · color principal · color
secundario · color y opacidad de la pista · brillo · formato del texto · décimas
de segundo · tipografía · tamaño, grosor y color del texto · cuenta hacia arriba ·
mostrar el nombre y dónde · segundos de aviso y de peligro · colores de aviso y
peligro · latido final · vibración final · sonido final · volumen · tic en los
últimos tres segundos · qué hacer al terminar (desaparecer, quedarse en cero,
parpadear o repetir) · tipo de fondo · color y opacidad del fondo · radio de las
esquinas · imagen de fondo con su opacidad y desenfoque · anclaje en pantalla ·
desplazamiento X e Y · apilado en columna o en fila.

Hay además seis ajustes rápidos (anillo por minuto, neón rápido, medidor,
líquido, barra superior y flip clock) y una vista previa en vivo mientras editas.

## Requisitos

1. **Rust** — https://www.rust-lang.org/tools/install
2. **Node.js** — https://nodejs.org/
3. **Visual Studio Build Tools** con la carga de trabajo «Desarrollo para escritorio con C++»
4. **WebView2** — ya viene con Windows 10 y 11

## Instalación y uso

```powershell
npm install
npm run dev      # desarrollo con recarga en caliente
npm run build    # genera el .exe y el .msi
```

La salida queda en `src-tauri/target/release/bundle/`.

## Configuración

Se guarda en `%APPDATA%/com.dbdoverlay.app/config.json`. El guardado es
atómico (se escribe en un temporal y se renombra), y si el archivo llegara a
corromperse la app lo aparta como `config.json.bak` y arranca con los valores por
defecto en vez de negarse a abrir.

Las configuraciones de la versión 1 se convierten solas: los atajos antiguos
`hotkey_*` y los temporizadores con `line_width`/`line_color` se conservan.

## Solución de problemas

**La app no aparece** — búscala en la bandeja del sistema o pulsa `Ctrl+Shift+F4`.

**Los atajos no funcionan** — puede que otra aplicación se haya quedado con la
misma combinación; asígnale otra en *Ajustes → Atajos*.

**No puedo hacer clic en nada** — está echado el candado (modo atravesable);
pulsa `F6`.

**No se ve sobre el juego** — funciona sobre pantalla completa sin bordes; sobre
pantalla completa exclusiva ninguna superposición puede dibujarse, cambia el
juego a «sin bordes».

**No llega hasta abajo del todo / no tapa la barra de tareas** — abre *Ajustes →
General → Pantalla*: ahí ves el rectángulo que está cubriendo ahora mismo. Debe
coincidir con la resolución completa de tu monitor (1920 × 1080 y no 1920 × 1040,
por ejemplo). Si no coincide, pulsa «Reajustar ahora». Con varios monitores
puedes elegir entre cubrir solo el actual o todas las pantallas a la vez.

**Falla la compilación** — comprueba `rustc --version` y que estén instaladas las
Build Tools de Visual Studio; después `rustup update`.

## Licencia

MIT
