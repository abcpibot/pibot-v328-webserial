/**
 * PiBot V3.28 Isolated 固件下载与测试平台
 * 使用 Web Serial API 直接连接客户电脑本机串口。
 * 需要 HTTPS/localhost + Chrome/Edge。
 */

// ===== 全局状态 =====
const appLang = (document.documentElement.lang || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en';

function L(zh, en) {
    return appLang === 'zh' ? zh : en;
}

const state = {
    // 连接模式
    connectionMode: null, // 'serial' | null
    
    // Web Serial API 状态
    port: null,
    reader: null,
    writer: null,
    isConnected: false,
    isReading: false,
    baudRate: 115200,
    serialWriteChain: Promise.resolve(),
    
    serialRxBuffer: '',
    
    // GRBL 状态
    grblStatus: {
        state: 'Unknown',
        mx: 0, my: 0, mz: 0,
        wx: 0, wy: 0, wz: 0,
        spindle: false,
        flood: false,
        mist: false,
        pins: ''
    },
    outputs: {
        spindle: false,
        mist: false,
        flood: false
    },
    
    // Jog 状态
    jogStep: 0.1,
    jogAxis: null,
    jogDir: 1,
    jogInterval: null,
    isJogging: false,

    // GRBL 命令发送状态
    commandQueue: [],
    currentCommand: null,
    waitingForResponse: false,
    commandTimeout: null,
    pollTimer: null,
    manualStatusReportCount: 0,
    signalTestRunning: false,
    isProgramming: false,
    programReader: null,
    programWriter: null,
    programRx: []
};

// ===== 固件信息 =====
const firmwareInfo = {
    official: {
        title: L('GRBL v1.1h 官方原版', 'GRBL v1.1h Official'),
        description: L(`
            <p>这是GRBL官方发布的标准版本1.1h，适用于大多数Arduino Uno/Nano（ATmega328P）主板。</p>
            <h4>默认引脚配置（VARIABLE_SPINDLE 启用）：</h4>
            <ul>
                <li><strong>Spindle PWM/Enable:</strong> D11 (PB3)</li>
                <li><strong>Spindle Direction:</strong> D13 (PB5)</li>
                <li><strong>Coolant Mist (M7):</strong> 默认未启用；需在 <code>config.h</code> 中启用 <code>ENABLE_M7</code></li>
                <li><strong>Coolant Flood (M8):</strong> A3 (PC3)</li>
            </ul>
            <h4>输入引脚：</h4>
            <ul>
                <li><strong>X Limit:</strong> D9 (PB1)</li>
                <li><strong>Y Limit:</strong> D10 (PB2)</li>
                <li><strong>Z Limit:</strong> D12 (PB4)</li>
                <li><strong>Probe:</strong> A5 (PC5)</li>
                <li><strong>Abort/Reset:</strong> 标准引脚</li>
            </ul>
            <p>固件已编译完成，可直接下载使用。</p>
        `, `
            <p>This is the standard GRBL v1.1h release for most Arduino Uno/Nano ATmega328P boards.</p>
            <h4>Default pin mapping with VARIABLE_SPINDLE enabled:</h4>
            <ul>
                <li><strong>Spindle PWM/Enable:</strong> D11 (PB3)</li>
                <li><strong>Spindle Direction:</strong> D13 (PB5)</li>
                <li><strong>Coolant Mist (M7):</strong> Disabled by default; enable <code>ENABLE_M7</code> in <code>config.h</code></li>
                <li><strong>Coolant Flood (M8):</strong> A3 (PC3)</li>
            </ul>
            <h4>Input pins:</h4>
            <ul>
                <li><strong>X Limit:</strong> D9 (PB1)</li>
                <li><strong>Y Limit:</strong> D10 (PB2)</li>
                <li><strong>Z Limit:</strong> D12 (PB4)</li>
                <li><strong>Probe:</strong> A5 (PC5)</li>
                <li><strong>Abort/Reset:</strong> Standard GRBL pin</li>
            </ul>
            <p>The firmware is precompiled and ready to download.</p>
        `,
        ),
        filename: 'grbl_v1.1h.hex',
        path: 'firmware/grbl_v1.1h.hex'
    },
    custom: {
        title: L('GRBL v1.1h 定制版本（PiBot V3.28 Isolated 专用）', 'GRBL v1.1h Custom for PiBot V3.28 Isolated'),
        description: L(`
            <p>此版本针对 PiBot V3.28 Isolated 硬件设计进行了引脚优化，必须基于GRBL 1.1h源代码修改后重新编译。</p>
            <h4>修改内容：</h4>
            <ul>
                <li><strong>Spindle Enable:</strong> 将 <strong>D13</strong> 从 Direction 改为 Enable (PB5)，高电平有效</li>
                <li><strong>Spindle PWM:</strong> 保持 <strong>D11</strong> (PB3)，不变</li>
                <li><strong>Coolant Mist (M7/ISO-COOLMIST):</strong> 启用 <code>ENABLE_M7</code> 后使用 <strong>A4</strong> (PC4)，高电平有效</li>
                <li><strong>Coolant Flood (M8):</strong> 保持 <strong>A3</strong> (PC3)，不变</li>
            </ul>
            <h4>编译修改方法：</h4>
            <p>修改 <code>config.h</code> 文件，取消注释以下两行：</p>
            <pre>#define ENABLE_M7
#define USE_SPINDLE_DIR_AS_ENABLE_PIN</pre>
            <p><code>ENABLE_M7</code> 让 M7 输出到 A4；<code>USE_SPINDLE_DIR_AS_ENABLE_PIN</code> 让 D13 作为 Spindle Enable。</p>
            <h4>输入引脚（与原版相同）：</h4>
            <ul>
                <li><strong>X/Y/Z Limit:</strong> D9/D10/D12</li>
                <li><strong>Probe:</strong> A5</li>
                <li><strong>Abort/Feed Hold/Cycle Start:</strong> 标准引脚</li>
            </ul>
            <p>固件已编译完成，可直接下载使用。</p>
        `, `
            <p>This build is optimized for the PiBot V3.28 Isolated board pinout and is rebuilt from modified GRBL v1.1h source.</p>
            <h4>Custom changes:</h4>
            <ul>
                <li><strong>Spindle Enable:</strong> Moves <strong>D13</strong> from Direction to Enable (PB5), active high</li>
                <li><strong>Spindle PWM:</strong> Keeps <strong>D11</strong> (PB3), unchanged</li>
                <li><strong>Coolant Mist (M7/ISO-COOLMIST):</strong> Enables <code>ENABLE_M7</code> and uses <strong>A4</strong> (PC4), active high</li>
                <li><strong>Coolant Flood (M8):</strong> Keeps <strong>A3</strong> (PC3), unchanged</li>
            </ul>
            <h4>Build notes:</h4>
            <p>Edit <code>config.h</code> and enable these two lines:</p>
            <pre>#define ENABLE_M7
#define USE_SPINDLE_DIR_AS_ENABLE_PIN</pre>
            <p><code>ENABLE_M7</code> maps M7 to A4; <code>USE_SPINDLE_DIR_AS_ENABLE_PIN</code> maps D13 to Spindle Enable.</p>
            <h4>Input pins, same as the official build:</h4>
            <ul>
                <li><strong>X/Y/Z Limit:</strong> D9/D10/D12</li>
                <li><strong>Probe:</strong> A5</li>
                <li><strong>Abort/Feed Hold/Cycle Start:</strong> Standard GRBL pins</li>
            </ul>
            <p>The firmware is precompiled and ready to download.</p>
        `,
        ),
        filename: 'grbl_v1.1h_custom.hex',
        path: 'firmware/grbl_v1.1h_custom.hex'
    }
};

// ===== DOM 元素缓存 =====
const elements = {};

function cacheElements() {
    elements.connectionStatus = document.getElementById('connectionStatus');
    elements.connectBtn = document.getElementById('connectBtn');
    elements.serialNotice = document.getElementById('serialNotice');
    elements.portInfo = document.getElementById('portInfo');
    elements.baudRate = document.getElementById('baudRate');
    elements.terminalOutput = document.getElementById('terminalOutput');
    elements.commandInput = document.getElementById('commandInput');
    elements.liveIndicator = document.getElementById('liveIndicator');
    elements.grblState = document.getElementById('grblState');
    elements.workMode = document.getElementById('workMode');
    elements.spindleSpeed = document.getElementById('spindleSpeed');
    elements.coolantState = document.getElementById('coolantState');
    elements.mx = document.getElementById('mx');
    elements.my = document.getElementById('my');
    elements.mz = document.getElementById('mz');
    elements.wx = document.getElementById('wx');
    elements.wy = document.getElementById('wy');
    elements.wz = document.getElementById('wz');
    elements.limitX = document.getElementById('limitX');
    elements.limitY = document.getElementById('limitY');
    elements.limitZ = document.getElementById('limitZ');
    elements.probeInput = document.getElementById('probeInput');
    elements.abortInput = document.getElementById('abortInput');
    elements.holdInput = document.getElementById('holdInput');
    elements.resumeInput = document.getElementById('resumeInput');
    elements.spindleState = document.getElementById('spindleState');
    elements.mistState = document.getElementById('mistState');
    elements.floodState = document.getElementById('floodState');
    elements.btnM3Full = document.getElementById('btnM3Full');
    elements.btnM3Half = document.getElementById('btnM3Half');
    elements.btnM4Full = document.getElementById('btnM4Full');
    elements.btnM4Half = document.getElementById('btnM4Half');
    elements.btnM5 = document.getElementById('btnM5');
    elements.mistToggle = document.getElementById('mistToggle');
    elements.floodToggle = document.getElementById('floodToggle');
    elements.firmwareModal = document.getElementById('firmwareModal');
    elements.modalTitle = document.getElementById('modalTitle');
    elements.modalBody = document.getElementById('modalBody');
    elements.programSection = document.getElementById('programSection');
    elements.programName = document.getElementById('programName');
    elements.programStage = document.getElementById('programStage');
    elements.progressFill = document.getElementById('progressFill');
}

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    if (elements.connectBtn) {
        elements.connectBtn.addEventListener('click', (event) => {
            event.preventDefault();
            if (state.isConnected && state.connectionMode === 'serial') {
                disconnectSerial();
            } else {
                openPortSelectorNow();
            }
        });
    }
    addTerminalLine(L('系统就绪。请连接串口设备开始测试。', 'System ready. Connect a serial device to begin.'), 'system');
    setSerialNotice(L('请选择串口连接主板。', 'Select a serial port to connect the board.'));
    
    if (canUseWebSerial()) {
        addTerminalLine(L('Web Serial API 可用。客户模式下可直接选择串口。', 'Web Serial API is available. Click Connect Device to choose a serial port.'), 'system');
        setSerialNotice(L('客户模式：点击“连接设备”后，浏览器会弹出串口选择窗口。', 'Click Connect Device. Your browser will open the serial port picker.'), 'success');
    } else {
        addTerminalLine(L('当前环境不能使用 Web Serial。', 'Web Serial is not available in this environment.'), 'error');
        setSerialNotice(L('当前浏览器或网址不支持 Web Serial。请使用 Chrome/Edge 并通过 HTTPS 打开。', 'Use Chrome/Edge and open this page over HTTPS.'), 'warning');
    }
});

