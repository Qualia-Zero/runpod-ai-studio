import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5173;

const RUNPOD_GRAPHQL_URL = 'https://api.runpod.io/graphql';

app.use(cors());
app.use(express.json());
app.use(express.text({ type: ['text/plain', 'application/json'] }));

// Serve built frontend assets
app.use(express.static(path.join(__dirname, 'dist')));


// Unformatted RAW Terminal Logger Helper (No ANSI codes, no formatting, pure raw text)
function logRAW(message, detail = '') {
  const time = new Date().toISOString();
  const detailStr = detail ? ` (${detail})` : '';
  console.log(`[${time}] ${message}${detailStr}`);
}

// Request logging middleware - unformatted raw request processing output
app.use((req, res, next) => {
  const isPolling = req.path === '/api/heartbeat';
  if (isPolling) {
    return next();
  }
  const start = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      const duration = Date.now() - start;
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl || req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Fallback middleware to parse stringified JSON in request body (e.g. from sendBeacon)
app.use((req, res, next) => {
  if (typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch (err) {
      // Keep as string if not JSON
    }
  }
  next();
});

// Helper to normalize desiredStatus & status fields to standard status values
function normalizePodStatus(desiredStatus, currentStatus) {
  const statusStr = (desiredStatus || currentStatus || 'STOPPED').toUpperCase();
  if (statusStr === 'RUNNING') return 'RUNNING';
  if (statusStr === 'STARTING') return 'STARTING';
  if (statusStr === 'STOPPING') return 'STOPPING';
  if (statusStr === 'PAUSED') return 'PAUSED';
  if (['STOPPED', 'EXITED', 'TERMINATED'].includes(statusStr)) return 'STOPPED';
  return statusStr;
}

// Helper for RunPod REST v2 requests
async function executeRestV2(endpoint, method = 'GET', body = null, apiKey = '') {
  if (!apiKey) {
    throw new Error('API key is required for RunPod REST v2 requests');
  }

  const url = `https://api.runpod.io/v2${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const text = await response.text();

  if (!response.ok) {
    // 409 Conflict: action "start" is not valid for status "RUNNING" -> Treat as success
    if (response.status === 409) {
      return { status: 'RUNNING', desiredStatus: 'RUNNING' };
    }

    let detailMsg = '';
    try {
      const parsedErr = text ? JSON.parse(text) : {};
      detailMsg = parsedErr.detail || parsedErr.title || parsedErr.message || '';
    } catch (e) {
      detailMsg = text;
    }

    throw new Error(detailMsg || `RunPod REST v2 Error ${response.status}: ${response.statusText}`);
  }

  try {
    return text ? JSON.parse(text) : {};
  } catch (err) {
    return { raw: text };
  }
}

// Helper for RunPod GraphQL requests
async function executeGraphQL(query, variables = {}, apiKey = '') {
  if (!apiKey) {
    throw new Error('API key is required for RunPod GraphQL requests');
  }

  const response = await fetch(`${RUNPOD_GRAPHQL_URL}?api_key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new Error(`RunPod GraphQL HTTP Error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (result.errors && result.errors.length > 0) {
    throw new Error(result.errors[0].message || 'RunPod GraphQL query returned errors');
  }

  return result.data;
}

// 1. Generic GraphQL Proxy Endpoint
app.post('/api/runpod/graphql', async (req, res) => {
  const { apiKey, query, variables } = req.body || {};
  if (!apiKey || !query) {
    return res.status(400).json({ error: 'apiKey and query parameters are required' });
  }

  try {
    const data = await executeGraphQL(query, variables || {}, apiKey);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[Server API] GraphQL error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 2. GET /api/runpod/pods - List Pods (REST v2 with GraphQL fallback)
app.get('/api/runpod/pods', async (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const headerKey = authHeader.replace(/^Bearer\s+/i, '') || req.headers['x-api-key'];
  const apiKey = (req.query.apiKey || req.query.api_key || headerKey || '').trim();

  if (!apiKey) {
    return res.json({ success: true, pods: [], apiKeyProvided: false, simulated: false });
  }

  // Attempt REST v2 first

  try {
    const restData = await executeRestV2('/pods', 'GET', null, apiKey);
    const rawPods = Array.isArray(restData) ? restData : (restData.pods || restData.data || []);

    function cleanModelName(raw) {
      if (!raw) return '';
      let str = String(raw).trim();
      str = str.replace(/^(https?:\/\/)?(huggingface\.co|hf\.co)\//i, '');
      if (str.includes('/')) {
        const parts = str.split('/');
        str = parts[parts.length - 1];
      }
      return str;
    }

    function mapToOllamaTag(rawName) {
      if (!rawName) return 'dolphin-3.0-r1-mistral-24b';
      return String(rawName).trim();
    }

    const pods = await Promise.all(rawPods.map(async (pod) => {
      const desiredStatus = (pod.desiredStatus || pod.status || 'STOPPED').toUpperCase();
      const status = normalizePodStatus(desiredStatus, pod.status);
      let rawModelTag = pod.name || `Pod ${pod.id}`;

      if (status === 'RUNNING') {
        try {
          const tagsRes = await fetch(`https://${pod.id}-11434.proxy.runpod.net/api/tags`, { signal: AbortSignal.timeout(2000) });
          if (tagsRes.ok) {
            const tagsData = await tagsRes.json();
            if (tagsData.models && tagsData.models.length > 0) {
              rawModelTag = tagsData.models[0].name;
            } else {
              rawModelTag = pod.name || `Pod ${pod.id}`;
            }
          }
        } catch (e) {
          // ignore
        }
      }

      const modelTag = cleanModelName(rawModelTag);
      const cleanName = cleanModelName(pod.name) || `Pod ${pod.id}`;

      return {
        id: pod.id,
        name: cleanName,
        modelTag,
        rawModelTag,
        status,
        desiredStatus,
        gpuType: pod.gpuType || pod.gpus?.[0]?.id || pod.machine?.gpuDisplayName || 'NVIDIA GPU',
        cpuPercent: pod.runtime?.container?.cpuPercent || pod.cpuPercent || 0,
        memoryPercent: pod.runtime?.container?.memoryPercent || pod.memoryPercent || 0,
        uptimeInSeconds: pod.runtime?.uptimeInSeconds || pod.uptimeInSeconds || 0,
        imageName: pod.imageName || 'runpod/default',
        costPerHr: pod.costPerHr || pod.gpus?.[0]?.costPerHr || 0
      };
    }));

    return res.json({ success: true, pods, apiKeyProvided: true, simulated: false });
  } catch (restErr) {
    // Fallback to GraphQL query
    try {
      const query = `
        query {
          myself {
            pods {
              id
              name
              desiredStatus
              runtime {
                uptimeInSeconds
                container {
                  cpuPercent
                  memoryPercent
                }
              }
              imageName
              costPerHr
              gpus {
                id
              }
            }
          }
        }
      `;

      const data = await executeGraphQL(query, {}, apiKey);
      const rawPods = data?.myself?.pods || [];

      const pods = rawPods.map(pod => {
        const desiredStatus = (pod.desiredStatus || 'STOPPED').toUpperCase();
        return {
          id: pod.id,
          name: pod.name || `Pod ${pod.id}`,
          status: normalizePodStatus(desiredStatus),
          desiredStatus,
          gpuType: pod.gpus?.[0]?.id || 'NVIDIA GPU',
          cpuPercent: pod.runtime?.container?.cpuPercent || 0,
          memoryPercent: pod.runtime?.container?.memoryPercent || 0,
          uptimeInSeconds: pod.runtime?.uptimeInSeconds || 0,
          imageName: pod.imageName || 'runpod/default',
          costPerHr: pod.costPerHr || 0
        };
      });

      return res.json({ success: true, pods, apiKeyProvided: true, simulated: false });
    } catch (gqlErr) {
      return res.json({ success: false, pods: [], apiKeyProvided: true, simulated: false, error: gqlErr.message });
    }
  }
});

