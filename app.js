// ==================== ELEMENTOS DO DOM ====================
const setupScreen = document.getElementById('setup-screen');
const teleprompterScreen = document.getElementById('teleprompter-screen');
const scriptText = document.getElementById('script-text');
const speedRange = document.getElementById('speed-range');
const speedValue = document.getElementById('speed-value');
const opacityRange = document.getElementById('opacity-range');
const opacityValue = document.getElementById('opacity-value');
const fontSizeRange = document.getElementById('font-size');
const fontSizeValue = document.getElementById('font-size-value');
const mirrorToggle = document.getElementById('mirror-toggle');
const cameraSelect = document.getElementById('camera-select');
const startBtn = document.getElementById('start-btn');

const cameraVideo = document.getElementById('camera-video');
const textOverlay = document.getElementById('text-overlay');
const teleprompterTextEl = document.getElementById('teleprompter-text');
const scrollContainer = document.getElementById('scroll-container');

const backBtn = document.getElementById('back-btn');
const recordBtn = document.getElementById('record-btn');
const playPauseBtn = document.getElementById('play-pause-btn');
const restartBtn = document.getElementById('restart-btn');
const speedDownBtn = document.getElementById('speed-down-btn');
const speedUpBtn = document.getElementById('speed-up-btn');

// Recording elements
const recordingTimer = document.getElementById('recording-timer');
const timerDisplay = document.getElementById('timer-display');
const timerBar = document.getElementById('timer-bar');

// ==================== ESTADO DA APLICAÇÃO ====================
let state = {
    isPlaying: false,
    isRecording: false,
    scrollPosition: 0,
    speed: 3,
    opacity: 70,
    fontSize: 28,
    mirrored: false,
    animationId: null,
    stream: null,
    mediaRecorder: null,
    recordedChunks: [],
    recordingStartTime: null,
    timerInterval: null
};

// ==================== TEXTO PADRÃO (DEMO) ====================
const defaultText = `Mano, o povo acha que n8n é igual montar LEGO...

"Ah, é só arrastar dois nodezinho e pronto!"

"Deu erro? Dois cliques resolve!"

Tá bom então...

A realidade? Tu fica 3 horas debugando um JSON que tá faltando uma vírgula. 

Descobre que o webhook não tá ativando porque o servidor decidiu tirar um cochilo. 

E quando acha que funcionou... o Typebot não conversa direito com a API.

E quer saber o pior?

Tenta fazer algo no n8n e dar conta de outra demanda ao mesmo tempo. VAI LÁ, TENTA.

Não faz nem um, nem outro, parceiro.

Essa bagaça exige 100% do teu cérebro. Não dá pra dividir atenção. 

Tu tá ali, mergulhado no flow, tentando entender onde o dado tá quebrando... 

E se alguém te interrompe? Perdeu. Volta do zero. Esquece onde tava, esquece a lógica, esquece tudo.

É igual iceberg, mano. A galera vê os 10% bonito do flow funcionando. 

Não vê as madrugadas, os cabelos brancos e os 47 testes que vieram antes.

Respeita quem automatiza!`;

// ==================== INICIALIZAÇÃO ====================
async function init() {
    // Preenche texto padrão
    scriptText.value = defaultText;

    // Carrega câmeras disponíveis
    await loadCameras();

    // Event listeners para configurações
    speedRange.addEventListener('input', updateSpeed);
    opacityRange.addEventListener('input', updateOpacity);
    fontSizeRange.addEventListener('input', updateFontSize);
    mirrorToggle.addEventListener('change', updateMirror);

    // Botões
    startBtn.addEventListener('click', startTeleprompter);
    backBtn.addEventListener('click', goBack);
    recordBtn.addEventListener('click', toggleRecording);
    playPauseBtn.addEventListener('click', togglePlayPause);
    restartBtn.addEventListener('click', restartScroll);
    speedDownBtn.addEventListener('click', decreaseSpeed);
    speedUpBtn.addEventListener('click', increaseSpeed);

    // Touch controls no texto
    scrollContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
    scrollContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
}

