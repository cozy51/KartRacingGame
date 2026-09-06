import './style.css';
import { Game } from './game/Game';
import { CONFIG } from './config';
document.title = CONFIG.title;
try {
  const game = new Game();
  if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
} catch (error) {
  console.error(error);
  document.querySelector('#app')!.innerHTML =
    '<div style="padding:48px;color:#fff7dc;background:#183f43;min-height:100vh"><h1 style="font-size:40px;letter-spacing:-1px">START YOUR ENGINE.</h1><p>3D描画を開始できませんでした。Chrome / Edge のハードウェア アクセラレーションを有効にして、再読み込みしてください。</p><button onclick="location.reload()" style="padding:15px 30px">再読み込み</button></div>';
}
