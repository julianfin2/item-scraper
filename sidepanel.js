// DOM Elements
const apiKeyInput = document.getElementById('apiKey');
const apiKeyLabel = document.getElementById('apiKeyLabel');
const providerSelect = document.getElementById('providerSelect');
const scriptUrlInput = document.getElementById('scriptUrl');
const modelInput = document.getElementById('modelInput');
const saveConfigBtn = document.getElementById('saveConfig');
const statusBadge = document.getElementById('statusBadge');
const resultsArea = document.getElementById('results');

// Preset Management Elements
const newPresetName = document.getElementById('newPresetName');
const newPresetSheet = document.getElementById('newPresetSheet');
const newPresetFields = document.getElementById('newPresetFields');
const addPresetBtn = document.getElementById('addPreset');
const cancelEditBtn = document.getElementById('cancelEdit');
const presetList = document.getElementById('presetList');
const presetSelect = document.getElementById('presetSelect');
const runPresetBtn = document.getElementById('runPreset');

// Import/Export Elements
const exportBtn = document.getElementById('exportPresets');
const importBtn = document.getElementById('importPresets');
const importInput = document.getElementById('importInput');

// Collapsible logic
const toggleConfig = document.getElementById('toggleConfig');
const configContent = document.getElementById('configContent');
const configChevron = document.getElementById('configChevron');

const DEFAULT_PRESETS = [
  { id: 'p1', name: '提取笔记本', sheetName: '笔记本', fields: '品牌, CPU, 内存, 存储, 价格, URL' },
  { id: 'p2', name: '提取外设', sheetName: '外设', fields: '品牌, 型号, 连接方式, 电池寿命, 价格, URL' }
];

const MODEL_PROVIDERS = {
  gemini: {
    name: 'Gemini',
    apiKeyStorageKey: 'geminiApiKey',
    modelStorageKey: 'geminiModel',
    defaultModel: 'gemini-1.5-flash',
    modelPlaceholder: '例如：gemini-1.5-flash'
  },
  openai: {
    name: 'OpenAI',
    apiKeyStorageKey: 'openaiApiKey',
    modelStorageKey: 'openaiModel',
    defaultModel: 'gpt-4.1-mini',
    modelPlaceholder: '例如：gpt-4.1-mini'
  }
};

const DEFAULT_PROVIDER = 'openai';

let currentPresets = [];
let editingPresetId = null;
let storedSettings = {};
let activeProvider = DEFAULT_PROVIDER;

toggleConfig.addEventListener('click', () => {
  const isHidden = configContent.classList.toggle('hidden');
  configChevron.classList.toggle('rotate-180', !isHidden);
});

// Load settings and presets on startup
chrome.storage.local.get(['aiProvider', 'geminiApiKey', 'openaiApiKey', 'googleScriptUrl', 'geminiModel', 'openaiModel', 'userPresets'], (data) => {
  storedSettings = data;
  const provider = data.aiProvider || DEFAULT_PROVIDER;
  providerSelect.value = provider;
  syncProviderFields(provider);
  activeProvider = provider;

  const providerConfig = MODEL_PROVIDERS[provider];
  if (data[providerConfig.apiKeyStorageKey]) {
    configContent.classList.add('hidden');
    configChevron.classList.remove('rotate-180');
  } else {
    configContent.classList.remove('hidden');
    configChevron.classList.add('rotate-180');
  }
  if (data.googleScriptUrl) scriptUrlInput.value = data.googleScriptUrl;

  currentPresets = data.userPresets || DEFAULT_PRESETS;
  renderPresets(currentPresets);
});

providerSelect.addEventListener('change', () => {
  syncCurrentProviderInputs();
  syncProviderFields(providerSelect.value);
  activeProvider = providerSelect.value;
});

// Save global settings
saveConfigBtn.addEventListener('click', () => {
  const apiKey = apiKeyInput.value.trim();
  const scriptUrl = scriptUrlInput.value.trim();
  const model = modelInput.value.trim();
  const provider = providerSelect.value;
  const providerConfig = MODEL_PROVIDERS[provider];

  syncCurrentProviderInputs();

  chrome.storage.local.set({ 
    aiProvider: provider,
    [providerConfig.apiKeyStorageKey]: apiKey,
    googleScriptUrl: scriptUrl,
    [providerConfig.modelStorageKey]: model
  }, () => {
    updateStatus('已保存', 'bg-green-500 text-white');
    setTimeout(() => updateStatus('待机', 'bg-gray-200 text-gray-600'), 2000);
  });
});

function syncCurrentProviderInputs() {
  const provider = activeProvider;
  const providerConfig = MODEL_PROVIDERS[provider];
  storedSettings[providerConfig.apiKeyStorageKey] = apiKeyInput.value.trim();
  storedSettings[providerConfig.modelStorageKey] = modelInput.value.trim();
  storedSettings.googleScriptUrl = scriptUrlInput.value.trim();
  storedSettings.aiProvider = providerSelect.value;
}