// ===== 固件下载 =====
function downloadFirmware(type) {
    const info = firmwareInfo[type];
    
    const link = document.createElement('a');
    link.href = info.path;
    link.download = info.filename;
    
    fetch(info.path, { method: 'HEAD' })
        .then(response => {
            if (response.ok) {
                link.click();
                addTerminalLine(`${L('开始下载', 'Download started')}: ${info.filename}`, 'system');
            } else {
                throw new Error(L('文件未找到', 'File not found'));
            }
        })
        .catch(() => {
            showModal(info.title, info.description + `
                <div style="margin-top: 1rem; padding: 1rem; background: var(--bg-primary); border-radius: var(--radius-md);">
                    <p><strong>${L('注意', 'Note')}：</strong>${L('固件文件未找到。请确保 .hex 文件已放置在 firmware/ 目录下。', 'Firmware file was not found. Make sure the .hex file exists in the firmware/ folder.')}</p>
                </div>
            `);
        });
}

// ===== 模态框 =====
function showModal(title, content) {
    elements.modalTitle.textContent = title;
    elements.modalBody.innerHTML = content;
    elements.firmwareModal.classList.add('show');
}

function closeModal() {
    elements.firmwareModal.classList.remove('show');
}

function setSerialNotice(text, type = 'system') {
    if (!elements.serialNotice) return;

    const textEl = elements.serialNotice.querySelector('.serial-notice-text');
    if (textEl) textEl.textContent = text;

    elements.serialNotice.classList.remove('success', 'warning', 'error');
    if (type === 'success') {
        elements.serialNotice.classList.add('success');
    } else if (type === 'warning') {
        elements.serialNotice.classList.add('warning');
    } else if (type === 'error') {
        elements.serialNotice.classList.add('error');
    }
}

// 点击模态框背景关闭
if (elements.firmwareModal) {
    elements.firmwareModal.addEventListener('click', (e) => {
        if (e.target === elements.firmwareModal) {
            closeModal();
        }
    });
}

// ===== 连接模式切换 =====
function toggleConnection() {
    if (state.isConnected && state.connectionMode === 'serial') {
        disconnectSerial();
    } else {
        openPortSelectorNow();
    }
}

function canUseWebSerial() {
    return 'serial' in navigator && window.isSecureContext && window.location.protocol !== 'file:';
}

function openPortSelectorNow() {
    if (!elements.firmwareModal) {
        cacheElements();
    }

    if (canUseWebSerial()) {
        setSerialNotice(L('正在打开浏览器串口选择窗口...', 'Opening the browser serial port picker...'));
        connectSerial();
        return;
    }

    addTerminalLine(L('当前浏览器或网址不支持 Web Serial。', 'Web Serial is not available in this browser or URL.'), 'error');
    showModal(L('无法连接串口', 'Cannot Connect Serial Port'), `
        <p>${L('请使用 Chrome 或 Edge 浏览器，并通过 HTTPS 网址打开本页面。', 'Use Chrome or Edge and open this page over HTTPS.')}</p>
        <p>${L('本页面是纯 Web Serial 模式，不需要安装 Python 或本地代理程序。', 'This page uses Web Serial only. No Python or local agent is required.')}</p>
    `);
}