// 3. GET /api/runpod/pod/:id/status - Live Status for single Pod
app.get('/api/runpod/pod/:id/status', async (req, res) => {
  const podId = req.params.id;
  const authHeader = req.headers['authorization'] || '';
  const headerKey = authHeader.replace(/^Bearer\s+/i, '') || req.headers['x-api-key'];
  const apiKey = (req.query.apiKey || req.query.api_key || headerKey || '').trim();

  if (!podId) {
    return res.status(400).json({ error: 'podId is required' });
  }

  if (!apiKey) {
    return res.json({
      success: true,
      podId,
      status: 'KEY_REQUIRED',
      desiredStatus: 'KEY_REQUIRED',
      apiKeyProvided: false,
      simulated: false
    });
  }

  try {
    const restData = await executeRestV2(`/pods/${podId}`, 'GET', null, apiKey);
    const pod = restData.pod || restData;
    const desiredStatus = (pod.desiredStatus || pod.status || 'STOPPED').toUpperCase();
    const status = normalizePodStatus(desiredStatus, pod.status);

    return res.json({
      success: true,
      podId,
      status,
      desiredStatus,
      pod,
      apiKeyProvided: true,
      simulated: false
    });
  } catch (restErr) {
    try {
      const query = `
        query Pod($podId: String!) {
          pod(input: { podId: $podId }) {
            id
            name
            desiredStatus
            runtime {
              uptimeInSeconds
              container {
                cpuPercent
                memoryPercent
              }
            }
            imageName
            costPerHr
            gpus {
              id
            }
          }
        }
      `;
      const gqlData = await executeGraphQL(query, { podId }, apiKey);
      const pod = gqlData?.pod;
      const desiredStatus = (pod?.desiredStatus || 'STOPPED').toUpperCase();
      const status = normalizePodStatus(desiredStatus);

      return res.json({
        success: true,
        podId,
        status,
        desiredStatus,
        pod,
        apiKeyProvided: true,
        simulated: false
      });
    } catch (gqlErr) {
      return res.json({
        success: false,
        podId,
        status: 'STOPPED',
        desiredStatus: 'STOPPED',
        apiKeyProvided: true,
        error: gqlErr.message
      });
    }
  }
});

