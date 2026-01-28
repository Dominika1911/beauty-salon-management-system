import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';

import axiosInstance from './axios';
import { server } from '@/test/msw/server';

type AxiosLikeError = {
  response?: {
    status?: number;
  };
};

function isAxiosLikeError(e: unknown): e is AxiosLikeError {
  return typeof e === 'object' && e !== null;
}

async function expectAxiosRejectStatus<T>(p: Promise<T>, status: number) {
  try {
    await p;
    throw new Error(`Oczekiwano reject (status ${status}), ale promise się spełnił.`);
  } catch (err: unknown) {
    if (!isAxiosLikeError(err)) {
      throw err;
    }
    expect(err.response?.status).toBe(status);
    return err;
  }
}

describe('api/axios.ts – interceptory (CSRF, nagłówki, przekierowania 401/403)', () => {
  const originalLocation = window.location;

  let loc = new URL('http://localhost/');
  let assignMock: ReturnType<typeof vi.fn<(url: string) => void>>;

  function ustawSciezke(pathname: string) {
    loc = new URL(`http://localhost${pathname}`);
  }

  beforeEach(() => {
    document.cookie = 'csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';

    loc = new URL('http://localhost/');
    assignMock = vi.fn((next: string) => {
      loc = new URL(next, loc.href);
    });

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get href() {
          return loc.href;
        },
        get origin() {
          return loc.origin;
        },
        get pathname() {
          return loc.pathname;
        },
        assign: assignMock,
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    vi.clearAllMocks();
  });

  it('dokleja nagłówek X-CSRFToken z cookie i ustawia Content-Type: application/json dla zwykłego JSON', async () => {
    document.cookie = 'csrftoken=abc123; path=/';

    server.use(
      http.post('*/api/echo', async ({ request }) => {
        expect(request.headers.get('x-csrftoken')).toBe('abc123');

        const ct = request.headers.get('content-type') || '';
        expect(ct.toLowerCase()).toContain('application/json');

        const bodyText = await request.text();
        expect(JSON.parse(bodyText)).toEqual({ hello: 'world' });

        return HttpResponse.json({ ok: true }, { status: 200 });
      }),
    );

    const res = await axiosInstance.post('/echo', { hello: 'world' });
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true });
  });

  it('gdy NIE ma cookie csrftoken -> NIE dokleja nagłówka X-CSRFToken (gałąź getCookie=null)', async () => {
    server.use(
      http.post('*/api/no-csrf', ({ request }) => {
        expect(request.headers.get('x-csrftoken')).toBeNull();
        return HttpResponse.json({ ok: true }, { status: 200 });
      }),
    );

    const res = await axiosInstance.post('/no-csrf', { a: 1 });
    expect(res.status).toBe(200);
  });

  it('dla FormData NIE ustawia Content-Type: application/json (usuwa go w interceptorze)', async () => {
    const fd = new FormData();
    fd.append('file', new Blob(['hello'], { type: 'text/plain' }), 'hello.txt');

    server.use(
      http.post('*/api/upload', ({ request }) => {
        const ct = (request.headers.get('content-type') || '').toLowerCase();
        expect(ct).not.toContain('application/json');
        return HttpResponse.json({ ok: true }, { status: 200 });
      }),
    );

    const res = await axiosInstance.post('/upload', fd);
    expect(res.status).toBe(200);
  });

  it('na 401 przekierowuje na /login (dla endpointów nie-auth), jeśli nie jesteśmy na /login', async () => {
    ustawSciezke('/dashboard');

    server.use(http.get('*/api/protected', () => HttpResponse.json({}, { status: 401 })));

    await expectAxiosRejectStatus(axiosInstance.get('/protected'), 401);
    expect(assignMock).toHaveBeenCalledWith('/login');
  });

  it('na 401 NIE przekierowuje na /login, jeśli już jesteśmy na /login', async () => {
    ustawSciezke('/login');

    server.use(http.get('*/api/protected-2', () => HttpResponse.json({}, { status: 401 })));

    await expectAxiosRejectStatus(axiosInstance.get('/protected-2'), 401);
    expect(assignMock).not.toHaveBeenCalled();
  });

  it.each([
    ['/auth/status/'],
    ['/auth/login/'],
    ['/auth/logout/'],
    ['/auth/csrf/'],
  ])('na 401 NIE przekierowuje na /login dla endpointu auth: %s', async (path) => {
    ustawSciezke('/dashboard');

    server.use(http.get(`*/api${path}`, () => HttpResponse.json({}, { status: 401 })));

    await expectAxiosRejectStatus(axiosInstance.get(path.replace('/auth/', '/auth/')), 401);
    expect(assignMock).not.toHaveBeenCalled();
  });

  it('na 403 przekierowuje na /access-denied, jeśli nie jesteśmy na /access-denied', async () => {
    ustawSciezke('/dashboard');

    server.use(http.get('*/api/forbidden', () => HttpResponse.json({}, { status: 403 })));

    await expectAxiosRejectStatus(axiosInstance.get('/forbidden'), 403);
    expect(assignMock).toHaveBeenCalledWith('/access-denied');
  });

  it('na 403 NIE przekierowuje na /access-denied, jeśli już jesteśmy na /access-denied', async () => {
    ustawSciezke('/access-denied');

    server.use(http.get('*/api/forbidden-2', () => HttpResponse.json({}, { status: 403 })));

    await expectAxiosRejectStatus(axiosInstance.get('/forbidden-2'), 403);
    expect(assignMock).not.toHaveBeenCalled();
  });

  it('security: dwa równoległe błędy 401 powodują tylko jedno przekierowanie na /login', async () => {
    ustawSciezke('/dashboard');

    server.use(
      http.get('*/api/protected-a', () => HttpResponse.json({}, { status: 401 })),
      http.get('*/api/protected-b', () => HttpResponse.json({}, { status: 401 })),
    );

    const p1 = axiosInstance.get('/protected-a').catch((e: unknown) => e);
    const p2 = axiosInstance.get('/protected-b').catch((e: unknown) => e);

    const [e1, e2] = await Promise.all([p1, p2]);

    expect(isAxiosLikeError(e1) ? e1.response?.status : undefined).toBe(401);
    expect(isAxiosLikeError(e2) ? e2.response?.status : undefined).toBe(401);

    expect(assignMock).toHaveBeenCalledTimes(1);
    expect(assignMock).toHaveBeenCalledWith('/login');
  });

  it('security: 500 NIE powoduje przekierowania (ani /login ani /access-denied)', async () => {
    ustawSciezke('/dashboard');

    server.use(http.get('*/api/server-error', () => HttpResponse.json({}, { status: 500 })));

    await expectAxiosRejectStatus(axiosInstance.get('/server-error'), 500);
    expect(assignMock).not.toHaveBeenCalled();
  });
});
