// src/app/not-found.tsx

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <h1 className="text-6xl font-bold text-gray-300">404</h1>
      <p className="text-gray-500 mt-4">Sayfa bulunamadı</p>
      <a
        href="/setup"
        className="mt-6 px-6 py-3 bg-green-600 text-white rounded-2xl font-semibold hover:bg-green-700 transition-colors"
      >
        Ana Sayfaya Dön
      </a>
    </div>
  );
}