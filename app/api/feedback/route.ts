import { put } from '@vercel/blob';

export const runtime = 'nodejs';

type Feedback = { id: string; helpful: string; ease: number; again: string; changes: string; email: string; website: string };

function validate(value: unknown): value is Feedback {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return typeof p.id === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(p.id)
    && typeof p.helpful === 'string' && ['Yes', 'Somewhat', 'No', 'Not tried yet'].includes(p.helpful)
    && Number.isInteger(p.ease) && (p.ease as number) >= 1 && (p.ease as number) <= 5
    && typeof p.again === 'string' && ['Yes', 'No'].includes(p.again)
    && typeof p.changes === 'string' && p.changes.length <= 2000
    && typeof p.email === 'string' && p.email.length <= 254
    && (!p.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))
    && typeof p.website === 'string';
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'Invalid origin' }, { status: 403 });
  if (Number(request.headers.get('content-length') || 0) > 8192) return Response.json({ error: 'Too large' }, { status: 413 });
  let payload: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 8192) return Response.json({ error: 'Too large' }, { status: 413 });
    payload = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (!validate(payload)) return Response.json({ error: 'Please check your answers' }, { status: 400 });
  if (payload.website) return Response.json({ ok: true });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: 'Feedback is temporarily unavailable. Please try again later.' }, { status: 503 });

  const record = {
    id: payload.id,
    helpful: payload.helpful,
    ease: payload.ease,
    again: payload.again,
    changes: payload.changes.trim(),
    email: payload.email.trim() || null,
    createdAt: new Date().toISOString(),
  };
  try {
    await put(`feedback/${payload.id}.json`, JSON.stringify(record), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error('Feedback storage failed', error);
    return Response.json({ error: 'Unable to save feedback. Please try again.' }, { status: 503 });
  }
}
