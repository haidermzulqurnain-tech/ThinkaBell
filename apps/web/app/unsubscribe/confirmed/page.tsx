export default function UnsubscribeConfirmedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-sm border border-gray-200 rounded-lg p-8 text-center">
        <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Unsubscribed</h1>
        <p className="text-gray-600 mb-6">
          You have been removed from ThinkaBell deal alerts. You will no longer receive price drop notifications.
        </p>
        <a href="/" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition">
          Return to ThinkaBell
        </a>
      </div>
    </div>
  );
}
