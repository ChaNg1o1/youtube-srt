// 全局设置
let globalSettings = {
    maxLength: 40,
    fontSize: 16,
    position: 'bottom',
    theme: 'default',
    autoSplit: true,
    showOutline: true,
    showBackground: true
};

// 加载设置
function loadSettings() {
    chrome.storage.sync.get(globalSettings, function(items) {
        globalSettings = items;
        applySettings();
    });
}

// 应用设置
function applySettings() {
    const subtitleDisplay = document.getElementById('srt-subtitle-display');
    if (subtitleDisplay) {
        updateSubtitleStyles(subtitleDisplay);
    }
}

// 更新字幕样式
function updateSubtitleStyles(element) {
    const baseStyles = {
        fontSize: globalSettings.fontSize + 'px',
        fontFamily: 'Arial, sans-serif',
        fontWeight: '600',
        lineHeight: '1.4',
        textAlign: 'center',
        padding: '8px 16px',
        borderRadius: '6px',
        maxWidth: '80%',
        margin: '0 auto',
        wordWrap: 'break-word',
        whiteSpace: 'pre-line',
        zIndex: '9999',
        pointerEvents: 'none',
        transition: 'all 0.3s ease'
    };

    // 位置设置
    switch (globalSettings.position) {
        case 'top':
            Object.assign(baseStyles, {
                position: 'absolute',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)'
            });
            break;
        case 'center':
            Object.assign(baseStyles, {
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)'
            });
            break;
        default: // bottom
            Object.assign(baseStyles, {
                position: 'absolute',
                bottom: '80px',
                left: '50%',
                transform: 'translateX(-50%)'
            });
    }

    // 主题设置
    switch (globalSettings.theme) {
        case 'dark':
            Object.assign(baseStyles, {
                color: '#ffffff',
                backgroundColor: globalSettings.showBackground ? 'rgba(0, 0, 0, 0.8)' : 'transparent',
                textShadow: globalSettings.showOutline ? '2px 2px 4px rgba(0, 0, 0, 0.8)' : 'none'
            });
            break;
        case 'light':
            Object.assign(baseStyles, {
                color: '#000000',
                backgroundColor: globalSettings.showBackground ? 'rgba(255, 255, 255, 0.9)' : 'transparent',
                textShadow: globalSettings.showOutline ? '1px 1px 2px rgba(255, 255, 255, 0.8)' : 'none'
            });
            break;
        default: // default theme
            Object.assign(baseStyles, {
                color: '#ffffff',
                backgroundColor: globalSettings.showBackground ? 'rgba(0, 0, 0, 0.7)' : 'transparent',
                textShadow: globalSettings.showOutline ? '1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)' : 'none'
            });
    }

    // 应用样式
    Object.assign(element.style, baseStyles);
}

// 监听设置更新
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    switch (request.type) {
        case 'updateSettings':
            globalSettings = request.settings;
            applySettings();
            sendResponse({success: true});
            break;
        case 'loadSrtFile':
            subtitles = parseSRT(request.content);
            sendResponse({success: true, count: subtitles.length});
            break;
        case 'clearSubtitles':
            subtitles = [];
            const display = document.getElementById('srt-subtitle-display');
            if (display) {
                display.style.visibility = 'hidden';
                display.innerHTML = '';
            }
            sendResponse({success: true});
            break;
        case 'getStatus':
            sendResponse({subtitleCount: subtitles.length});
            break;
    }
});

let subtitles = [];
let videoElement = null;

// 1. 长句分割算法
function splitLongText(text, maxLineLength = null) {
    const maxLength = maxLineLength || globalSettings.maxLength;
    
    if (!globalSettings.autoSplit) {
        return text;
    }
    
    const cleanText = text.replace(/<br>/g, '\n').replace(/\n/g, ' ').trim();
    
    if (cleanText.length <= maxLength) {
        return text;
    }
    
    const sentences = cleanText.split(/([.!?。！？]+)/);
    const result = [];
    let currentLine = '';
    
    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        
        if (currentLine.length + sentence.length <= maxLength) {
            currentLine += sentence;
        } else {
            if (currentLine.trim()) {
                result.push(currentLine.trim());
                currentLine = sentence;
            } else {
                const words = sentence.split(/\s+/);
                let tempLine = '';
                
                for (const word of words) {
                    if (tempLine.length + word.length + 1 <= maxLength) {
                        tempLine += (tempLine ? ' ' : '') + word;
                    } else {
                        if (tempLine.trim()) {
                            result.push(tempLine.trim());
                        }
                        tempLine = word;
                    }
                }
                
                if (tempLine.trim()) {
                    currentLine = tempLine;
                }
            }
        }
    }
    
    if (currentLine.trim()) {
        result.push(currentLine.trim());
    }
    
    return result.join('<br>');
}

