
import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {}

export const CoffeeIcon: React.FC<IconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10.5 2.25a2.25 2.25 0 0 0-2.25 2.25v10.5a2.25 2.25 0 0 0 2.25 2.25h3a2.25 2.25 0 0 0 2.25-2.25V4.5a2.25 2.25 0 0 0-2.25-2.25h-3Z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 3.75a.75.75 0 0 0 .75.75h.008a.75.75 0 0 0 .75-.75v-.008a.75.75 0 0 0-.75-.75h-.008a.75.75 0 0 0-.75.75v.008Z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M18.75 18a.75.75 0 0 0 .75.75h.008a.75.75 0 0 0 .75-.75v-.008a.75.75 0 0 0-.75-.75h-.008a.75.75 0 0 0-.75.75v.008Z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5.25 6.375a2.625 2.625 0 1 1 5.25 0 2.625 2.625 0 0 1-5.25 0ZM5.25 15.375a2.625 2.625 0 1 1 5.25 0 2.625 2.625 0 0 1-5.25 0Z"
    />
  </svg>
);
