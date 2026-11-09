# Escuela Portuaria — qué falta poner

Juego de pelea escolar en primera persona (estilo Doom), de caricatura.
Aquí viene **solo el código**. El mapa y los dibujos los haces tú, en una carpeta `assets/`.

## Estructura

```
index.html             la página (no se toca)
codigo/
  codigo.js            todo el código (los ajustes están en el bloque CONFIG, arriba)
assets/                ← la creas tú
  mapa.js              el mapa
  imagenes/            los dibujos PNG
    enemigos/          estudiante_1.png _2 _3, corredor_1.png _2 _3, bravucon_1.png _2 _3,
                       inspector_1.png _2 _3, jefe_1.png _2 _3
    armas/             punos.png, mochila.png, pelota.png, extintor.png
    items/             colacion.png
```

Mientras no tengas todo, el juego funciona igual: usa figuras simples en lugar de las imágenes
que falten, y te avisa en pantalla cuáles son. Lo único obligatorio es `assets/mapa.js`.

## Formato de `assets/mapa.js`

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
| `S` | inicio del jugador (solo una) |

Rodea todo con muros y conecta todas las zonas. Si el mapa tiene errores, el juego lo dice en pantalla.

## Imágenes

PNG con fondo transparente. Los nombres deben ser exactos. Los rivales en proporción 5:8 (ancho:alto),
recortados pegados al dibujo y de frente. El tamaño exacto no importa.

Los textos para pedirle los dibujos y el mapa a otra IA están en `PEDIR-A-LA-OTRA-IA.md`.

## Jugar online

Sube todo a GitHub y activa **Settings → Pages** (rama `main`, carpeta `/ (root)`).
