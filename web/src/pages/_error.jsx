function Error({ statusCode }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-6xl font-bold text-slate-200 mb-4">{statusCode || 'Error'}</h1>
      <p className="text-lg font-medium text-slate-700 mb-2">
        {statusCode === 500
          ? 'Server error — please try again'
          : 'Something went wrong'}
      </p>
      <p className="text-sm text-slate-500 mb-6 max-w-md">
        If this keeps happening, the data might still be loading. Refresh the page.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
      >
        Refresh Page
      </button>
    </div>
  );
}

Error.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
