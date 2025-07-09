// YouTube SRT 扩展设置面板
document.addEventListener('DOMContentLoaded', function() {
    // 默认设置
    const defaultSettings = {
        maxLength: 40,
        fontSize: 16,
        position: 'bottom',
        theme: 'default',
        autoSplit: true,
        showOutline: true,
        showBackground: true
    };

    // 获取DOM元素
    const elements = {
        maxLength: document.getElementById('maxLength'),
        maxLengthValue: document.getElementById('maxLengthValue'),
        fontSize: document.getElementById('fontSize'),
        fontSizeValue: document.getElementById('fontSizeValue'),
        position: document.getElementById('position'),
        theme: document.getElementById('theme'),
        autoSplit: document.getElementById('autoSplit'),
        showOutline: document.getElementById('showOutline'),
        showBackground: document.getElementById('showBackground'),
        loadSrt: document.getElementById('loadSrt'),
        clearSrt: document.getElementById('clearSrt'),
        resetSettings: document.getElementById('resetSettings'),
        exportSettings: document.getElementById('exportSettings'),
        status: document.getElementById('status'),
        fileInput: document.getElementById('fileInput')
    };

    // 加载保存的设置
    function loadSettings() {
        chrome.storage.sync.get(defaultSettings, function(items) {
            elements.maxLength.value = items.maxLength;
            elements.maxLengthValue.textContent = items.maxLength;
            elements.fontSize.value = items.fontSize;
            elements.fontSizeValue.textContent = items.fontSize + 'px';
            elements.position.value = items.position;
            elements.theme.value = items.theme;
            elements.autoSplit.checked = items.autoSplit;
            elements.showOutline.checked = items.showOutline;
            elements.showBackground.checked = items.showBackground;
        });
    }

    // 保存设置
    function saveSettings() {
        const settings = {
            maxLength: parseInt(elements.maxLength.value),
            fontSize: parseInt(elements.fontSize.value),
            position: elements.position.value,
            theme: elements.theme.value,
            autoSplit: elements.autoSplit.checked,
            showOutline: elements.showOutline.checked,
            showBackground: elements.showBackground.checked
        };

        chrome.storage.sync.set(settings, function() {
            showStatus('设置已保存', 'success');
            // 通知content script更新设置
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'updateSettings',
                    settings: settings
                });
            });
        });
    }

    // 显示状态消息
    function showStatus(message, type = 'info') {
        elements.status.textContent = message;
        elements.status.className = `status ${type}`;
        setTimeout(() => {
            elements.status.textContent = '';
            elements.status.className = 'status';
        }, 2000);
    }

    // 事件监听器
    elements.maxLength.addEventListener('input', function() {
        elements.maxLengthValue.textContent = this.value;
        saveSettings();
    });

    elements.fontSize.addEventListener('input', function() {
        elements.fontSizeValue.textContent = this.value + 'px';
        saveSettings();
    });

    elements.position.addEventListener('change', saveSettings);
    elements.theme.addEventListener('change', saveSettings);
    elements.autoSplit.addEventListener('change', saveSettings);
    elements.showOutline.addEventListener('change', saveSettings);
    elements.showBackground.addEventListener('change', saveSettings);

    // 加载字幕文件
    elements.loadSrt.addEventListener('click', function() {
        elements.fileInput.click();
    });

    elements.fileInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            // 发送到content script
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'loadSrtFile',
                    content: content
                }, function(response) {
                    if (response && response.success) {
                        showStatus(`成功加载 ${response.count} 条字幕`, 'success');
                    } else {
                        showStatus('加载失败', 'error');
                    }
                });
            });
        };
        reader.readAsText(file);
        event.target.value = '';
    });

    // 清除字幕
    elements.clearSrt.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: 'clearSubtitles'
            }, function(response) {
                if (response && response.success) {
                    showStatus('字幕已清除', 'success');
                } else {
                    showStatus('清除失败', 'error');
                }
            });
        });
    });

    // 重置设置
    elements.resetSettings.addEventListener('click', function() {
        if (confirm('确定要重置所有设置吗？')) {
            chrome.storage.sync.set(defaultSettings, function() {
                loadSettings();
                showStatus('设置已重置', 'success');
            });
        }
    });

    // 导出设置
    elements.exportSettings.addEventListener('click', function() {
        chrome.storage.sync.get(defaultSettings, function(items) {
            const blob = new Blob([JSON.stringify(items, null, 2)], {
                type: 'application/json'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'youtube-srt-settings.json';
            a.click();
            URL.revokeObjectURL(url);
            showStatus('设置已导出', 'success');
        });
    });

    // 初始化
    loadSettings();

    // 检查当前标签页状态
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const url = tabs[0].url;
        if (url.includes('youtube.com/watch')) {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: 'getStatus'
            }, function(response) {
                if (response && response.subtitleCount > 0) {
                    showStatus(`已加载 ${response.subtitleCount} 条字幕`, 'info');
                }
            });
        } else {
            showStatus('请在YouTube视频页面使用', 'warning');
        }
    });
});