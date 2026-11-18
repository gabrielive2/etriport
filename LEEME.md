# Guerra Anfibia

Shooter en primera persona estilo Doom: desembarco en la playa, puerto, almacenes y base militar enemiga (caricatura, sin sangre).
Aquí viene **solo el código**. El mapa y los dibujos los haces tú, en una carpeta `assets/`.

## Estructura (3 carpetas)

```
index.html             la página (no se toca)
codigo/codigo.js       el código (los ajustes están en el bloque CONFIG, arriba)
mapa/mapa.js           el mapa (texto)
assets/imagenes/       los dibujos PNG
  enemigos/            <tipo>_<n>_hoja.png  (marinero, explorador, granadero, oficial, comandante; n = 1, 2, 3)
  armas/               pistola, escopeta, fusil, ametralladora, fogonazo
  items/               colacion.png (ración que cura)
```

Para el APK están además `package.json`, `capacitor.config.json` y `.github/workflows/apk.yml` (no se tocan).
Abre `index.html` para jugar; si falta una imagen, el juego usa figuras simples y avisa en pantalla.

## Formato de `mapa/mapa.js`

```js
const NIVEL = {
  nombre: "Mi Escuela",
  mapa: `
##########
#S.......#
#..1..1..#
#........#
##########
`
};
```

Cada letra es una casilla y todas las filas deben tener el mismo largo:

| Letra | Qué es |
|---|---|
| `#` | muro con casilleros |
| `.` | pasillo o sala (con techo) |
| `,` | patio abierto (con cielo) |
| `1` | pilar o contenedor |
| `W` | ventana al puerto (muro exterior) |
| `L` | salvavidas en la pared |
| `B` | muro de ladrillo (los que dan al patio) |
| `2` | puerta decorativa |
| `;` | arena de playa (con cielo) |
| `~` | agua baja (se puede caminar) |
| `O` | mar profundo (muro de horizonte, ponlo en el borde de arriba) |
| `Y` | barco (casco, obstáculo) |
| `M` | muro de base militar |
| `V` | almacén (muro de chapa) |
| `S` | inicio del jugador (solo una) |

Rodea todo con muros y conecta todas las zonas. Si el mapa tiene errores, el juego lo dice en pantalla.

## Imágenes

PNG con fondo transparente. Los nombres deben ser exactos. Los rivales en proporción 5:8 (ancho:alto),
recortados pegados al dibujo y de frente. El tamaño exacto no importa.

Los textos para pedirle los dibujos y el mapa a otra IA están en `PEDIR-A-LA-OTRA-IA.md`.

## Hojas de sprites estilo Doom (opcional, para rivales animados)

Con una imagen sola, el rival se ve siempre igual. Con una **hoja de sprites** camina, ataca, se queja del golpe y cae al suelo.

- Archivo: `assets/imagenes/enemigos/<tipo>_<n>_hoja.png`, por ejemplo `marinero_1_hoja.png`.
- Es **una sola imagen** con los cuadros en una cuadrícula de **4 columnas × 2 filas**, y cada cuadro en proporción 5:8
  (la plantilla mide 1000 × 800 px, con cuadros de 250 × 400).
- Todos los cuadros deben tener el mismo tamaño, el personaje con los pies sobre la misma línea y a la misma escala.
- Orden de los cuadros, de izquierda a derecha y de arriba hacia abajo:

| Cuadro | Fila 1 | | | |
|---|---|---|---|---|
| | 0 caminar 1 | 1 caminar 2 | 2 caminar 3 | 3 caminar 4 |

| Cuadro | Fila 2 | | | |
|---|---|---|---|---|
| | 4 atacar 1 (prepara el golpe) | 5 atacar 2 (golpea) | 6 dolor | 7 muerte (tendido en el suelo) |

- Si un rival tiene hoja, el juego la usa. Si no, usa la imagen sola (`<tipo>_<n>.png`), así que puedes mezclar.
  Los rivales con imagen sola igual se achican y se desvanecen al caer.
- En la carpeta `plantillas/` hay dos imágenes para dibujar encima o dárselas a otra IA:
  `plantilla_hoja_guia.png` (con nombres de cuadros y líneas de cabeza, hombros, cintura, rodillas y piso)
  y `plantilla_hoja_siluetas.png` (solo los muñecos, sin texto).
- Si quieres otra distribución (más columnas, más cuadros), cambia el bloque `HOJA` al inicio de `codigo/codigo.js`.

## Jugar online

Sube todo a GitHub y activa **Settings → Pages** (rama `main`, carpeta `/ (root)`).
