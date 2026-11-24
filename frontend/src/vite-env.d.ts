/// <reference types="vite/client" />

declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

interface GoogleCredentialResponse {
  credential: string;
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (config: { client_id: string; callback: (r: GoogleCredentialResponse) => void; ux_mode?: string }) => void;
        renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
        cancel: () => void;
      };
    };
  };
}