function syncProviderFields(provider) {
  const providerConfig = MODEL_PROVIDERS[provider] || MODEL_PROVIDERS.gemini;
  apiKeyLabel.textContent = `${providerConfig.name} API 密钥`;
  apiKeyInput.value = storedSettings[providerConfig.apiKeyStorageKey] || '';
  modelInput.value = storedSettings[providerConfig.modelStorageKey] || '';
  modelInput.placeholder = providerConfig.modelPlaceholder;
}

// Preset Management Logic
addPresetBtn.addEventListener('click', async () => {
  const name = newPresetName.value.trim();
  const sheetName = newPresetSheet.value.trim();
  const rawFields = newPresetFields.value.trim();
  
  if (!name || !rawFields) return alert('请输入名称和字段');

  const normalizedFields = rawFields
    .split(/[，,]/)
    .map(f => f.trim())
    .filter(f => f !== "")
    .join(', ');

  const { userPresets = DEFAULT_PRESETS } = await chrome.storage.local.get('userPresets');
  
  if (editingPresetId) {
    // Update existing
    currentPresets = userPresets.map(p => 
      p.id === editingPresetId ? { ...p, name, sheetName, fields: normalizedFields } : p
    );
    stopEditing();
  } else {
    // Add new
    const newPreset = { id: Date.now().toString(), name, sheetName, fields: normalizedFields };
    currentPresets = [...userPresets, newPreset];
  }

  await chrome.storage.local.set({ userPresets: currentPresets });
  clearPresetInputs();
  renderPresets(currentPresets);
});

cancelEditBtn.addEventListener('click', stopEditing);

// Export/Import Logic
exportBtn.addEventListener('click', async () => {
  const { userPresets = DEFAULT_PRESETS } = await chrome.storage.local.get('userPresets');
  const blob = new Blob([JSON.stringify(userPresets, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hardware-presets-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener('click', () => importInput.click());

importInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const importedPresets = JSON.parse(event.target.result);
      if (!Array.isArray(importedPresets)) throw new Error('无效的预设文件格式');

      const { userPresets = DEFAULT_PRESETS } = await chrome.storage.local.get('userPresets');
      
      const choice = confirm('导入成功！\n点击 [确定] 将导入的预设合并到当前列表。\n点击 [取消] 将替换整个预设列表。');
      
      let finalPresets;
      if (choice) {
        // Merge: Append with new IDs to prevent conflicts
        const newItems = importedPresets.map(p => ({ 
          ...p, 
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5) 
        }));
        finalPresets = [...userPresets, ...newItems];
      } else {
        finalPresets = importedPresets;
      }

      await chrome.storage.local.set({ userPresets: finalPresets });
      currentPresets = finalPresets;
      renderPresets(currentPresets);
      alert('预设导入完成！');
    } catch (err) {
      alert('导入失败: ' + err.message);
    }
    importInput.value = ''; // Reset input
  };
  reader.readAsText(file);
});

function startEditing(preset) {
  editingPresetId = preset.id;
  newPresetName.value = preset.name;
  newPresetSheet.value = preset.sheetName || '';
  newPresetFields.value = preset.fields;
  
  addPresetBtn.textContent = '更新预设';
  addPresetBtn.classList.replace('bg-indigo-50', 'bg-indigo-600');
  addPresetBtn.classList.replace('text-indigo-700', 'text-white');
  cancelEditBtn.classList.remove('hidden');
  
  configContent.classList.remove('hidden');
  configChevron.classList.add('rotate-180');
}

function stopEditing() {
  editingPresetId = null;
  clearPresetInputs();
  addPresetBtn.textContent = '添加新预设';
  addPresetBtn.classList.replace('bg-indigo-600', 'bg-indigo-50');
  addPresetBtn.classList.replace('text-white', 'text-indigo-700');
  cancelEditBtn.classList.add('hidden');
}

function clearPresetInputs() {
  newPresetName.value = '';
  newPresetSheet.value = '';
  newPresetFields.value = '';
}

async function deletePreset(id) {
  if (editingPresetId === id) stopEditing();
  const { userPresets = DEFAULT_PRESETS } = await chrome.storage.local.get('userPresets');
  currentPresets = userPresets.filter(p => p.id !== id);
  await chrome.storage.local.set({ userPresets: currentPresets });
  renderPresets(currentPresets);
}

