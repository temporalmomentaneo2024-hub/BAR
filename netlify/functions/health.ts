import serverless from 'serverless-http';
import app from '../../server/app.ts';

const handlerBase = serverless(app);

export const handler = async (event: any, context: any) => {
  try {
    const fixedEvent = {
      ...event,
      path: '/api/health',
      httpMethod: 'GET',
      rawUrl: event.rawUrl?.replace(event.path || '', '/api/health')
    };
    const res = await handlerBase(fixedEvent, context);
    // Ensure required fields
    return {
      statusCode: res.statusCode || 200,
      headers: res.headers,
      body: typeof res.body === 'string' ? res.body : JSON.stringify(res.body ?? { ok: true })
    };
  } catch (err) {
    console.error('Health function error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno del servidor' })
    };
  }
};
