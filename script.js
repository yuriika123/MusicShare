// --- 1. HTMLの要素を取得する ---
const generateButton = document.getElementById('generateButton');
const urlInput = document.getElementById('itemURL');
const statusMessage = document.getElementById('statusMessage');
const canvas = document.getElementById('imageCanvas');
const ctx = canvas.getContext('2d');
const resultImage = document.getElementById('resultImage');
const resultContainer = document.getElementById('resultContainer');

let currentImageBlob = null; // 現在の画像データを保存

// ペーストボタンの機能
document.getElementById('pasteButton').addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text.includes('music.apple.com')) {
      urlInput.value = text;
      statusMessage.textContent = 'URLがペーストされました';
    } else {
      statusMessage.textContent = 'Apple MusicのURLをペーストしてください';
    }
  } catch (err) {
    statusMessage.textContent = 'クリップボードを読み取れませんでした。';
  }
});

// --- 2. 「作成」ボタンのメイン機能 ---
generateButton.addEventListener('click', async (event) => {
  event.preventDefault();
  const url = urlInput.value.trim();
  
  if (!url) {
    statusMessage.textContent = 'URLを入力してください。';
    return;
  }

  if (!url.includes('music.apple.com')) {
    statusMessage.textContent = 'Apple MusicのURLを入力してください。';
    return;
  }

  // ローディング状態の設定
  generateButton.disabled = true;
  generateButton.textContent = '画像生成中...';
  generateButton.classList.add('loading');
  statusMessage.textContent = '情報を取得しています...';
  resultContainer.style.display = 'none';
  resultImage.style.display = 'none';

  try {
    const settings = {
      background: document.querySelector('input[name="backgroundStyle"]:checked').value,
      aspectRatio: document.querySelector('input[name="aspectRatio"]:checked').value,
    };
    
    const id = extractID(url);
    if (!id) {
      throw new Error('URLから有効なIDを抽出できませんでした。Apple Musicの正しいURLを入力してください。');
    }
    
    const musicItem = await fetchMusicInfo(id);
    if (!musicItem) {
      throw new Error('音楽情報の取得に失敗しました。URLが正しいか確認してください。');
    }

    statusMessage.textContent = '画像を生成しています...';
    const imageBlob = await createImage(settings, musicItem);
    if (!imageBlob) {
      throw new Error('画像データの生成に失敗しました。');
    }
    
    // 画像を表示
    const imageURL = URL.createObjectURL(imageBlob);
    resultImage.src = imageURL;
    resultImage.style.display = 'block';
    resultContainer.style.display = 'block';
    
    statusMessage.textContent = '画像が生成されました！長押しして保存できます。';

  } catch (error) {
    console.error('エラー:', error);
    statusMessage.textContent = `エラー: ${error.message}`;
    resultContainer.style.display = 'none';
    resultImage.style.display = 'none';
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = '画像を作成';
    generateButton.classList.remove('loading');
  }
});


