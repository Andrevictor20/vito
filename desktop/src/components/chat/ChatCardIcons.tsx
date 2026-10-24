export function CalIcon({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="5" width="18" height="16" rx="3" stroke={color} strokeWidth={2} />
      <path d="M8 3v4M16 3v4M3 10h18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

export function MailIcon({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="5" width="18" height="14" rx="3" stroke={color} strokeWidth={2} />
      <path d="M4 7.5l8 6 8-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RadarIcon({ color = 'currentColor', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth={2} />
      <circle cx="12" cy="12" r="5" stroke={color} strokeWidth={2} />
      <circle cx="12" cy="12" r="1" stroke={color} strokeWidth={2} />
    </svg>
  );
}

export function CheckCircleIcon({ color = 'currentColor', size = 22 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth={2.4} />
      <path d="M8 12.5l3 3 5-6" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WhatsAppGlyph({ color = 'currentColor', size = 24 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2a10 10 0 0 0-8.600 15.100L2 22l5-1.300A10 10 0 1 0 12 2zm0 18.200c-1.500 0-2.900-.4-4.100-1.200l-.3-.2-3 .8.8-2.900-.2-.3A8.200 8.200 0 1 1 12 20.200zm4.500-6.100c-.2-.1-1.500-.7-1.700-.8-.2-.1-.4-.1-.6.100l-.8 1c-.1.200-.3.200-.5.100-1.400-.7-2.400-1.300-3.300-2.900-.2-.3.2-.3.700-1.100.1-.2 0-.3 0-.5l-.8-1.800c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.100-.7.300-.8.800-1 1.700-.9 2.700.2 1.100.7 2.100 1.400 3 1.200 1.700 2.700 2.800 4.500 3.500 1.600.6 2.200.5 3 .4.900-.1 1.800-.8 2-1.500.2-.6.2-1.200.1-1.300-.1-.1-.2-.2-.5-.3z" />
    </svg>
  );
}
