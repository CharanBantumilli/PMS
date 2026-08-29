import * as React from 'react';

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 24, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

// Stripe
export function StripeIcon({ size, ...props }: IconProps) {
  return base({
    size,
    ...props,
    children: (
      <path
        d="M13.5 10.3c0-.7.6-1 1.5-1 1.4 0 3.2.4 4.6 1.2V6.6c-1.5-.6-3-.9-4.6-.9-3.8 0-6.3 2-6.3 5.3 0 5.1 7 4.3 7 6.5 0 .8-.7 1.1-1.7 1.1-1.4 0-3.3-.6-4.8-1.4v4c1.7.7 3.4 1 4.8 1 3.9 0 6.6-1.9 6.6-5.3 0-5.5-7-4.5-7-6.6z"
        fill="#635BFF"
      />
    ),
  });
}

// WhatsApp
export function WhatsAppIcon({ size, ...props }: IconProps) {
  return base({
    size,
    ...props,
    children: (
      <g>
        <path
          d="M17.5 14.4c-.3-.1-1.7-.8-1.9-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-1 1.1-.2.2-.4.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.8-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.3 0-.5-.1-.1-.7-1.6-1-2.2-.3-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3z"
          fill="#25D366"
        />
        <path
          d="M20.5 3.5C18.3 1.2 15.3 0 12.2 0 5.5 0 0 5.5 0 12.2c0 2.1.6 4.2 1.6 6L0 24l5.9-1.5c1.7.9 3.7 1.4 5.7 1.4h.1c6.7 0 12.2-5.5 12.2-12.2 0-3.3-1.3-6.3-3.4-8.4zm-8.3 18.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.5.9 1-3.4-.2-.4c-1-1.6-1.5-3.4-1.5-5.3 0-5.5 4.5-9.9 9.9-9.9 2.7 0 5.1 1 7 2.9 1.9 1.9 2.9 4.3 2.9 7-.1 5.4-4.5 9.8-10.2 9.8z"
          fill="#25D366"
        />
      </g>
    ),
  });
}

// Twilio
export function TwilioIcon({ size, ...props }: IconProps) {
  return base({
    size,
    ...props,
    children: (
      <g fill="#F22F46">
        <circle cx="12" cy="12" r="9" />
        <circle cx="16.5" cy="12" r="3" fill="#fff" />
        <circle cx="9" cy="9" r="2" fill="#fff" />
        <circle cx="9" cy="15" r="2" fill="#fff" />
        <circle cx="6" cy="12" r="1.2" fill="#fff" />
      </g>
    ),
  });
}

// SMTP / Email
export function EmailIcon({ size, ...props }: IconProps) {
  return base({
    size,
    ...props,
    children: (
      <g>
        <rect x="3" y="5" width="18" height="14" rx="2" fill="#3B82F6" />
        <path d="M3 7l9 6 9-6" stroke="#fff" strokeWidth="1.5" fill="none" />
      </g>
    ),
  });
}

// QuickBooks
export function QuickBooksIcon({ size, ...props }: IconProps) {
  return base({
    size,
    ...props,
    children: (
      <g>
        <circle cx="12" cy="12" r="10" fill="#2CA01C" />
        <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#fff" fontFamily="Arial">QB</text>
      </g>
    ),
  });
}

// Xero
export function XeroIcon({ size, ...props }: IconProps) {
  return base({
    size,
    ...props,
    children: (
      <g>
        <circle cx="12" cy="12" r="10" fill="#13B5EA" />
        <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#fff" fontFamily="Arial">x</text>
      </g>
    ),
  });
}

// Slack
export function SlackIcon({ size, ...props }: IconProps) {
  return base({
    size,
    ...props,
    children: (
      <g>
        <rect x="3" y="10" width="6" height="3" rx="1.5" fill="#E01E5A" />
        <rect x="10" y="3" width="3" height="6" rx="1.5" fill="#36C5F0" />
        <rect x="15" y="11" width="6" height="3" rx="1.5" fill="#2EB67D" />
        <rect x="11" y="15" width="3" height="6" rx="1.5" fill="#ECB22E" />
        <rect x="3" y="13" width="3" height="6" rx="1.5" fill="#36C5F0" transform="rotate(90 4.5 16)" />
      </g>
    ),
  });
}

// Zapier
export function ZapierIcon({ size, ...props }: IconProps) {
  return base({
    size,
    ...props,
    children: (
      <g>
        <path d="M12 2L8 8h8l-4-6zm0 14l-4 6h8l-4-6z" fill="#FF4A00" />
        <circle cx="12" cy="12" r="3" fill="#FF4A00" />
        <path d="M2 12l6-4v8L2 12zm14-4l6 4-6 4V8z" fill="#FF4A00" />
      </g>
    ),
  });
}

// Booking.com
export function BookingComIcon({ size, ...props }: IconProps) {
  return base({
    size,
    ...props,
    children: (
      <g>
        <rect x="2" y="4" width="20" height="16" rx="3" fill="#003580" />
        <text x="12" y="15" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#fff" fontFamily="Arial">B.</text>
        <circle cx="18" cy="8" r="1.5" fill="#FFB700" />
      </g>
    ),
  });
}

// Airbnb
export function AirbnbIcon({ size, ...props }: IconProps) {
  return base({
    size,
    ...props,
    children: (
      <g>
        <path
          d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8z"
          fill="#FF5A5F"
        />
        <path
          d="M12 6c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6-2.7-6-6-6zm0 10c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"
          fill="#FF5A5F"
        />
      </g>
    ),
  });
}

// Google (for potential future use)
export function GoogleIcon({ size, ...props }: IconProps) {
  return base({
    size,
    ...props,
    children: (
      <g>
        <path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4c-.2 1.3-1 2.4-2.1 3.1v2.6h3.4c2-1.8 3.1-4.5 3.1-7.5z" fill="#4285F4" />
        <path d="M12 22c2.7 0 5-1 6.7-2.5l-3.4-2.6c-.9.6-2.1 1-3.3 1-2.6 0-4.7-1.7-5.5-4.1H3v2.6C4.7 19.7 8.1 22 12 22z" fill="#34A853" />
        <path d="M6.5 13.8c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V7.6H3c-.7 1.3-1 2.8-1 4.4s.3 3.1 1 4.4l3.5-2.6z" fill="#FBBC05" />
        <path d="M12 5.5c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 2.7 14.7 2 12 2 8.1 2 4.7 4.3 3 7.6l3.5 2.6c.8-2.4 2.9-4.1 5.5-4.1z" fill="#EA4335" />
      </g>
    ),
  });
}

// Webhook
export function WebhookBrandIcon({ size, ...props }: IconProps) {
  return base({
    size,
    ...props,
    children: (
      <g>
        <circle cx="6" cy="18" r="3" fill="#10B981" />
        <circle cx="18" cy="18" r="3" fill="#10B981" />
        <circle cx="12" cy="6" r="3" fill="#10B981" />
        <path d="M6 18h12M6 18l6-12M18 18l-6-12" stroke="#10B981" strokeWidth="1.5" fill="none" />
      </g>
    ),
  });
}

// API Key
export function ApiKeyBrandIcon({ size, ...props }: IconProps) {
  return base({
    size,
    ...props,
    children: (
      <g>
        <circle cx="8" cy="15" r="4" fill="none" stroke="#F59E0B" strokeWidth="2" />
        <path d="M11 13l9-9m-2 7l-2 2m-2-4l-2 2" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" fill="none" />
      </g>
    ),
  });
}
