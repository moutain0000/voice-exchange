// Supabase設定
const SUPABASE_URL = 'https://atkbfppbuscfrglbpjaz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0a2JmcHBidXNjZnJnbGJwamF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMDM4MjAsImV4cCI6MjA4MDY3OTgyMH0._ka9M6qtnyLj9dpHGg4WGvwFPX7whnw_GUl9Io8rl1k';

// Supabaseクライアント初期化
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// グローバル変数
let mediaRecorder;
let audioChunks = [];
let recordedBlob = null;
let audioContext;
let analyser;
let dataArray;
let animationId;

// DOM要素
const recordBtn = document.getElementById('recordBtn');
const recordText = document.getElementById('recordText');
const timer = document.getElementById('timer');
const preview = document.getElementById('preview');
const exchangeBtn = document.getElementById('exchangeBtn');
const status = document.getElementById('status');
const receivedAudio = document.getElementById('receivedAudio');
const receivedStatus = document.getElementById('receivedStatus');
const canvas = document.getElementById('waveform');
const canvasCtx = canvas.getContext('2d');

// 初期状態
exchangeBtn.disabled = true;

// 録音ボタンのイベント
recordBtn.addEventListener('click', async () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopRecording();
  } else {
    await startRecording();
  }
});

// 交換ボタンのイベント
exchangeBtn.addEventListener('click', () => {
  exchangeAudio();
});

// 録音開始
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } 
    });
    
    const options = { mimeType: 'audio/webm' };
    mediaRecorder = new MediaRecorder(stream, options);
    
    audioChunks = [];
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      recordedBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(recordedBlob);
      preview.src = audioUrl;
      
      recordBtn.classList.remove('recording');
      recordBtn.disabled = false;  // ← ボタンを有効化
      recordText.textContent = '録音開始';
      status.textContent = '録音完了！交換できます';
      exchangeBtn.disabled = false;
      
      timer.textContent = '3.0';
      cancelAnimationFrame(animationId);
      clearCanvas();
      stream.getTracks().forEach(track => track.stop());
    };
    
    mediaRecorder.start();
    recordBtn.classList.add('recording');
    recordBtn.disabled = true;  // ← ボタンを無効化
    recordText.textContent = '録音中...';
    status.textContent = '録音中...';
    
    setupAudioContext(stream);
    drawWaveform();
    
    let timeLeft = 3.0;
    const timerInterval = setInterval(() => {
      timeLeft -= 0.1;
      if (timeLeft <= 0) {
        timeLeft = 0;
        clearInterval(timerInterval);
        stopRecording();
      }
      timer.textContent = timeLeft.toFixed(1);
    }, 100);
    
    setTimeout(() => {
      if (mediaRecorder.state === 'recording') {
        clearInterval(timerInterval);
        stopRecording();
      }
    }, 3000);
    
  } catch (error) {
    console.error('マイクアクセスエラー:', error);
    alert('マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。');
  }
}

// 録音停止
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
}

// 音声コンテキストのセットアップ
function setupAudioContext(stream) {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  
  analyser.fftSize = 2048;
  const bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);
}

// 波形描画
function drawWaveform() {
  animationId = requestAnimationFrame(drawWaveform);
  analyser.getByteTimeDomainData(dataArray);
  
  canvasCtx.fillStyle = '#f5f5f5';
  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
  
  canvasCtx.lineWidth = 2;
  canvasCtx.strokeStyle = '#667eea';
  canvasCtx.beginPath();
  
  const sliceWidth = canvas.width / dataArray.length;
  let x = 0;
  
  for (let i = 0; i < dataArray.length; i++) {
    const v = dataArray[i] / 128.0;
    const y = (v * canvas.height) / 2;
    
    if (i === 0) {
      canvasCtx.moveTo(x, y);
    } else {
      canvasCtx.lineTo(x, y);
    }
    
    x += sliceWidth;
  }
  
  canvasCtx.lineTo(canvas.width, canvas.height / 2);
  canvasCtx.stroke();
}


function clearCanvas() {
  canvasCtx.fillStyle = '#f5f5f5';
  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
}