// ===== Web Serial API 连接 =====
async function connectSerial() {
    try {
        state.baudRate = parseInt(elements.baudRate.value);
        
        const port = await navigator.serial.requestPort({
            filters: [
                { usbVendorId: 0x2341, usbProductId: 0x0043 },
                { usbVendorId: 0x2341, usbProductId: 0x0001 },
                { usbVendorId: 0x2A03, usbProductId: 0x0043 },
                { usbVendorId: 0x1A86, usbProductId: 0x7523 },
                { usbVendorId: 0x0403, usbProductId: 0x6001 },
            ]
        });
        
        state.port = port;
        await port.open({ baudRate: state.baudRate });
        
        state.connectionMode = 'serial';
        state.isConnected = true;
        updateConnectionUI();
        
        const portInfo = port.getInfo();
        setSerialNotice(`${L('Web Serial 已连接，波特率', 'Web Serial connected at')} ${state.baudRate}.`, 'success');
        addTerminalLine(`${L('已连接', 'Connected')}: USB VID=${portInfo.usbVendorId ? portInfo.usbVendorId.toString(16) : 'unknown'} PID=${portInfo.usbProductId ? portInfo.usbProductId.toString(16) : 'unknown'}`, 'system');
        addTerminalLine(`${L('波特率', 'Baud rate')}: ${state.baudRate}`, 'system');
        
        readSerialLoop();
        startStatusPolling();
        
        setTimeout(() => sendCommand('$I', { silent: true, timeoutMs: 6000, warnOnTimeout: false }), 1200);
        setTimeout(() => sendRealtimeCommand('?', { silent: true }), 1000);
        
    } catch (error) {
        console.error('Serial connection failed:', error);
        setSerialNotice(`${L('连接失败', 'Connection failed')}: ${error.message}`, 'error');
        addTerminalLine(`${L('连接失败', 'Connection failed')}: ${error.message}`, 'error');
    }
}

async function disconnectSerial() {
    state.isConnected = false;
    state.isReading = false;
    
    try {
        await releaseActiveSerialReader();
        if (state.writer) {
            await state.writer.close();
            state.writer = null;
        }
        if (state.port) {
            await state.port.close();
            state.port = null;
        }
    } catch (error) {
        console.error('Disconnect failed:', error);
    }
    
    state.connectionMode = null;
    state.serialWriteChain = Promise.resolve();
    clearCommandQueue();
    stopStatusPolling();
    updateConnectionUI();
    addTerminalLine(L('已断开连接', 'Disconnected'), 'system');
    setSerialNotice(L('串口已断开，请重新选择串口。', 'Serial port disconnected. Select a port again.'), 'warning');
    resetStatus();
}

async function releaseActiveSerialReader() {
    const reader = state.reader;
    if (!reader) return;

    try { await reader.cancel(); } catch (_) {}
    try { reader.releaseLock(); } catch (_) {}
    if (state.reader === reader) {
        state.reader = null;
    }
}

async function readSerialLoop() {
    if (!state.port || !state.isConnected) return;
    
    state.isReading = true;
    
    try {
        const decoder = new TextDecoder();
        state.reader = state.port.readable.getReader();
        let buffer = '';
        
        while (state.isConnected && state.isReading) {
            const { value, done } = await state.reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop();
            
            for (const line of lines) {
                if (line.trim()) {
                    processIncomingLine(line.trim());
                }
            }
        }
    } catch (error) {
        if (state.isConnected) {
            console.error('Read failed:', error);
            addTerminalLine(`${L('读取错误', 'Read error')}: ${error.message}`, 'error');
        }
    } finally {
        try { if (state.reader) state.reader.releaseLock(); } catch (_) {}
        state.reader = null;
    }
}

// ===== 更新连接状态 UI =====
function updateConnectionUI() {
    const isConnected = state.isConnected;
    
    if (isConnected) {
        elements.connectionStatus.classList.add('connected');
        elements.connectionStatus.querySelector('.status-text').textContent = L('已连接', 'Connected');
        elements.connectBtn.classList.add('connected');
        elements.connectBtn.querySelector('span').textContent = L('断开连接', 'Disconnect');
        elements.liveIndicator.classList.add('active');
        elements.commandInput.disabled = false;
        
        if (state.connectionMode === 'serial') {
            elements.portInfo.innerHTML = `<span class="port-name">Web Serial @ ${state.baudRate}bps</span>`;
        }
    } else {
        elements.connectionStatus.classList.remove('connected');
        elements.connectionStatus.querySelector('.status-text').textContent = L('未连接', 'Disconnected');
        elements.connectBtn.classList.remove('connected');
        elements.connectBtn.querySelector('span').textContent = L('连接设备', 'Connect Device');
        elements.portInfo.innerHTML = `<span class="no-port">${L('未选择串口', 'No serial port selected')}</span>`;
        elements.liveIndicator.classList.remove('active');
        elements.commandInput.disabled = true;
    }
}

function resetStatus() {
    state.grblStatus = {
        state: 'Unknown',
        mx: 0, my: 0, mz: 0,
        wx: 0, wy: 0, wz: 0,
        spindle: false,
        flood: false,
        mist: false,
        pins: ''
    };
    updateStatusDisplay();
}

// ===== 处理接收数据 =====
function processSerialText(text) {
    state.serialRxBuffer = (state.serialRxBuffer || '') + text;

    const lines = state.serialRxBuffer.split(/\r?\n/);
    state.serialRxBuffer = lines.pop() || '';

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line) processIncomingLine(line);
    }

    // GRBL status reports can occasionally arrive without a newline through
    // the proxy. Parse complete reports immediately so MPos fragments do not
    // leak into the terminal.
    const pending = state.serialRxBuffer.trim();
    if (pending.startsWith('<') && pending.endsWith('>')) {
        state.serialRxBuffer = '';
        processIncomingLine(pending);
    }
}

function processIncomingLine(line) {
    if (line.startsWith('<') && line.endsWith('>')) {
        parseStatusReport(line);
        if (state.manualStatusReportCount > 0) {
            state.manualStatusReportCount--;
            addTerminalLine(line, 'incoming');
        }
        return;
    }

    if (isStatusReportFragment(line)) {
        return;
    }

    addTerminalLine(line, 'incoming');
    if (line.includes('Grbl') && line.includes('[')) {
        addTerminalLine(`${L('GRBL 版本', 'GRBL version')}: ${line}`, 'system');
    }
    else if (line.startsWith('[MSG:')) {
        const msg = line.slice(5, -1);
        addTerminalLine(`${L('消息', 'Message')}: ${msg}`, 'system');
    }
    else if (line.startsWith('$') && line.includes('=')) {
        // 参数响应
    }
    else if (line === 'ok') {
        markCommandComplete();
    }
    else if (line.startsWith('error:')) {
        const errorCode = line.split(':')[1];
        addTerminalLine(`${L('错误代码', 'Error code')}: ${errorCode} - ${getErrorMessage(errorCode)}`, 'error');
        markCommandComplete();
    }
}

function isStatusReportFragment(line) {
    return line.startsWith('<') ||
        line.endsWith('>') ||
        line.includes('|MPos:') ||
        line.includes('|WPos:') ||
        line.includes('|FS:') ||
        line.includes('|Pn:') ||
        line.includes('|Ov:') ||
        line.includes('|A:');
}

// ===== 解析状态报告 =====
function parseStatusReport(report) {
    const content = report.slice(1, -1);
    const parts = content.split('|');
    
    let pinState = '';
    
    for (const part of parts) {
        if (!part.includes(':')) {
            state.grblStatus.state = part;
        } else {
            const [key, value] = part.split(':', 2);
            
            switch (key) {
                case 'MPos': {
                    const [x, y, z] = value.split(',').map(Number);
                    state.grblStatus.mx = x;
                    state.grblStatus.my = y;
                    state.grblStatus.mz = z;
                    break;
                }
                case 'WPos': {
                    const [x, y, z] = value.split(',').map(Number);
                    state.grblStatus.wx = x;
                    state.grblStatus.wy = y;
                    state.grblStatus.wz = z;
                    break;
                }
                case 'Pn': {
                    pinState = value;
                    state.grblStatus.pins = value;
                    break;
                }
                case 'FS': {
                    const [speed, feed] = value.split(',').map(Number);
                    elements.spindleSpeed.textContent = `${speed} RPM`;
                    break;
                }
                case 'A': {
                    state.grblStatus.spindle = value.includes('S');
                    state.grblStatus.flood = value.includes('F');
                    state.grblStatus.mist = value.includes('M');
                    break;
                }
            }
        }
    }
    
    updateStatusDisplay();
    updatePinStates(pinState);
}

