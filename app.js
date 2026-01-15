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
const playPauseBtn = document.getElementById('play-pause-btn');
const restartBtn = document.getElementById('restart-btn');
const speedDownBtn = document.getElementById('speed-down-btn');
const speedUpBtn = document.getElementById('speed-up-btn');

// ==================== ESTADO DA APLICAÇÃO ====================
let state = {
    isPlaying: false,
    scrollPosition: 0,
    speed: 3,
    opacity: 70,
    fontSize: 28,
    mirrored: false,
    animationId: null,
    stream: null
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
        // Inicia câmera
        const constraints = {
            video: {
                deviceId: cameraSelect.value ? { exact: cameraSelect.value } : undefined,
                facingMode: cameraSelect.value ? undefined : 'user',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
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
        updatePlayPauseButton();

    } catch (error) {
        console.error('Erro ao iniciar:', error);
        alert('Erro ao acessar a câmera. Verifique as permissões do navegador.');
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
