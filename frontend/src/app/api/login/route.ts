import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { username, password } = await request.json();

  // Puxa do cofre .env (se não achar, usa um padrão de fallback)
  const envUser = process.env.ADMIN_USER;
  const envPass = process.env.ADMIN_PASS;

  if (username === envUser && password === envPass) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false }, { status: 401 });
}