// ===== 更新显示 =====
function updateStatusDisplay() {
    const stateColors = {
        'Idle': '#10b981',
        'Run': '#0ea5e9',
        'Hold': '#f59e0b',
        'Jog': '#8b5cf6',
        'Alarm': '#ef4444',
        'Door': '#f97316',
        'Check': '#06b6d4',
        'Home': '#84cc16',
        'Sleep': '#64748b'
    };
    
    const statusColor = stateColors[state.grblStatus.state] || '#94a3b8';
    elements.grblState.innerHTML = `<span style="color: ${statusColor}">${state.grblStatus.state}</span>`;
    elements.workMode.textContent = state.grblStatus.state === 'Check' ? L('检查模式', 'Check Mode') : L('正常模式', 'Normal Mode');
    
    elements.mx.textContent = state.grblStatus.mx.toFixed(3);
    elements.my.textContent = state.grblStatus.my.toFixed(3);
    elements.mz.textContent = state.grblStatus.mz.toFixed(3);
    elements.wx.textContent = state.grblStatus.wx.toFixed(3);
    elements.wy.textContent = state.grblStatus.wy.toFixed(3);
    elements.wz.textContent = state.grblStatus.wz.toFixed(3);
    
    let coolantText = L('关闭', 'Off');
    if (state.grblStatus.flood && state.grblStatus.mist) {
        coolantText = L('全部开启', 'All On');
    } else if (state.grblStatus.flood) {
        coolantText = 'Flood (M8)';
    } else if (state.grblStatus.mist) {
        coolantText = 'Mist (M7)';
    }
    elements.coolantState.textContent = coolantText;
    
    updateOutputButtons();
}

function updatePinStates(pinState) {
    const pins = pinState || '';
    
    updateInputItem(elements.limitX, pins.includes('X'), L('已触发', 'Triggered'), L('未触发', 'Inactive'));
    updateInputItem(elements.limitY, pins.includes('Y'), L('已触发', 'Triggered'), L('未触发', 'Inactive'));
    updateInputItem(elements.limitZ, pins.includes('Z'), L('已触发', 'Triggered'), L('未触发', 'Inactive'));
    updateInputItem(elements.probeInput, pins.includes('P'), L('已触发', 'Triggered'), L('未触发', 'Inactive'));
    updateInputItem(elements.abortInput, pins.includes('R'), L('急停!', 'Abort!'), L('正常', 'Normal'));
    updateInputItem(elements.holdInput, pins.includes('H'), L('保持中', 'Holding'), L('未触发', 'Inactive'));
    updateInputItem(elements.resumeInput, pins.includes('S'), L('恢复中', 'Resume Active'), L('未触发', 'Inactive'));
}

function updateInputItem(element, isActive, activeText, inactiveText) {
    if (!element) return;
    
    const stateEl = element.querySelector('.input-state');
    
    if (isActive) {
        element.classList.add('active');
        if (stateEl) stateEl.textContent = activeText;
    } else {
        element.classList.remove('active');
        if (stateEl) stateEl.textContent = inactiveText;
    }
}

function updateOutputButtons() {
    updateOutputButton(null, elements.spindleState, state.grblStatus.spindle);
    updateOutputButton(null, elements.mistState, state.grblStatus.mist);
    updateOutputButton(null, elements.floodState, state.grblStatus.flood);
    if (elements.mistToggle) elements.mistToggle.checked = state.grblStatus.mist;
    if (elements.floodToggle) elements.floodToggle.checked = state.grblStatus.flood;
}

function updateOutputButton(btn, stateEl, isOn) {
    if (!stateEl) return;
    
    if (isOn) {
        if (btn) btn.classList.add('on');
        stateEl.textContent = 'ON';
        stateEl.classList.add('on');
    } else {
        if (btn) btn.classList.remove('on');
        stateEl.textContent = 'OFF';
        stateEl.classList.remove('on');
    }
}

// ===== 发送命令 =====
function isRealtimeCommand(command) {
    return command === '?' || command === '!' || command === '~' || command === '\x18' || command === '\x85';
}

function displayCommand(command) {
    const names = {
        '\x18': 'Ctrl-X / Reset',
        '\x85': 'Jog Cancel'
    };
    return names[command] || command;
}

async function sendCommand(command, options = {}) {
    if (!state.isConnected) {
        addTerminalLine(L('未连接设备', 'Device not connected'), 'error');
        return false;
    }

    if (options.realtime || isRealtimeCommand(command)) {
        return sendRealtimeCommand(command, options);
    }

    return new Promise(resolve => {
        state.commandQueue.push({
            command,
            silent: Boolean(options.silent),
            warnOnTimeout: options.warnOnTimeout !== false && !options.silent,
            timeoutMs: options.timeoutMs || (options.silent ? 6000 : 5000),
            resolve
        });
        pumpCommandQueue();
    });
}

async function pumpCommandQueue() {
    if (state.waitingForResponse || state.commandQueue.length === 0 || !state.isConnected) {
        return;
    }

    const item = state.commandQueue.shift();
    state.currentCommand = item;
    state.waitingForResponse = true;

    try {
        if (state.connectionMode === 'serial') {
            await sendSerialLine(item.command);
        }

        if (!item.silent) {
            addTerminalLine(`> ${displayCommand(item.command)}`, 'outgoing');
        }

        clearTimeout(state.commandTimeout);
        state.commandTimeout = setTimeout(() => {
            if (state.waitingForResponse) {
                if (item.warnOnTimeout) {
                    addTerminalLine(`${L('命令等待超时，继续发送下一条', 'Command timed out, continuing')}: ${displayCommand(item.command)}`, 'warning');
                }
                markCommandComplete();
            }
        }, item.timeoutMs);
    } catch (error) {
        state.waitingForResponse = false;
        state.currentCommand = null;
        if (item.resolve) item.resolve(false);
        addTerminalLine(`${L('发送失败', 'Send failed')}: ${error.message}`, 'error');
        setTimeout(pumpCommandQueue, 0);
    }
}

function markCommandComplete() {
    clearTimeout(state.commandTimeout);
    state.commandTimeout = null;
    if (state.currentCommand && state.currentCommand.resolve) {
        state.currentCommand.resolve(true);
    }
    state.currentCommand = null;
    state.waitingForResponse = false;
    setTimeout(pumpCommandQueue, 0);
}

function clearCommandQueue() {
    state.commandQueue = [];
    if (state.currentCommand && state.currentCommand.resolve) {
        state.currentCommand.resolve(false);
    }
    state.currentCommand = null;
    state.waitingForResponse = false;
    clearTimeout(state.commandTimeout);
    state.commandTimeout = null;
}

async function sendSerialLine(command) {
    const encoder = new TextEncoder();
    await enqueueSerialWrite(encoder.encode(command + '\n'));
}

async function sendRealtimeCommand(command, options = {}) {
    if (!state.isConnected) {
        if (!options.silent) addTerminalLine(L('未连接设备', 'Device not connected'), 'error');
        return false;
    }

    if (command === '\x18') {
        clearCommandQueue();
    }

    const expectsManualStatus = command === '?' && !options.silent;
    if (expectsManualStatus) {
        state.manualStatusReportCount++;
    }

    try {
        const bytes = Array.from(command, ch => ch.charCodeAt(0) & 0xff);
        if (state.connectionMode === 'serial') {
            await sendSerialBytes(bytes);
        }

        if (!options.silent) {
            addTerminalLine(`> ${displayCommand(command)}`, 'outgoing');
        }
        return true;
    } catch (error) {
        if (expectsManualStatus && state.manualStatusReportCount > 0) {
            state.manualStatusReportCount--;
        }
        if (!options.silent) addTerminalLine(`${L('发送失败', 'Send failed')}: ${error.message}`, 'error');
        return false;
    }
}

