process.env.VERCEL = '1';

import app from '../server';

export default function handler(req: any, res: any) {
  try {
    // 1. Recover full requested URL if modified by Vercel rewrite or proxy
    const forwardedUri = req.headers['x-forwarded-uri'] as string | undefined;
    const matchedPath = req.headers['x-matched-path'] as string | undefined;

    if (forwardedUri && forwardedUri.startsWith('/api')) {
      req.url = forwardedUri;
    } else if (matchedPath && matchedPath.startsWith('/api')) {
      const query = req.url && req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      req.url = matchedPath + query;
    } else if (req.query && req.query.__path) {
      const pathParam = Array.isArray(req.query.__path) ? req.query.__path.join('/') : req.query.__path;
      const query = req.url && req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      req.url = `/api/${pathParam}${query}`;
    } else if (req.url && !req.url.startsWith('/api')) {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }

    // 2. Delegate directly to Express app
    return app(req, res);
  } catch (err: any) {
    console.error('[Vercel API Gateway Error]:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Vercel API Gateway Error',
        message: err?.message || String(err),
      });
    }
  }
}

