import { NextResponse } from 'next/server';
import { getCurrentUser, hashPassword } from '@/lib/auth';
import { getAllUsers, createUser, getUserByUsername } from '@/lib/db';

export async function GET() {
  try {
    const session = await getCurrentUser();
    
    // Hanya Admin (ID = 1) yang bisa mengakses
    if (!session || session.userId !== 1) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const users = getAllUsers();
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

    const { username, password } = await request.json();

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
    const userId = createUser(username, passwordHash);

    return NextResponse.json({ message: 'User berhasil dibuat', user: { id: userId, username } });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