async function sendSerialBytes(bytes) {
    await enqueueSerialWrite(new Uint8Array(bytes));
}

function enqueueSerialWrite(data) {
    state.serialWriteChain = state.serialWriteChain
        .catch(() => {})
        .then(async () => {
            const writer = state.port.writable.getWriter();
            try {
                await writer.write(data);
            } finally {
                writer.releaseLock();
            }
        });
    return state.serialWriteChain;
}

function startStatusPolling() {
    stopStatusPolling();
    state.pollTimer = setInterval(() => {
        if (state.isConnected) {
            sendRealtimeCommand('?', { silent: true });
        }
    }, 200);
}

function stopStatusPolling() {
    if (state.pollTimer) {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
    }
}

function sendManualCommand() {
    const input = elements.commandInput;
    const command = input.value.trim();
    
    if (command) {
        sendCommand(command);
        input.value = '';
        addToHistory(command);
    }
}

// 命令历史
let commandHistory = [];
let historyIndex = -1;

function addToHistory(command) {
    commandHistory.push(command);
    historyIndex = commandHistory.length;
}

document.addEventListener('keydown', (e) => {
    if (document.activeElement === elements.commandInput) {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyIndex > 0) {
                historyIndex--;
                elements.commandInput.value = commandHistory[historyIndex];
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                elements.commandInput.value = commandHistory[historyIndex];
            } else {
                historyIndex = commandHistory.length;
                elements.commandInput.value = '';
            }
        }
    }
});

// ===== Jog 控制 =====
function setJogStep(step) {
    state.jogStep = step;
    document.querySelectorAll('.step-btn').forEach(btn => {
        btn.classList.toggle('active', parseFloat(btn.dataset.step) === step);
    });
}

function startJog(axis, dir) {
    if (!state.isConnected) {
        addTerminalLine(L('请先连接设备', 'Connect the device first'), 'error');
        return;
    }
    
    if (state.grblStatus.state !== 'Idle' && state.grblStatus.state !== 'Jog') {
        addTerminalLine(L('主轴非空闲状态，无法Jog', 'GRBL is not idle, so jogging is not available'), 'error');
        return;
    }
    
    state.jogAxis = axis;
    state.jogDir = dir;
    state.isJogging = true;
    
    const feedrate = parseInt(document.getElementById('jogFeedrate').value) || 1000;
    const distance = state.jogStep * dir;
    const cmd = `$J=G91 ${axis}${distance} F${feedrate}`;
    
    sendCommand(cmd);
    
    // 如果按住不放，持续发送；队列会等待 ok/error，避免把 GRBL 塞满。
    if (state.jogInterval) clearInterval(state.jogInterval);
    state.jogInterval = setInterval(() => {
        if (state.isJogging) {
            sendCommand(cmd);
        }
    }, 300);
}

function stopJog() {
    state.isJogging = false;
    if (state.jogInterval) {
        clearInterval(state.jogInterval);
        state.jogInterval = null;
    }
    // 发送取消Jog命令
    if (state.isConnected) {
        sendRealtimeCommand('\x85');  // GRBL Jog Cancel
    }
}

