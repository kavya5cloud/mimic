import './globals.css';

export const metadata = { title: 'Mimic — Learn it from the best.', description: 'Learn software live, guided by experts.' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
