import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy route for CMS image uploads.
 *
 * Flow:
 *  1. Client sends file + folder via FormData to /api/cms-upload
 *  2. This route gets a presigned URL from the backend
 *  3. This route PUTs the file to R2 (server-side — no CORS issues)
 *  4. Returns the public URL to the client
 */

const API = process.env.NEXT_PUBLIC_API_URL!;

export async function POST(req: NextRequest) {
  try {
    // 1. Parse incoming form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'general';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 2. Forward auth token
    const authHeader = req.headers.get('authorization') ?? '';

    // 3. Get presigned URL from backend
    const presignedRes = await fetch(
      `${API}/api/admin/cms/upload-url?folder=${folder}&content_type=${encodeURIComponent(file.type)}`,
      {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!presignedRes.ok) {
      const err = await presignedRes.text();
      return NextResponse.json(
        { error: `Failed to get upload URL: ${presignedRes.status}`, details: err },
        { status: presignedRes.status },
      );
    }

    const { upload_url, url } = (await presignedRes.json()) as {
      upload_url: string;
      url: string;
    };

    // 4. Upload file to R2 via presigned URL (server-side — no CORS)
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const uploadRes = await fetch(upload_url, {
      method: 'PUT',
      body: fileBuffer,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return NextResponse.json(
        { error: `R2 upload failed: ${uploadRes.status}`, details: errText },
        { status: 502 },
      );
    }

    // 5. Return the public URL
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
