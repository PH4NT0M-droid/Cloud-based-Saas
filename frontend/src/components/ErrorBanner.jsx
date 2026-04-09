function ErrorBanner({ message }) {
  if (!message) {
    return null;
  }

  return <div className="rounded-md bg-red-50 p-3 text-sm font-medium text-red-700">{message}</div>;
}

export default ErrorBanner;
