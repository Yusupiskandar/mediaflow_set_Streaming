import { NextResponse } from 'next/server';
import { getCurrentUser, hashPassword } from '@/lib/auth';
import { getAllUsers, createUser, getUserByUsername, getAllSchedules } from '@/lib/db';
import { getAllLiveStreams } from '@/lib/stream';
import { isAccountExpired, parseExpiryInput } from '@/lib/subscription';

export async function GET() {
  try {
    const session = await getCurrentUser();
    
    // Hanya Admin (ID = 1) yang bisa mengakses
    if (!session || session.userId !== 1) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const liveStreams = getAllLiveStreams();
    const schedules = new Map(getAllSchedules().map((s) => [s.user_id, s]));
    const users = getAllUsers().map((user) => ({
      ...user,
      isExpired: isAccountExpired(user),
      // null = sedang tidak live
      live: liveStreams.get(user.id) ?? null,
      // Jadwal tanpa stream key: kapan mulai/berhenti otomatis.
      schedule: (() => {
        const s = schedules.get(user.id);
        return s && !s.last_error ? { startAt: s.start_at, stopAt: s.stop_at } : null;
      })(),
    }));
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Fetch users error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentUser();
    
    // Hanya Admin (ID = 1) yang bisa mengakses
    if (!session || session.userId !== 1) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { username, password, expiresAt } = await request.json();

    const expiry = parseExpiryInput(expiresAt);
    if (!expiry.ok) {
      return NextResponse.json({ error: expiry.error }, { status: 400 });
    }
    if (expiry.value && Date.parse(expiry.value) <= Date.now()) {
      return NextResponse.json({ error: 'Masa sewa harus di waktu yang akan datang' }, { status: 400 });
    }

    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password harus diisi' }, { status: 400 });
    }

    if (username.length < 3) {
      return NextResponse.json({ error: 'Username minimal 3 karakter' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 });
    }

    const existingUser = getUserByUsername(username);
    if (existingUser) {
      return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const userId = createUser(username, passwordHash, expiry.value);

    return NextResponse.json({ message: 'User berhasil dibuat', user: { id: userId, username } });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