async function exchangeAudio() {
  if (!recordedBlob) {
    alert('先に録音してください');
    return;
  }
  
  
  // 1. ファイルサイズチェック（最大1MB）
  const maxSize = 1 * 1024 * 1024; // 1MB
  if (recordedBlob.size > maxSize) {
    alert('ファイルサイズが大きすぎます（最大1MB）\n録音時間を短くしてください。');
    status.textContent = '録音完了！交換できます';
    return;
  }
  
  // 2. ファイル形式チェック
  if (!recordedBlob.type.includes('audio/webm') && !recordedBlob.type.includes('audio/mp4')) {
    alert('サポートされていないファイル形式です\nWebMまたはMP4形式のみ対応しています。');
    status.textContent = '録音完了！交換できます';
    return;
  }
  
  try {
    status.textContent = 'アップロード中...';
    exchangeBtn.disabled = true;
    
    
    const randomStr = Math.random().toString(36).substring(2, 10);
    const fileName = `audio_${Date.now()}_${randomStr}.webm`;
    
    // 3. Supabase Storageに音声をアップロード
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-recordings')
      .upload(fileName, recordedBlob, {
        contentType: 'audio/webm',
        cacheControl: '3600',
        upsert: false  
      });
    
    if (uploadError) {
      console.error('アップロードエラー:', uploadError);
      
      
      let errorMessage = 'アップロードに失敗しました。';
      if (uploadError.message.includes('Duplicate')) {
        errorMessage = 'ファイル名が重複しています。もう一度お試しください。';
      } else if (uploadError.message.includes('quota')) {
        errorMessage = 'ストレージの容量が不足しています。';
      }
      
      alert(errorMessage);
      status.textContent = '録音完了！交換できます';
      exchangeBtn.disabled = false;
      return;
    }
    
    // 4. 公開URLを取得
    const { data: urlData } = supabase.storage
      .from('audio-recordings')
      .getPublicUrl(fileName);
    
    const publicUrl = urlData.publicUrl;
    
    // 5. URLの検証（自分のSupabaseストレージか確認）
    if (!publicUrl.startsWith(SUPABASE_URL + '/storage/')) {
      console.error('不正なURL:', publicUrl);
      alert('不正なURLが生成されました。もう一度お試しください。');
      status.textContent = '録音完了！交換できます';
      exchangeBtn.disabled = false;
      return;
    }
    
    console.log('アップロード成功:', publicUrl);
    status.textContent = '交換中...';
    

    const { data, error } = await supabase.rpc('exchange_audio', {
      new_audio_url: publicUrl,
      new_duration: 3.0,  // 
      new_format: 'webm'  // 
    });
    
    if (error) {
      console.error('交換エラー:', error);
      
      // サーバー側のバリデーションエラーを分かりやすく表示
      let errorMessage = '交換に失敗しました。';
      
      if (error.message.includes('Rate limit exceeded')) {
        errorMessage = '送信回数が多すぎます。\n1分後にもう一度お試しください。';
      } else if (error.message.includes('Invalid duration')) {
        errorMessage = '無効な録音時間です。';
      } else if (error.message.includes('Invalid format')) {
        errorMessage = '無効なファイル形式です。';
      } else if (error.message.includes('Invalid URL')) {
        errorMessage = '無効なURLです。';
      }
      
      alert(errorMessage);
      status.textContent = '録音完了！交換できます';
      exchangeBtn.disabled = false;
      return;
    }
    
    console.log('交換成功:', data);
    
    // 7. 受け取った音声を再生
    if (data && data.length > 0) {
      const receivedUrl = data[0].received_audio_url;
      receivedAudio.src = receivedUrl;
      
      // 自分の音声と同じものが返ってきたか確認
      if (receivedUrl === publicUrl) {
        receivedStatus.textContent = '初回なので自分の音声が返されました';
      } else {
        receivedStatus.textContent = `${new Date().toLocaleString('ja-JP')} に受信`;
      }
    }
    
    status.textContent = '交換完了！もう一度録音できます';
    
    // リセット
    recordedBlob = null;
    preview.src = '';
    
  } catch (error) {
    console.error('予期しないエラー:', error);
    alert('予期しないエラーが発生しました。\nページをリロードしてもう一度お試しください。');
    status.textContent = '録音完了！交換できます';
    exchangeBtn.disabled = false;
  }
}