// 4. POST /api/runpod/pod/start - Start Pod endpoint
app.post('/api/runpod/pod/start', async (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const headerKey = authHeader.replace(/^Bearer\s+/i, '') || req.headers['x-api-key'];
  const apiKey = (req.body?.apiKey || req.query?.apiKey || headerKey || '').trim();
  const podId = req.body?.podId || req.body?.id;

  if (!podId) {
    return res.status(400).json({ error: 'podId is required' });
  }

  if (!apiKey) {
    return res.status(401).json({ error: 'API key is required' });
  }

  try {
    const restData = await executeRestV2(`/pods/${podId}/start`, 'POST', null, apiKey);
    const desiredStatus = (restData.desiredStatus || restData.status || 'RUNNING').toUpperCase();
    const status = normalizePodStatus(desiredStatus, restData.status);

    logRAW('SYS', `Start-Signal gesendet an Pod ${podId}`);
    return res.json({
      success: true,
      status,
      desiredStatus,
      podId,
      data: restData,
      simulated: false
    });
  } catch (restErr) {
    logRAW('WARN', `Start-Signal fehlgeschlagen für Pod ${podId}: ${restErr.message}`);
    return res.json({
      success: false,
      status: 'STOPPED',
      podId,
      simulated: false,
      error: restErr.message
    });
  }
});


// 5. POST /api/runpod/pod/stop & /api/runpod/pods/stop-all - Stop All Active Pods
async function stopAllActivePods(apiKey, res) {
  if (!apiKey) {
    return res.json({ success: true, status: 'STOPPED', simulated: false });
  }

  let runningPods = [];

  // 1. Try REST v2 to list pods
  try {
    const podsData = await executeRestV2('/pods', 'GET', null, apiKey);
    const rawPods = Array.isArray(podsData) ? podsData : (podsData.items || podsData.pods || []);
    runningPods = rawPods.filter(p => {
      const s = (p.desiredStatus || p.status || '').toUpperCase();
      return s === 'RUNNING' || s === 'STARTING' || s === 'PAUSED';
    }).map(p => ({ id: p.id, name: p.name || p.id }));
  } catch (restErr) {
    console.warn('[Stop-All] REST v2 fetch pods failed, trying GraphQL fallback:', restErr.message);
    try {
      const gqlData = await executeGraphQL(`
        query {
          myself {
            pods {
              id
              name
              desiredStatus
            }
          }
        }
      `, {}, apiKey);
      const rawPods = gqlData?.myself?.pods || [];
      runningPods = rawPods.filter(p => {
        const s = (p.desiredStatus || '').toUpperCase();
        return s === 'RUNNING' || s === 'STARTING' || s === 'PAUSED';
      }).map(p => ({ id: p.id, name: p.name || p.id }));
    } catch (gqlErr) {
      console.warn('[Stop-All] GraphQL fetch pods also failed:', gqlErr.message);
    }
  }

  if (runningPods.length === 0) {
    logRAW('SYS', 'Keine aktiven Pods zum Stoppen auf deinem Account gefunden.');
    return res.json({ success: true, status: 'STOPPED', message: 'Keine aktiven Pods gefunden.', stoppedCount: 0 });
  }

  let stoppedCount = 0;
  for (const p of runningPods) {
    let stopped = false;
    // Try REST v2 stop
    try {
      await executeRestV2(`/pods/${p.id}/stop`, 'POST', null, apiKey);
      stopped = true;
    } catch (e) {
      // Try GraphQL podStop mutation
      try {
        await executeGraphQL(`
          mutation PodStop($podId: String!) {
            podStop(input: { podId: $podId }) {
              id
              desiredStatus
            }
          }
        `, { podId: p.id }, apiKey);
        stopped = true;
      } catch (gqlStopErr) {
        logRAW('WARN', `Konnte Pod ${p.id} nicht stoppen: ${gqlStopErr.message}`);
      }
    }

    if (stopped) {
      logRAW('SYS', `Aktiver Pod "${p.name}" (${p.id}) wurde erfolgreich gestoppt.`);
      stoppedCount++;
    }
  }

  return res.json({ success: true, status: 'STOPPED', stoppedCount });
}

