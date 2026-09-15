process.env.VERCEL = '1';

import app from '../server.ts';

export default function handler(req: any, res: any) {
  try {
    // 1. Extract requested path across all Vercel environments & rewrites
    let targetPath = '';

    if (req.query && req.query.all) {
      // Catch-all route api/[...all].ts
      const segments = Array.isArray(req.query.all) ? req.query.all : [req.query.all];
      targetPath = `/api/${segments.join('/')}`;
      delete req.query.all;
    } else if (req.query && req.query.__path) {
      // Vercel rewrite parameter
      const segments = Array.isArray(req.query.__path) ? req.query.__path : [req.query.__path];
      targetPath = `/api/${segments.join('/')}`;
      delete req.query.__path;
    } else {
      const forwardedUri = req.headers['x-forwarded-uri'];
      const realUrl = req.headers['x-real-url'];
      const rawUrl = req.url || '';

      if (typeof forwardedUri === 'string' && forwardedUri.startsWith('/api')) {
        targetPath = forwardedUri.split('?')[0];
      } else if (typeof realUrl === 'string' && realUrl.startsWith('/api')) {
        targetPath = realUrl.split('?')[0];
      } else if (rawUrl.startsWith('/api')) {
        targetPath = rawUrl.split('?')[0];
      } else {
        const cleanRaw = rawUrl.split('?')[0];
        targetPath = `/api${cleanRaw.startsWith('/') ? cleanRaw : `/${cleanRaw}`}`;
      }
    }

    // Clean multiple slashes and preserve query string
    targetPath = targetPath.replace(/\/+/g, '/');

    const searchParams = new URLSearchParams();
    if (req.query && typeof req.query === 'object') {
      for (const [k, v] of Object.entries(req.query)) {
        if (k !== 'all' && k !== '__path') {
          if (Array.isArray(v)) {
            v.forEach(val => searchParams.append(k, String(val)));
          } else if (v !== undefined) {
            searchParams.append(k, String(v));
          }
        }
      }
    }
    const queryString = searchParams.toString();
    const finalUrl = queryString ? `${targetPath}?${queryString}` : targetPath;

    req.url = finalUrl;
    req.originalUrl = finalUrl;

    // 2. Safe Body Handling: parse JSON string if pre-read by Vercel serverless gateway
    if (req.body && typeof req.body === 'string') {
      try {
        req.body = JSON.parse(req.body);
      } catch {
        // keep string if not valid JSON
      }
    }

    // 3. Delegate to Express application
    return app(req, res);
  } catch (err: any) {
    console.error('[Vercel API Gateway Fatal Error]:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'خطأ في بوابة خادم Vercel API',
        message: err?.message || String(err),
      });
    }
  }
}