// ==================== CÂMERAS ====================
async function loadCameras() {
    try {
        // Primeiro, pede permissão básica
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach(track => track.stop());

        // Lista dispositivos
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        cameraSelect.innerHTML = '';

        if (videoDevices.length === 0) {
            cameraSelect.innerHTML = '<option value="">Nenhuma câmera encontrada</option>';
            return;
        }

        videoDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;

            // Tenta identificar frontal/traseira
            const label = device.label.toLowerCase();
            if (label.includes('front') || label.includes('frontal') || label.includes('user')) {
                option.textContent = `📱 Câmera Frontal`;
            } else if (label.includes('back') || label.includes('traseira') || label.includes('environment')) {
                option.textContent = `📷 Câmera Traseira`;
            } else {
                option.textContent = device.label || `Câmera ${index + 1}`;
            }

            cameraSelect.appendChild(option);
        });

        // Seleciona frontal por padrão (geralmente é a primeira ou tem 'front' no nome)
        const frontCamera = videoDevices.find(d =>
            d.label.toLowerCase().includes('front') ||
            d.label.toLowerCase().includes('user')
        );
        if (frontCamera) {
            cameraSelect.value = frontCamera.deviceId;
        }

    } catch (error) {
        console.error('Erro ao carregar câmeras:', error);
        cameraSelect.innerHTML = '<option value="">Erro ao acessar câmera</option>';
    }
}

// ==================== CONFIGURAÇÕES ====================
function updateSpeed() {
    state.speed = parseInt(speedRange.value);
    speedValue.textContent = state.speed;
}

function updateOpacity() {
    state.opacity = parseInt(opacityRange.value);
    opacityValue.textContent = `${state.opacity}%`;
}

function updateFontSize() {
    state.fontSize = parseInt(fontSizeRange.value);
    fontSizeValue.textContent = `${state.fontSize}px`;
}

function updateMirror() {
    state.mirrored = mirrorToggle.checked;
}

// ==================== INICIAR TELEPROMPTER ====================
async function startTeleprompter() {
    const text = scriptText.value.trim();

    if (!text) {
        alert('Por favor, insira um texto para o teleprompter!');
        return;
    }

    try {
        // Inicia câmera COM ÁUDIO - proporção 9:16 pra story
        const constraints = {
            video: {
                deviceId: cameraSelect.value ? { exact: cameraSelect.value } : undefined,
                facingMode: cameraSelect.value ? undefined : 'user',
                aspectRatio: { ideal: 9 / 16 },  // Proporção vertical de story
                width: { ideal: 1080 },
                height: { ideal: 1920 }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: { ideal: 48000 },
                channelCount: { ideal: 1 }
            }
        };

        state.stream = await navigator.mediaDevices.getUserMedia(constraints);
        cameraVideo.srcObject = state.stream;

        // Configura texto
        teleprompterTextEl.innerHTML = formatText(text);
        teleprompterTextEl.style.fontSize = `${state.fontSize}px`;
        textOverlay.style.backgroundColor = `rgba(0, 0, 0, ${(100 - state.opacity) / 100 * 0.7})`;

        if (state.mirrored) {
            teleprompterTextEl.classList.add('mirrored');
        } else {
            teleprompterTextEl.classList.remove('mirrored');
        }

        // Reset scroll
        state.scrollPosition = 0;
        teleprompterTextEl.style.transform = state.mirrored ? 'scaleX(-1) translateY(0)' : 'translateY(0)';

        // Troca de tela
        setupScreen.classList.remove('active');
        teleprompterScreen.classList.add('active');

        // Começa pausado
        state.isPlaying = false;
        state.isRecording = false;
        updatePlayPauseButton();

    } catch (error) {
        console.error('Erro ao iniciar:', error);

        // Tenta sem áudio se falhar
        try {
            const constraintsNoAudio = {
                video: {
                    deviceId: cameraSelect.value ? { exact: cameraSelect.value } : undefined,
                    facingMode: cameraSelect.value ? undefined : 'user',
                    aspectRatio: { ideal: 9 / 16 },
                    width: { ideal: 1080 },
                    height: { ideal: 1920 }
                },
                audio: false
            };

            state.stream = await navigator.mediaDevices.getUserMedia(constraintsNoAudio);
            cameraVideo.srcObject = state.stream;

            teleprompterTextEl.innerHTML = formatText(text);
            teleprompterTextEl.style.fontSize = `${state.fontSize}px`;
            textOverlay.style.backgroundColor = `rgba(0, 0, 0, ${(100 - state.opacity) / 100 * 0.7})`;

            if (state.mirrored) {
                teleprompterTextEl.classList.add('mirrored');
            } else {
                teleprompterTextEl.classList.remove('mirrored');
            }

            state.scrollPosition = 0;
            teleprompterTextEl.style.transform = state.mirrored ? 'scaleX(-1) translateY(0)' : 'translateY(0)';

            setupScreen.classList.remove('active');
            teleprompterScreen.classList.add('active');

            state.isPlaying = false;
            state.isRecording = false;
            updatePlayPauseButton();

            alert('⚠️ Microfone não disponível. Gravação será sem áudio.');

        } catch (error2) {
            alert('Erro ao acessar a câmera. Verifique as permissões do navegador.');
        }
    }
}