app.post('/api/runpod/pod/stop', async (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const headerKey = authHeader.replace(/^Bearer\s+/i, '') || req.headers['x-api-key'];
  const apiKey = (req.body?.apiKey || req.query?.apiKey || headerKey || '').trim();
  const podId = req.body?.podId || req.body?.id;

  if (!podId || podId === 'all' || podId === 'active') {
    return await stopAllActivePods(apiKey, res);
  }

  try {
    const restData = await executeRestV2(`/pods/${podId}/stop`, 'POST', null, apiKey);
    const desiredStatus = (restData.desiredStatus || restData.status || 'STOPPED').toUpperCase();
    const status = normalizePodStatus(desiredStatus, restData.status);

    return res.json({
      success: true,
      status,
      desiredStatus,
      podId,
      data: restData,
      simulated: false
    });
  } catch (restErr) {
    // Try GraphQL podStop mutation for single pod before stop-all fallback
    try {
      const gqlResult = await executeGraphQL(`
        mutation PodStop($podId: String!) {
          podStop(input: { podId: $podId }) {
            id
            desiredStatus
          }
        }
      `, { podId }, apiKey);
      return res.json({
        success: true,
        status: 'STOPPED',
        desiredStatus: 'STOPPED',
        podId,
        data: gqlResult,
        simulated: false
      });
    } catch (gqlErr) {
      return await stopAllActivePods(apiKey, res);
    }
  }
});

app.post('/api/runpod/pods/stop-all', async (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const headerKey = authHeader.replace(/^Bearer\s+/i, '') || req.headers['x-api-key'];
  const apiKey = (req.body?.apiKey || req.query?.apiKey || headerKey || '').trim();
  return await stopAllActivePods(apiKey, res);
});

