import serverless from 'serverless-http';
import app from '../../server/app.ts';

const handlerBase = serverless(app);

export const handler = async (event: any, context: any) => {
  try {
    const fixedEvent = {
      ...event,
      path: '/api/login',
      httpMethod: 'POST',
      rawUrl: event.rawUrl?.replace(event.path || '', '/api/login'),
      body: event.body || ''
    };

    const res = await handlerBase(fixedEvent, context);
    return {
      statusCode: res.statusCode || 200,
      headers: res.headers,
      body: typeof res.body === 'string' ? res.body : JSON.stringify(res.body ?? {})
    };
  } catch (err) {
    console.error('Login function error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno del servidor' })
    };
  }
};
