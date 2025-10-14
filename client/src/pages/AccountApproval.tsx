import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const AccountApproval = () => {
  const location = useLocation();
  const { state } = location as { state?: { email?: string } };
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Account Created Successfully!
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Your rider account has been created and is pending approval.
          </p>
          {state?.email && (
            <p className="mt-2 text-sm text-gray-600">
              A verification email has been sent to <span className="font-medium">{state.email}</span>.
            </p>
          )}
          <div className="mt-6">
            <Link
              to="/login"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountApproval;
