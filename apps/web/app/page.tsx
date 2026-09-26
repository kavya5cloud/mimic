import Image from 'next/image';
import { AuthLinks } from '../components/AuthLinks';

export default function Home() {
  return (
    <main className="page">
      <section className="card">
        <Image className="logo" src="/logo.svg" alt="Mimic" width={54} height={54} priority />
        <h1>Learn it from the best.</h1>
        <p>Phase 1 foundation is live: shared contracts, Supabase auth, protected desktop session handoff, and a metered Vercel API boundary.</p>
        <AuthLinks />
        <p><code>Mimic</code> is being built in deliberate phases. Desktop guidance and voice begin in Phase 2.</p>
      </section>
    </main>
  );
}
