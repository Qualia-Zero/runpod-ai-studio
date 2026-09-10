/**
 * Runpod Service - API integration for Runpod Pod management and Serverless completions.
 * Communicates with local Express API server (/api/runpod/...) with client-side fallback simulation.
 */

const API_BASE_URL = '/api/runpod';

/**
 * Fetch list of pods from Express backend / Runpod API.
 * @param {string} [apiKey] 
 * @returns {Promise<{ pods: Array<Object>, apiKeyProvided: boolean, simulated: boolean }>}
 */
export async function fetchPods(apiKey = '') {
  try {
    const headers = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${API_BASE_URL}/pods${apiKey ? `?apiKey=${encodeURIComponent(apiKey)}` : ''}`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      pods: data.pods || [],
      apiKeyProvided: data.apiKeyProvided !== undefined ? data.apiKeyProvided : !!apiKey,
      simulated: !!data.simulated
    };
  } catch (error) {
    console.warn('[Runpod Service] fetchPods failed (Server offline):', error.message);
    return {
      pods: [],
      apiKeyProvided: !!apiKey,
      simulated: false,
      connectionError: true,
      error: error.message
    };
  }
}


/**
 * Stop a Runpod Pod instance.
 * @param {string} podId 
 * @param {string} apiKey 
 * @returns {Promise<{ success: boolean, status: string }>}
 */
export async function stopPod(podId, apiKey = '') {
  if (!podId) return stopAllPods(apiKey);

  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${API_BASE_URL}/pod/stop`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ podId, apiKey })
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();
    return { success: true, status: data.status || 'STOPPING' };
  } catch (error) {
    console.warn('[Runpod Service] stopPod request failed, falling back to simulated STOPPING:', error.message);
    return { success: true, status: 'STOPPING' };
  }
}

/**
 * Stop all active Runpod Pod instances on account.
 * @param {string} apiKey 
 * @returns {Promise<{ success: boolean, status: string, stoppedCount?: number }>}
 */
export async function stopAllPods(apiKey = '') {
  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${API_BASE_URL}/pod/stop`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ podId: 'all', apiKey })
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();
    return { success: true, status: data.status || 'STOPPED', stoppedCount: data.stoppedCount || 0 };
  } catch (error) {
    console.warn('[Runpod Service] stopAllPods request failed, falling back to simulated STOPPING:', error.message);
    return { success: true, status: 'STOPPING', stoppedCount: 0 };
  }
}


/**
 * Stream text completion from Express API (/api/runpod/serverless/stream) or local AI simulator fallback.
 * 
 * @param {Object} params 
 * @param {Function} onChunk - Callback(chunkText: string) when text arrives
 * @param {Function} onError - Callback(error: Error) on failure
 * @returns {Function} Abort function to cancel execution
 */
export function streamCompletion(params, onChunk, onError, onComplete) {
  const { prompt, messages = [], model, temperature, maxTokens, apiKey, endpointId, podId, systemPrompt, completionMode } = params;
  
  const controller = new AbortController();
  let isAborted = false;

  const abort = () => {
    isAborted = true;
    controller.abort();
  };

  const startStream = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/serverless/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          messages,
          model,
          temperature,
          maxTokens,
          apiKey,
          endpointId,
          podId,
          systemPrompt,
          completionMode
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (!isAborted) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete trailing line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (trimmed === 'data: [DONE]') {
            return;
          }

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.chunk && !isAborted) {
                onChunk(parsed.chunk);
              }
            } catch (parseErr) {
              // Plain text stream chunk fallback
              if (!isAborted) {
                onChunk(dataStr);
              }
            }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError' || isAborted) {
        return;
      }
      console.warn('[Runpod Service] Express streaming endpoint failed:', err.message);
      if (onError && typeof onError === 'function') {
        onError(err);
      }
    } finally {
      if (onComplete && typeof onComplete === 'function') {
        onComplete();
      }
    }
  };

  startStream();
  return abort;
}
