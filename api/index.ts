import app from '../server';

export default function handler(req: any, res: any) {
  // If the request URL was stripped during rewrite, ensure it retains the /api prefix
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return app(req, res);
}
