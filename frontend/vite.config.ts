// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2025 Pierre Fitness Intelligence

/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { request as httpsRequest } from 'node:https'
import react from '@vitejs/plugin-react'

function wellnessRefreshPlugin() {
  return {
    name: 'wellness-refresh',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/wellness-refresh', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }
        res.setHeader('Content-Type', 'application/json')
        const script = resolve(__dirname, '..', 'garmin_data_extract', 'fetch_garmin_live.py')
        execFile('python', [script], { timeout: 120000, env: { ...process.env } }, (err, stdout, stderr) => {
          if (err) {
            res.statusCode = 500
            res.end(JSON.stringify({ ok: false, error: stderr || err.message, output: stdout }))
          } else {
            res.statusCode = 200
            res.end(JSON.stringify({ ok: true, output: stdout }))
          }
        })
      })
    },
  }
}

function wellnessChatPlugin() {
  return {
    name: 'wellness-chat',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/wellness-chat', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }))
          return
        }

        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString() })
        req.on('end', () => {
          try {
            const { messages, wellnessContext, model, stream } = JSON.parse(body)
            const geminiModel = model || process.env.PIERRE_LLM_DEFAULT_MODEL || 'gemini-2.5-flash'

            // Build system prompt from wellness context
            const ctx = wellnessContext || {}
            const systemPrompt = `Tu es Pierre, un coach sportif IA expert en VTT et perte de graisse.
Tu as accès aux données wellness Garmin de l'athlète. Réponds de façon concise, personnalisée et CONCRÈTE.
Utilise toujours des valeurs précises (bpm, kg, ml, kcal) quand possible.

## Contexte athlète
${ctx.profile || 'Homme, 51 ans, VTT électrique 30.5kg sans assistance, objectif perte de gras.'}

## Données du jour
${ctx.todaySummary || 'Pas de données disponibles.'}

## Dernière activité
${ctx.activitySummary || 'Pas d\'activité récente.'}

## Métriques
${ctx.metrics || 'Pas de métriques disponibles.'}

Réponds en français. Sois direct et concret.`

            const contents = [
              { role: 'user', parts: [{ text: systemPrompt }] },
              { role: 'model', parts: [{ text: 'Compris, je suis Pierre, ton coach sportif. Je suis prêt à analyser tes données et répondre à tes questions. Que veux-tu savoir ?' }] },
              ...(messages || []),
            ]

            if (stream) {
              // SSE streaming mode with auto-retry on rate limit (429)
              const urlPath = `/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${apiKey}`
              const payload = JSON.stringify({
                contents,
                generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
              })

              res.setHeader('Content-Type', 'text/event-stream')
              res.setHeader('Cache-Control', 'no-cache')
              res.setHeader('Connection', 'keep-alive')

              const MAX_RETRIES = 2
              let attempt = 0

              const doRequest = () => {
                attempt++
                const geminiReq = httpsRequest({
                  hostname: 'generativelanguage.googleapis.com',
                  path: urlPath,
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                }, (geminiRes) => {
                  if (geminiRes.statusCode === 429 && attempt <= MAX_RETRIES) {
                    // Rate limited - parse retry delay and auto-retry
                    let errData = ''
                    geminiRes.on('data', (chunk: Buffer) => { errData += chunk.toString() })
                    geminiRes.on('end', () => {
                      // Extract retry delay from error (default 20s)
                      const retryMatch = errData.match(/retry in (\d+(?:\.\d+)?)/)
                      const delaySec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 20
                      const waitMs = Math.min(delaySec * 1000, 30000)
                      // Notify client about the wait
                      const waitPayload = JSON.stringify({ candidates: [{ content: { parts: [{ text: `*Rate limit atteint, retry automatique dans ${delaySec}s...*\n\n` }] } }] })
                      res.write(`data: ${waitPayload}\n\n`)
                      setTimeout(doRequest, waitMs)
                    })
                    return
                  }
                  if (geminiRes.statusCode && geminiRes.statusCode >= 400) {
                    let errData = ''
                    geminiRes.on('data', (chunk: Buffer) => { errData += chunk.toString() })
                    geminiRes.on('end', () => {
                      let errMsg = `Gemini API error ${geminiRes.statusCode}`
                      try {
                        const parsed = JSON.parse(errData)
                        errMsg = parsed.error?.message || errMsg
                      } catch { /* use default */ }
                      const errorPayload = JSON.stringify({ candidates: [{ content: { parts: [{ text: `**Erreur modèle ${geminiModel}:** ${errMsg}` }] } }] })
                      res.write(`data: ${errorPayload}\n\n`)
                      res.end()
                    })
                    return
                  }
                  geminiRes.on('data', (chunk: Buffer) => {
                    res.write(chunk)
                  })
                  geminiRes.on('end', () => {
                    res.end()
                  })
                  geminiRes.on('error', () => {
                    res.end()
                  })
                })

                geminiReq.on('error', (err: Error) => {
                  const errorPayload = JSON.stringify({ candidates: [{ content: { parts: [{ text: `**Erreur connexion:** ${err.message}` }] } }] })
                  res.write(`data: ${errorPayload}\n\n`)
                  res.end()
                })

                geminiReq.write(payload)
                geminiReq.end()
              }

              doRequest()
            } else {
              // Non-streaming mode
              const urlPath = `/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`
              const payload = JSON.stringify({
                contents,
                generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
              })

              const geminiReq = httpsRequest({
                hostname: 'generativelanguage.googleapis.com',
                path: urlPath,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
              }, (geminiRes) => {
                let data = ''
                geminiRes.on('data', (chunk: Buffer) => { data += chunk.toString() })
                geminiRes.on('end', () => {
                  try {
                    const result = JSON.parse(data)
                    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || ''
                    res.setHeader('Content-Type', 'application/json')
                    res.statusCode = 200
                    res.end(JSON.stringify({ text }))
                  } catch {
                    res.statusCode = 500
                    res.end(JSON.stringify({ error: 'Failed to parse Gemini response' }))
                  }
                })
              })

              geminiReq.on('error', (err: Error) => {
                res.statusCode = 500
                res.end(JSON.stringify({ error: err.message }))
              })

              geminiReq.write(payload)
              geminiReq.end()
            }
          } catch {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Invalid JSON body' }))
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Use 127.0.0.1 (IPv4) to avoid IPv6 conflicts with other processes on the same port
  const backendUrl = env.VITE_BACKEND_URL || 'http://127.0.0.1:8081'

  // Disable proxy during E2E tests since Playwright mocks all API routes
  const isE2EMode = process.env.E2E_TEST === 'true'

  return {
    plugins: [react(), wellnessRefreshPlugin(), wellnessChatPlugin()],
    server: isE2EMode
      ? {}
      : {
          // Expose on LAN so mobile devices can access the app
          host: true,
          port: 5173,
          allowedHosts: true,
          proxy: {
            // Proxy backend OAuth endpoints but NOT /oauth-callback (frontend route)
            '/oauth': {
              target: backendUrl,
              changeOrigin: true,
              bypass: (req) => {
                // Don't proxy /oauth-callback - it's a frontend route
                if (req.url?.startsWith('/oauth-callback')) {
                  return req.url;
                }
                return undefined;
              },
            },
            '/api': {
              target: backendUrl,
              changeOrigin: true,
            },
            '/admin': {
              target: backendUrl,
              changeOrigin: true,
            },
            '/a2a': {
              target: backendUrl,
              changeOrigin: true,
            },
            '/ws': {
              target: backendUrl,
              ws: true,
              changeOrigin: true,
            },
          },
        },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['node_modules', 'e2e', 'dist'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html', 'lcov'],
        exclude: [
          'node_modules/',
          'src/test/',
          '**/*.test.{ts,tsx}',
          '**/*.config.{ts,js}',
          'dist/',
        ],
      },
      // CI-friendly configuration
      watch: false,
    },
  }
})