function formatText(text) {
    // Quebra em parágrafos menores para melhor leitura
    return text
        .split('\n')
        .filter(line => line.trim())
        .map(line => `<p style="margin-bottom: 1em;">${line}</p>`)
        .join('');
}

// ==================== GRAVAÇÃO ====================
function toggleRecording() {
    if (state.isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

async function startRecording() {
    if (!state.stream) {
        alert('Câmera não está ativa!');
        return;
    }

    try {
        // Configura o MediaRecorder com opções leves para mobile
        let options = {};

        // Tenta formatos mais leves primeiro para melhor performance
        const mimeTypes = [
            'video/webm;codecs=vp8,opus',  // VP8 é mais leve que VP9
            'video/webm;codecs=vp8',
            'video/webm',
            'video/mp4'
        ];

        for (const mimeType of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                options.mimeType = mimeType;
                break;
            }
        }

        if (!options.mimeType) {
            alert('Seu navegador não suporta gravação de vídeo');
            return;
        }

        // Qualidade alta para vídeo de story
        options.videoBitsPerSecond = 5000000;  // 5 Mbps - qualidade HD
        options.audioBitsPerSecond = 192000;   // 192 kbps - áudio alta qualidade

        state.recordedChunks = [];
        state.mediaRecorder = new MediaRecorder(state.stream, options);

        state.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                state.recordedChunks.push(event.data);
            }
        };

        state.mediaRecorder.onstop = () => {
            saveRecording();
        };

        // Inicia gravação - chunks maiores para menos overhead
        state.mediaRecorder.start(1000); // Salva chunks a cada 1 segundo
        state.isRecording = true;
        state.recordingStartTime = Date.now();

        // Atualiza UI
        recordBtn.textContent = '⏹️';
        recordBtn.classList.add('recording');
        recordBtn.title = 'Parar Gravação';
        recordingTimer.classList.remove('hidden');

        // Inicia timer
        startTimer();

        // Auto-inicia o scroll do texto
        if (!state.isPlaying) {
            togglePlayPause();
        }

    } catch (error) {
        console.error('Erro ao iniciar gravação:', error);
        alert('Erro ao iniciar gravação: ' + error.message);
    }
}

function stopRecording() {
    if (state.mediaRecorder && state.isRecording) {
        state.mediaRecorder.stop();
        state.isRecording = false;

        // Atualiza UI
        recordBtn.textContent = '⏺️';
        recordBtn.classList.remove('recording');
        recordBtn.title = 'Gravar';
        recordingTimer.classList.add('hidden');
        recordingTimer.classList.remove('warning', 'danger');
        timerBar.classList.remove('warning', 'danger');

        // Para timer
        stopTimer();

        // Para o scroll
        if (state.isPlaying) {
            togglePlayPause();
        }
    }
}