function renderPresets(presets) {
  presetList.innerHTML = '';
  presetSelect.innerHTML = '';

  presets.forEach(preset => {
    // 1. Settings List Item
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between bg-white p-3 mb-2 rounded-lg border border-gray-200 shadow-sm transition-all hover:border-indigo-200';
    item.innerHTML = `
      <div class="flex-1 overflow-hidden mr-2">
        <div class="text-xs font-bold text-gray-800 truncate">${preset.name} ${preset.sheetName ? `<span class="text-indigo-500 ml-1">#${preset.sheetName}</span>` : ''}</div>
        <div class="text-[11px] text-gray-400 truncate mt-1 leading-tight">${preset.fields}</div>
      </div>
      <div class="flex gap-1">
        <button class="edit-btn flex items-center justify-center w-7 h-7 rounded-full text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer border-none bg-transparent" title="编辑预设">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="delete-btn flex items-center justify-center w-7 h-7 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer border-none bg-transparent" title="删除预设">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    `;
    item.querySelector('.edit-btn').onclick = () => startEditing(preset);
    item.querySelector('.delete-btn').onclick = () => deletePreset(preset.id);
    presetList.appendChild(item);

    // 2. Dropdown Option
    const opt = document.createElement('option');
    opt.value = preset.id;
    opt.textContent = preset.name;
    presetSelect.appendChild(opt);
  });
}

// Extraction Handler
runPresetBtn.addEventListener('click', () => {
  const selectedId = presetSelect.value;
  const preset = currentPresets.find(p => p.id === selectedId);
  if (preset) handleExtraction('preset', preset);
});

async function handleExtraction(type, presetObj) {
  const data = await chrome.storage.local.get(['aiProvider', 'geminiApiKey', 'openaiApiKey', 'googleScriptUrl', 'geminiModel', 'openaiModel']);
  const provider = data.aiProvider || DEFAULT_PROVIDER;
  const providerConfig = MODEL_PROVIDERS[provider] || MODEL_PROVIDERS.gemini;
  const apiKey = data[providerConfig.apiKeyStorageKey];
  
  if (!apiKey) {
    alert(`请先输入 ${providerConfig.name} API 密钥。`);
    return;
  }

  const selectedModel = data[providerConfig.modelStorageKey] || providerConfig.defaultModel;
  updateStatus('提取中...', 'bg-blue-500 text-white');
  resultsArea.textContent = `正在使用 ${selectedModel} 提取 ${presetObj.name}...`;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result: pageData }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });

    resultsArea.textContent = `正在发送至 ${providerConfig.name}...`;
    
    const systemPrompt = `你是一个专业的采购助手。
请从以下网页文本中提取产品数据。
仅返回有效的 JSON 格式。
如果可能，将本地货币转换为美元，或者保留原始符号。
URL: ${pageData.url}
Title: ${pageData.title}`;

    const userPrompt = `提取以下字段：${presetObj.fields}。
【重要约束】：
1. 必须使用我提供的字段名称作为 JSON 的键名（Key），不要翻译成英文。
2. 将提取到的具体内容翻译成中文。
3. 仅返回 JSON 格式，不要包含任何多余的解释文字。`;

    const aiResult = await callAiProvider(provider, apiKey, selectedModel, systemPrompt, pageData.text, userPrompt);
    let cleanedJson = parseAiJson(aiResult);
    
    if (Array.isArray(cleanedJson)) {
      cleanedJson = cleanedJson[0] || {};
    }
    
    resultsArea.textContent = JSON.stringify(cleanedJson, null, 2);

    if (googleScriptUrl) {
      updateStatus('保存至表格...', 'bg-purple-500 text-white');
      const businessHeaders = presetObj.fields.split(',').map(f => f.trim()).filter(f => f !== "");
      const metaHeaders = ["来源链接", "提取时间"];
      const allHeaders = [...businessHeaders, ...metaHeaders];
      
      const payload = {
        sheetName: presetObj.sheetName || '',
        headers: allHeaders
      };
      
      businessHeaders.forEach(h => {
        payload[h] = cleanedJson[h] || "N/A";
      });
      
      payload["来源链接"] = pageData.url;
      payload["提取时间"] = new Date().toLocaleString();
      
      await sendToGoogleScript(googleScriptUrl, payload);
      updateStatus('成功', 'bg-green-500 text-white');
    } else {
      updateStatus('完成 (未配置脚本链接)', 'bg-yellow-500 text-white');
    }

  } catch (error) {
    console.error(error);
    updateStatus('错误', 'bg-red-500 text-white');
    resultsArea.textContent = `错误: ${error.message}`;
  }
}

async function callGemini(apiKey, model, systemPrompt, contextText, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `${systemPrompt}\n\n上下文:\n${contextText}\n\n任务: ${userPrompt}`
        }]
      }]
    })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates[0].content.parts[0].text;
}

async function callOpenAI(apiKey, model, systemPrompt, contextText, userPrompt) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `上下文:\n${contextText}\n\n任务: ${userPrompt}`
        }
      ]
    })
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `OpenAI 请求失败 (${response.status})`);
  }
  return extractOpenAIText(data);
}

function extractOpenAIText(data) {
  if (data.output_text) return data.output_text;

  const message = data.output?.find(item => item.type === 'message');
  const textPart = message?.content?.find(part => part.type === 'output_text' || part.type === 'text');
  if (textPart?.text) return textPart.text;

  throw new Error('OpenAI 返回结果中没有可解析的文本内容');
}

async function callAiProvider(provider, apiKey, model, systemPrompt, contextText, userPrompt) {
  if (provider === 'openai') {
    return callOpenAI(apiKey, model, systemPrompt, contextText, userPrompt);
  }
  return callGemini(apiKey, model, systemPrompt, contextText, userPrompt);
}

function parseAiJson(text) {
  try {
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    throw new Error('AI 返回了无效的 JSON: ' + text);
  }
}

async function sendToGoogleScript(url, payload) {
  return await fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

function updateStatus(text, classes) {
  statusBadge.textContent = text;
  statusBadge.className = `status-badge ${classes}`;
}