// 2. SRT解析函数 (带长句分割)
function parseSRT(data) {
    const srtRegex = /(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n([\s\S]*?)(?=\n\n|\n*$)/g;
    let match;
    const parsedSubtitles = [];
    const timeToSeconds = (timeStr) => {
        const parts = timeStr.split(/[:,]/);
        return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10) + parseInt(parts[3], 10) / 1000;
    };
    while ((match = srtRegex.exec(data)) !== null) {
        const originalText = match[4].replace(/\n/g, '<br>');
        const splitText = splitLongText(originalText);
        parsedSubtitles.push({
            index: parseInt(match[1], 10),
            start: timeToSeconds(match[2]),
            end: timeToSeconds(match[3]),
            text: splitText
        });
    }
    return parsedSubtitles;
}

// 2. 确保所有UI元素都存在 (核心修改)
function ensureSubtitleUI() {
    // 检查我们自己的字幕显示区域
    let subtitleDisplay = document.getElementById('srt-subtitle-display');
    if (subtitleDisplay && document.body.contains(subtitleDisplay)) {
        updateSubtitleStyles(subtitleDisplay);
        return subtitleDisplay; // 如果已存在，应用样式后返回
    }

    // 检查YT的字幕容器，或者我们自己创建的容器
    let captionContainer = document.querySelector('.ytp-caption-window-container');
    if (!captionContainer) {
        const player = document.querySelector('.html5-video-player');
        if (!player) {
            return null;
        }
        captionContainer = document.createElement('div');
        // 添加YT的类名以获得一些基础样式，并添加我们自己的类名用于定位
        captionContainer.className = 'ytp-caption-window-container srt-custom-container';
        captionContainer.style.position = 'relative';
        captionContainer.style.width = '100%';
        captionContainer.style.height = '100%';
        captionContainer.style.pointerEvents = 'none';
        player.appendChild(captionContainer);
    }

    // 创建并注入我们自己的字幕显示div
    subtitleDisplay = document.createElement('div');
    subtitleDisplay.id = 'srt-subtitle-display';
    captionContainer.appendChild(subtitleDisplay);
    
    // 应用样式
    updateSubtitleStyles(subtitleDisplay);
    
    
    return subtitleDisplay;
}


// 3. 字幕同步和显示函数
function displaySubtitles() {
    if (!videoElement || subtitles.length === 0) return;

    const subtitleDisplay = ensureSubtitleUI();
    if (!subtitleDisplay) return; // 如果UI创建失败，则跳过

    const currentTime = videoElement.currentTime;
    const currentSubtitle = subtitles.find(sub => currentTime >= sub.start && currentTime <= sub.end);

    if (currentSubtitle) {
        subtitleDisplay.innerHTML = currentSubtitle.text;
        subtitleDisplay.style.visibility = 'visible';
    } else {
        subtitleDisplay.style.visibility = 'hidden';
        subtitleDisplay.innerHTML = '';
    }
}

// 4. 文件处理
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const srtContent = e.target.result;
        subtitles = parseSRT(srtContent);
        event.target.value = '';
    };
    reader.readAsText(file);
}

// 5. 创建加载按钮
function setupLoadButton() {
    if (document.getElementById('srt-load-button')) {
        return true;
    }

    const playerControls = document.querySelector('.ytp-right-controls');
    
    if (playerControls) {
        const srtButton = document.createElement('button');
        srtButton.id = 'srt-load-button';
        srtButton.className = 'ytp-button';
        srtButton.title = '加载本地SRT字幕';
        srtButton.innerText = 'SRT';
        srtButton.style.display = 'flex';
        srtButton.style.visibility = 'visible';
        
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.srt';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', handleFileSelect);
        srtButton.addEventListener('click', () => fileInput.click());
        
        const leftControls = document.querySelector('.ytp-left-controls');
        if (leftControls) {
            leftControls.appendChild(srtButton);
            leftControls.appendChild(fileInput);
        } else {
            const titleArea = document.querySelector('#title h1');
            if (titleArea) {
                const buttonContainer = document.createElement('div');
                buttonContainer.style.display = 'inline-block';
                buttonContainer.style.marginLeft = '16px';
                buttonContainer.appendChild(srtButton);
                buttonContainer.appendChild(fileInput);
                titleArea.parentElement.appendChild(buttonContainer);
            } else {
                const floatingContainer = document.createElement('div');
                floatingContainer.style.position = 'fixed';
                floatingContainer.style.top = '20px';
                floatingContainer.style.right = '20px';
                floatingContainer.style.zIndex = '10000';
                floatingContainer.style.backgroundColor = 'transparent';
                floatingContainer.style.padding = '8px';
                floatingContainer.style.borderRadius = '4px';
                floatingContainer.appendChild(srtButton);
                floatingContainer.appendChild(fileInput);
                document.body.appendChild(floatingContainer);
            }
        }
        
        return true;
    }
    return false;
}

// 6. 初始化脚本
function initialize() {
    
    // 加载设置
    loadSettings();
    
    videoElement = document.querySelector('video');

    if (videoElement) {
        const setupInterval = setInterval(() => {
            if (setupLoadButton()) {
                clearInterval(setupInterval);
            }
        }, 1000);

        videoElement.addEventListener('timeupdate', displaySubtitles);
    } else {
        setTimeout(initialize, 500);
    }
}

// 处理YouTube单页应用导航
let lastUrl = location.href;
const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        subtitles = [];
        videoElement = null;
        initialize();
    }
});
observer.observe(document.body, { childList: true, subtree: true });

initialize();