function getNumberInput(id, fallback, min, max) {
    const input = document.getElementById(id);
    const value = parseFloat(input ? input.value : NaN);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function setSignalButtonsRunning(axis, running) {
    document.querySelectorAll('.signal-btn').forEach(btn => {
        const axisClass = axis ? axis.toLowerCase() : '';
        const isTarget = btn.classList.contains(`axis-${axisClass}`) || (axis === 'ALL' && btn.classList.contains('all'));
        btn.classList.toggle('running', running && isTarget);
        btn.disabled = running || (state.signalTestRunning && !isTarget);
    });
}

async function runSignalTest(axis) {
    if (state.signalTestRunning) {
        addTerminalLine(L('信号测试正在运行，请稍等。', 'Signal test is already running. Please wait.'), 'warning');
        return;
    }

    if (!state.isConnected) {
        addTerminalLine(L('请先连接设备', 'Connect the device first'), 'error');
        return;
    }

    if (state.grblStatus.state === 'Alarm') {
        addTerminalLine(L('GRBL 处于 Alarm 状态，请先确认安全后点击“解锁”。', 'GRBL is in Alarm. Confirm safety, then click Unlock.'), 'error');
        return;
    }

    if (!['X', 'Y', 'Z'].includes(axis)) return;

    state.signalTestRunning = true;
    setSignalButtonsRunning(axis, true);

    try {
        await runSignalAxis(axis);
    } finally {
        state.signalTestRunning = false;
        setSignalButtonsRunning(axis, false);
        sendRealtimeCommand('?', { silent: true });
    }
}

async function runAllSignalTest() {
    if (state.signalTestRunning) {
        addTerminalLine(L('信号测试正在运行，请稍等。', 'Signal test is already running. Please wait.'), 'warning');
        return;
    }

    if (!state.isConnected) {
        addTerminalLine(L('请先连接设备', 'Connect the device first'), 'error');
        return;
    }

    if (state.grblStatus.state === 'Alarm') {
        addTerminalLine(L('GRBL 处于 Alarm 状态，请先确认安全后点击“解锁”。', 'GRBL is in Alarm. Confirm safety, then click Unlock.'), 'error');
        return;
    }

    state.signalTestRunning = true;
    setSignalButtonsRunning('ALL', true);

    try {
        for (const axis of ['X', 'Y', 'Z']) {
            await runSignalAxis(axis);
        }
    } finally {
        state.signalTestRunning = false;
        setSignalButtonsRunning('ALL', false);
        sendRealtimeCommand('?', { silent: true });
    }
}

async function runSignalAxis(axis) {
    const step = getNumberInput('signalStep', 1, 0.01, 100);
    const feed = getNumberInput('signalFeedrate', 300, 10, 5000);
    const cycles = Math.round(getNumberInput('signalCycles', 3, 1, 20));
    const moveDelay = Math.max(250, Math.ceil((step / feed) * 60000) + 120);

    addTerminalLine(L(
        `开始 ${axis} 轴信号灯测试：${cycles} 次往返，${step}mm，F${feed}`,
        `Starting ${axis}-axis signal test: ${cycles} round trips, ${step} mm, F${feed}`
    ), 'system');

    for (let i = 0; i < cycles; i++) {
        await sendCommand(`$J=G91 G21 ${axis}${step} F${feed}`);
        await delay(moveDelay);
        await sendCommand(`$J=G91 G21 ${axis}${-step} F${feed}`);
        await delay(moveDelay);
    }

    addTerminalLine(L(`${axis} 轴信号灯测试完成`, `${axis}-axis signal test complete`), 'system');
}

// ===== 固件烧录 =====
async function programFirmware(type) {
    const info = firmwareInfo[type];

    try {
        if (!state.isConnected) {
            if (canUseWebSerial()) {
                state.baudRate = parseInt(elements.baudRate.value) || 115200;
                state.port = await navigator.serial.requestPort({
                    filters: [
                        { usbVendorId: 0x2341, usbProductId: 0x0043 },
                        { usbVendorId: 0x2341, usbProductId: 0x0001 },
                        { usbVendorId: 0x2A03, usbProductId: 0x0043 },
                        { usbVendorId: 0x1A86, usbProductId: 0x7523 },
                        { usbVendorId: 0x0403, usbProductId: 0x6001 },
                    ]
                });
                state.connectionMode = 'serial';
                addTerminalLine(L('已选择串口，将使用 Web Serial 直接烧录。', 'Serial port selected. Web Serial flashing will be used.'), 'system');
                setSerialNotice(L('已选择串口，正在准备 Web Serial 烧录。', 'Serial port selected. Preparing Web Serial flashing.'), 'success');
            } else {
                addTerminalLine(L('请先连接串口，烧录需要占用串口', 'Connect a serial port first. Flashing needs exclusive access.'), 'error');
                showModal(L('烧录提示', 'Flashing Notice'), `<p>${L('请使用 Chrome/Edge 通过 HTTPS 打开页面，然后点击连接设备选择串口。', 'Use Chrome/Edge over HTTPS, then click Connect Device to select a serial port.')}</p>`);
                return;
            }
        }

        const response = await fetch(info.path);
        if (!response.ok) throw new Error(L('固件文件不存在', 'Firmware file not found'));
        const hexContent = await response.text();

        if (state.connectionMode === 'serial') {
            startProgramViaWebSerial(info.title, hexContent);
        } else {
            showModal(L('烧录提示', 'Flashing Notice'), `<p>${L('请先连接主板串口，再点击烧录。', 'Connect the board serial port first, then click Flash.')}</p>`);
        }
    } catch (err) {
        addTerminalLine(`${L('烧录准备失败', 'Flash preparation failed')}: ${err.message}`, 'error');
    }
}

// ===== Web Serial 直接烧录 ATmega328P / Arduino Bootloader =====
const stk500 = {
    ok: 0x10,
    insync: 0x14,
    getSync: 0x30,
    setDevice: 0x42,
    loadAddress: 0x55,
    progPage: 0x64,
    leaveProgmode: 0x51,
    eop: 0x20,
    pageSize: 128,
    deviceParams: [
        0x86, 0x00, 0x00, 0x01, 0x01, 0x01, 0x01, 0x03,
        0xff, 0xff, 0xff, 0xff, 0x00, 0x80, 0x04, 0x00,
        0x00, 0x80, 0x00
    ]
};

async function startProgramViaWebSerial(name, hexContent) {
    if (!state.port) {
        addTerminalLine(L('Web Serial 串口未就绪，无法烧录。', 'Web Serial port is not ready for flashing.'), 'error');
        return;
    }

    if (state.isProgramming) {
        addTerminalLine(L('正在烧录中，请稍等。', 'Flashing is already in progress. Please wait.'), 'warning');
        return;
    }

    state.isProgramming = true;
    stopStatusPolling();
    clearCommandQueue();

    elements.programSection.style.display = 'block';
    elements.programName.textContent = name;
    updateProgramStatus(L('准备 Web Serial 直接烧录...', 'Preparing Web Serial flashing...'), 0);
    addTerminalLine(`${L('开始网页直烧', 'Starting Web Serial flashing')}: ${name}`, 'system');

    const port = state.port;
    const baudrate = parseInt(elements.baudRate.value) || state.baudRate || 115200;

    try {
        state.isConnected = false;
        state.isReading = false;
        updateConnectionUI();

        await releaseActiveSerialReader();

        await delay(150);
        await closePortIfOpen(port);
        await delay(200);

        const baudCandidates = [...new Set([baudrate, 115200, 57600])];
        let burned = false;
        let lastError = null;

        for (const bootBaud of baudCandidates) {
            try {
                updateProgramStatus(`${L('尝试 Bootloader 波特率', 'Trying bootloader baud rate')} ${bootBaud}...`, 3);
                await closePortIfOpen(port);
                await delay(200);
                await port.open({ baudRate: bootBaud });

                await programHexOnPort(port, hexContent, (stage, progress) => {
                    updateProgramStatus(`${stage} @ ${bootBaud}`, progress);
                });

                burned = true;
                break;
            } catch (error) {
                lastError = error;
                addTerminalLine(`${L('波特率', 'Baud rate')} ${bootBaud} ${L('烧录失败', 'flashing failed')}: ${error.message}`, 'warning');
                await cleanupWebSerialProgrammer();
                await closePortIfOpen(port);
                await delay(500);
            }
        }

        if (!burned) {
            throw lastError || new Error(L('所有 Bootloader 波特率都烧录失败', 'All bootloader baud rates failed'));
        }

        updateProgramStatus(L('烧录完成，正在重启主板...', 'Flash complete. Restarting the board...'), 100);
        addTerminalLine(L('网页直烧完成。', 'Web Serial flashing complete.'), 'system');
        showModal(L('烧录完成', 'Flash Complete'), `<p>${L(`${name} 已烧录到 PiBot V3.28 Isolated。`, `${name} has been flashed to PiBot V3.28 Isolated.`)}</p><p>${L('页面会重新连接串口，稍后即可测试。', 'The page will reconnect to the serial port for testing shortly.')}</p>`);
    } catch (error) {
        const friendlyError = getSerialOpenHint(error);
        addTerminalLine(`${L('网页直烧失败', 'Web Serial flashing failed')}: ${friendlyError}`, 'error');
        showModal(L('烧录失败', 'Flash Failed'), `
            <p>${L('网页直烧没有成功：', 'Web Serial flashing did not complete:')}</p>
            <pre style="color:var(--danger)">${friendlyError}</pre>
            <p>${L('请确认：', 'Please check:')}</p>
            <ul>
                <li>${L('关闭 Arduino IDE、XLoader、串口调试助手和其它网页标签页', 'Close Arduino IDE, XLoader, serial monitors, and other browser tabs')}</li>
                <li>${L('主板是 ATmega328P，并且有 Arduino/Optiboot bootloader', 'The board uses ATmega328P and has an Arduino/Optiboot bootloader')}</li>
                <li>${L('波特率通常选 115200；旧 Nano bootloader 可尝试 57600', '115200 is typical; older Nano bootloaders may need 57600')}</li>
                <li>${L('USB 串口 DTR/RESET 电路正常，或者烧录开始时手动按一下复位', 'The USB serial DTR/RESET circuit works, or press reset manually when flashing starts')}</li>
            </ul>
        `);
    } finally {
        await cleanupWebSerialProgrammer();
        await reconnectSerialAfterProgram(port);
        elements.programSection.style.display = 'none';
        state.isProgramming = false;
    }
}

function getSerialOpenHint(error) {
    const msg = (error && error.message) || String(error);
    if (/Failed to open serial port|Access denied|The port is busy|NetworkError|InvalidStateError/i.test(msg)) {
        return `${msg}\n\n${L('串口打不开，通常是 COM 口被占用。请关闭 Arduino IDE、XLoader、串口调试助手、其它浏览器标签页，拔插 USB 后再试。', 'The serial port usually fails to open because the COM port is busy. Close Arduino IDE, XLoader, serial monitors, and other browser tabs, then unplug and reconnect USB before trying again.')}`;
    }
    return msg;
}

async function programHexOnPort(port, hexContent, progressCallback) {
    const image = parseIntelHex(hexContent);
    if (!image.size) {
        throw new Error(L('HEX 文件为空或解析失败', 'HEX file is empty or could not be parsed'));
    }

    state.programRx = [];
    state.programReader = port.readable.getReader();
    state.programWriter = port.writable.getWriter();

    let readerRunning = true;
    const readTask = (async () => {
        while (readerRunning) {
            try {
                const { value, done } = await state.programReader.read();
                if (done) break;
                if (value) state.programRx.push(...value);
            } catch (_) {
                break;
            }
        }
    })();

    try {
        progressCallback(L('复位主板，等待 Bootloader...', 'Resetting board and waiting for bootloader...'), 5);
        await resetPortForBootloader(port);

        progressCallback(L('同步 Bootloader...', 'Synchronizing bootloader...'), 8);
        if (!await stkGetSync(20)) {
            throw new Error(L('无法同步 Bootloader。请确认 bootloader 存在，或在开始烧录时按一下主板复位键。', 'Could not synchronize with the bootloader. Confirm the bootloader is present, or press the board reset button when flashing starts.'));
        }

        progressCallback(L('Bootloader 已同步，开始写入 Flash...', 'Bootloader synchronized. Writing flash...'), 12);

        const totalPages = Math.ceil((image.maxAddress - image.minAddress + 1) / stk500.pageSize);
        let pageIndex = 0;

        for (let address = image.minAddress; address <= image.maxAddress; address += stk500.pageSize) {
            const pct = 15 + Math.round((pageIndex / Math.max(1, totalPages)) * 80);
            progressCallback(`${L('写入 Flash', 'Writing flash')} 0x${address.toString(16).padStart(4, '0')}...`, pct);

            if (!await stkLoadAddress(address)) {
                throw new Error(`${L('设置写入地址失败', 'Failed to set write address')}: 0x${address.toString(16).padStart(4, '0')}`);
            }

            const page = new Uint8Array(stk500.pageSize);
            page.fill(0xff);
            for (let i = 0; i < stk500.pageSize; i++) {
                const value = image.data.get(address + i);
                if (value !== undefined) page[i] = value;
            }

            if (!await stkProgramPage(page)) {
                await delay(100);
                if (!await stkProgramPage(page)) {
                    throw new Error(`${L('写入 Flash 失败', 'Failed to write flash')}: 0x${address.toString(16).padStart(4, '0')}`);
                }
            }

            pageIndex++;
        }

        progressCallback(L('退出 Bootloader...', 'Leaving bootloader...'), 98);
        await stkWrite([stk500.leaveProgmode, stk500.eop]);
        await delay(100);
    } finally {
        readerRunning = false;
        try { await state.programReader.cancel(); } catch (_) {}
        try { await readTask; } catch (_) {}
    }
}

function parseIntelHex(hexContent) {
    const data = new Map();
    let baseAddress = 0;
    let minAddress = Number.POSITIVE_INFINITY;
    let maxAddress = 0;

    for (const rawLine of hexContent.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        if (!line.startsWith(':')) throw new Error(`${L('HEX 行格式错误', 'Invalid HEX line format')}: ${line}`);

        const byteCount = parseInt(line.slice(1, 3), 16);
        const address = parseInt(line.slice(3, 7), 16);
        const recordType = parseInt(line.slice(7, 9), 16);
        const bytes = [];
        let checksum = byteCount + (address >> 8) + (address & 0xff) + recordType;

        for (let i = 0; i < byteCount; i++) {
            const b = parseInt(line.slice(9 + i * 2, 11 + i * 2), 16);
            bytes.push(b);
            checksum += b;
        }

        const expected = parseInt(line.slice(9 + byteCount * 2, 11 + byteCount * 2), 16);
        if (((checksum + expected) & 0xff) !== 0) {
            throw new Error(`${L('HEX 校验失败', 'HEX checksum failed')}: ${line}`);
        }

        if (recordType === 0x00) {
            const fullAddress = baseAddress + address;
            for (let i = 0; i < bytes.length; i++) {
                const addr = fullAddress + i;
                data.set(addr, bytes[i]);
                minAddress = Math.min(minAddress, addr);
                maxAddress = Math.max(maxAddress, addr);
            }
        } else if (recordType === 0x01) {
            break;
        } else if (recordType === 0x02) {
            baseAddress = ((bytes[0] << 8) | bytes[1]) << 4;
        } else if (recordType === 0x04) {
            baseAddress = ((bytes[0] << 8) | bytes[1]) << 16;
        }
    }

    if (!data.size) {
        minAddress = 0;
    }

    return { data, minAddress, maxAddress, size: data.size };
}

async function resetPortForBootloader(port) {
    state.programRx = [];
    if (port.setSignals) {
        try {
            await port.setSignals({ dataTerminalReady: false, requestToSend: false });
            await delay(80);
            await port.setSignals({ dataTerminalReady: true, requestToSend: true });
        } catch (_) {}
    }
    await delay(650);
    state.programRx = [];
}

async function stkGetSync(retries) {
    for (let i = 0; i < retries; i++) {
        state.programRx = [];
        await stkWrite([stk500.getSync, stk500.eop]);
        if (await stkWaitOk(i < 4 ? 180 : 320)) {
            return true;
        }
        await delay(60);
    }
    return false;
}

async function stkLoadAddress(byteAddress) {
    const wordAddress = Math.floor(byteAddress / 2);
    return stkCommand([
        stk500.loadAddress,
        wordAddress & 0xff,
        (wordAddress >> 8) & 0xff,
        stk500.eop
    ], 500);
}

async function stkProgramPage(page) {
    return stkCommand([
        stk500.progPage,
        (stk500.pageSize >> 8) & 0xff,
        stk500.pageSize & 0xff,
        0x46,
        ...page,
        stk500.eop
    ], 800);
}

async function stkCommand(bytes, timeout) {
    state.programRx = [];
    await stkWrite(bytes);
    return stkWaitOk(timeout);
}

async function stkWrite(bytes) {
    await state.programWriter.write(new Uint8Array(bytes));
}

async function stkWaitOk(timeout) {
    const deadline = performance.now() + timeout;
    while (performance.now() < deadline) {
        const insyncIndex = state.programRx.indexOf(stk500.insync);
        if (insyncIndex !== -1) {
            const okIndex = state.programRx.indexOf(stk500.ok, insyncIndex + 1);
            if (okIndex !== -1) {
                state.programRx.splice(0, okIndex + 1);
                return true;
            }
        }
        await delay(10);
    }
    return false;
}

async function cleanupWebSerialProgrammer() {
    try { if (state.programWriter) state.programWriter.releaseLock(); } catch (_) {}
    state.programWriter = null;
    try { if (state.programReader) state.programReader.releaseLock(); } catch (_) {}
    state.programReader = null;
    state.programRx = [];
    await delay(150);
}

async function reconnectSerialAfterProgram(port) {
    try {
        await closePortIfOpen(port);
        await delay(1200);
        await port.open({ baudRate: state.baudRate || parseInt(elements.baudRate.value) || 115200 });
        state.port = port;
        state.connectionMode = 'serial';
        state.isConnected = true;
        state.isReading = true;
        state.serialWriteChain = Promise.resolve();
        updateConnectionUI();
        readSerialLoop();
        startStatusPolling();
        setSerialNotice(L('烧录后已自动重新连接串口。', 'Serial port reconnected after flashing.'), 'success');
        setTimeout(() => sendCommand('$I', { silent: true, timeoutMs: 6000, warnOnTimeout: false }), 1200);
        setTimeout(() => sendRealtimeCommand('?', { silent: true }), 1000);
    } catch (error) {
        state.isConnected = false;
        state.connectionMode = null;
        updateConnectionUI();
        setSerialNotice(`${L('烧录后自动重连失败', 'Reconnect after flashing failed')}: ${error.message}`, 'warning');
        addTerminalLine(`${L('烧录后自动重连失败，请手动重新连接', 'Reconnect after flashing failed. Please reconnect manually')}: ${error.message}`, 'warning');
    }
}

async function closePortIfOpen(port) {
    try {
        if (port.readable || port.writable) {
            await port.close();
        }
    } catch (_) {}
}

function cancelProgram() {
    elements.programSection.style.display = 'none';
    addTerminalLine(L('烧录已取消', 'Flashing canceled'), 'system');
}

function updateProgramStatus(stage, progress) {
    elements.programStage.textContent = stage;
    elements.progressFill.style.width = progress + '%';
}

// ===== 输出控制 =====
function sendOutputCommand(command) {
    if (!state.isConnected) {
        addTerminalLine(L('请先连接设备', 'Connect the device first'), 'error');
        return;
    }

    applyOutputOptimisticState(command);
    sendCommand(command);
    refreshStatusSoon();
}

function setCoolantOutput(type, enabled) {
    if (!state.isConnected) {
        addTerminalLine(L('请先连接设备', 'Connect the device first'), 'error');
        if (type === 'mist' && elements.mistToggle) elements.mistToggle.checked = state.grblStatus.mist;
        if (type === 'flood' && elements.floodToggle) elements.floodToggle.checked = state.grblStatus.flood;
        return;
    }

    let command = '';
    if (enabled) {
        command = type === 'mist' ? 'M7' : 'M8';
    } else {
        command = 'M9';
    }

    if (type === 'mist') {
        state.grblStatus.mist = enabled;
        if (!enabled) state.grblStatus.flood = false;
    } else {
        state.grblStatus.flood = enabled;
        if (!enabled) state.grblStatus.mist = false;
    }
    updateStatusDisplay();

    setCoolantTogglesDisabled(true);
    sendCommand(command);
    refreshStatusSoon();
    setTimeout(() => setCoolantTogglesDisabled(false), 450);
}

function applyOutputOptimisticState(command) {
    const upper = command.toUpperCase();
    if (upper.startsWith('M3') || upper.startsWith('M4')) {
        state.grblStatus.spindle = true;
    } else if (upper.startsWith('M5')) {
        state.grblStatus.spindle = false;
    } else if (upper.startsWith('M7')) {
        state.grblStatus.mist = true;
    } else if (upper.startsWith('M8')) {
        state.grblStatus.flood = true;
    } else if (upper.startsWith('M9')) {
        state.grblStatus.mist = false;
        state.grblStatus.flood = false;
    }
    updateStatusDisplay();
}

function refreshStatusSoon() {
    setTimeout(() => sendRealtimeCommand('?', { silent: true }), 80);
    setTimeout(() => sendRealtimeCommand('?', { silent: true }), 300);
}

function setCoolantTogglesDisabled(disabled) {
    if (elements.mistToggle) elements.mistToggle.disabled = disabled;
    if (elements.floodToggle) elements.floodToggle.disabled = disabled;
}

function toggleOutput(type) {
    if (!state.isConnected) {
        addTerminalLine(L('请先连接设备', 'Connect the device first'), 'error');
        return;
    }
    
    let command = '';
    
    switch (type) {
        case 'spindle':
            if (state.grblStatus.spindle) {
                command = 'M5';
            } else {
                command = 'M3 S1000';
            }
            break;
        case 'mist':
            if (state.grblStatus.mist) {
                command = 'M9';
            } else {
                command = 'M7';
            }
            break;
        case 'flood':
            if (state.grblStatus.flood) {
                command = 'M9';
            } else {
                command = 'M8';
            }
            break;
    }
    
    if (command) {
        sendCommand(command);
        setTimeout(() => sendRealtimeCommand('?', { silent: true }), 200);
    }
}

// ===== 终端 =====
function addTerminalLine(text, type = '') {
    const line = document.createElement('div');
    line.className = `terminal-line ${type}`;
    line.textContent = text;
    
    elements.terminalOutput.appendChild(line);
    
    const container = elements.terminalOutput.parentElement;
    container.scrollTop = container.scrollHeight;
    
    while (elements.terminalOutput.children.length > 500) {
        elements.terminalOutput.removeChild(elements.terminalOutput.firstChild);
    }
}

function clearTerminal() {
    elements.terminalOutput.innerHTML = '';
    addTerminalLine(L('终端已清空', 'Terminal cleared'), 'system');
}

// ===== 错误代码解析 =====
function getErrorMessage(code) {
    const zhErrors = {
        '1': 'G代码命令字母缺少数字值或不支持',
        '2': '校准命令缺少$或值无效',
        '3': 'Grbl "$" 系统命令不支持或无效',
        '4': '负值或无效值',
        '5': '复位中，忽略设置锁定',
        '6': '非空闲时无法执行命令',
        '7': '步进速率过快，超出最大值',
        '8': '检测到暂停',
        '9': '门已打开，无法执行命令',
        '10': '软限位错误，无法执行',
        '11': '行太长',
        '12': '步进脉冲忽略',
        '13': '安全门打开',
        '14': '线路格式错误',
        '15': '无法通过jog命令重置',
        '16': '设置值超出范围',
        '17': '激光模式需要PWM输出',
        '20': '不支持G代码命令',
        '21': '同一句中多个G代码命令',
        '22': '进给率未设置',
        '23': '同一句中多次使用G代码命令字',
        '24': '轴字缺失',
        '25': 'G代码中有未使用的轴字',
        '26': '主轴转速过大',
        '27': '无安全门支持',
        '28': '缺少轴字',
        '29': '无效工作区',
        '30': '无效G代码ID:30',
        '31': 'G参数无效',
        '32': 'G2/G3弧需要至少一个轴字',
        '33': '运动目标无效',
        '34': 'G2/G3弧半径无效',
        '35': 'G2/G3弧未找到有效起点',
        '36': 'G2/G3弧角度过短',
        '37': 'G43.1动态长度补偿无效',
        '38': '刀具编号无效',
        '39': '使用G28/30时轴字非法',
        '40': '未启用G28/30原点返回',
        '41': '激光模式禁用',
        '42': 'G代码启用需要PWM',
    };
    const enErrors = {
        '1': 'G-code word is missing a value or is unsupported',
        '2': 'Numeric value format is invalid',
        '3': 'Grbl "$" system command is unsupported or invalid',
        '4': 'Negative value or invalid value',
        '5': 'Setting is locked during reset',
        '6': 'Command cannot execute while GRBL is not idle',
        '7': 'Step pulse time must be greater than 3 usec',
        '8': 'EEPROM read failed. Reset and restored to defaults',
        '9': 'G-code locked out during alarm or jog state',
        '10': 'Soft limit error',
        '11': 'Line overflow',
        '12': 'Max step rate exceeded',
        '13': 'Safety door detected as opened',
        '14': 'Build info or startup line exceeded EEPROM line length',
        '15': 'Jog target exceeds machine travel',
        '16': 'Jog command has no "=" or contains prohibited G-code',
        '17': 'Laser mode requires PWM output',
        '20': 'Unsupported or invalid G-code command',
        '21': 'More than one modal G-code command in a modal group',
        '22': 'Feed rate has not been set',
        '23': 'G-code command requires an integer value',
        '24': 'Two G-code commands require the same axis word',
        '25': 'Repeated G-code word found in block',
        '26': 'No axis words found in command block',
        '27': 'Line number value is invalid',
        '28': 'G-code command is missing a required value word',
        '29': 'G59.x work coordinate systems are not supported',
        '30': 'G53 is only valid with G0 or G1',
        '31': 'Axis words are found in a block with no motion command',
        '32': 'G2/G3 arc requires at least one axis word',
        '33': 'Motion target is invalid',
        '34': 'G2/G3 arc radius is invalid',
        '35': 'G2/G3 arc is missing a valid start point',
        '36': 'G2/G3 arc angle is too short',
        '37': 'G43.1 dynamic tool length offset is invalid',
        '38': 'Tool number is invalid',
        '39': 'Axis words are invalid with G28/G30',
        '40': 'G28/G30 home position is not enabled',
        '41': 'Laser mode is disabled',
        '42': 'G-code command requires PWM output',
    };
    
    const errors = appLang === 'zh' ? zhErrors : enErrors;
    return errors[code] || L('未知错误', 'Unknown error');
}

// ===== 页面可见性变化 =====
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.isConnected) {
        sendRealtimeCommand('?', { silent: true });
    }
});