// 5. POST /api/runpod/serverless/stream - Streaming completion endpoint for vLLM GPU Pods & Serverless
app.post('/api/runpod/serverless/stream', async (req, res) => {
  const { prompt, messages, model, temperature, maxTokens, apiKey, endpointId, podId, systemPrompt, completionMode } = req.body || {};

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const streamToken = (text) => {
    res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
  };

  const endStream = () => {
    res.write('data: [DONE]\n\n');
    res.end();
  };

  if (!apiKey || apiKey.trim() === '') {
    return endStream();
  }

  // 1. Direct GPU Pod Proxy Connection (Supports Ollama on 11434 and vLLM on 8000)
  try {
    const formattedMessages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...(messages && messages.length > 0
        ? messages.map(m => ({ role: m.role, content: m.content }))
        : [{ role: 'user', content: prompt }])
    ];

    let targetPodId = podId || null;

    // If no valid podId provided or initial check needed, try resolving active pods
    if (!targetPodId) {
      try {
        const podList = await executeRestV2('/pods', 'GET', null, apiKey);
        const running = (podList.items || []).find(p => p.status === 'RUNNING' || p.desiredStatus === 'RUNNING');
        if (running) targetPodId = running.id;
      } catch (e) {
        // ignore
      }
    }

    let lastErrorMsg = '';

    async function pullOllamaModelWithProgress(currentPodId, modelTag, streamToken) {
      try {
        const pullRes = await fetch(`https://${currentPodId}-11434.proxy.runpod.net/api/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: modelTag, stream: true })
        });

        if (pullRes.ok && pullRes.body) {
          const reader = pullRes.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';
          let lastPct = -1;

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const parsed = JSON.parse(line);
                if (parsed.total && parsed.completed) {
                  const pct = Math.round((parsed.completed / parsed.total) * 100);
                  if (pct % 25 === 0 && pct !== lastPct && pct > 0 && pct < 100) {
                    lastPct = pct;
                    streamToken(`⏳ *Download-Fortschritt (${modelTag}): ${pct}%* \n\n`);
                  }
                }
              } catch (e) {}
            }
          }
        }
      } catch (err) {
        console.warn('[Auto-pull] Streaming pull error:', err.message);
      }
    }

    const tryPodProxy = async (currentPodId) => {
      if (!currentPodId) return null;
      const ports = [11434, 8000];
      for (const port of ports) {
        try {
          let targetModel = model || 'vllm';

          if (port === 11434) {
            try {
              const tagsRes = await fetch(`https://${currentPodId}-11434.proxy.runpod.net/api/tags`);
              if (tagsRes.ok) {
                const tagsData = await tagsRes.json();
                if (tagsData.models && tagsData.models.length > 0) {
                  const reqModel = (model || '').trim();
                  const reqClean = reqModel.toLowerCase().replace(/[^a-z0-9]/g, '');
                  
                  // 1. Exact match
                  const exactMatch = tagsData.models.find(m => m.name === reqModel || m.model === reqModel);
                  if (exactMatch) {
                    targetModel = exactMatch.name;
                  } else {
                    // 2. Substring / normalized match
                    const subMatch = tagsData.models.find(m => {
                      const nameClean = m.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                      return nameClean.includes(reqClean) || reqClean.includes(nameClean);
                    });
                    targetModel = subMatch ? subMatch.name : tagsData.models[0].name;
                  }
                } else {
                  // No models loaded yet on this newly created Ollama pod!
                  const autoTag = mapToOllamaTag(model || currentPodId);
                  targetModel = autoTag;
                  streamToken(`⏳ *Initialisiere neuen Pod: Starte Download von \`${autoTag}\` auf den Pod... Bitte kurz gedulden.* \n\n`);
                  await pullOllamaModelWithProgress(currentPodId, autoTag, streamToken);
                }
              }
            } catch (tErr) {
              // Ignore tags lookup error
            }
          }

          const endpoints = completionMode && port === 11434
            ? [{ url: `https://${currentPodId}-${port}.proxy.runpod.net/api/generate`, type: 'ollama-generate' }]
            : [
                { url: `https://${currentPodId}-${port}.proxy.runpod.net/v1/chat/completions`, type: 'openai' },
                ...(port === 11434 ? [{ url: `https://${currentPodId}-${port}.proxy.runpod.net/api/chat`, type: 'ollama' }] : [])
              ];

          for (const ep of endpoints) {
            const payload = ep.type === 'openai' ? {
              model: targetModel,
              messages: formattedMessages,
              temperature: temperature ?? 0.7,
              max_tokens: maxTokens ?? 2048,
              stream: true
            } : ep.type === 'ollama-generate' ? {
              model: targetModel,
              prompt: (messages && messages.length > 0)
                ? messages.map(m => m.content).filter(Boolean).join('\n\n')
                : (prompt || ''),
              stream: true,
              raw: true,
              options: { temperature: temperature ?? 0.7, num_predict: maxTokens ?? 2048 }
            } : {
              model: targetModel,
              messages: formattedMessages,
              stream: true,
              options: { temperature: temperature ?? 0.7, num_predict: maxTokens ?? 2048 }
            };

            const res = await fetch(ep.url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify(payload)
            });

            if (res.ok && res.body) {
              return { res, type: ep.type };
            } else {
              const errText = await res.text().catch(() => '');
              lastErrorMsg = `HTTP ${res.status} ${res.statusText}${errText ? `: ${errText}` : ''}`;

              if (errText.toLowerCase().includes('not found') && port === 11434) {
                const autoTag = mapToOllamaTag(model || currentPodId);
                streamToken(`⏳ *Modell \`${autoTag}\` wird auf dem Pod installiert...* \n\n`);
                await pullOllamaModelWithProgress(currentPodId, autoTag, streamToken);
                
                const retryPayload = { ...payload, model: autoTag };
                const retryRes = await fetch(ep.url, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                  },
                  body: JSON.stringify(retryPayload)
                });
                if (retryRes.ok && retryRes.body) {
                  return { res: retryRes, type: ep.type };
                }
              }
            }
          }
        } catch (fetchErr) {
          lastErrorMsg = fetchErr.message;
        }
      }
      return null;
    };

    let proxyResult = await tryPodProxy(targetPodId);

    // If specified podId failed, try fetching current running pod from account as fallback
    if (!proxyResult && targetPodId) {
      try {
        const podList = await executeRestV2('/pods', 'GET', null, apiKey);
        const running = (podList.items || []).find(p => p.status === 'RUNNING' || p.desiredStatus === 'RUNNING');
        if (running && running.id !== targetPodId) {
          proxyResult = await tryPodProxy(running.id);
        }
      } catch (e) {
        // ignore fallback lookup error
      }
    }

    if (proxyResult && proxyResult.res && proxyResult.res.body) {
      const reader = proxyResult.res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed === 'data: [DONE]') {
            return endStream();
          }

          if (proxyResult.type === 'ollama' || proxyResult.type === 'ollama-generate') {
            try {
              const parsed = JSON.parse(trimmed);
              // /api/generate uses parsed.response, /api/chat uses parsed.message.content
              const chunk = parsed.response ?? parsed.message?.content;
              if (chunk) {
                streamToken(chunk);
              }
            } catch (e) {}
          } else {
            if (trimmed.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                const deltaContent = parsed.choices?.[0]?.delta?.content;
                if (deltaContent) {
                  streamToken(deltaContent);
                }
              } catch (pErr) {
                // Ignore line parse errors
              }
            }
          }
        }
      }
      return endStream();
    } else if (lastErrorMsg) {
      console.warn(`[Server API] GPU Pod request failed for ${podId}:`, lastErrorMsg);
      return endStream();
    }
  } catch (err) {
    console.warn(`[Server API] GPU Pod request failed for ${podId}:`, err.message);
    return endStream();
  }

  // 2. Serverless Endpoint Fallback Connection
  if (endpointId && endpointId.trim() !== '') {
    try {
      const url = `https://api.runpod.ai/v2/${endpointId}/runsync`;
      const payload = {
        input: {
          prompt,
          messages: messages?.length ? messages : undefined,
          system_prompt: systemPrompt,
          temperature,
          max_tokens: maxTokens,
          model
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errTxt = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} ${response.statusText}${errTxt ? `: ${errTxt}` : ''}`);
      }

      const result = await response.json();
      let textOutput = '';
      if (typeof result.output === 'string') {
        textOutput = result.output;
      } else if (Array.isArray(result.output)) {
        textOutput = result.output.map(o => typeof o === 'string' ? o : o.text || JSON.stringify(o)).join('');
      } else if (result.output?.choices?.[0]?.message?.content) {
        textOutput = result.output.choices[0].message.content;
      } else if (result.output?.text) {
        textOutput = result.output.text;
      } else {
        textOutput = JSON.stringify(result.output || result);
      }

      const words = textOutput.split(/(?<=\s)/);
      for (const word of words) {
        streamToken(word);
        await new Promise(r => setTimeout(r, 20));
      }
      return endStream();
    } catch (err) {
      console.warn('[Server API] Serverless request failed:', err.message);
      return endStream();
    }
  }

  // 3. No active Pod or Serverless Endpoint available
  console.warn('[Server API] No active GPU Pod or Serverless Endpoint reachable');
  endStream();
});

// Heartbeat endpoint to track UI activity
app.post('/api/heartbeat', (_req, res) => {
  res.json({ ok: true });
});


// 6. POST /api/shutdown - Graceful process exit on navigator.sendBeacon
app.post('/api/shutdown', (req, res) => {
  logRAW('SYS', 'Shutdown-Signal empfangen. Beende Prozess in 500ms...');
  res.json({ success: true, message: 'Server shutting down...' });
  setTimeout(() => {
    process.exit(0);
  }, 500);
});

// SPA Fallback: Return index.html for all non-API GET requests
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  }
  next();
});



app.listen(PORT, '0.0.0.0', () => {
  console.log(`[${new Date().toISOString()}] RunPod AI Studio server listening on http://localhost:${PORT}`);
});



