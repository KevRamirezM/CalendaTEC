type IconProps = {
  className?: string;
  title?: string;
};

/** Official Google "G" mark (brand colors). */
export function GoogleCalendarIcon({ className, title = 'Google' }: IconProps) {
  return (
    <svg aria-hidden={title ? undefined : true} className={className} role="img" viewBox="0 0 24 24">
      {title ? <title>{title}</title> : null}
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

/** Official Apple logo. */
export function AppleCalendarIcon({ className, title = 'Apple' }: IconProps) {
  return (
    <svg aria-hidden={title ? undefined : true} className={className} role="img" viewBox="0 0 24 24">
      {title ? <title>{title}</title> : null}
      <path
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
        fill="#12141a"
      />
    </svg>
  );
}

/** Microsoft Outlook logo (Simple Icons). */
export function OutlookCalendarIcon({ className, title = 'Outlook' }: IconProps) {
  return (
    <svg aria-hidden={title ? undefined : true} className={className} role="img" viewBox="0 0 24 24">
      {title ? <title>{title}</title> : null}
      <path
        d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.55q0-.44.3-.75.3-.3.75-.3h12.9q.44 0 .75.3.3.3.3.75V10.85l1.24.72h.01q.1.07.18.18.07.12.07.25zm-6-8.25v3h3v-3zm0 4.5v3h3v-3zm0 4.5v1.83l3.05-1.83zm-5.25-9v3h3.75v-3zm0 4.5v3h3.75v-3zm0 4.5v2.03l2.41 1.5 1.34-.8v-2.73zM9 3.75V6h2l.13.01.12.04v-2.3zM5.98 15.98q.9 0 1.6-.3.7-.32 1.19-.86.48-.55.73-1.28.25-.74.25-1.61 0-.83-.25-1.55-.24-.71-.71-1.24t-1.15-.83q-.68-.3-1.55-.3-.92 0-1.64.3-.71.3-1.2.85-.5.54-.75 1.3-.25.74-.25 1.63 0 .85.26 1.56.26.72.74 1.23.48.52 1.17.81.69.3 1.56.3zM7.5 21h12.39L12 16.08V17q0 .41-.3.7-.29.3-.7.3H7.5zm15-.13v-7.24l-5.9 3.54Z"
        fill="#0078D4"
      />
    </svg>
  );
}

export function StepBrowserIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 64 48">
      <rect fill="#f3f1ec" height="40" rx="4" stroke="#12141a" strokeWidth="1.5" width="56" x="4" y="4" />
      <path d="M4 14h56" stroke="#12141a" strokeWidth="1.5" />
      <circle cx="12" cy="9" fill="#1b4dff" r="1.5" />
      <circle cx="17" cy="9" fill="#5c606a" r="1.5" />
      <circle cx="22" cy="9" fill="#5c606a" r="1.5" />
      <rect fill="#fff" height="6" rx="1" stroke="#b8b9bf" strokeWidth="1" width="28" x="18" y="22" />
      <path d="M22 25h20" stroke="#5c606a" strokeWidth="1" />
    </svg>
  );
}

export function StepSettingsIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 64 48">
      <rect fill="#f3f1ec" height="40" rx="4" stroke="#12141a" strokeWidth="1.5" width="56" x="4" y="4" />
      <circle cx="40" cy="16" fill="none" r="6" stroke="#1b4dff" strokeWidth="1.75" />
      <path
        d="M40 8v2.5M40 21.5V24M32.5 16H35M45 16h2.5M34.3 10.3l1.8 1.8M43.9 19.9l1.8 1.8M34.3 21.7l1.8-1.8M43.9 12.1l1.8-1.8"
        stroke="#1b4dff"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <path d="M12 20h18M12 26h14M12 32h16" stroke="#5c606a" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

export function StepFileIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 64 48">
      <rect fill="#f3f1ec" height="40" rx="4" stroke="#12141a" strokeWidth="1.5" width="56" x="4" y="4" />
      <path
        d="M22 12h12l8 8v16H22V12z"
        fill="#fff"
        stroke="#12141a"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path d="M34 12v8h8" stroke="#12141a" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M26 28h12M26 33h8" stroke="#1b4dff" strokeLinecap="round" strokeWidth="1.5" />
      <text fill="#1b4dff" fontFamily="IBM Plex Mono, monospace" fontSize="5" fontWeight="600" x="26" y="24">
        .ics
      </text>
    </svg>
  );
}

export function StepImportIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 64 48">
      <rect fill="#f3f1ec" height="40" rx="4" stroke="#12141a" strokeWidth="1.5" width="56" x="4" y="4" />
      <path d="M32 14v16" stroke="#1b4dff" strokeLinecap="round" strokeWidth="2" />
      <path d="M26 24l6 6 6-6" stroke="#1b4dff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M18 36h28" stroke="#12141a" strokeLinecap="round" strokeWidth="1.75" />
      <circle cx="46" cy="14" fill="#0f766e" r="5" />
      <path d="M43.5 14l1.75 1.75L48.5 12.5" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

export function StepPhoneIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 64 48">
      <rect fill="#f3f1ec" height="36" rx="5" stroke="#12141a" strokeWidth="1.5" width="20" x="14" y="6" />
      <rect fill="#fff" height="24" rx="1" stroke="#b8b9bf" strokeWidth="1" width="14" x="17" y="11" />
      <circle cx="24" cy="38" fill="#5c606a" r="1.5" />
      <path
        d="M40 14h10l6 6v14H40V14z"
        fill="#fff"
        stroke="#12141a"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path d="M50 14v6h6" stroke="#12141a" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M43 28h8" stroke="#1b4dff" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

export function StepMacIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 64 48">
      <rect fill="#f3f1ec" height="26" rx="3" stroke="#12141a" strokeWidth="1.5" width="40" x="12" y="8" />
      <path d="M12 28h40" stroke="#12141a" strokeWidth="1.5" />
      <path d="M24 38h16M32 28v10" stroke="#12141a" strokeLinecap="round" strokeWidth="1.5" />
      <circle cx="32" cy="18" fill="none" r="5" stroke="#ff3b30" strokeWidth="1.5" />
      <path d="M32 15v3l2 1.5" stroke="#12141a" strokeLinecap="round" strokeWidth="1.25" />
    </svg>
  );
}

export function StepCheckIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 64 48">
      <rect fill="#f3f1ec" height="40" rx="4" stroke="#12141a" strokeWidth="1.5" width="56" x="4" y="4" />
      <rect fill="#fff" height="22" rx="2" stroke="#12141a" strokeWidth="1.25" width="28" x="10" y="13" />
      <path d="M14 20h12M14 25h8M14 30h10" stroke="#b8b9bf" strokeLinecap="round" strokeWidth="1.25" />
      <circle cx="44" cy="24" fill="#0f766e" r="9" />
      <path d="M39.5 24l3 3 6-6.5" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}
