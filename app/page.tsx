export default function Home() {
  return (
    <main className="w-screen h-screen flex items-center justify-center bg-bg text-text-primary">
      <div className="text-center">
        <h1 className="text-2xl mb-4">FloodPulse</h1>
        <a href="/explore" className="underline text-text-secondary">
          Open explorer →
        </a>
      </div>
    </main>
  );
}