// --- 3. 画像生成のメイン関数 ---
async function createImage(settings, item) {
    const artworkUrl = item.artworkUrl100.replace('100x100', '2000x2000');
    const artworkImg = await loadImage(artworkUrl);

    const artworkSize = 1000;
    canvas.width = artworkSize;
    let ratioValue;
    if (settings.aspectRatio === 'nineToSixteen') {
        ratioValue = 16 / 9;
    } else {
        ratioValue = 4 / 3;
    }
    canvas.height = artworkSize * ratioValue;

    let backgroundColor = '#FFFFFF';
    
    if (settings.background === 'blurredArtwork') {
        ctx.save();
        ctx.filter = 'blur(30px) brightness(0.9)';
        const blurredAspect = artworkImg.width / artworkImg.height;
        const canvasAspect = canvas.width / canvas.height;
        let drawWidth, drawHeight, offsetX, offsetY;
        if (blurredAspect > canvasAspect) {
            drawHeight = canvas.height;
            drawWidth = drawHeight * blurredAspect;
            offsetX = (canvas.width - drawWidth) / 2;
            offsetY = 0;
        } else {
            drawWidth = canvas.width;
            drawHeight = drawWidth / blurredAspect;
            offsetX = 0;
            offsetY = (canvas.height - drawHeight) / 2;
        }
        ctx.drawImage(artworkImg, offsetX, offsetY, drawWidth, drawHeight);
        ctx.restore();
    } else {
        if (settings.background === 'averageColor') {
            backgroundColor = getAverageColor(artworkImg);
        }
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    const padding = canvas.width * 0.05;
    const drawSize = canvas.width - padding * 2;

    // --- ↓↓↓ ここからが修正点です ↓↓↓ ---

    let artworkY;
    const titleFontSize = drawSize * 0.07;
    const artistFontSize = drawSize * 0.05;
    const textGap = titleFontSize * 0.4;
    const totalTextBlockHeight = titleFontSize + artistFontSize + textGap;

    // ★アートワークとテキストの「隙間」を固定値として定義
    const artworkToTextGap = padding * 1.5;

    // アスペクト比によってレイアウトを切り替える
    if (settings.aspectRatio === 'nineToSixteen') {
        // 9:16 の場合：アートワークとテキストのブロック全体を中央に配置
        const totalContentHeight = drawSize + artworkToTextGap + totalTextBlockHeight;
        artworkY = (canvas.height - totalContentHeight) / 2;
    } else {
        // 3:4 の場合：これまで通り、アートワークを上部に配置
        artworkY = padding;
    }
    
    // 計算したY座標を使ってアートワークを描画
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowOffsetY = 5;
    ctx.shadowBlur = 15;
    ctx.drawImage(artworkImg, padding, artworkY, drawSize, drawSize);
    ctx.shadowColor = 'transparent';

    // ★テキストの開始位置を、アートワークの下端＋固定の隙間で直接計算する
    const artworkBottomY = artworkY + drawSize;
    const textBlockStartY = artworkBottomY + artworkToTextGap;
    
    // --- ↑↑↑ 修正ここまで ↑↑↑ ---
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    if (settings.background === 'blurredArtwork') {
        ctx.fillStyle = 'white';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowOffsetY = 2;
        ctx.shadowBlur = 5;
    } else {
        ctx.fillStyle = isColorLight(backgroundColor) ? 'black' : 'white';
    }
    
    const title = item.trackName || item.collectionName;
    ctx.font = `bold ${titleFontSize}px sans-serif`;
    ctx.fillText(title, canvas.width / 2, textBlockStartY);

    ctx.font = `normal ${artistFontSize}px sans-serif`;
    ctx.fillText(item.artistName, canvas.width / 2, textBlockStartY + titleFontSize + textGap);

    ctx.shadowColor = 'transparent';
    ctx.textBaseline = 'alphabetic';
    
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}


// --- 4. ヘルパー関数群 (変更なし) ---
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
function extractID(urlString) {
  try {
    const url = new URL(urlString);
    const pathParts = url.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    if (lastPart && /^\d+$/.test(lastPart)) return lastPart;
    const songId = url.searchParams.get('i');
    if (songId) return songId;
    return null;
  } catch(e) { return null; }
}
async function fetchMusicInfo(id) {
  try {
    const apiURL = `https://itunes.apple.com/lookup?id=${id}&country=jp&lang=ja_jp&entity=song,album`;
    const response = await fetch(apiURL);
    
    if (!response.ok) {
      throw new Error(`APIエラー: ${response.status} - サーバーとの通信に失敗しました`);
    }
    
    const data = await response.json();
    
    if (!data || data.resultCount === 0) {
      throw new Error('音楽情報が見つかりませんでした。URLが正しいか確認してください。');
    }
    
    const item = data.results[0];
    if (!item.artworkUrl100) {
      throw new Error('アートワークが見つかりませんでした。');
    }
    
    return item;
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('インターネット接続を確認してください。');
    }
    throw error;
  }
}

/**
 * 画像の平均色を計算してCSSの色文字列として返します。
 * @param {HTMLImageElement} img - 分析する画像要素。
 * @returns {string} - 'rgb(r, g, b)' 形式の文字列。
 */
function getAverageColor(img) {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    // 1x1のキャンバスに画像を描画すると、その1ピクセルが平均色になる
    tempCanvas.width = 1;
    tempCanvas.height = 1;
    tempCtx.drawImage(img, 0, 0, 1, 1);
    
    // 1ピクセルの色データを取得
    const data = tempCtx.getImageData(0, 0, 1, 1).data;
    return `rgb(${data[0]}, ${data[1]}, ${data[2]})`;
}

/**
 * 色が明るいか暗いかを判定します。
 * @param {string} rgbColor - 'rgb(r, g, b)' 形式の文字列。
 * @returns {boolean} - 明るい場合はtrue。
 */
function isColorLight(rgbColor) {
    const [r, g, b] = rgbColor.match(/\d+/g).map(Number);
    // YIQ式を使って人間の感じる明るさを計算
    const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return brightness > 128;
}