function saveRecording() {
    if (state.recordedChunks.length === 0) {
        alert('Nenhum vídeo gravado!');
        return;
    }

    const blob = new Blob(state.recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);

    // Cria link de download
    const a = document.createElement('a');
    a.href = url;
    a.download = `story_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Limpa
    URL.revokeObjectURL(url);
    state.recordedChunks = [];

    // Feedback
    alert('✅ Vídeo salvo! Verifique seus downloads.');
}

// ==================== TIMER ====================
function startTimer() {
    state.recordingStartTime = Date.now();

    updateTimerDisplay();

    state.timerInterval = setInterval(() => {
        updateTimerDisplay();
    }, 100);
}

function stopTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }

    // Reset display
    timerDisplay.textContent = '00:00';
    timerBar.style.width = '0%';
}

function updateTimerDisplay() {
    const elapsed = Date.now() - state.recordingStartTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    // Formata display
    timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;

    // Atualiza barra de progresso (60 segundos = 100%)
    const progress = Math.min((seconds / 60) * 100, 100);
    timerBar.style.width = `${progress}%`;

    // Estados visuais baseados no tempo
    if (seconds >= 55) {
        // PERIGO - menos de 5 segundos restantes
        recordingTimer.classList.remove('warning');
        recordingTimer.classList.add('danger');
        timerBar.classList.remove('warning');
        timerBar.classList.add('danger');
    } else if (seconds >= 45) {
        // AVISO - menos de 15 segundos restantes
        recordingTimer.classList.add('warning');
        recordingTimer.classList.remove('danger');
        timerBar.classList.add('warning');
        timerBar.classList.remove('danger');
    } else {
        recordingTimer.classList.remove('warning', 'danger');
        timerBar.classList.remove('warning', 'danger');
    }

    // Auto-stop aos 60 segundos (limite do story)
    if (seconds >= 60) {
        stopRecording();
    }
}

// ==================== CONTROLES ====================
function togglePlayPause() {
    state.isPlaying = !state.isPlaying;
    updatePlayPauseButton();

    if (state.isPlaying) {
        startScrolling();
    } else {
        stopScrolling();
    }
}

function updatePlayPauseButton() {
    if (state.isPlaying) {
        playPauseBtn.textContent = '⏸️';
        playPauseBtn.classList.add('playing');
    } else {
        playPauseBtn.textContent = '▶️';
        playPauseBtn.classList.remove('playing');
    }
}

function startScrolling() {
    const baseSpeed = state.speed * 0.5; // pixels por frame

    function scroll() {
        if (!state.isPlaying) return;

        state.scrollPosition += baseSpeed;

        const transform = state.mirrored
            ? `scaleX(-1) translateY(-${state.scrollPosition}px)`
            : `translateY(-${state.scrollPosition}px)`;

        teleprompterTextEl.style.transform = transform;

        // Verifica se chegou ao fim
        const maxScroll = teleprompterTextEl.scrollHeight;
        if (state.scrollPosition < maxScroll + 200) {
            state.animationId = requestAnimationFrame(scroll);
        } else {
            state.isPlaying = false;
            updatePlayPauseButton();
        }
    }

    scroll();
}

function stopScrolling() {
    if (state.animationId) {
        cancelAnimationFrame(state.animationId);
        state.animationId = null;
    }
}

function restartScroll() {
    stopScrolling();
    state.scrollPosition = 0;
    const transform = state.mirrored ? 'scaleX(-1) translateY(0)' : 'translateY(0)';
    teleprompterTextEl.style.transform = transform;
    state.isPlaying = false;
    updatePlayPauseButton();
}

function increaseSpeed() {
    if (state.speed < 10) {
        state.speed++;
        speedRange.value = state.speed;
        speedValue.textContent = state.speed;
    }
}

function decreaseSpeed() {
    if (state.speed > 1) {
        state.speed--;
        speedRange.value = state.speed;
        speedValue.textContent = state.speed;
    }
}

function goBack() {
    // Para gravação se estiver ativa
    if (state.isRecording) {
        stopRecording();
    }

    // Para tudo
    stopScrolling();
    state.isPlaying = false;

    // Para a câmera
    if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
        state.stream = null;
    }

    // Volta para setup
    teleprompterScreen.classList.remove('active');
    setupScreen.classList.add('active');
}

// ==================== TOUCH CONTROLS ====================
let touchStartY = 0;
let touchStartScroll = 0;

function handleTouchStart(e) {
    if (e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
        touchStartScroll = state.scrollPosition;

        // Pausa enquanto arrasta
        if (state.isPlaying) {
            stopScrolling();
        }
    }
}

function handleTouchMove(e) {
    if (e.touches.length === 1) {
        e.preventDefault();

        const deltaY = touchStartY - e.touches[0].clientY;
        state.scrollPosition = Math.max(0, touchStartScroll + deltaY);

        const transform = state.mirrored
            ? `scaleX(-1) translateY(-${state.scrollPosition}px)`
            : `translateY(-${state.scrollPosition}px)`;

        teleprompterTextEl.style.transform = transform;
    }
}

// ==================== INICIALIZA ====================
document.addEventListener('DOMContentLoaded', init);
