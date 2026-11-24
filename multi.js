// ############################################################
// ## MULTIJUGADOR COOPERATIVO (hasta 6 jugadores)
// ## Usa PeerJS (WebRTC): uno crea la sala (anfitrión) y los demás entran con el código.
// ## El anfitrión corre el juego completo; los demás reciben lo que pasa y mandan sus movimientos y disparos.
// ############################################################

(function () {
  const MAX_JUGADORES = 6;                       // anfitrión + 5
  const HZ_SNAP = 12, HZ_POS = 20;               // cuántas veces por segundo se envía el estado / tu posición
  const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

  let peer = null, conn = null;                  // peer propio; conn = conexión al anfitrión (solo cliente)
  let codigo = '', snapT = 0, posT = 0;
  const $ = id => document.getElementById(id);

  // ---------------- Pantalla de sala ----------------
  const css = document.createElement('style');
  css.textContent = `
  #sala{position:fixed;inset:0;z-index:30;background:radial-gradient(ellipse at center,rgba(40,0,0,.9),rgba(8,0,0,.97)),url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%27600%27%20height%3D%27600%27%3E%3Cg%20fill%3D%27%236e0a0a%27%20fill-opacity%3D%27.55%27%3E%3Ccircle%20cx%3D%27381%27%20cy%3D%2788%27%20r%3D%2752%27/%3E%3Ccircle%20cx%3D%27363%27%20cy%3D%27155%27%20r%3D%278%27/%3E%3Ccircle%20cx%3D%27406%27%20cy%3D%2747%27%20r%3D%274%27/%3E%3Ccircle%20cx%3D%27340%27%20cy%3D%27105%27%20r%3D%276%27/%3E%3Ccircle%20cx%3D%27299%27%20cy%3D%27124%27%20r%3D%276%27/%3E%3Ccircle%20cx%3D%27278%27%20cy%3D%2758%27%20r%3D%276%27/%3E%3Ccircle%20cx%3D%27472%27%20cy%3D%27114%27%20r%3D%275%27/%3E%3Crect%20x%3D%27379%27%20y%3D%2788%27%20width%3D%274%27%20height%3D%27104%27/%3E%3Ccircle%20cx%3D%27433%27%20cy%3D%27295%27%20r%3D%2741%27/%3E%3Ccircle%20cx%3D%27466%27%20cy%3D%27254%27%20r%3D%275%27/%3E%3Ccircle%20cx%3D%27429%27%20cy%3D%27279%27%20r%3D%272%27/%3E%3Ccircle%20cx%3D%27371%27%20cy%3D%27224%27%20r%3D%279%27/%3E%3Ccircle%20cx%3D%27511%27%20cy%3D%27284%27%20r%3D%2710%27/%3E%3Ccircle%20cx%3D%27487%27%20cy%3D%27333%27%20r%3D%277%27/%3E%3Ccircle%20cx%3D%27388%27%20cy%3D%27263%27%20r%3D%273%27/%3E%3Crect%20x%3D%27431%27%20y%3D%27295%27%20width%3D%274%27%20height%3D%2793%27/%3E%3Ccircle%20cx%3D%27207%27%20cy%3D%27451%27%20r%3D%2731%27/%3E%3Ccircle%20cx%3D%27168%27%20cy%3D%27434%27%20r%3D%278%27/%3E%3Ccircle%20cx%3D%27240%27%20cy%3D%27464%27%20r%3D%277%27/%3E%3Ccircle%20cx%3D%27226%27%20cy%3D%27460%27%20r%3D%275%27/%3E%3Ccircle%20cx%3D%27260%27%20cy%3D%27430%27%20r%3D%273%27/%3E%3Ccircle%20cx%3D%27252%27%20cy%3D%27396%27%20r%3D%275%27/%3E%3Ccircle%20cx%3D%27180%27%20cy%3D%27486%27%20r%3D%275%27/%3E%3Crect%20x%3D%27205%27%20y%3D%27451%27%20width%3D%274%27%20height%3D%2738%27/%3E%3Ccircle%20cx%3D%27339%27%20cy%3D%27181%27%20r%3D%2732%27/%3E%3Ccircle%20cx%3D%27392%27%20cy%3D%27123%27%20r%3D%272%27/%3E%3Ccircle%20cx%3D%27366%27%20cy%3D%27138%27%20r%3D%276%27/%3E%3Ccircle%20cx%3D%27358%27%20cy%3D%27121%27%20r%3D%277%27/%3E%3Ccircle%20cx%3D%27348%27%20cy%3D%27199%27%20r%3D%274%27/%3E%3Ccircle%20cx%3D%27380%27%20cy%3D%27136%27%20r%3D%276%27/%3E%3Ccircle%20cx%3D%27324%27%20cy%3D%27230%27%20r%3D%276%27/%3E%3Crect%20x%3D%27337%27%20y%3D%27181%27%20width%3D%274%27%20height%3D%2749%27/%3E%3Ccircle%20cx%3D%27256%27%20cy%3D%27390%27%20r%3D%2752%27/%3E%3Ccircle%20cx%3D%27192%27%20cy%3D%27370%27%20r%3D%272%27/%3E%3Ccircle%20cx%3D%27245%27%20cy%3D%27297%27%20r%3D%279%27/%3E%3Ccircle%20cx%3D%27195%27%20cy%3D%27379%27%20r%3D%277%27/%3E%3Ccircle%20cx%3D%27226%27%20cy%3D%27432%27%20r%3D%273%27/%3E%3Ccircle%20cx%3D%27264%27%20cy%3D%27339%27%20r%3D%278%27/%3E%3Ccircle%20cx%3D%27205%27%20cy%3D%27315%27%20r%3D%272%27/%3E%3Crect%20x%3D%27254%27%20y%3D%27390%27%20width%3D%274%27%20height%3D%2759%27/%3E%3Ccircle%20cx%3D%2756%27%20cy%3D%27172%27%20r%3D%2752%27/%3E%3Ccircle%20cx%3D%27125%27%20cy%3D%27106%27%20r%3D%272%27/%3E%3Ccircle%20cx%3D%2791%27%20cy%3D%27193%27%20r%3D%275%27/%3E%3Ccircle%20cx%3D%2734%27%20cy%3D%2777%27%20r%3D%273%27/%3E%3Ccircle%20cx%3D%2787%27%20cy%3D%27142%27%20r%3D%278%27/%3E%3Ccircle%20cx%3D%27118%27%20cy%3D%27119%27%20r%3D%279%27/%3E%3Ccircle%20cx%3D%273%27%20cy%3D%27129%27%20r%3D%279%27/%3E%3Crect%20x%3D%2754%27%20y%3D%27172%27%20width%3D%274%27%20height%3D%27104%27/%3E%3Ccircle%20cx%3D%27503%27%20cy%3D%2737%27%20r%3D%2728%27/%3E%3Ccircle%20cx%3D%27500%27%20cy%3D%2737%27%20r%3D%275%27/%3E%3Ccircle%20cx%3D%27529%27%20cy%3D%2735%27%20r%3D%275%27/%3E%3Ccircle%20cx%3D%27510%27%20cy%3D%275%27%20r%3D%272%27/%3E%3Ccircle%20cx%3D%27451%27%20cy%3D%2713%27%20r%3D%276%27/%3E%3Ccircle%20cx%3D%27478%27%20cy%3D%2748%27%20r%3D%275%27/%3E%3Ccircle%20cx%3D%27545%27%20cy%3D%2710%27%20r%3D%278%27/%3E%3Crect%20x%3D%27501%27%20y%3D%2737%27%20width%3D%274%27%20height%3D%2783%27/%3E%3Ccircle%20cx%3D%27267%27%20cy%3D%27145%27%20r%3D%2734%27/%3E%3Ccircle%20cx%3D%27212%27%20cy%3D%27157%27%20r%3D%273%27/%3E%3Ccircle%20cx%3D%27302%27%20cy%3D%2787%27%20r%3D%279%27/%3E%3Ccircle%20cx%3D%27298%27%20cy%3D%27100%27%20r%3D%278%27/%3E%3Ccircle%20cx%3D%27252%27%20cy%3D%27119%27%20r%3D%277%27/%3E%3Ccircle%20cx%3D%27274%27%20cy%3D%27197%27%20r%3D%277%27/%3E%3Ccircle%20cx%3D%27306%27%20cy%3D%27212%27%20r%3D%275%27/%3E%3Crect%20x%3D%27265%27%20y%3D%27145%27%20width%3D%274%27%20height%3D%2768%27/%3E%3Ccircle%20cx%3D%27346%27%20cy%3D%27401%27%20r%3D%2745%27/%3E%3Ccircle%20cx%3D%27275%27%20cy%3D%27382%27%20r%3D%275%27/%3E%3Ccircle%20cx%3D%27267%27%20cy%3D%27412%27%20r%3D%274%27/%3E%3Ccircle%20cx%3D%27324%27%20cy%3D%27481%27%20r%3D%272%27/%3E%3Ccircle%20cx%3D%27298%27%20cy%3D%27487%27%20r%3D%279%27/%3E%3Ccircle%20cx%3D%27401%27%20cy%3D%27431%27%20r%3D%278%27/%3E%3Ccircle%20cx%3D%27355%27%20cy%3D%27366%27%20r%3D%272%27/%3E%3Crect%20x%3D%27344%27%20y%3D%27401%27%20width%3D%274%27%20height%3D%2772%27/%3E%3Ccircle%20cx%3D%27160%27%20cy%3D%2713%27%20r%3D%2753%27/%3E%3Ccircle%20cx%3D%27119%27%20cy%3D%27-64%27%20r%3D%278%27/%3E%3Ccircle%20cx%3D%27261%27%20cy%3D%27104%27%20r%3D%278%27/%3E%3Ccircle%20cx%3D%27110%27%20cy%3D%2747%27%20r%3D%272%27/%3E%3Ccircle%20cx%3D%27105%27%20cy%3D%27-52%27%20r%3D%277%27/%3E%3Ccircle%20cx%3D%27263%27%20cy%3D%2750%27%20r%3D%279%27/%3E%3Ccircle%20cx%3D%27188%27%20cy%3D%2719%27%20r%3D%272%27/%3E%3Crect%20x%3D%27158%27%20y%3D%2713%27%20width%3D%274%27%20height%3D%2763%27/%3E%3Ccircle%20cx%3D%2735%27%20cy%3D%27115%27%20r%3D%2745%27/%3E%3Ccircle%20cx%3D%2788%27%20cy%3D%2790%27%20r%3D%274%27/%3E%3Ccircle%20cx%3D%27-45%27%20cy%3D%27117%27%20r%3D%273%27/%3E%3Ccircle%20cx%3D%2778%27%20cy%3D%2727%27%20r%3D%276%27/%3E%3Ccircle%20cx%3D%2733%27%20cy%3D%2744%27%20r%3D%273%27/%3E%3Ccircle%20cx%3D%2784%27%20cy%3D%27141%27%20r%3D%278%27/%3E%3Ccircle%20cx%3D%27-3%27%20cy%3D%27104%27%20r%3D%278%27/%3E%3Crect%20x%3D%2733%27%20y%3D%27115%27%20width%3D%274%27%20height%3D%2774%27/%3E%3Ccircle%20cx%3D%27498%27%20cy%3D%27409%27%20r%3D%2720%27/%3E%3Ccircle%20cx%3D%27467%27%20cy%3D%27383%27%20r%3D%277%27/%3E%3Ccircle%20cx%3D%27523%27%20cy%3D%27424%27%20r%3D%278%27/%3E%3Ccircle%20cx%3D%27514%27%20cy%3D%27377%27%20r%3D%275%27/%3E%3Ccircle%20cx%3D%27496%27%20cy%3D%27430%27%20r%3D%278%27/%3E%3Ccircle%20cx%3D%27473%27%20cy%3D%27440%27%20r%3D%274%27/%3E%3Ccircle%20cx%3D%27505%27%20cy%3D%27389%27%20r%3D%274%27/%3E%3Crect%20x%3D%27496%27%20y%3D%27409%27%20width%3D%274%27%20height%3D%2729%27/%3E%3Ccircle%20cx%3D%27334%27%20cy%3D%27506%27%20r%3D%2735%27/%3E%3Ccircle%20cx%3D%27330%27%20cy%3D%27574%27%20r%3D%272%27/%3E%3Ccircle%20cx%3D%27307%27%20cy%3D%27437%27%20r%3D%276%27/%3E%3Ccircle%20cx%3D%27294%27%20cy%3D%27575%27%20r%3D%273%27/%3E%3Ccircle%20cx%3D%27388%27%20cy%3D%27559%27%20r%3D%2710%27/%3E%3Ccircle%20cx%3D%27283%27%20cy%3D%27569%27%20r%3D%275%27/%3E%3Ccircle%20cx%3D%27369%27%20cy%3D%27511%27%20r%3D%277%27/%3E%3Crect%20x%3D%27332%27%20y%3D%27506%27%20width%3D%274%27%20height%3D%2764%27/%3E%3Ccircle%20cx%3D%27184%27%20cy%3D%271%27%20r%3D%2757%27/%3E%3Ccircle%20cx%3D%2783%27%20cy%3D%2743%27%20r%3D%277%27/%3E%3Ccircle%20cx%3D%27209%27%20cy%3D%276%27%20r%3D%276%27/%3E%3Ccircle%20cx%3D%27292%27%20cy%3D%2716%27%20r%3D%279%27/%3E%3Ccircle%20cx%3D%27226%27%20cy%3D%2745%27%20r%3D%279%27/%3E%3Ccircle%20cx%3D%27170%27%20cy%3D%27-77%27%20r%3D%276%27/%3E%3Ccircle%20cx%3D%27267%27%20cy%3D%2739%27%20r%3D%277%27/%3E%3Crect%20x%3D%27182%27%20y%3D%271%27%20width%3D%274%27%20height%3D%27141%27/%3E%3Ccircle%20cx%3D%27348%27%20cy%3D%27136%27%20r%3D%2741%27/%3E%3Ccircle%20cx%3D%27287%27%20cy%3D%27209%27%20r%3D%274%27/%3E%3Ccircle%20cx%3D%27425%27%20cy%3D%2799%27%20r%3D%276%27/%3E%3Ccircle%20cx%3D%27361%27%20cy%3D%27104%27%20r%3D%277%27/%3E%3Ccircle%20cx%3D%27424%27%20cy%3D%2777%27%20r%3D%273%27/%3E%3Ccircle%20cx%3D%27369%27%20cy%3D%2799%27%20r%3D%277%27/%3E%3Ccircle%20cx%3D%27361%27%20cy%3D%27137%27%20r%3D%274%27/%3E%3Crect%20x%3D%27346%27%20y%3D%27136%27%20width%3D%274%27%20height%3D%2779%27/%3E%3Ccircle%20cx%3D%2723%27%20cy%3D%2720%27%20r%3D%2747%27/%3E%3Ccircle%20cx%3D%27-49%27%20cy%3D%2717%27%20r%3D%273%27/%3E%3Ccircle%20cx%3D%27-31%27%20cy%3D%27-28%27%20r%3D%279%27/%3E%3Ccircle%20cx%3D%2798%27%20cy%3D%2772%27%20r%3D%273%27/%3E%3Ccircle%20cx%3D%27-42%27%20cy%3D%27-30%27%20r%3D%279%27/%3E%3Ccircle%20cx%3D%27101%27%20cy%3D%27-18%27%20r%3D%276%27/%3E%3Ccircle%20cx%3D%27105%27%20cy%3D%2729%27%20r%3D%275%27/%3E%3Crect%20x%3D%2721%27%20y%3D%2720%27%20width%3D%274%27%20height%3D%27109%27/%3E%3C/g%3E%3C/svg%3E");display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;color:#eee;touch-action:auto}
  #sala .caja{width:min(92vw,430px);max-height:94vh;overflow:auto;position:relative;background:linear-gradient(#1c0b0b,#0f0505);border:2px solid #7a0f0f;border-radius:6px;box-shadow:0 0 0 1px #2a0505,0 0 30px rgba(180,0,0,.55),inset 0 0 40px rgba(120,0,0,.35);padding:34px 16px 16px;touch-action:auto;user-select:text}
  #sala h2{margin:0 0 4px;color:#c8140f;font:900 30px Impact,'Arial Black',sans-serif;letter-spacing:3px;text-transform:uppercase;text-align:center;text-shadow:0 2px 0 #3a0000,0 0 14px rgba(200,0,0,.7);position:relative;padding-bottom:20px}
  #sala h2::after{content:'';position:absolute;left:-6px;right:-6px;top:78%;height:34px;background:url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%27300%27%20height%3D%2734%27%20viewBox%3D%270%200%20300%2034%27%20preserveAspectRatio%3D%27none%27%3E%3Cg%20fill%3D%27%239b0f0f%27%3E%3Crect%20x%3D%278%27%20y%3D%270%27%20width%3D%274%27%20height%3D%2713%27/%3E%3Ccircle%20cx%3D%2710.0%27%20cy%3D%2713%27%20r%3D%273.0%27/%3E%3Crect%20x%3D%2727%27%20y%3D%270%27%20width%3D%275%27%20height%3D%279%27/%3E%3Ccircle%20cx%3D%2729.5%27%20cy%3D%279%27%20r%3D%273.75%27/%3E%3Crect%20x%3D%2746%27%20y%3D%270%27%20width%3D%274%27%20height%3D%2718%27/%3E%3Ccircle%20cx%3D%2748.0%27%20cy%3D%2718%27%20r%3D%273.0%27/%3E%3Crect%20x%3D%2765%27%20y%3D%270%27%20width%3D%273%27%20height%3D%2710%27/%3E%3Ccircle%20cx%3D%2766.5%27%20cy%3D%2710%27%20r%3D%272.25%27/%3E%3Crect%20x%3D%2784%27%20y%3D%270%27%20width%3D%273%27%20height%3D%278%27/%3E%3Ccircle%20cx%3D%2785.5%27%20cy%3D%278%27%20r%3D%272.25%27/%3E%3Crect%20x%3D%27103%27%20y%3D%270%27%20width%3D%275%27%20height%3D%2718%27/%3E%3Ccircle%20cx%3D%27105.5%27%20cy%3D%2718%27%20r%3D%273.75%27/%3E%3Crect%20x%3D%27122%27%20y%3D%270%27%20width%3D%273%27%20height%3D%2715%27/%3E%3Ccircle%20cx%3D%27123.5%27%20cy%3D%2715%27%20r%3D%272.25%27/%3E%3Crect%20x%3D%27141%27%20y%3D%270%27%20width%3D%275%27%20height%3D%2713%27/%3E%3Ccircle%20cx%3D%27143.5%27%20cy%3D%2713%27%20r%3D%273.75%27/%3E%3Crect%20x%3D%27160%27%20y%3D%270%27%20width%3D%274%27%20height%3D%2723%27/%3E%3Ccircle%20cx%3D%27162.0%27%20cy%3D%2723%27%20r%3D%273.0%27/%3E%3Crect%20x%3D%27179%27%20y%3D%270%27%20width%3D%273%27%20height%3D%2714%27/%3E%3Ccircle%20cx%3D%27180.5%27%20cy%3D%2714%27%20r%3D%272.25%27/%3E%3Crect%20x%3D%27198%27%20y%3D%270%27%20width%3D%274%27%20height%3D%279%27/%3E%3Ccircle%20cx%3D%27200.0%27%20cy%3D%279%27%20r%3D%273.0%27/%3E%3Crect%20x%3D%27217%27%20y%3D%270%27%20width%3D%273%27%20height%3D%2712%27/%3E%3Ccircle%20cx%3D%27218.5%27%20cy%3D%2712%27%20r%3D%272.25%27/%3E%3Crect%20x%3D%27236%27%20y%3D%270%27%20width%3D%274%27%20height%3D%2726%27/%3E%3Ccircle%20cx%3D%27238.0%27%20cy%3D%2726%27%20r%3D%273.0%27/%3E%3Crect%20x%3D%27255%27%20y%3D%270%27%20width%3D%273%27%20height%3D%2714%27/%3E%3Ccircle%20cx%3D%27256.5%27%20cy%3D%2714%27%20r%3D%272.25%27/%3E%3Crect%20x%3D%27274%27%20y%3D%270%27%20width%3D%274%27%20height%3D%2711%27/%3E%3Ccircle%20cx%3D%27276.0%27%20cy%3D%2711%27%20r%3D%273.0%27/%3E%3Crect%20x%3D%27293%27%20y%3D%270%27%20width%3D%275%27%20height%3D%2715%27/%3E%3Ccircle%20cx%3D%27295.5%27%20cy%3D%2715%27%20r%3D%273.75%27/%3E%3C/g%3E%3C/svg%3E") center top/100% 100% no-repeat;pointer-events:none}
  #sala .caja::before{content:'';position:absolute;left:0;right:0;top:0;height:14px;background:linear-gradient(#5a0606,#2a0303);border-radius:4px 4px 0 0}
  #sala p.sub{margin:16px 0 12px;text-align:center;color:#b08a8a;font-size:13px}
  #sala input[type=text]{width:100%;padding:10px;font-size:16px;border-radius:8px;border:2px solid #5a1212;background:#0c0404;color:#fff;text-transform:none}
  #sala input[type=text]:focus{outline:none;border-color:#c8140f;box-shadow:0 0 10px rgba(200,20,15,.6)}
  #sala .fila{display:flex;gap:8px;margin:8px 0}
  #sala button{width:auto;height:auto;min-height:44px;padding:8px 14px;font-size:15px;border-radius:6px;border:2px solid #5a1a1a;background:linear-gradient(#3a1a1a,#220d0d);color:#f3dede;flex:1;font-weight:bold;letter-spacing:.5px;text-transform:uppercase;cursor:pointer}
  #sala button:hover:not(:disabled){border-color:#d02a20;box-shadow:0 0 12px rgba(200,20,15,.55)}
  #sala button.pri{background:linear-gradient(#c01a14,#7a0b08);border-color:#ff3b2d;color:#fff;text-shadow:0 1px 0 #3a0000}
  #sala button:disabled{opacity:.45}
  #sala .cod{font:bold 34px monospace;text-align:center;letter-spacing:3px;color:#ff4a3a;background:#0c0404;border:1px solid #5a1212;border-radius:6px;padding:8px;margin:8px 0;user-select:all}
  #sala ul{list-style:none;margin:8px 0;padding:0}
  #sala li{padding:6px 8px;margin:3px 0;background:#0c0404;border-left:3px solid #8a0f0f;border-radius:4px;display:flex;align-items:center;gap:8px;font-size:15px}
  #sala li i{width:12px;height:12px;border-radius:50%;display:inline-block}
  #sala .est{min-height:20px;text-align:center;font-size:14px;color:#ffd24a;margin:6px 0}
  #sala label{display:flex;gap:8px;align-items:center;font-size:15px;margin:8px 0}
  #sala label input{width:20px;height:20px}
  #sala .peq{font-size:12px;color:#a07070;text-align:center;margin-top:8px}
  `;
  document.head.appendChild(css);
  const sala = document.createElement('div');
  sala.id = 'sala';
  sala.innerHTML = `<div class="caja">
    <h2>GUERRA ANFIBIA</h2><p class="sub">Elige cómo jugar · hasta ${MAX_JUGADORES} jugadores en equipo</p>
    <div id="s-inicio">
      <input id="s-nombre" type="text" maxlength="10" placeholder="Tu nombre" autocomplete="off">
      <div class="fila"><button id="s-solo" class="pri">Un jugador</button></div>
      <div class="fila"><button id="s-crear">Crear sala</button></div>
      <div class="fila"><input id="s-cod" type="text" maxlength="8" placeholder="Código (GA-XXXXX)" autocomplete="off" autocapitalize="characters" style="flex:2"><button id="s-unir">Unirse</button></div>
    </div>
    <div id="s-dentro" style="display:none">
      <div id="s-codbox"><div class="peq">Código de la sala (pásaselo a tus amigos)</div><div class="cod" id="s-codigo"></div></div>
      <ul id="s-lista"></ul>
      <label id="s-fa-fila"><input type="checkbox" id="s-fa"> Fuego amigo (los disparos también dañan a tus compañeros)</label>
      <div id="s-fa-txt" class="est" style="display:none"></div>
      <div class="fila"><button id="s-ini" class="pri">Empezar partida</button><button id="s-salir">Salir</button></div>
    </div>
    <div class="est" id="s-est"></div>
    <div class="peq">Modo cooperativo: todos contra los enemigos. Necesita internet.</div>
  </div>`;
  document.body.appendChild(sala);
  const est = t => { $('s-est').textContent = t || ''; };
  MP.lobby = true;
  try { $('s-nombre').value = localStorage.getItem('ga_nombre') || ''; } catch (e) {}
  const qs = new URLSearchParams(location.search);
  if (qs.get('sala')) $('s-cod').value = qs.get('sala').toUpperCase();

  function miNombre() {
    const n = ($('s-nombre').value || '').trim().slice(0, 10) || 'Marino';
    try { localStorage.setItem('ga_nombre', n); } catch (e) {}
    return n;
  }
  function mostrar(dentro) { $('s-inicio').style.display = dentro ? 'none' : ''; $('s-dentro').style.display = dentro ? '' : 'none'; }
  function ocultarSala() { MP.lobby = false; sala.style.display = 'none'; }
  function mostrarSala() { MP.lobby = true; sala.style.display = 'flex'; }

  function pintarLista() {
    const ul = $('s-lista'); ul.innerHTML = '';
    for (let i = 0; i < MAX_JUGADORES; i++) {
      const li = document.createElement('li');
      const nombre = MP.nombres[i];
      const b = document.createElement('i'); b.style.background = nombre ? COLORES_JUGADOR[i] : '#333'; li.appendChild(b);
      const t = document.createElement('span'); t.textContent = nombre ? nombre + (i === 0 ? ' (anfitrión)' : '') + (i === MP.miIdx ? ' · tú' : '') : '— libre —';
      if (!nombre) t.style.opacity = .4;
      li.appendChild(t); ul.appendChild(li);
    }
    $('s-fa').checked = MP.fuegoAmigo;
  }

  // ---------------- Utilidades de red ----------------
  function enviar(c, m) { try { if (c && c.open) c.send(m); } catch (e) {} }
  function aTodos(m) { for (const o of MP.otros) enviar(o.conn, m); }
  MP.enviarA = (P, m) => enviar(P.conn, m);
  const r2 = v => Math.round(v * 100) / 100;

  function cerrarTodo() {
    try { if (conn) conn.close(); } catch (e) {}
    try { if (peer) peer.destroy(); } catch (e) {}
    peer = null; conn = null; MP.otros = []; MP.rol = 'solo'; MP.nombres = []; MP.miIdx = 0; MP.fuegoAmigo = false;
  }
  function volverASala(texto) {
    cerrarTodo();
    state = 'menu'; enemies = []; items = []; player.muerto = false;
    mostrar(false); mostrarSala(); est(texto);
  }

  // ---------------- Botones ----------------
  function listo() {
    if (MP.listo) return true;
    est('Cargando el juego… espera un momento'); return false;
  }
  $('s-solo').onclick = () => { if (!listo()) return; cerrarTodo(); player.nombre = miNombre(); ocultarSala(); resetGame(); };
  $('s-salir').onclick = () => { volverASala(''); };
  $('s-crear').onclick = () => { if (listo()) crearSala(0); };
  $('s-unir').onclick = () => {
    if (!listo()) return;
    const c = ($('s-cod').value || '').trim().toUpperCase().replace(/\s+/g, '');
    if (c.length < 4) { est('Escribe el código de la sala'); return; }
    unirse(c.startsWith('GA-') ? c : 'GA-' + c);
  };
  $('s-ini').onclick = () => { if (MP.rol === 'host' && listo()) { ocultarSala(); resetGame(); MP.anunciarInicio(); } };
  $('s-fa').onchange = () => { if (MP.rol === 'host') { MP.fuegoAmigo = $('s-fa').checked; avisarSala(); } };

  // Servidores para atravesar routers/redes móviles (STUN) y, si no queda otra, retransmitir (TURN gratuito de OpenRelay)
  const OPC_PEER = { debug: 1, config: { iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turns:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' } ] } };
  function textoError(err) {
    const t = err && err.type || err;
    if (t === 'peer-unavailable') return 'No existe esa sala. Revisa el código.';
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'No se pudo contactar el servidor de salas (PeerJS). Revisa tu internet y vuelve a intentar.';
    if (t === 'browser-incompatible') return 'Tu navegador no soporta conexión directa (WebRTC). Prueba con Chrome.';
    return 'Error de conexión: ' + t;
  }

  // ---------------- ANFITRIÓN ----------------
  function nuevoCodigo() { let c = 'GA-'; for (let i = 0; i < 5; i++) c += LETRAS[Math.floor(Math.random() * LETRAS.length)]; return c; }

  function crearSala(intento) {
    cerrarTodo(); est('Creando sala…');
    player.nombre = miNombre();
    codigo = nuevoCodigo();
    try { peer = new Peer(codigo, OPC_PEER); } catch (e) { est('No se pudo cargar PeerJS (¿sin internet?)'); return; }
    MP.rol = 'host'; MP.miIdx = 0; MP.nombres = [player.nombre];
    peer.on('open', () => {
      mostrar(true); est('');
      $('s-codigo').textContent = codigo; $('s-codbox').style.display = '';
      $('s-fa-fila').style.display = ''; $('s-fa-txt').style.display = 'none'; $('s-ini').style.display = '';
      pintarLista();
    });
    peer.on('connection', c => nuevaConexion(c));
    peer.on('error', err => {
      if (err.type === 'unavailable-id' && intento < 5) { crearSala(intento + 1); return; }
      volverASala(textoError(err));
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
  }

  function nombresLista() { const n = []; n[0] = player.nombre; for (const o of MP.otros) n[o.idx] = o.nombre; return Array.from(n, v => v || null); }
  function avisarSala() {
    MP.nombres = nombresLista(); pintarLista();
    aTodos({ t: 'lobby', n: MP.nombres, fa: MP.fuegoAmigo });
  }

  function nuevaConexion(c) {
    let o = null;
    c.on('data', m => {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'hola') {
        if (o) return;
        let idx = 0; const usados = new Set(MP.otros.map(x => x.idx));
        for (let i = 1; i < MAX_JUGADORES; i++) if (!usados.has(i)) { idx = i; break; }
        if (!idx) { enviar(c, { t: 'lleno' }); setTimeout(() => { try { c.close(); } catch (e) {} }, 400); return; }
        o = { idx, conn: c, nombre: String(m.nombre || 'Marino').slice(0, 10), x: INICIO.x, y: INICIO.y, tx: INICIO.x, ty: INICIO.y, a: 0, hp: CONFIG.vidaInicial,
              weapon: 0, muerto: false, resp: 0, conectado: true, mov: false, golpe: 0, atkAnim: 0, walkT: 0, fT: 0 };
        MP.otros.push(o);
        enviar(c, { t: 'ok', idx, n: nombresLista(), fa: MP.fuegoAmigo });
        avisarSala();
        if (state === 'play') { colocar(o); enviar(c, { t: 'ini', fa: MP.fuegoAmigo, idx, x: o.x, y: o.y, a: o.a, n: MP.nombres }); }   // entra con la partida en marcha
      } else if (!o) return;
      else if (m.t === 'p') {
        o.tx = +m.x || o.tx; o.ty = +m.y || o.ty; o.a = +m.a || 0; o.weapon = m.w | 0; o.mov = !!m.m;
        if (o.veh && o.veh.k === 'barco') { o.veh.o.cmd = Array.isArray(m.d) ? [Math.sign(m.d[0] | 0), Math.sign(m.d[1] | 0)] : null; o.veh.o.cmdT = 0.3; }
      } else if (m.t === 'v') {                                   // subir / bajar de un vehículo
        if (state !== 'play' || o.muerto) return;
        const lista = m.k === 'barco' ? BOATS : (m.k === 'camion' || m.k === 'tanque') ? CAM : CAN;
        const ob = lista.find(q => q.id === m.i);
        if (!ob) return;
        if (m.on) {
          const pes = m.k === 'camion' || m.k === 'tanque';
          if (pes && ob.piloto >= 0 && ob.piloto !== o.idx && !(ob.pas && ob.pas.includes(o.idx)) && ocupantes(ob) < CAPACIDAD[m.k]) {   // sube de pasajero
            liberar(o); ob.pas = ob.pas || []; ob.pas.push(o.idx); o.veh = { k: m.k, o: ob, pas: true }; return;
          }
          if ((ob.piloto >= 0 && ob.piloto !== o.idx) || ob.op) { enviar(c, { t: 'vno' }); return; }
          liberar(o); ob.piloto = o.idx; o.veh = { k: m.k, o: ob };
        } else if (o.veh && o.veh.o === ob) liberar(o);
      } else if (m.t === 'f' && m.c) {                             // disparo de cañón (barco o torre)
        if (state !== 'play' || o.muerto || o.fT > 0 || !o.veh || o.veh.k !== m.k || o.veh.o.id !== m.i) return;
        const v = o.veh;
        if (v.o.tipo === 'ametra') { o.fT = 0.08; v.o.flash = 0.08; disparoBalas(o.x, o.y, +m.a || 0, ARMA_FIJA, o); return; }
        o.fT = 1.0;
        const q = mundoPos(o);
        v.o.flash = 0.3; disparoCanon(q.x, q.y, +m.a || 0, o, 0, !!v.o.alto);
      } else if (m.t === 'aban') {
        if (state === 'play' && !o.muerto) { abandonoOk = 10; avisoEquipo('¡' + (o.nombre || 'Un jugador') + ' ORDENA ABANDONAR! Se escapa sin los que estén lejos (10 s)'); }
      } else if (m.t === 'f') {
        if (state !== 'play' || o.muerto || o.fT > 0) return;
        const w = WEAPONS[m.w | 0]; if (!w) return;
        o.fT = w.cd * 0.7; o.atkAnim = 0.3;
        disparoBalas(+m.x || o.x, +m.y || o.y, +m.a || 0, w, o);
      }
    });
    const salio = () => {
      if (!o) return;
      liberar(o);
      MP.otros = MP.otros.filter(x => x !== o);
      avisarSala();
      if (state === 'play' && MP.rol === 'host') msg = o.nombre + ' salió de la partida', msgT = 3;
      o = null;
    };
    c.on('close', salio); c.on('error', salio);
  }

  function colocar(o) {
    const c = reachable[Math.min(reachable.length - 1, o.idx)];
    o.x = o.tx = c[0] + 0.5; o.y = o.ty = c[1] + 0.5; o.a = INICIO.a; o.hp = CONFIG.vidaInicial; o.muerto = false; o.resp = 0; o.veh = null;
  }
  MP.colocarJugadores = () => { for (const o of MP.otros) colocar(o); };
  MP.anunciarInicio = () => {
    for (const o of MP.otros) enviar(o.conn, { t: 'ini', fa: MP.fuegoAmigo, idx: o.idx, x: o.x, y: o.y, a: o.a, n: MP.nombres });
  };
  MP.anunciarVictoria = (como, d) => aTodos({ t: 'gan', c: como, sc: score, k: kills, d });
  MP.enviarAbandono = () => enviar(conn, { t: 'aban' });
  MP.avisoTodos = t => aTodos({ t: 'msg', m: t });
  MP.anunciarFin = () => aTodos({ t: 'fin', sc: score, k: kills });
  MP.avisoAmigo = (v, duenio) => {
    const texto = (duenio.nombre || 'Un compañero') + ' te disparó (fuego amigo)';
    if (v === player) { msg = texto; msgT = 2; } else enviar(v.conn, { t: 'msg', m: texto });
  };
  MP.enviarVeh = (on, k, i) => enviar(conn, { t: 'v', on, k, i });
  MP.enviarCanon = (k, i, a) => enviar(conn, { t: 'f', c: 1, k, i, a: r2(a) });
  MP.avisarExplosion = (x, y) => aTodos({ t: 'x', x: r2(x), y: r2(y) });
  MP.enviarDisparo = (x, y, a, w) => enviar(conn, { t: 'f', x: r2(x), y: r2(y), a: r2(a), w });

  function snapshotHost() {
    const e = [];
    for (const n of enemies) e.push([n.id, Math.round(n.x * 100), Math.round(n.y * 100), n.type, n.v, n.pain > 0 ? 1 : 0, Math.round((n.atkAnim || 0) * 100), Math.round(Math.max(0, n.muriendo || 0) * 100)]);
    const j = [[0, Math.round(player.x * 100), Math.round(player.y * 100), Math.round(player.a * 100), Math.round(player.hp), weapon, player.muerto ? 1 : 0, punchT > 0 ? 1 : 0, player.mov ? 1 : 0, Math.ceil(player.resp)]];
    for (const o of MP.otros) j.push([o.idx, Math.round(o.x * 100), Math.round(o.y * 100), Math.round(o.a * 100), Math.round(o.hp), o.weapon, o.muerto ? 1 : 0, o.atkAnim > 0 ? 1 : 0, o.mov ? 1 : 0, Math.ceil(o.resp)]);
    return { t: 's', ms: masacre ? 1 : 0, k: kills, sc: score, e, b: BOATS.map(b => [b.x, b.y, b.piloto]), c: CAM.map(c => [Math.round(c.x * 100), Math.round(c.y * 100), Math.round(c.a * 100), c.piloto, c.pas || []]), cp: CAN.map(c => c.piloto), esc: [tieneLlaves ? 1 : 0, tieneMapa ? 1 : 0, HELI ? [r2(HELI.x), r2(HELI.y), r2(HELI.z), HELI.llego ? 1 : 0] : 0], p: pickups.map(o => o.idx), i: items.map(it => [Math.round(it.x * 100), Math.round(it.y * 100)]), j };
  }

  // ---------------- CLIENTE ----------------
  function unirse(c) {
    cerrarTodo(); est('Conectando…');
    player.nombre = miNombre();
    try { peer = new Peer(undefined, OPC_PEER); } catch (e) { est('No se pudo cargar PeerJS (¿sin internet?)'); return; }
    let abierto = false;
    const limite = setTimeout(() => { if (!abierto) volverASala('No se pudo conectar. Revisa el código o tu internet.'); }, 25000);
    peer.on('open', () => {
      conn = peer.connect(c, { reliable: true });
      conn.on('open', () => { abierto = true; clearTimeout(limite); MP.rol = 'cliente'; enviar(conn, { t: 'hola', nombre: player.nombre }); });
      conn.on('data', alRecibir);
      conn.on('close', () => { if (MP.rol === 'cliente') volverASala('El anfitrión cerró la sala.'); });
      conn.on('error', () => { if (MP.rol === 'cliente') volverASala('Se perdió la conexión.'); });
    });
    peer.on('error', err => {
      clearTimeout(limite);
      volverASala(textoError(err));
    });
  }

  function alRecibir(m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'ok') {
      MP.miIdx = m.idx; MP.nombres = m.n; MP.fuegoAmigo = !!m.fa;
      mostrar(true); est('Conectado. Espera a que el anfitrión empiece.');
      $('s-codigo').textContent = (conn && conn.peer) || ''; $('s-fa-fila').style.display = 'none';
      $('s-fa-txt').style.display = ''; $('s-fa-txt').textContent = 'Fuego amigo: ' + (MP.fuegoAmigo ? 'SÍ' : 'NO'); $('s-ini').style.display = 'none';
      pintarLista();
    } else if (m.t === 'lobby') {
      MP.nombres = m.n; MP.fuegoAmigo = !!m.fa; $('s-fa-txt').textContent = 'Fuego amigo: ' + (MP.fuegoAmigo ? 'SÍ' : 'NO'); pintarLista();
      for (const o of MP.otros) o.nombre = MP.nombres[o.idx] || o.nombre;
    } else if (m.t === 'lleno') {
      volverASala('La sala está llena (máximo ' + MAX_JUGADORES + ' jugadores).');
    } else if (m.t === 'ini') {
      MP.rol = 'cliente'; MP.fuegoAmigo = !!m.fa; MP.miIdx = m.idx; MP.nombres = m.n || MP.nombres; MP.otros = [];
      resetGame(); player.x = m.x; player.y = m.y; player.a = m.a || 0;
      ocultarSala();
    } else if (m.t === 's') {
      if (state === 'play') aplicarSnapshot(m);
    } else if (m.t === 'pk') {
      recogerLocal({ t: m.k, arma: m.i });
    } else if (m.t === 'rea') {
      player.muerto = false; player.x = m.x; player.y = m.y; player.hp = m.hp; player.resp = 0; msg = '¡REAPARECISTE!'; msgT = 2; reloadT = 0;
    } else if (m.t === 'x') {
      FX.push({ x: m.x, y: m.y, t: 0 }); sfx.explosion(Math.max(0.25, 1 - Math.hypot(m.x - player.x, m.y - player.y) / 40));
    } else if (m.t === 'vno') {
      liberar(player); msg = 'Ese vehículo ya está ocupado'; msgT = 2;
    } else if (m.t === 'msg') {
      msg = m.m; msgT = 2;
    } else if (m.t === 'gan') {
      score = m.sc; kills = m.k; victoria = m.c; meAbandonaron = !!(m.d && m.d.includes(MP.miIdx)); state = 'over'; overT = 2; causa = ''; firing = false;
    } else if (m.t === 'fin') {
      score = m.sc; kills = m.k; state = 'over'; overT = 2; causa = ''; firing = false;
    }
  }

  function aplicarSnapshot(m) {
    score = m.sc; kills = m.k; if (!!m.ms !== masacre) { masacre = !!m.ms; if (masacre) { masaT = 0; aviso('☠ LOS MUERTOS VIENEN POR TI. YA NO HAY ESCAPE.'); tiembla = 1.2; } }
    if (m.esc) {                                            // llaves, mapa y helicóptero del equipo
      tieneLlaves = !!m.esc[0]; tieneMapa = !!m.esc[1]; if (ESC[0]) ESC[0].ok = tieneLlaves; if (ESC[1]) ESC[1].ok = tieneMapa;
      const h = m.esc[2]; HELI = h ? { x: h[0], y: h[1], tx: h[0], ty: h[1], z: h[2], llego: !!h[3], resc: 0 } : null;
    }
    // rivales
    const vistos = new Set(), previos = new Map(enemies.map(e => [e.id, e]));
    const nuevos = [];
    for (const d of m.e) {
      const [id, x, y, type, v, pain, atk, mu] = d;
      let e = previos.get(id);
      if (!e) e = { id, x: x / 100, y: y / 100, type, v, hp: 1, atk: 0, tiro: 0, flash: 0, walkT: Math.random() * 4, pain: 0, atkAnim: 0, muriendo: 0 };
      e.tx = x / 100; e.ty = y / 100; e.pain = pain ? 0.1 : 0; e.atkAnim = atk / 100; e.muriendo = mu / 100;
      e.torre = CAN.find(c => Math.abs(c.x - e.tx) < 0.7 && Math.abs(c.y - e.ty) < 0.7) || null;
      if (mu > 0 && !e.cu) { e.cu = true; dejarCuerpo(e); }
      else if (pain && !e.sg) { e.sg = 1; sangreP(e.x, e.y, 5, 1); } else if (!pain) e.sg = 0;
      nuevos.push(e);
    }
    enemies = nuevos;
    // barcos
    m.b.forEach(([bx, by, pl], i) => {
      const b = BOATS[i]; if (!b) return;
      b.piloto = pl;
      if (b.x !== bx || b.y !== by) {
        const cx = Math.floor(player.x), cy = Math.floor(player.y);
        const montado = cx >= b.x && cx < b.x + b.l && cy >= b.y && cy < b.y + b.h && !VSOL[cy * MW + cx];
        const dx = bx - b.x, dy = by - b.y;
        pintarBarco(b, 0); b.x = bx; b.y = by; pintarBarco(b, b.id);
        if (montado) { player.x += dx; player.y += dy; }       // te lleva el barco
      }
    });
    m.c.forEach(([x, y, a, pl, pas], i) => {
      const c = CAM[i]; if (!c) return;
      c.piloto = pl; c.pas = pas || [];
      if (player.veh && player.veh.o === c && !player.veh.pas) return;
      c.tx = x / 100; c.ty = y / 100; c.ta = a / 100;
    });
    m.cp.forEach((pl, i) => { if (CAN[i]) CAN[i].piloto = pl; });
    if (player.veh && player.vehT <= 0) {
      const ov = player.veh.o;
      if (ov.piloto === MP.miIdx) player.veh.pas = false;
      else if (!(ov.pas && ov.pas.includes(MP.miIdx))) player.veh = null;
      else player.veh.pas = true;
    }
    // objetos
    const quedan = new Set(m.p); pickups = pickups.filter(o => quedan.has(o.idx));
    items = m.i.map(([x, y]) => ({ x: x / 100, y: y / 100, ttl: 5 }));
    // jugadores
    const idxs = new Set();
    for (const d of m.j) {
      const [idx, x, y, a, hp, w, muerto, atk, mov, resp] = d;
      if (idx === MP.miIdx) {
        if (hp < player.hp - 0.5) redFlash = 0.18;
        player.hp = hp; player.muerto = !!muerto; player.resp = resp;
        continue;
      }
      idxs.add(idx);
      let o = MP.otros.find(q => q.idx === idx);
      if (!o) { o = { idx, nombre: MP.nombres[idx] || 'Marino', x: x / 100, y: y / 100, conectado: true, walkT: 0, golpe: 0, atkAnim: 0 }; MP.otros.push(o); }
      if (o.hp !== undefined && hp < o.hp - 0.5) o.golpe = 0.3;
      o.tx = x / 100; o.ty = y / 100; o.a = a / 100; o.hp = hp; o.weapon = w; o.muerto = !!muerto; o.mov = !!mov; o.resp = resp;
      if (atk) o.atkAnim = 0.3;
    }
    MP.otros = MP.otros.filter(o => idxs.has(o.idx));
  }

  // El cliente suaviza lo que recibe y manda su posición
  MP.actualizarCliente = dt => {
    const k = Math.min(1, dt * 12);
    for (const e of enemies) {
      if (e.tx === undefined) continue;
      const px = e.x, py = e.y;
      e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k;
      e.walkT += Math.hypot(e.x - px, e.y - py) * 5;
      e.flash = Math.max(0, e.flash - dt);
    }
    for (const o of MP.otros) {
      if (o.tx !== undefined) { o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; }
      o.atkAnim = Math.max(0, (o.atkAnim || 0) - dt); o.golpe = Math.max(0, (o.golpe || 0) - dt);
      if (o.mov && !o.muerto) o.walkT += dt * 6;
    }
    for (const it of items) it.ttl = 5;
    for (const c of CAM) if (c.tx !== undefined && !(player.veh && player.veh.o === c && !player.veh.pas)) { c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k; c.a = c.ta; }
  };

  // ---------------- Reloj de red (se llama en cada cuadro) ----------------
  MP.tick = dt => {
    if (MP.rol === 'host') {
      for (const o of MP.otros) {
        o.fT = Math.max(0, (o.fT || 0) - dt);
        const k = Math.min(1, dt * 14);
        o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k;
        if (o.veh && (o.veh.k === 'camion' || o.veh.k === 'tanque')) {
          if (!o.veh.pas) { o.veh.o.x = o.x; o.veh.o.y = o.y; o.veh.o.a = o.a; }
          else { const q = o.veh.o, si = Math.max(0, (q.pas || []).indexOf(o.idx)); o.x = o.tx = q.x + Math.cos(q.a + 1.5708) * (si % 2 ? 0.3 : -0.3); o.y = o.ty = q.y + Math.sin(q.a + 1.5708) * (si % 2 ? 0.3 : -0.3); }
        }
        if (o.veh && o.veh.k === 'canon') { o.x = o.tx = o.veh.o.x; o.y = o.ty = o.veh.o.y; }
      }
      snapT -= dt;
      if (state === 'play' && snapT <= 0 && MP.otros.length) { snapT = 1 / HZ_SNAP; aTodos(snapshotHost()); }
    } else if (MP.rol === 'cliente' && state === 'play') {
      posT -= dt;
      if (posT <= 0) { posT = 1 / HZ_POS; enviar(conn, { t: 'p', x: r2(player.x), y: r2(player.y), a: r2(player.a), w: weapon, m: player.mov ? 1 : 0, d: player.cmd || 0 }); }
    }
  };

  MP.alListo = () => { if (qs.get('sala')) est('Listo: pulsa «Unirse»'); };
})();
