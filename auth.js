// auth.js – Supabase client & auth functions

const SUPABASE_URL = 'https://naxshjgtdnqhhqyowkbs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5heHNoamd0ZG5xaGhxeW93a2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTcwODMsImV4cCI6MjEwMDczMzA4M30._2MoWDqA45xo0u8N5XpopCzENdHYfuH0bUQZQj3rJ14';

function initSupabase() {
    try {
        const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window.shdrSupabase = client;    // ← make it globally available
        console.log('Supabase initialized');
        return true;
    } catch (error) {
        console.error('Supabase init failed:', error);
        return false;
    }
}

async function signIn(email, password) {
    const { data, error } = await window.shdrSupabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Use metadata stored during sign‑up – no DB call
    const meta = data.user.user_metadata || {};
    return {
        user: data.user,
        profile: {
            id: data.user.id,
            email: data.user.email,
            full_name: meta.full_name || 'User',
            role: meta.role || 'manager',
            phone: meta.phone || ''
        }
    };
}

async function signUp(email, password, fullName, role = 'manager') {
    const { data, error } = await window.shdrSupabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, role } }
    });
    if (error) throw error;

    if (data.session) {
        const meta = data.user.user_metadata || {};
        return {
            user: data.user,
            profile: {
                id: data.user.id,
                email: data.user.email,
                full_name: meta.full_name || fullName,
                role: meta.role || role,
                phone: meta.phone || ''
            },
            session: data.session
        };
    } else {
        return { user: data.user, needsConfirmation: true };
    }
}

async function signOut() {
    await window.shdrSupabase.auth.signOut();
}

async function getCurrentSession() {
    const { data: { session } } = await window.shdrSupabase.auth.getSession();
    return session;
}

async function restoreSession() {
    const { data: { session } } = await window.shdrSupabase.auth.getSession();
    if (session) {
        if (window.location.pathname.endsWith('login.html') || window.location.pathname === '/') {
            window.location.href = 'app.html';
        }
        return session;
    } else {
        if (window.location.pathname.endsWith('app.html')) {
            window.location.href = 'login.html';
        }
        return null;
    }
}
