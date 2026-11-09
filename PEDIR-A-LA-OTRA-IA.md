# Cómo pedirle a otra IA los dibujos y el mapa

Copia y pega los textos de las cajas. Cuando tengas lo que te entregue, sigue la parte
**"Dónde poner lo que te dio"** al final de cada sección.

---

## 1. Los dibujos (sprites)

Son archivos **PNG con fondo transparente**, que van en la carpeta `assets/imagenes/` con **exactamente** estos nombres.
Si un archivo falta, el juego avisa en pantalla cuál es y sigue funcionando con los demás.

### Texto para pegarle a la IA de imágenes (primero esto, como estilo general)

```
Voy a pedirte varios personajes y objetos para un videojuego de pelea escolar
en primera persona, estilo retro de los años 90 (como Doom, pero de caricatura).
Reglas para TODAS las imágenes:
- Estilo: caricatura / pixel art detallado, colores planos, contorno oscuro fino. Mismo estilo en todas.
- Vista de frente, cuerpo completo (los personajes), bien centrados.
- Fondo transparente en PNG (si no puedes, fondo verde liso #00FF00 sin sombras).
- Recorta la imagen pegada al dibujo: que el personaje toque los 4 bordes, sin márgenes vacíos.
- Sin sangre, sin armas reales, sin logos, sin personas reales ni colegios reales.
- Uniforme escolar genérico: suéter azul marino, camisa blanca, pantalón gris.
Te iré pidiendo una imagen a la vez.
```

### Rivales — proporción 5:8 (ancho:alto), por ejemplo 500 × 800 px

Cada tipo necesita **3 versiones** distintas (otra cara, otro pelo, otro color de piel).

| Archivo (en `assets/imagenes/enemigos/`) | Qué dibujar |
|---|---|
| `estudiante_1.png` | Chico escolar, pelo corto oscuro, suéter azul marino, camisa blanca, pantalón gris, cara seria |
| `estudiante_2.png` | Otro chico escolar, piel más morena, pelo café, mismo uniforme |
| `estudiante_3.png` | Niña escolar, pelo largo castaño, mismo uniforme |
| `corredor_1.png` `_2` `_3` | Estudiante flaco y ágil con polerón rojo, pantalón oscuro, postura de ir corriendo (3 versiones) |
| `bravucon_1.png` `_2` `_3` | Estudiante grande y ancho con polerón negro, cara de enojado, puños cerrados (3 versiones) |
| `inspector_1.png` `_2` `_3` | Adulto de pelo gris con traje gris y corbata roja, serio, con una carpeta (3 versiones) |
| `jefe_1.png` `_2` `_3` | Estudiante muy grande con chaqueta verde, aire de líder, brazos cruzados (3 versiones) |

### Armas en primera persona (assets/imagenes/armas/)

| Archivo | Proporción (ancho:alto) | Qué dibujar |
|---|---|---|
| `punos.png` | 1:2 (ej. 400×800) | Antebrazo con manga de suéter azul marino y puño cerrado arriba, visto desde atrás, saliendo desde abajo |
| `mochila.png` | 2:3 (ej. 400×600) | Mochila escolar azul con bolsillo frontal, sostenida por la correa desde arriba |
| `pelota.png` | 1:1 (ej. 400×400) | Pelota de educación física roja/naranja, sola |
| `extintor.png` | 2:5 (ej. 400×1000) | Extintor rojo con manguera y boquilla, visto desde atrás |

### Objeto (assets/imagenes/items/)

| Archivo | Proporción | Qué dibujar |
|---|---|---|
| `colacion.png` | 3:2 (ej. 300×200) | Sándwich (pan, lechuga, tomate), visto de lado |

### Dónde poner lo que te dio

1. Si la IA no pudo dar fondo transparente, quítalo con una herramienta gratis
   (por ejemplo remove.bg o "quitar fondo" en Canva) y descarga como **PNG**.
2. Renombra cada archivo con el nombre exacto de las tablas.
3. Reemplaza los archivos en la carpeta `assets/imagenes/` (en GitHub: entra a la carpeta, **Add file → Upload files**).
4. Abre `index.html`. Si falta alguna imagen, saldrá un cuadro amarillo con los nombres.

**Consejos:** el tamaño exacto no importa (el juego los ajusta sin deformarlos), pero si la imagen
tiene mucho espacio vacío alrededor, el personaje se verá chico. Mantén los personajes parados de frente.

---

## 2. El mapa

El mapa es texto: cada letra es una casilla. Va en `assets/mapa.js`.

### Texto para pegarle a la IA

```
Necesito que diseñes el mapa de un videojuego como una cuadrícula de texto. Responde SOLO
con la cuadrícula dentro de un bloque de código, sin comillas, sin comas y sin explicaciones.

Tamaño: 64 columnas por 40 filas (TODAS las filas deben tener exactamente 64 caracteres).

Letras:
#  muro de casilleros (interior)
.  pasillo o sala interior (con techo)
,  patio abierto (con cielo)
1  pilar o contenedor (obstáculo de 1 casilla, sirve para esconderse)
W  ventana al puerto (solo en el muro exterior, pegada a un pasillo interior)
L  salvavidas en la pared (solo en el muro exterior, pegado a un pasillo interior)
B  muro de ladrillo (los muros que dan al patio abierto)
2  puerta de sala decorativa (en muros que dan a un pasillo)
S  inicio del jugador: pon UNA sola S, sobre una casilla libre (. o ,)

Reglas:
- Rodea TODO el mapa con muros (# o B), sin huecos al borde.
- Todo lo libre (. y ,) debe estar conectado: desde la S se debe poder llegar a cualquier parte.
- Pasillos de 2 casillas de ancho para que se pueda maniobrar.
- Incluye: un edificio con pasillos en cuadrícula, un patio abierto grande con contenedores (1)
  para esconderse, y un gimnasio (sala grande abierta con pilares).
- Ambiente: escuela portuaria de Valparaíso, con ventanas (W) y salvavidas (L) en los muros exteriores.
- Los muros que tocan el patio (,) deben ser B.
```

### Dónde poner lo que te dio

1. Abre `assets/mapa.js` en un editor de texto.
2. Borra las filas que están **entre las comillas invertidas** (`` ` ``), justo después de `mapa: ` `` ` `` .
3. Pega ahí la cuadrícula nueva, una fila por línea (la primera línea después de `` ` `` puede quedar vacía).
4. Guarda y abre `index.html`.

Si el mapa tiene algún problema, el juego **no arranca** y muestra un cuadro rojo con lo que hay que arreglar, por ejemplo:

- "La fila 4 tiene 61 caracteres y debería tener 64"
- "Carácter no válido "X" en la fila 6, columna 6"
- "Hay más de una S"
- "El punto de inicio cae sobre un muro"

Copia ese mensaje y pégaselo a la IA: *"Arregla estos errores del mapa y dame la cuadrícula completa corregida."*

> Las IA suelen equivocarse contando columnas. Si el error es de largo de filas, pídele
> que "rellene o recorte cada fila a exactamente 64 caracteres".
